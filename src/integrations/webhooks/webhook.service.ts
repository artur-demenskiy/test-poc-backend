import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios, { AxiosRequestConfig } from 'axios';
import * as crypto from 'crypto';
import { Buffer } from 'buffer';
import {
  WebhookConfig,
  WebhookDelivery,
  WebhookAuth,
  WebhookRetryConfig,
} from '../interfaces/integration.interface';

/**
 * Webhook service for managing webhook configurations and deliveries
 */
@Injectable()
export class WebhookService implements OnModuleInit {
  private readonly logger = new Logger(WebhookService.name);
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveries: WebhookDelivery[] = [];

  /**
   * Initialize the service and load webhook configurations
   */
  async onModuleInit() {
    await this.loadWebhooks();
    this.logger.log('Webhook service initialized');
  }

  /**
   * Load webhook configurations from external source
   */
  private async loadWebhooks(): Promise<void> {
    try {
      // In a real implementation, this would load from a database
      const defaultWebhooks: WebhookConfig[] = [
        {
          id: 'user-registration',
          name: 'User Registration Webhook',
          url: 'https://api.example.com/webhooks/user-registration',
          method: 'POST',
          events: ['user.created', 'user.updated'],
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Source': 'nestjs-boilerplate',
          },
          auth: {
            type: 'bearer',
            token: 'webhook-secret-token',
          },
          retry: {
            maxAttempts: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            multiplier: 2,
            retryStatusCodes: [408, 429, 500, 502, 503, 504],
          },
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'order-notification',
          name: 'Order Notification Webhook',
          url: 'https://slack.com/api/chat.postMessage',
          method: 'POST',
          events: ['order.created', 'order.completed', 'order.cancelled'],
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer xoxb-your-slack-token',
          },
          auth: {
            type: 'bearer',
            token: 'xoxb-your-slack-token',
          },
          retry: {
            maxAttempts: 5,
            initialDelay: 2000,
            maxDelay: 30000,
            multiplier: 1.5,
            retryStatusCodes: [429, 500, 502, 503, 504],
          },
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      this.webhooks.clear();
      defaultWebhooks.forEach(webhook => {
              this.webhooks.set(webhook.id, webhook);
    });

    this.logger.log(`Loaded ${this.webhooks.size} webhook configurations`);
    } catch (error) {
      this.logger.error('Failed to load webhook configurations', error);
    }
  }

  /**
   * Trigger webhook delivery for a specific event
   */
  async triggerWebhook(event: string, payload: any): Promise<void> {
    try {
      const webhooks = this.getWebhooksForEvent(event);
      
      for (const webhook of webhooks) {
        if (!webhook.active) {
          continue;
        }

        await this.deliverWebhook(webhook, event, payload);
      }
    } catch (error) {
      this.logger.error(`Failed to trigger webhooks for event: ${event}`, error);
    }
  }

  /**
   * Deliver webhook to a specific endpoint
   */
  private async deliverWebhook(
    webhook: WebhookConfig,
    event: string,
    payload: any
  ): Promise<void> {
    const deliveryId = this.generateId();
    const attempt = 1;

    try {
      const requestConfig = this.buildRequestConfig(webhook, event, payload);

      const response = await axios(requestConfig);

      const delivery: WebhookDelivery = {
        id: deliveryId,
        webhookId: webhook.id,
        event,
        payload,
        statusCode: response.status,
        responseBody: response.data,
        attempt,
        deliveredAt: new Date(),
      };

      this.deliveries.push(delivery);
      this.logger.log(`Webhook delivered successfully: ${webhook.name} (${response.status})`);
    } catch (error) {
      await this.handleDeliveryError(webhook, event, payload, deliveryId, attempt, error);
    }
  }

  /**
   * Build HTTP request configuration for webhook delivery
   */
  private buildRequestConfig(
    webhook: WebhookConfig,
    event: string,
    payload: any
  ): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      method: webhook.method,
      url: webhook.url,
      headers: {
        ...webhook.headers,
        'X-Webhook-Event': event,
        'X-Webhook-Timestamp': Date.now().toString(),
      },
      timeout: 30000,
    };

    // Add authentication headers
    if (webhook.auth) {
      this.addAuthHeaders(config, webhook.auth);
    }

    // Add payload based on method
    if (webhook.method === 'GET') {
      config.params = payload;
    } else {
      config.data = payload;
    }

    return config;
  }

  /**
   * Add authentication headers to request configuration
   */
  private addAuthHeaders(config: AxiosRequestConfig, auth: WebhookAuth): void {
    switch (auth.type) {
      case 'basic':
        if (auth.username && auth.password) {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          config.headers = {
            ...config.headers,
            'Authorization': `Basic ${credentials}`,
          };
        }
        break;

      case 'bearer':
        if (auth.token) {
          config.headers = {
            ...config.headers,
            'Authorization': `Bearer ${auth.token}`,
          };
        }
        break;

      case 'hmac':
        if (auth.secret && config.data) {
          const signature = this.generateHmacSignature(config.data, auth.secret);
          config.headers = {
            ...config.headers,
            'X-Webhook-Signature': signature,
          };
        }
        break;

      case 'custom':
        if (auth.customHeaders) {
          config.headers = {
            ...config.headers,
            ...auth.customHeaders,
          };
        }
        break;
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateHmacSignature(payload: any, secret: string): string {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Handle webhook delivery error and schedule retry if needed
   */
  private async handleDeliveryError(
    webhook: WebhookConfig,
    event: string,
    payload: any,
    deliveryId: string,
    attempt: number,
    error: any
  ): Promise<void> {
    const delivery: WebhookDelivery = {
      id: deliveryId,
      webhookId: webhook.id,
      event,
      payload,
      statusCode: error.response?.status,
      responseBody: error.response?.data,
      error: error.message,
      attempt,
      deliveredAt: new Date(),
    };

    this.deliveries.push(delivery);

    // Check if retry is needed
    if (webhook.retry && attempt < webhook.retry.maxAttempts) {
      const shouldRetry = this.shouldRetryWebhook(error, webhook.retry);
      
      if (shouldRetry) {
        const nextRetryAt = this.calculateNextRetryTime(attempt, webhook.retry);
        delivery.nextRetryAt = nextRetryAt;

        // Schedule retry
        setTimeout(() => {
          this.retryWebhook(webhook, event, payload, deliveryId, attempt + 1);
        }, this.calculateRetryDelay(attempt, webhook.retry));
      }
    }

    this.logger.error(
      `Webhook delivery failed: ${webhook.name} (attempt ${attempt}/${webhook.retry?.maxAttempts || 1})`,
      error.message
    );
  }

  /**
   * Check if webhook should be retried based on error
   */
  private shouldRetryWebhook(error: any, retryConfig: WebhookRetryConfig): boolean {
    const statusCode = error.response?.status;
    return retryConfig.retryStatusCodes.includes(statusCode);
  }

  /**
   * Calculate retry delay based on attempt number
   */
  private calculateRetryDelay(attempt: number, retryConfig: WebhookRetryConfig): number {
    const delay = retryConfig.initialDelay * Math.pow(retryConfig.multiplier, attempt - 1);
    return Math.min(delay, retryConfig.maxDelay);
  }

  /**
   * Calculate next retry timestamp
   */
  private calculateNextRetryTime(attempt: number, retryConfig: WebhookRetryConfig): Date {
    const delay = this.calculateRetryDelay(attempt, retryConfig);
    return new Date(Date.now() + delay);
  }

  /**
   * Retry webhook delivery
   */
  private async retryWebhook(
    webhook: WebhookConfig,
    event: string,
    payload: any,
    deliveryId: string,
    attempt: number
  ): Promise<void> {
    try {
      const requestConfig = this.buildRequestConfig(webhook, event, payload);
      const response = await axios(requestConfig);

      // Update delivery record
      const delivery = this.deliveries.find(d => d.id === deliveryId);
      if (delivery) {
        delivery.statusCode = response.status;
        delivery.responseBody = response.data;
        delivery.attempt = attempt;
        delivery.deliveredAt = new Date();
        delivery.error = undefined;
        delivery.nextRetryAt = undefined;
      }

      this.logger.log(`Webhook retry successful: ${webhook.name} (attempt ${attempt})`);
    } catch (error) {
      await this.handleDeliveryError(webhook, event, payload, deliveryId, attempt, error);
    }
  }

  /**
   * Get webhooks configured for a specific event
   */
  private getWebhooksForEvent(event: string): WebhookConfig[] {
    return Array.from(this.webhooks.values()).filter(webhook =>
      webhook.events.includes(event)
    );
  }

  /**
   * Get all webhook configurations
   */
  getAllWebhooks(): WebhookConfig[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Get webhook configuration by ID
   */
  getWebhook(id: string): WebhookConfig | null {
    return this.webhooks.get(id) || null;
  }

  /**
   * Create new webhook configuration
   */
  async createWebhook(webhook: Omit<WebhookConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = this.generateId();
    const newWebhook: WebhookConfig = {
      ...webhook,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhooks.set(id, newWebhook);
    this.logger.log(`Created webhook: ${newWebhook.name}`);
    return id;
  }

  /**
   * Update webhook configuration
   */
  async updateWebhook(id: string, updates: Partial<WebhookConfig>): Promise<boolean> {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      return false;
    }

    const updatedWebhook: WebhookConfig = {
      ...webhook,
      ...updates,
      updatedAt: new Date(),
    };

    this.webhooks.set(id, updatedWebhook);
    this.logger.log(`Updated webhook: ${updatedWebhook.name}`);
    return true;
  }

  /**
   * Delete webhook configuration
   */
  async deleteWebhook(id: string): Promise<boolean> {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      return false;
    }

    this.webhooks.delete(id);
    this.logger.log(`Deleted webhook: ${webhook.name}`);
    return true;
  }

  /**
   * Get webhook delivery history
   */
  getDeliveryHistory(webhookId?: string, limit: number = 100): WebhookDelivery[] {
    let history = this.deliveries;

    if (webhookId) {
      history = history.filter(delivery => delivery.webhookId === webhookId);
    }

    return history
      .sort((a, b) => b.deliveredAt.getTime() - a.deliveredAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get webhook delivery statistics
   */
  getDeliveryStats(webhookId?: string): {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    averageResponseTime: number;
  } {
    let deliveries = this.deliveries;

    if (webhookId) {
      deliveries = deliveries.filter(delivery => delivery.webhookId === webhookId);
    }

    const total = deliveries.length;
    const successful = deliveries.filter(d => !d.error).length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    // Calculate average response time (simplified)
    const responseTimes = deliveries
      .filter(d => d.statusCode && d.statusCode >= 200 && d.statusCode < 300)
      .map(() => 100); // Placeholder for actual response time

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    return {
      total,
      successful,
      failed,
      successRate,
      averageResponseTime,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Refresh webhook configurations
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshWebhooks(): Promise<void> {
    try {
      await this.loadWebhooks();
      this.logger.log('Webhook configurations refreshed');
    } catch (error) {
      this.logger.error('Failed to refresh webhook configurations', error);
    }
  }

  /**
   * Clean up old delivery records
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldDeliveries(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const initialCount = this.deliveries.length;
      
      this.deliveries = this.deliveries.filter(
        delivery => delivery.deliveredAt > thirtyDaysAgo
      );

      const removedCount = initialCount - this.deliveries.length;
      if (removedCount > 0) {
        this.logger.log(`Cleaned up ${removedCount} old webhook delivery records`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old webhook deliveries', error);
    }
  }
}
