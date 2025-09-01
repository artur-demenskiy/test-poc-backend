import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ConfigurationEntry,
  ConfigurationType,
  ConfigurationHistory,
  ConfigurationFilters,
  ConfigurationResponse,
} from './interfaces/configuration.interface';

/**
 * Configuration service for managing dynamic application configuration
 */
@Injectable()
export class ConfigurationService implements OnModuleInit {
  private readonly logger = new Logger(ConfigurationService.name);
  private configurations: Map<string, ConfigurationEntry> = new Map();
  private configurationHistory: ConfigurationHistory[] = [];
  private lastUpdated: Date = new Date();

  /**
   * Initialize the service and load configurations
   */
  async onModuleInit() {
    await this.loadConfigurations();
    this.logger.log('Configuration service initialized');
  }

  /**
   * Load configurations from external source
   */
  private async loadConfigurations(): Promise<void> {
    try {
      // In a real implementation, this would load from a database or external service
      const defaultConfigs: ConfigurationEntry[] = [
        {
          key: 'app.name',
          value: 'NestJS Boilerplate',
          type: ConfigurationType.STRING,
          description: 'Application name',
          environment: 'all',
          sensitive: false,
          validation: {
            required: true,
            minLength: 1,
            maxLength: 100,
          },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
        {
          key: 'app.version',
          value: '1.0.0',
          type: ConfigurationType.STRING,
          description: 'Application version',
          environment: 'all',
          sensitive: false,
          validation: {
            required: true,
            pattern: '^\\d+\\.\\d+\\.\\d+$',
          },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
        {
          key: 'database.pool.size',
          value: 10,
          type: ConfigurationType.NUMBER,
          description: 'Database connection pool size',
          environment: 'all',
          sensitive: false,
          validation: {
            required: true,
            min: 1,
            max: 100,
          },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
        {
          key: 'cache.ttl',
          value: 3600,
          type: ConfigurationType.NUMBER,
          description: 'Default cache TTL in seconds',
          environment: 'all',
          sensitive: false,
          validation: {
            required: true,
            min: 60,
            max: 86400,
          },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
        {
          key: 'features.enableMetrics',
          value: true,
          type: ConfigurationType.BOOLEAN,
          description: 'Enable application metrics collection',
          environment: 'all',
          sensitive: false,
          validation: {
            required: true,
          },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
        {
          key: 'api.rateLimit',
          value: { windowMs: 900000, max: 100 },
          type: ConfigurationType.JSON,
          description: 'API rate limiting configuration',
          environment: 'all',
          sensitive: false,
          validation: {
            required: true,
            customValidator: value => {
              return (
                typeof value === 'object' &&
                typeof value.windowMs === 'number' &&
                typeof value.max === 'number'
              );
            },
          },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
      ];

      this.configurations.clear();
      defaultConfigs.forEach(config => {
        this.configurations.set(config.key, config);
      });

      this.lastUpdated = new Date();
      this.logger.log(`Loaded ${this.configurations.size} configurations`);
    } catch (error) {
      this.logger.error('Failed to load configurations', error);
    }
  }

  /**
   * Get configuration value by key
   */
  get<T = any>(key: string, environment?: string): T | null {
    const config = this.getConfiguration(key, environment);
    return config ? config.value : null;
  }

  /**
   * Get configuration entry by key
   */
  getConfiguration(key: string, environment?: string): ConfigurationEntry | null {
    // Try environment-specific configuration first
    if (environment) {
      const envKey = `${key}:${environment}`;
      const envConfig = this.configurations.get(envKey);
      if (envConfig) {
        return envConfig;
      }
    }

    // Fall back to global configuration
    return this.configurations.get(key) || null;
  }

  /**
   * Get all configurations with optional filtering
   */
  getAll(filters: ConfigurationFilters = {}): ConfigurationResponse {
    let entries = Array.from(this.configurations.values());

    // Apply filters
    if (filters.environment) {
      entries = entries.filter(
        config => config.environment === filters.environment || config.environment === 'all'
      );
    }

    if (filters.type) {
      entries = entries.filter(config => config.type === filters.type);
    }

    if (filters.sensitive !== undefined) {
      entries = entries.filter(config => config.sensitive === filters.sensitive);
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      entries = entries.filter(
        config =>
          config.key.toLowerCase().includes(searchTerm) ||
          config.description?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    const total = entries.length;
    const paginatedEntries = entries.slice(offset, offset + limit);

    return {
      entries: paginatedEntries,
      total,
      offset,
      limit,
      hasNext: offset + limit < total,
      hasPrevious: offset > 0,
    };
  }

  /**
   * Set configuration value
   */
  async set(
    key: string,
    value: any,
    environment?: string,
    updatedBy?: string,
    reason?: string
  ): Promise<boolean> {
    try {
      const configKey = environment ? `${key}:${environment}` : key;
      const existingConfig = this.configurations.get(configKey);

      // Validate the value
      const validationResult = this.validateConfiguration(key, value, existingConfig);
      if (!validationResult.valid) {
        this.logger.error(`Configuration validation failed for ${key}: ${validationResult.error}`);
        return false;
      }

      // Create or update configuration
      const config: ConfigurationEntry = {
        key: configKey,
        value,
        type: this.detectType(value),
        description: existingConfig?.description,
        environment: environment || 'all',
        sensitive: existingConfig?.sensitive || false,
        validation: existingConfig?.validation,
        metadata: existingConfig?.metadata || {},
        createdAt: existingConfig?.createdAt || new Date(),
        updatedAt: new Date(),
        version: (existingConfig?.version || 0) + 1,
      };

      // Store previous value for history
      const previousValue = existingConfig?.value;

      // Update configuration
      this.configurations.set(configKey, config);

      // Add to history
      this.addToHistory({
        id: this.generateId(),
        key: configKey,
        previousValue,
        newValue: value,
        environment,
        reason,
        updatedBy,
        updatedAt: new Date(),
        version: config.version,
      });

      this.logger.log(`Configuration updated: ${configKey}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to set configuration ${key}`, error);
      return false;
    }
  }

  /**
   * Delete configuration
   */
  async delete(key: string, environment?: string, updatedBy?: string): Promise<boolean> {
    try {
      const configKey = environment ? `${key}:${environment}` : key;
      const existingConfig = this.configurations.get(configKey);

      if (!existingConfig) {
        return false;
      }

      // Add to history before deletion
      this.addToHistory({
        id: this.generateId(),
        key: configKey,
        previousValue: existingConfig.value,
        newValue: null,
        environment,
        reason: 'Configuration deleted',
        updatedBy,
        updatedAt: new Date(),
        version: existingConfig.version + 1,
      });

      this.configurations.delete(configKey);
      this.logger.log(`Configuration deleted: ${configKey}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete configuration ${key}`, error);
      return false;
    }
  }

  /**
   * Get configuration history
   */
  getHistory(key?: string, limit: number = 50): ConfigurationHistory[] {
    let history = this.configurationHistory;

    if (key) {
      history = history.filter(entry => entry.key === key);
    }

    return history.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, limit);
  }

  /**
   * Validate configuration value
   */
  private validateConfiguration(
    _key: string,
    value: any,
    existingConfig?: ConfigurationEntry
  ): { valid: boolean; error?: string } {
    const validation = existingConfig?.validation;

    if (!validation) {
      return { valid: true };
    }

    // Check required
    if (validation.required && (value === null || value === undefined)) {
      return { valid: false, error: 'Value is required' };
    }

    // Check type-specific validations
    const type = this.detectType(value);

    if (type === ConfigurationType.NUMBER) {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return { valid: false, error: 'Value must be a number' };
      }

      if (validation.min !== undefined && numValue < validation.min) {
        return { valid: false, error: `Value must be >= ${validation.min}` };
      }

      if (validation.max !== undefined && numValue > validation.max) {
        return { valid: false, error: `Value must be <= ${validation.max}` };
      }
    }

    if (type === ConfigurationType.STRING) {
      const strValue = String(value);

      if (validation.minLength !== undefined && strValue.length < validation.minLength) {
        return { valid: false, error: `String length must be >= ${validation.minLength}` };
      }

      if (validation.maxLength !== undefined && strValue.length > validation.maxLength) {
        return { valid: false, error: `String length must be <= ${validation.maxLength}` };
      }

      if (validation.pattern && !new RegExp(validation.pattern).test(strValue)) {
        return { valid: false, error: 'String does not match required pattern' };
      }
    }

    if (validation.enum && !validation.enum.includes(value)) {
      return { valid: false, error: `Value must be one of: ${validation.enum.join(', ')}` };
    }

    if (validation.customValidator) {
      const customResult = validation.customValidator(value);
      if (customResult !== true) {
        return {
          valid: false,
          error: typeof customResult === 'string' ? customResult : 'Custom validation failed',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Detect configuration type from value
   */
  private detectType(value: any): ConfigurationType {
    if (typeof value === 'boolean') {
      return ConfigurationType.BOOLEAN;
    }

    if (typeof value === 'number') {
      return ConfigurationType.NUMBER;
    }

    if (Array.isArray(value)) {
      return ConfigurationType.ARRAY;
    }

    if (typeof value === 'object' && value !== null) {
      return ConfigurationType.JSON;
    }

    return ConfigurationType.STRING;
  }

  /**
   * Add entry to configuration history
   */
  private addToHistory(entry: ConfigurationHistory): void {
    this.configurationHistory.push(entry);

    // Keep only last 1000 entries to prevent memory issues
    if (this.configurationHistory.length > 1000) {
      this.configurationHistory = this.configurationHistory.slice(-1000);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Refresh configurations from external source
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshConfigurations(): Promise<void> {
    try {
      await this.loadConfigurations();
      this.logger.log('Configurations refreshed');
    } catch (error) {
      this.logger.error('Failed to refresh configurations', error);
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalConfigurations: number;
    environments: string[];
    lastUpdated: Date;
  } {
    const totalConfigurations = this.configurations.size;
    const environments = Array.from(
      new Set(
        Array.from(this.configurations.values())
          .map(config => config.environment)
          .filter(env => env !== 'all')
      )
    );

    return {
      totalConfigurations,
      environments,
      lastUpdated: this.lastUpdated,
    };
  }
}
