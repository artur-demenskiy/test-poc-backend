import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebhookService } from '../webhooks/webhook.service';
import { ApiIntegrationService } from '../api-integrations/api-integration.service';
import { EtlService } from '../etl/etl.service';
import {
  IntegrationMetrics,
  IntegrationHealth,
} from '../interfaces/integration.interface';

/**
 * Integration monitoring service for health checks and metrics collection
 */
@Injectable()
export class IntegrationMonitorService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationMonitorService.name);
  private metrics: Map<string, IntegrationMetrics> = new Map();
  private healthStatus: Map<string, IntegrationHealth> = new Map();

  constructor(
    private readonly webhookService: WebhookService,
    private readonly apiIntegrationService: ApiIntegrationService,
    private readonly etlService: EtlService,
  ) {}

  /**
   * Initialize the service
   */
  async onModuleInit() {
    this.logger.log('Integration monitor service initialized');
  }

  /**
   * Get all integration metrics
   */
  getAllMetrics(): IntegrationMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics for specific integration
   */
  getMetrics(integrationId: string): IntegrationMetrics | null {
    return this.metrics.get(integrationId) || null;
  }

  /**
   * Get all integration health statuses
   */
  getAllHealthStatuses(): IntegrationHealth[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get health status for specific integration
   */
  getHealthStatus(integrationId: string): IntegrationHealth | null {
    return this.healthStatus.get(integrationId) || null;
  }

  /**
   * Perform health check for all integrations
   */
  async performHealthChecks(): Promise<IntegrationHealth[]> {
    this.logger.debug('Performing health checks for all integrations');

    const healthChecks: IntegrationHealth[] = [];

    // Check webhook health
    const webhooks = this.webhookService.getAllWebhooks();
    for (const webhook of webhooks) {
      const health = await this.checkWebhookHealth(webhook.id);
      healthChecks.push(health);
      this.healthStatus.set(webhook.id, health);
    }

    // Check API integration health
    const apiIntegrations = this.apiIntegrationService.getAllIntegrations();
    for (const integration of apiIntegrations) {
      const health = await this.checkApiIntegrationHealth(integration.id);
      healthChecks.push(health);
      this.healthStatus.set(integration.id, health);
    }

    // Check ETL pipeline health
    const etlPipelines = this.etlService.getAllPipelines();
    for (const pipeline of etlPipelines) {
      const health = await this.checkEtlPipelineHealth(pipeline.id);
      healthChecks.push(health);
      this.healthStatus.set(pipeline.id, health);
    }

    this.logger.log(`Completed health checks for ${healthChecks.length} integrations`);
    return healthChecks;
  }

  /**
   * Check webhook health
   */
  private async checkWebhookHealth(webhookId: string): Promise<IntegrationHealth> {
    try {
      const startTime = Date.now();
      const webhook = this.webhookService.getWebhook(webhookId);
      
      if (!webhook) {
        return {
          integrationId: webhookId,
          type: 'webhook',
          status: 'unhealthy',
          checkedAt: new Date(),
          error: 'Webhook not found',
        };
      }

      if (!webhook.active) {
        return {
          integrationId: webhookId,
          type: 'webhook',
          status: 'degraded',
          checkedAt: new Date(),
          error: 'Webhook is inactive',
        };
      }

      // In a real implementation, this would test the webhook endpoint
      const responseTime = Date.now() - startTime;

      return {
        integrationId: webhookId,
        type: 'webhook',
        status: 'healthy',
        checkedAt: new Date(),
        responseTime,
        details: {
          url: webhook.url,
          method: webhook.method,
          events: webhook.events.length,
        },
      };
    } catch (error) {
      return {
        integrationId: webhookId,
        type: 'webhook',
        status: 'unhealthy',
        checkedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check API integration health
   */
  private async checkApiIntegrationHealth(integrationId: string): Promise<IntegrationHealth> {
    try {
      const startTime = Date.now();
      const integration = this.apiIntegrationService.getIntegration(integrationId);
      
      if (!integration) {
        return {
          integrationId,
          type: 'api',
          status: 'unhealthy',
          checkedAt: new Date(),
          error: 'Integration not found',
        };
      }

      if (!integration.active) {
        return {
          integrationId,
          type: 'api',
          status: 'degraded',
          checkedAt: new Date(),
          error: 'Integration is inactive',
        };
      }

      // Test the API integration with a simple request
      try {
        await this.apiIntegrationService.makeRequest(integrationId, 'GET', '/health', undefined, {
          'User-Agent': 'NestJS-Integration-Monitor/1.0',
        });
        
        const responseTime = Date.now() - startTime;

        return {
          integrationId,
          type: 'api',
          status: 'healthy',
          checkedAt: new Date(),
          responseTime,
          details: {
            provider: integration.provider,
            baseUrl: integration.baseUrl,
            version: integration.version,
          },
        };
      } catch (error) {
        return {
          integrationId,
          type: 'api',
          status: 'unhealthy',
          checkedAt: new Date(),
          error: `API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } catch (error) {
      return {
        integrationId,
        type: 'api',
        status: 'unhealthy',
        checkedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check ETL pipeline health
   */
  private async checkEtlPipelineHealth(pipelineId: string): Promise<IntegrationHealth> {
    try {
      const startTime = Date.now();
      const pipeline = this.etlService.getPipeline(pipelineId);
      
      if (!pipeline) {
        return {
          integrationId: pipelineId,
          type: 'etl',
          status: 'unhealthy',
          checkedAt: new Date(),
          error: 'Pipeline not found',
        };
      }

      if (!pipeline.active) {
        return {
          integrationId: pipelineId,
          type: 'etl',
          status: 'degraded',
          checkedAt: new Date(),
          error: 'Pipeline is inactive',
        };
      }

      // Check pipeline statistics
      const stats = this.etlService.getPipelineStats(pipelineId);
      const responseTime = Date.now() - startTime;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let error: string | undefined;

      if (stats.totalExecutions > 0) {
        const errorRate = (stats.failedExecutions / stats.totalExecutions) * 100;
        
        if (errorRate > 20) {
          status = 'unhealthy';
          error = `High error rate: ${errorRate.toFixed(1)}%`;
        } else if (errorRate > 5) {
          status = 'degraded';
          error = `Elevated error rate: ${errorRate.toFixed(1)}%`;
        }
      }

      return {
        integrationId: pipelineId,
        type: 'etl',
        status,
        checkedAt: new Date(),
        responseTime,
        error,
        details: {
          name: pipeline.name,
          totalExecutions: stats.totalExecutions,
          successfulExecutions: stats.successfulExecutions,
          failedExecutions: stats.failedExecutions,
          averageDuration: stats.averageDuration,
        },
      };
    } catch (error) {
      return {
        integrationId: pipelineId,
        type: 'etl',
        status: 'unhealthy',
        checkedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update metrics for an integration
   */
  updateMetrics(integrationId: string, type: 'webhook' | 'api' | 'etl', metrics: Partial<IntegrationMetrics>): void {
    const existing = this.metrics.get(integrationId);
    const updated: IntegrationMetrics = {
      integrationId,
      type,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
      throughput: 0,
      timestamp: new Date(),
      ...existing,
      ...metrics,
    };

    this.metrics.set(integrationId, updated);
  }

  /**
   * Get system overview
   */
  getSystemOverview(): {
    totalIntegrations: number;
    healthyIntegrations: number;
    degradedIntegrations: number;
    unhealthyIntegrations: number;
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    lastHealthCheck: Date | null;
  } {
    const healthStatuses = this.getAllHealthStatuses();
    
    const healthy = healthStatuses.filter(h => h.status === 'healthy').length;
    const degraded = healthStatuses.filter(h => h.status === 'degraded').length;
    const unhealthy = healthStatuses.filter(h => h.status === 'unhealthy').length;
    
    let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthy > 0) {
      overallHealth = 'unhealthy';
    } else if (degraded > 0) {
      overallHealth = 'degraded';
    }

    const lastHealthCheck = healthStatuses.length > 0 
      ? new Date(Math.max(...healthStatuses.map(h => h.checkedAt.getTime())))
      : null;

    return {
      totalIntegrations: healthStatuses.length,
      healthyIntegrations: healthy,
      degradedIntegrations: degraded,
      unhealthyIntegrations: unhealthy,
      overallHealth,
      lastHealthCheck,
    };
  }

  /**
   * Get integration performance metrics
   */
  getPerformanceMetrics(integrationId: string, _timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): {
    averageResponseTime: number;
    throughput: number;
    errorRate: number;
    successRate: number;
  } {
    const metrics = this.getMetrics(integrationId);
    if (!metrics) {
      return {
        averageResponseTime: 0,
        throughput: 0,
        errorRate: 0,
        successRate: 0,
      };
    }

    const successRate = metrics.totalRequests > 0 
      ? (metrics.successfulRequests / metrics.totalRequests) * 100 
      : 0;

    return {
      averageResponseTime: metrics.averageResponseTime,
      throughput: metrics.throughput,
      errorRate: metrics.errorRate,
      successRate,
    };
  }

  /**
   * Clean up old metrics
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldMetrics(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const initialCount = this.metrics.size;
    for (const [id, metric] of this.metrics.entries()) {
      if (metric.timestamp < thirtyDaysAgo) {
        this.metrics.delete(id);
      }
    }
    const removedCount = initialCount - this.metrics.size;

    this.logger.log(`Cleaned up ${removedCount} old integration metrics`);
  }

  /**
   * Perform scheduled health checks
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledHealthChecks(): Promise<void> {
    try {
      await this.performHealthChecks();
      this.logger.debug('Scheduled health checks completed');
    } catch (error) {
      this.logger.error('Scheduled health checks failed', error);
    }
  }

  /**
   * Get integration alerts
   */
  getAlerts(): Array<{
    integrationId: string;
    type: 'webhook' | 'api' | 'etl';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
  }> {
    const alerts: Array<{
      integrationId: string;
      type: 'webhook' | 'api' | 'etl';
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      timestamp: Date;
    }> = [];

    const healthStatuses = this.getAllHealthStatuses();
    
    for (const health of healthStatuses) {
      if (health.status === 'unhealthy') {
        alerts.push({
          integrationId: health.integrationId,
          type: health.type as 'webhook' | 'api' | 'etl',
          severity: 'high',
          message: `Integration ${health.integrationId} is unhealthy: ${health.error}`,
          timestamp: health.checkedAt,
        });
      } else if (health.status === 'degraded') {
        alerts.push({
          integrationId: health.integrationId,
          type: health.type as 'webhook' | 'api' | 'etl',
          severity: 'medium',
          message: `Integration ${health.integrationId} is degraded: ${health.error}`,
          timestamp: health.checkedAt,
        });
      }
    }

    return alerts;
  }
}
