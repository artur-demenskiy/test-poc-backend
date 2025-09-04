import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Buffer } from 'buffer';
import {
  ApiIntegrationConfig,
  ApiAuthConfig,
  ApiRateLimitConfig,
} from '../interfaces/integration.interface';

/**
 * API integration service for managing third-party API integrations
 */
@Injectable()
export class ApiIntegrationService implements OnModuleInit {
  private readonly logger = new Logger(ApiIntegrationService.name);
  private integrations: Map<string, ApiIntegrationConfig> = new Map();
  private clients: Map<string, AxiosInstance> = new Map();
  private rateLimitCounters: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Initialize the service and load API integrations
   */
  async onModuleInit() {
    await this.loadIntegrations();
    this.logger.log('API integration service initialized');
  }

  /**
   * Load API integrations from external source
   */
  private async loadIntegrations(): Promise<void> {
    try {
      // In a real implementation, this would load from a database
      const defaultIntegrations: ApiIntegrationConfig[] = [
        {
          id: 'stripe',
          name: 'Stripe Payment API',
          provider: 'stripe',
          baseUrl: 'https://api.stripe.com/v1',
          version: '2023-10-16',
          auth: {
            type: 'api_key',
            apiKey: 'sk_test_your_stripe_secret_key',
          },
          rateLimit: {
            maxRequests: 100,
            windowMs: 60000,
            distributed: false,
          },
          timeout: 30000,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'github',
          name: 'GitHub API',
          provider: 'github',
          baseUrl: 'https://api.github.com',
          version: '2022-11-28',
          auth: {
            type: 'bearer',
            token: 'ghp_your_github_token',
          },
          rateLimit: {
            maxRequests: 5000,
            windowMs: 3600000,
            distributed: false,
          },
          timeout: 30000,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'slack',
          name: 'Slack API',
          provider: 'slack',
          baseUrl: 'https://slack.com/api',
          auth: {
            type: 'bearer',
            token: 'xoxb_your_slack_token',
          },
          rateLimit: {
            maxRequests: 50,
            windowMs: 60000,
            distributed: false,
          },
          timeout: 30000,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      this.integrations.clear();
      this.clients.clear();
      this.rateLimitCounters.clear();

      defaultIntegrations.forEach(integration => {
              this.integrations.set(integration.id, integration);
      this.createApiClient(integration);
    });

    this.logger.log(`Loaded ${this.integrations.size} API integrations`);
    } catch (error) {
      this.logger.error('Failed to load API integrations', error);
    }
  }

  /**
   * Create API client for an integration
   */
  private createApiClient(integration: ApiIntegrationConfig): void {
    const client = axios.create({
      baseURL: integration.baseUrl,
      timeout: integration.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NestJS-Integration-Service/1.0',
      },
    });

    // Add authentication interceptor
    client.interceptors.request.use(config => {
      this.addAuthHeaders(config, integration.auth);
      return config;
    });

    // Add rate limiting interceptor
    if (integration.rateLimit) {
      client.interceptors.request.use(async config => {
        await this.checkRateLimit(integration.id, integration.rateLimit);
        return config;
      });
    }

    // Add response logging interceptor
    client.interceptors.response.use(
      response => {
        this.logger.log(`API call successful: ${integration.name} ${response.config.method?.toUpperCase()} ${response.config.url}`);
        return response;
      },
      error => {
        this.logger.error(`API call failed: ${integration.name} ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error.message);
        return Promise.reject(error);
      }
    );

    this.clients.set(integration.id, client);
  }

  /**
   * Add authentication headers to request
   */
  private addAuthHeaders(config: AxiosRequestConfig, auth: ApiAuthConfig): void {
    switch (auth.type) {
      case 'api_key':
        if (auth.apiKey) {
          config.headers = {
            ...config.headers,
            'Authorization': `Bearer ${auth.apiKey}`,
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

      case 'basic':
        if (auth.username && auth.password) {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          config.headers = {
            ...config.headers,
            'Authorization': `Basic ${credentials}`,
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
   * Check rate limit for API integration
   */
  private async checkRateLimit(integrationId: string, rateLimit: ApiRateLimitConfig): Promise<void> {
    const counter = this.rateLimitCounters.get(integrationId);
    const now = Date.now();

    if (!counter || now > counter.resetTime) {
      // Reset counter
      this.rateLimitCounters.set(integrationId, {
        count: 1,
        resetTime: now + rateLimit.windowMs,
      });
      return;
    }

    if (counter.count >= rateLimit.maxRequests) {
      throw new Error(`Rate limit exceeded for integration: ${integrationId}`);
    }

    counter.count++;
  }

  /**
   * Make API request to integration
   */
  async makeRequest(
    integrationId: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    data?: any,
    params?: any
  ): Promise<AxiosResponse> {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    if (!integration.active) {
      throw new Error(`Integration is not active: ${integrationId}`);
    }

    const client = this.clients.get(integrationId);
    if (!client) {
      throw new Error(`API client not found for integration: ${integrationId}`);
    }

    const config: AxiosRequestConfig = {
      method,
      url: endpoint,
      data,
      params,
    };

    return client.request(config);
  }

  /**
   * Get integration configuration by ID
   */
  getIntegration(id: string): ApiIntegrationConfig | null {
    return this.integrations.get(id) || null;
  }

  /**
   * Get all integration configurations
   */
  getAllIntegrations(): ApiIntegrationConfig[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Create new API integration
   */
  async createIntegration(integration: Omit<ApiIntegrationConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = this.generateId();
    const newIntegration: ApiIntegrationConfig = {
      ...integration,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.integrations.set(id, newIntegration);
    this.createApiClient(newIntegration);
    this.logger.log(`Created API integration: ${newIntegration.name}`);
    return id;
  }

  /**
   * Update API integration
   */
  async updateIntegration(id: string, updates: Partial<ApiIntegrationConfig>): Promise<boolean> {
    const integration = this.integrations.get(id);
    if (!integration) {
      return false;
    }

    const updatedIntegration: ApiIntegrationConfig = {
      ...integration,
      ...updates,
      updatedAt: new Date(),
    };

    this.integrations.set(id, updatedIntegration);
    this.createApiClient(updatedIntegration);
    this.logger.log(`Updated API integration: ${updatedIntegration.name}`);
    return true;
  }

  /**
   * Delete API integration
   */
  async deleteIntegration(id: string): Promise<boolean> {
    const integration = this.integrations.get(id);
    if (!integration) {
      return false;
    }

    this.integrations.delete(id);
    this.clients.delete(id);
    this.rateLimitCounters.delete(id);
    this.logger.log(`Deleted API integration: ${integration.name}`);
    return true;
  }

  /**
   * Test API integration connectivity
   */
  async testIntegration(id: string): Promise<{ success: boolean; response?: any; error?: string }> {
    try {
      const integration = this.integrations.get(id);
      if (!integration) {
        return { success: false, error: 'Integration not found' };
      }

      // Make a simple test request (usually a health check endpoint)
      const response = await this.makeRequest(id, 'GET', '/health');
      return { success: true, response: response.data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get OAuth2 authorization URL
   */
  getOAuth2AuthUrl(integrationId: string, state?: string): string {
    const integration = this.integrations.get(integrationId);
    if (!integration || integration.auth.type !== 'oauth2') {
      throw new Error(`OAuth2 integration not found: ${integrationId}`);
    }

    const oauth2 = integration.auth.oauth2;
    if (!oauth2) {
      throw new Error(`OAuth2 configuration not found for integration: ${integrationId}`);
    }

    const params = new URLSearchParams({
      client_id: oauth2.clientId,
      redirect_uri: oauth2.redirectUri,
      response_type: 'code',
      scope: oauth2.scopes.join(' '),
      state: state || this.generateId(),
    });

    return `${oauth2.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange OAuth2 authorization code for access token
   */
  async exchangeOAuth2Code(integrationId: string, code: string): Promise<{ access_token: string; refresh_token?: string }> {
    const integration = this.integrations.get(integrationId);
    if (!integration || integration.auth.type !== 'oauth2') {
      throw new Error(`OAuth2 integration not found: ${integrationId}`);
    }

    const oauth2 = integration.auth.oauth2;
    if (!oauth2) {
      throw new Error(`OAuth2 configuration not found for integration: ${integrationId}`);
    }

    const response = await axios.post(oauth2.tokenUrl, {
      client_id: oauth2.clientId,
      client_secret: oauth2.clientSecret,
      code,
      redirect_uri: oauth2.redirectUri,
      grant_type: 'authorization_code',
    });

    return response.data;
  }

  /**
   * Get rate limit status for integration
   */
  getRateLimitStatus(integrationId: string): { count: number; limit: number; resetTime: Date } | null {
    const integration = this.integrations.get(integrationId);
    if (!integration || !integration.rateLimit) {
      return null;
    }

    const counter = this.rateLimitCounters.get(integrationId);
    if (!counter) {
      return {
        count: 0,
        limit: integration.rateLimit.maxRequests,
        resetTime: new Date(Date.now() + integration.rateLimit.windowMs),
      };
    }

    return {
      count: counter.count,
      limit: integration.rateLimit.maxRequests,
      resetTime: new Date(counter.resetTime),
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Refresh API integrations
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshIntegrations(): Promise<void> {
    try {
      await this.loadIntegrations();
      this.logger.log('API integrations refreshed');
    } catch (error) {
      this.logger.error('Failed to refresh API integrations', error);
    }
  }

  /**
   * Reset rate limit counters
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async resetRateLimitCounters(): Promise<void> {
    try {
      const now = Date.now();
      for (const [integrationId, counter] of this.rateLimitCounters.entries()) {
        if (now > counter.resetTime) {
          this.rateLimitCounters.delete(integrationId);
        }
      }
    } catch (error) {
      this.logger.error('Failed to reset rate limit counters', error);
    }
  }
}
