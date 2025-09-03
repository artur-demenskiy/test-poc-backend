import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import {
  EtlPipelineConfig,
  EtlSourceConfig,
  EtlTransformConfig,
  EtlDestinationConfig,
  EtlIncrementalConfig,
  EtlFilterCondition,
  EtlAggregationConfig,
} from '../interfaces/integration.interface';

/**
 * ETL pipeline execution result
 */
export interface EtlExecutionResult {
  pipelineId: string;
  executionId: string;
  status: 'success' | 'failed' | 'partial';
  recordsProcessed: number;
  recordsFailed: number;
  startTime: Date;
  endTime: Date;
  duration: number;
  error?: string;
  details?: Record<string, any>;
}

/**
 * ETL service for managing and executing ETL pipelines
 */
@Injectable()
export class EtlService implements OnModuleInit {
  private readonly logger = new Logger(EtlService.name);
  private pipelines: Map<string, EtlPipelineConfig> = new Map();
  private executions: EtlExecutionResult[] = [];

  /**
   * Initialize the service and load ETL pipeline configurations
   */
  async onModuleInit() {
    await this.loadPipelines();
    this.logger.log('ETL service initialized');
  }

  /**
   * Load ETL pipeline configurations from external source
   */
  private async loadPipelines(): Promise<void> {
    try {
      // In a real implementation, this would load from a database
      const defaultPipelines: EtlPipelineConfig[] = [
        {
          id: 'user-data-sync',
          name: 'User Data Synchronization',
          description: 'Sync user data from external API to local database',
          source: {
            type: 'api',
            connection: {
              baseUrl: 'https://api.example.com',
              endpoint: '/users',
              method: 'GET',
            },
            batchSize: 100,
            incremental: {
              trackingColumn: 'updated_at',
              useTimestamp: true,
            },
          },
          transform: {
            type: 'mapping',
            mappings: {
              'id': 'external_id',
              'email': 'email',
              'name': 'full_name',
              'created_at': 'created_at',
              'updated_at': 'updated_at',
            },
            filters: [
              {
                field: 'status',
                operator: 'equals',
                value: 'active',
              },
            ],
          },
          destination: {
            type: 'database',
            connection: {
              host: 'localhost',
              port: 5432,
              database: 'app_db',
              table: 'users',
            },
            target: 'users',
            mode: 'upsert',
            conflictResolution: 'update',
          },
          schedule: {
            type: 'scheduled',
            cronExpression: '0 */6 * * *', // Every 6 hours
            timezone: 'UTC',
          },
          errorHandling: {
            maxRetries: 3,
            retryDelay: 5000,
            continueOnError: false,
            notifications: [
              {
                type: 'webhook',
                target: 'https://hooks.slack.com/services/...',
                template: 'ETL pipeline {{pipelineId}} failed: {{error}}',
              },
            ],
          },
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'order-analytics',
          name: 'Order Analytics Pipeline',
          description: 'Aggregate order data for analytics',
          source: {
            type: 'database',
            connection: {
              host: 'localhost',
              port: 5432,
              database: 'app_db',
              table: 'orders',
            },
            query: 'SELECT * FROM orders WHERE created_at >= $1',
            batchSize: 1000,
            incremental: {
              trackingColumn: 'created_at',
              useTimestamp: true,
            },
          },
          transform: {
            type: 'aggregate',
            aggregations: [
              {
                type: 'sum',
                field: 'total_amount',
              },
              {
                type: 'count',
                field: 'id',
              },
              {
                type: 'average',
                field: 'total_amount',
              },
            ],
            filters: [
              {
                field: 'status',
                operator: 'equals',
                value: 'completed',
              },
            ],
          },
          destination: {
            type: 'data_warehouse',
            connection: {
              host: 'analytics-db.example.com',
              port: 5432,
              database: 'analytics',
              table: 'order_summary',
            },
            target: 'order_summary',
            mode: 'insert',
          },
          schedule: {
            type: 'scheduled',
            cronExpression: '0 2 * * *', // Daily at 2 AM
            timezone: 'UTC',
          },
          errorHandling: {
            maxRetries: 5,
            retryDelay: 10000,
            continueOnError: true,
            notifications: [
              {
                type: 'email',
                target: 'analytics-team@example.com',
                template: 'Order analytics pipeline completed with {{recordsProcessed}} records',
              },
            ],
          },
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      this.pipelines.clear();
      defaultPipelines.forEach(pipeline => {
        this.pipelines.set(pipeline.id, pipeline);
      });

      this.logger.log(`Loaded ${this.pipelines.size} ETL pipeline configurations`);
    } catch (error) {
      this.logger.error('Failed to load ETL pipeline configurations', error);
    }
  }

  /**
   * Get all ETL pipeline configurations
   */
  getAllPipelines(): EtlPipelineConfig[] {
    return Array.from(this.pipelines.values());
  }

  /**
   * Get ETL pipeline configuration by ID
   */
  getPipeline(id: string): EtlPipelineConfig | null {
    return this.pipelines.get(id) || null;
  }

  /**
   * Create new ETL pipeline configuration
   */
  async createPipeline(config: Omit<EtlPipelineConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const pipeline: EtlPipelineConfig = {
      ...config,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.pipelines.set(id, pipeline);
    this.logger.log(`Created ETL pipeline: ${id}`);
    return id;
  }

  /**
   * Update ETL pipeline configuration
   */
  async updatePipeline(id: string, updates: Partial<EtlPipelineConfig>): Promise<void> {
    const pipeline = this.pipelines.get(id);
    if (!pipeline) {
      throw new Error(`ETL pipeline not found: ${id}`);
    }

    const updatedPipeline: EtlPipelineConfig = {
      ...pipeline,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date(),
    };

    this.pipelines.set(id, updatedPipeline);
    this.logger.log(`Updated ETL pipeline: ${id}`);
  }

  /**
   * Delete ETL pipeline configuration
   */
  async deletePipeline(id: string): Promise<void> {
    const pipeline = this.pipelines.get(id);
    if (!pipeline) {
      throw new Error(`ETL pipeline not found: ${id}`);
    }

    this.pipelines.delete(id);
    this.logger.log(`Deleted ETL pipeline: ${id}`);
  }

  /**
   * Execute ETL pipeline
   */
  async executePipeline(pipelineId: string, options?: {
    force?: boolean;
    incremental?: boolean;
    dryRun?: boolean;
  }): Promise<EtlExecutionResult> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`ETL pipeline not found: ${pipelineId}`);
    }

    if (!pipeline.active && !options?.force) {
      throw new Error(`ETL pipeline is inactive: ${pipelineId}`);
    }

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();
    let status: 'success' | 'failed' | 'partial' = 'success';
    let recordsProcessed = 0;
    let recordsFailed = 0;
    let error: string | undefined;

    try {
      this.logger.log(`Starting ETL pipeline execution: ${pipelineId}`);

      // Extract data from source
      const sourceData = await this.extractData(pipeline.source, options?.incremental);

      // Transform data
      const transformedData = await this.transformData(pipeline.transform, sourceData);

      // Load data to destination (unless dry run)
      if (!options?.dryRun) {
        const loadResult = await this.loadData(pipeline.destination, transformedData);
        recordsProcessed = loadResult.processed;
        recordsFailed = loadResult.failed;
        status = recordsFailed > 0 ? 'partial' : 'success';
      } else {
        recordsProcessed = transformedData.length;
        this.logger.log(`Dry run completed for pipeline: ${pipelineId}`);
      }

      // Update incremental tracking
      if (pipeline.source.incremental && transformedData.length > 0) {
        await this.updateIncrementalTracking(pipeline.source.incremental, transformedData);
      }

      // Send notifications on success
      if (status === 'success' && pipeline.errorHandling.notifications) {
        await this.sendNotifications(pipeline.errorHandling.notifications, {
          pipelineId,
          status: 'success',
          recordsProcessed,
          recordsFailed,
        });
      }

    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      status = 'failed';
      recordsFailed = 1;
      this.logger.error(`ETL pipeline execution failed: ${pipelineId}`, err);

      // Send error notifications
      if (pipeline.errorHandling.notifications) {
        await this.sendNotifications(pipeline.errorHandling.notifications, {
          pipelineId,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const result: EtlExecutionResult = {
      pipelineId,
      executionId,
      status,
      recordsProcessed,
      recordsFailed,
      startTime,
      endTime,
      duration,
      error,
    };

    this.executions.push(result);
    this.logger.log(`ETL pipeline execution completed: ${pipelineId} (${status})`);

    return result;
  }

  /**
   * Extract data from source
   */
  private async extractData(source: EtlSourceConfig, incremental?: boolean): Promise<any[]> {
    this.logger.debug(`Extracting data from source: ${source.type}`);

    switch (source.type) {
      case 'api':
        return await this.extractFromApi(source);
      case 'database':
        return await this.extractFromDatabase(source, incremental);
      case 'file':
        return await this.extractFromFile(source);
      case 'message_queue':
        return await this.extractFromMessageQueue(source);
      case 'stream':
        return await this.extractFromStream(source);
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }

  /**
   * Extract data from API
   */
  private async extractFromApi(source: EtlSourceConfig): Promise<any[]> {
    const { baseUrl, endpoint, method } = source.connection;
    const url = `${baseUrl}${endpoint}`;

    try {
      const response = await axios({
        method: method || 'GET',
        url,
        timeout: 30000,
      });

      return Array.isArray(response.data) ? response.data : [response.data];
    } catch (error) {
      throw new Error(`API extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract data from database
   */
  private async extractFromDatabase(_source: EtlSourceConfig, _incremental?: boolean): Promise<any[]> {
    // In a real implementation, this would use a database connection
    // For now, return mock data
    this.logger.debug('Extracting from database (mock implementation)');
    return [
      { id: 1, name: 'John Doe', email: 'john@example.com', created_at: new Date() },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: new Date() },
    ];
  }

  /**
   * Extract data from file
   */
  private async extractFromFile(_source: EtlSourceConfig): Promise<any[]> {
    // In a real implementation, this would read from files
    this.logger.debug('Extracting from file (mock implementation)');
    return [];
  }

  /**
   * Extract data from message queue
   */
  private async extractFromMessageQueue(_source: EtlSourceConfig): Promise<any[]> {
    // In a real implementation, this would consume from message queues
    this.logger.debug('Extracting from message queue (mock implementation)');
    return [];
  }

  /**
   * Extract data from stream
   */
  private async extractFromStream(_source: EtlSourceConfig): Promise<any[]> {
    // In a real implementation, this would read from streams
    this.logger.debug('Extracting from stream (mock implementation)');
    return [];
  }

  /**
   * Transform data according to configuration
   */
  private async transformData(transform: EtlTransformConfig, data: any[]): Promise<any[]> {
    this.logger.debug(`Transforming ${data.length} records`);

    let transformedData = [...data];

    // Apply field mappings
    if (transform.type === 'mapping' && transform.mappings) {
      transformedData = transformedData.map(record => {
        const mappedRecord: any = {};
        for (const [sourceField, targetField] of Object.entries(transform.mappings!)) {
          mappedRecord[targetField] = record[sourceField];
        }
        return mappedRecord;
      });
    }

    // Apply filters
    if (transform.filters && transform.filters.length > 0) {
      transformedData = transformedData.filter(record => {
        return transform.filters!.every(filter => {
          return this.evaluateFilterCondition(record, filter);
        });
      });
    }

    // Apply aggregations
    if (transform.type === 'aggregate' && transform.aggregations) {
      transformedData = this.applyAggregations(transformedData, transform.aggregations);
    }

    // Apply custom transform
    if (transform.type === 'custom' && transform.customTransform) {
      // In a real implementation, this would execute custom transform logic
      this.logger.debug('Applying custom transform (mock implementation)');
    }

    this.logger.debug(`Transformation completed: ${transformedData.length} records`);
    return transformedData;
  }

  /**
   * Evaluate filter condition
   */
  private evaluateFilterCondition(record: any, filter: EtlFilterCondition): boolean {
    const value = record[filter.field];
    const filterValue = filter.value;

    switch (filter.operator) {
      case 'equals':
        return value === filterValue;
      case 'not_equals':
        return value !== filterValue;
      case 'contains':
        return String(value).includes(String(filterValue));
      case 'greater_than':
        return value > filterValue;
      case 'less_than':
        return value < filterValue;
      case 'regex':
        return new RegExp(filterValue).test(String(value));
      default:
        return true;
    }
  }

  /**
   * Apply aggregations to data
   */
  private applyAggregations(data: any[], aggregations: EtlAggregationConfig[]): any[] {
    const result: any = {};

    aggregations.forEach(agg => {
      switch (agg.type) {
        case 'sum':
          result[`sum_${agg.field}`] = data.reduce((sum, record) => sum + (record[agg.field] || 0), 0);
          break;
        case 'count':
          result[`count_${agg.field}`] = data.length;
          break;
        case 'average':
          const sum = data.reduce((sum, record) => sum + (record[agg.field] || 0), 0);
          result[`avg_${agg.field}`] = data.length > 0 ? sum / data.length : 0;
          break;
        case 'min':
          result[`min_${agg.field}`] = Math.min(...data.map(record => record[agg.field] || 0));
          break;
        case 'max':
          result[`max_${agg.field}`] = Math.max(...data.map(record => record[agg.field] || 0));
          break;
        case 'group_by':
          if (agg.groupBy) {
            const grouped = data.reduce((groups, record) => {
              const key = agg.groupBy!.map(field => record[field]).join('|');
              if (!groups[key]) groups[key] = [];
              groups[key].push(record);
              return groups;
            }, {} as Record<string, any[]>);
            result[`grouped_by_${agg.groupBy.join('_')}`] = grouped;
          }
          break;
      }
    });

    return [result];
  }

  /**
   * Load data to destination
   */
  private async loadData(destination: EtlDestinationConfig, data: any[]): Promise<{
    processed: number;
    failed: number;
  }> {
    this.logger.debug(`Loading ${data.length} records to destination: ${destination.type}`);

    let processed = 0;
    let failed = 0;

    try {
      switch (destination.type) {
        case 'database':
          const dbResult = await this.loadToDatabase(destination, data);
          processed = dbResult.processed;
          failed = dbResult.failed;
          break;
        case 'api':
          const apiResult = await this.loadToApi(destination, data);
          processed = apiResult.processed;
          failed = apiResult.failed;
          break;
        case 'file':
          const fileResult = await this.loadToFile(destination, data);
          processed = fileResult.processed;
          failed = fileResult.failed;
          break;
        case 'message_queue':
          const queueResult = await this.loadToMessageQueue(destination, data);
          processed = queueResult.processed;
          failed = queueResult.failed;
          break;
        case 'data_warehouse':
          const warehouseResult = await this.loadToDataWarehouse(destination, data);
          processed = warehouseResult.processed;
          failed = warehouseResult.failed;
          break;
        default:
          throw new Error(`Unsupported destination type: ${destination.type}`);
      }
    } catch (error) {
      failed = data.length;
      this.logger.error(`Data loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    this.logger.debug(`Data loading completed: ${processed} processed, ${failed} failed`);
    return { processed, failed };
  }

  /**
   * Load data to database
   */
  private async loadToDatabase(destination: EtlDestinationConfig, data: any[]): Promise<{
    processed: number;
    failed: number;
  }> {
    // In a real implementation, this would use a database connection
    this.logger.debug(`Loading ${data.length} records to database table: ${destination.target}`);
    
    // Mock implementation - simulate some failures
    const processed = Math.floor(data.length * 0.95); // 95% success rate
    const failed = data.length - processed;
    
    return { processed, failed };
  }

  /**
   * Load data to API
   */
  private async loadToApi(destination: EtlDestinationConfig, data: any[]): Promise<{
    processed: number;
    failed: number;
  }> {
    // In a real implementation, this would make API calls
    this.logger.debug(`Loading ${data.length} records to API endpoint: ${destination.target}`);
    
    // Mock implementation
    return { processed: data.length, failed: 0 };
  }

  /**
   * Load data to file
   */
  private async loadToFile(destination: EtlDestinationConfig, data: any[]): Promise<{
    processed: number;
    failed: number;
  }> {
    // In a real implementation, this would write to files
    this.logger.debug(`Loading ${data.length} records to file: ${destination.target}`);
    
    // Mock implementation
    return { processed: data.length, failed: 0 };
  }

  /**
   * Load data to message queue
   */
  private async loadToMessageQueue(destination: EtlDestinationConfig, data: any[]): Promise<{
    processed: number;
    failed: number;
  }> {
    // In a real implementation, this would publish to message queues
    this.logger.debug(`Loading ${data.length} records to message queue: ${destination.target}`);
    
    // Mock implementation
    return { processed: data.length, failed: 0 };
  }

  /**
   * Load data to data warehouse
   */
  private async loadToDataWarehouse(destination: EtlDestinationConfig, data: any[]): Promise<{
    processed: number;
    failed: number;
  }> {
    // In a real implementation, this would load to data warehouse
    this.logger.debug(`Loading ${data.length} records to data warehouse: ${destination.target}`);
    
    // Mock implementation
    return { processed: data.length, failed: 0 };
  }

  /**
   * Update incremental tracking
   */
  private async updateIncrementalTracking(incremental: EtlIncrementalConfig, data: any[]): Promise<void> {
    if (data.length === 0) return;

    // Find the latest value for tracking
    const latestRecord = data.reduce((latest, record) => {
      const currentValue = record[incremental.trackingColumn];
      const latestValue = latest[incremental.trackingColumn];
      
      if (incremental.useTimestamp) {
        return new Date(currentValue) > new Date(latestValue) ? record : latest;
      } else {
        return currentValue > latestValue ? record : latest;
      }
    });

    incremental.lastProcessedValue = latestRecord[incremental.trackingColumn];
    this.logger.debug(`Updated incremental tracking: ${incremental.trackingColumn} = ${incremental.lastProcessedValue}`);
  }

  /**
   * Send notifications
   */
  private async sendNotifications(notifications: any[], context: Record<string, any>): Promise<void> {
    for (const notification of notifications) {
      try {
        switch (notification.type) {
          case 'webhook':
            await this.sendWebhookNotification(notification.target, notification.template, context);
            break;
          case 'email':
            await this.sendEmailNotification(notification.target, notification.template, context);
            break;
          case 'slack':
            await this.sendSlackNotification(notification.target, notification.template, context);
            break;
          case 'sms':
            await this.sendSmsNotification(notification.target, notification.template, context);
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to send notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(target: string, template: string, context: Record<string, any>): Promise<void> {
    const message = this.interpolateTemplate(template, context);
    await axios.post(target, { message });
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(target: string, template: string, context: Record<string, any>): Promise<void> {
    // In a real implementation, this would send emails
    this.logger.debug(`Email notification to ${target}: ${this.interpolateTemplate(template, context)}`);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(target: string, template: string, context: Record<string, any>): Promise<void> {
    const message = this.interpolateTemplate(template, context);
    await axios.post(target, { text: message });
  }

  /**
   * Send SMS notification
   */
  private async sendSmsNotification(target: string, template: string, context: Record<string, any>): Promise<void> {
    // In a real implementation, this would send SMS
    this.logger.debug(`SMS notification to ${target}: ${this.interpolateTemplate(template, context)}`);
  }

  /**
   * Interpolate template with context
   */
  private interpolateTemplate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] !== undefined ? String(context[key]) : match;
    });
  }

  /**
   * Get pipeline execution history
   */
  getExecutionHistory(pipelineId?: string): EtlExecutionResult[] {
    if (pipelineId) {
      return this.executions.filter(exec => exec.pipelineId === pipelineId);
    }
    return [...this.executions];
  }

  /**
   * Get pipeline statistics
   */
  getPipelineStats(pipelineId: string): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    totalRecordsProcessed: number;
    totalRecordsFailed: number;
  } {
    const executions = this.executions.filter(exec => exec.pipelineId === pipelineId);
    
    if (executions.length === 0) {
      return {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
        totalRecordsProcessed: 0,
        totalRecordsFailed: 0,
      };
    }

    const successful = executions.filter(exec => exec.status === 'success').length;
    const failed = executions.filter(exec => exec.status === 'failed').length;
    const totalDuration = executions.reduce((sum, exec) => sum + exec.duration, 0);
    const totalProcessed = executions.reduce((sum, exec) => sum + exec.recordsProcessed, 0);
    const totalFailed = executions.reduce((sum, exec) => sum + exec.recordsFailed, 0);

    return {
      totalExecutions: executions.length,
      successfulExecutions: successful,
      failedExecutions: failed,
      averageDuration: totalDuration / executions.length,
      totalRecordsProcessed: totalProcessed,
      totalRecordsFailed: totalFailed,
    };
  }

  /**
   * Refresh pipeline configurations
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshPipelines(): Promise<void> {
    try {
      await this.loadPipelines();
      this.logger.debug('ETL pipeline configurations refreshed');
    } catch (error) {
      this.logger.error('Failed to refresh ETL pipeline configurations', error);
    }
  }

  /**
   * Clean up old execution records
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExecutions(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const initialCount = this.executions.length;
    this.executions = this.executions.filter(exec => exec.startTime > thirtyDaysAgo);
    const removedCount = initialCount - this.executions.length;

    this.logger.log(`Cleaned up ${removedCount} old ETL execution records`);
  }
}
