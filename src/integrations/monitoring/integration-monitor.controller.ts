import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { IntegrationMonitorService } from './integration-monitor.service';
import {
  IntegrationMetrics,
  IntegrationHealth,
} from '../interfaces/integration.interface';

/**
 * Integration monitoring controller for health checks and metrics
 */
@ApiTags('Integration Monitoring')
@Controller('monitoring')
export class IntegrationMonitorController {
  constructor(private readonly monitorService: IntegrationMonitorService) {}

  /**
   * Get all integration metrics
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Get all integration metrics' })
  @ApiResponse({ status: 200, description: 'List of integration metrics' })
  getAllMetrics(): IntegrationMetrics[] {
    return this.monitorService.getAllMetrics();
  }

  /**
   * Get metrics for specific integration
   */
  @Get('metrics/:integrationId')
  @ApiOperation({ summary: 'Get metrics for specific integration' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'Integration metrics' })
  @ApiResponse({ status: 404, description: 'Metrics not found' })
  getMetrics(@Param('integrationId') integrationId: string): IntegrationMetrics | null {
    return this.monitorService.getMetrics(integrationId);
  }

  /**
   * Get all integration health statuses
   */
  @Get('health')
  @ApiOperation({ summary: 'Get all integration health statuses' })
  @ApiResponse({ status: 200, description: 'List of integration health statuses' })
  getAllHealthStatuses(): IntegrationHealth[] {
    return this.monitorService.getAllHealthStatuses();
  }

  /**
   * Get health status for specific integration
   */
  @Get('health/:integrationId')
  @ApiOperation({ summary: 'Get health status for specific integration' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'Integration health status' })
  @ApiResponse({ status: 404, description: 'Health status not found' })
  getHealthStatus(@Param('integrationId') integrationId: string): IntegrationHealth | null {
    return this.monitorService.getHealthStatus(integrationId);
  }

  /**
   * Perform health checks for all integrations
   */
  @Get('health/check')
  @ApiOperation({ summary: 'Perform health checks for all integrations' })
  @ApiResponse({ status: 200, description: 'Health checks completed' })
  async performHealthChecks(): Promise<IntegrationHealth[]> {
    return await this.monitorService.performHealthChecks();
  }

  /**
   * Get system overview
   */
  @Get('overview')
  @ApiOperation({ summary: 'Get integration system overview' })
  @ApiResponse({ status: 200, description: 'System overview' })
  getSystemOverview(): {
    totalIntegrations: number;
    healthyIntegrations: number;
    degradedIntegrations: number;
    unhealthyIntegrations: number;
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    lastHealthCheck: Date | null;
  } {
    return this.monitorService.getSystemOverview();
  }

  /**
   * Get performance metrics for integration
   */
  @Get('performance/:integrationId')
  @ApiOperation({ summary: 'Get performance metrics for integration' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  @ApiQuery({ name: 'timeRange', required: false, description: 'Time range for metrics', enum: ['1h', '24h', '7d', '30d'] })
  @ApiResponse({ status: 200, description: 'Performance metrics' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  getPerformanceMetrics(
    @Param('integrationId') integrationId: string,
    @Query('timeRange') timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): {
    averageResponseTime: number;
    throughput: number;
    errorRate: number;
    successRate: number;
  } {
    return this.monitorService.getPerformanceMetrics(integrationId, timeRange);
  }

  /**
   * Get integration alerts
   */
  @Get('alerts')
  @ApiOperation({ summary: 'Get integration alerts' })
  @ApiResponse({ status: 200, description: 'List of integration alerts' })
  getAlerts(): Array<{
    integrationId: string;
    type: 'webhook' | 'api' | 'etl';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
  }> {
    return this.monitorService.getAlerts();
  }

  /**
   * Get health dashboard data
   */
  @Get('dashboard')
  @ApiOperation({ summary: 'Get health dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  getDashboardData(): {
    overview: {
      totalIntegrations: number;
      healthyIntegrations: number;
      degradedIntegrations: number;
      unhealthyIntegrations: number;
      overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    };
    alerts: Array<{
      integrationId: string;
      type: 'webhook' | 'api' | 'etl';
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      timestamp: Date;
    }>;
    recentMetrics: IntegrationMetrics[];
    healthStatuses: IntegrationHealth[];
  } {
    const overview = this.monitorService.getSystemOverview();
    const alerts = this.monitorService.getAlerts();
    const metrics = this.monitorService.getAllMetrics();
    const healthStatuses = this.monitorService.getAllHealthStatuses();

    // Get recent metrics (last 24 hours)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const recentMetrics = metrics.filter(m => m.timestamp > twentyFourHoursAgo);

    return {
      overview: {
        totalIntegrations: overview.totalIntegrations,
        healthyIntegrations: overview.healthyIntegrations,
        degradedIntegrations: overview.degradedIntegrations,
        unhealthyIntegrations: overview.unhealthyIntegrations,
        overallHealth: overview.overallHealth,
      },
      alerts,
      recentMetrics,
      healthStatuses,
    };
  }
}
