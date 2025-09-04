import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RabbitMQProvider } from './rabbitmq.provider';
import { RedisProvider } from './redis.provider';
import { KafkaProvider } from './kafka.provider';
import {
  MessageQueueProvider,
  MessageQueueConfig,
  MessageProducer,
  MessageConsumer,
  QueueMessage,
  QueueStats,
  QueueHealth,
  QueueMetrics,
  QueueEvent,
  QueueEventType,
} from '../interfaces/message-queue.interface';

@Injectable()
export class MessageQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessageQueueService.name);
  private providers: Map<string, MessageQueueProvider> = new Map();
  private queueConfigs: Map<string, MessageQueueConfig> = new Map();
  private producers: Map<string, MessageProducer> = new Map();
  private consumers: Map<string, MessageConsumer> = new Map();
  private eventHandlers: Map<QueueEventType, ((event: QueueEvent) => Promise<void>)[]> = new Map();

  constructor(
    private readonly rabbitMQProvider: RabbitMQProvider,
    private readonly redisProvider: RedisProvider,
    private readonly kafkaProvider: KafkaProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Message Queue Service');
    
    // Register providers
    this.providers.set('rabbitmq', this.rabbitMQProvider);
    this.providers.set('redis', this.redisProvider);
    this.providers.set('kafka', this.kafkaProvider);
    
    // Load default configurations
    await this.loadDefaultConfigurations();
    
    this.logger.log('Message Queue Service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Message Queue Service');
    
    // Close all providers
    for (const provider of this.providers.values()) {
      await provider.close();
    }
    
    this.logger.log('Message Queue Service shut down');
  }

  /**
   * Create a new queue configuration
   */
  async createQueue(config: MessageQueueConfig): Promise<string> {
    this.logger.log(`Creating queue configuration: ${config.name}`);
    
    try {
      const provider = this.providers.get(config.type);
      if (!provider) {
        throw new Error(`Unsupported queue type: ${config.type}`);
      }

      await provider.initialize(config);
      this.queueConfigs.set(config.name, config);
      
      this.logger.log(`Queue configuration created: ${config.name}`);
      return config.name;
    } catch (error) {
      this.logger.error(`Failed to create queue configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get queue configuration by name
   */
  getQueueConfig(queueName: string): MessageQueueConfig | undefined {
    return this.queueConfigs.get(queueName);
  }

  /**
   * List all queue configurations
   */
  listQueueConfigs(): MessageQueueConfig[] {
    return Array.from(this.queueConfigs.values());
  }

  /**
   * Update queue configuration
   */
  async updateQueue(queueName: string, config: Partial<MessageQueueConfig>): Promise<void> {
    this.logger.log(`Updating queue configuration: ${queueName}`);
    
    const existingConfig = this.queueConfigs.get(queueName);
    if (!existingConfig) {
      throw new Error(`Queue configuration not found: ${queueName}`);
    }

    const updatedConfig = { ...existingConfig, ...config, updatedAt: new Date() };
    this.queueConfigs.set(queueName, updatedConfig);
    
    this.logger.log(`Queue configuration updated: ${queueName}`);
  }

  /**
   * Delete queue configuration
   */
  async deleteQueue(queueName: string): Promise<void> {
    this.logger.log(`Deleting queue configuration: ${queueName}`);
    
    const config = this.queueConfigs.get(queueName);
    if (!config) {
      throw new Error(`Queue configuration not found: ${queueName}`);
    }

    const provider = this.providers.get(config.type);
    if (provider) {
      await provider.deleteQueue(queueName);
    }

    this.queueConfigs.delete(queueName);
    this.logger.log(`Queue configuration deleted: ${queueName}`);
  }

  /**
   * Create a producer for a queue
   */
  async createProducer(queueName: string): Promise<MessageProducer> {
    this.logger.log(`Creating producer for queue: ${queueName}`);
    
    const config = this.queueConfigs.get(queueName);
    if (!config) {
      throw new Error(`Queue configuration not found: ${queueName}`);
    }

    const provider = this.providers.get(config.type);
    if (!provider) {
      throw new Error(`Provider not found for type: ${config.type}`);
    }

    const producer = await provider.createProducer(config);
    this.producers.set(producer.id, producer);
    
    this.logger.log(`Producer created: ${producer.id}`);
    return producer;
  }

  /**
   * Create a consumer for a queue
   */
  async createConsumer(
    queueName: string,
    handler: (message: QueueMessage) => Promise<void>
  ): Promise<MessageConsumer> {
    this.logger.log(`Creating consumer for queue: ${queueName}`);
    
    const config = this.queueConfigs.get(queueName);
    if (!config) {
      throw new Error(`Queue configuration not found: ${queueName}`);
    }

    const provider = this.providers.get(config.type);
    if (!provider) {
      throw new Error(`Provider not found for type: ${config.type}`);
    }

    const consumer = await provider.createConsumer(config, handler);
    this.consumers.set(consumer.id, consumer);
    
    this.logger.log(`Consumer created: ${consumer.id}`);
    return consumer;
  }

  /**
   * Publish a message to a queue
   */
  async publishMessage(queueName: string, message: QueueMessage): Promise<void> {
    this.logger.debug(`Publishing message to queue: ${queueName}, message ID: ${message.id}`);
    
    const config = this.queueConfigs.get(queueName);
    if (!config) {
      throw new Error(`Queue configuration not found: ${queueName}`);
    }

    const provider = this.providers.get(config.type);
    if (!provider) {
      throw new Error(`Provider not found for type: ${config.type}`);
    }

    // Create producer if not exists
    let producer = Array.from(this.producers.values()).find(p => p.queue.name === queueName);
    if (!producer) {
      producer = await this.createProducer(queueName);
    }

    await provider.publish(producer, message);
  }

  /**
   * Start consuming messages from a queue
   */
  async startConsumer(queueName: string, handler: (message: QueueMessage) => Promise<void>): Promise<void> {
    this.logger.log(`Starting consumer for queue: ${queueName}`);
    
    const config = this.queueConfigs.get(queueName);
    if (!config) {
      throw new Error(`Queue configuration not found: ${queueName}`);
    }

    const provider = this.providers.get(config.type);
    if (!provider) {
      throw new Error(`Provider not found for type: ${config.type}`);
    }

    // Create consumer if not exists
    let consumer = Array.from(this.consumers.values()).find(c => c.queue.name === queueName);
    if (!consumer) {
      consumer = await this.createConsumer(queueName, handler);
    }

    await provider.consume(consumer);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<QueueStats> {
    const config = this.queueConfigs.get(queueName);
    if (!config) {
      throw new Error(`Queue configuration not found: ${queueName}`);
    }

    const provider = this.providers.get(config.type);
    if (!provider) {
      throw new Error(`Provider not found for type: ${config.type}`);
    }

    return await provider.getStats(queueName);
  }

  /**
   * Get queue health
   */
  async getQueueHealth(queueName: string): Promise<QueueHealth> {
    const config = this.queueConfigs.get(queueName);
    if (!config) {
      throw new Error(`Queue configuration not found: ${queueName}`);
    }

    const provider = this.providers.get(config.type);
    if (!provider) {
      throw new Error(`Provider not found for type: ${config.type}`);
    }

    return await provider.getHealth(queueName);
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(queueName: string): Promise<QueueMetrics> {
    const config = this.queueConfigs.get(queueName);
    if (!config) {
      throw new Error(`Queue configuration not found: ${queueName}`);
    }

    const provider = this.providers.get(config.type);
    if (!provider) {
      throw new Error(`Provider not found for type: ${config.type}`);
    }

    return await provider.getMetrics(queueName);
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats(): Promise<QueueStats[]> {
    const stats: QueueStats[] = [];
    
    for (const queueName of this.queueConfigs.keys()) {
      try {
        const stat = await this.getQueueStats(queueName);
        stats.push(stat);
      } catch (error) {
        this.logger.error(`Failed to get stats for queue ${queueName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return stats;
  }

  /**
   * Get all queue health statuses
   */
  async getAllQueueHealth(): Promise<QueueHealth[]> {
    const health: QueueHealth[] = [];
    
    for (const queueName of this.queueConfigs.keys()) {
      try {
        const status = await this.getQueueHealth(queueName);
        health.push(status);
      } catch (error) {
        this.logger.error(`Failed to get health for queue ${queueName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return health;
  }

  /**
   * Subscribe to queue events
   */
  subscribeToEvents(eventType: QueueEventType, handler: (event: QueueEvent) => Promise<void>): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  /**
   * Unsubscribe from queue events
   */
  unsubscribeFromEvents(eventType: QueueEventType, handler: (event: QueueEvent) => Promise<void>): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.eventHandlers.set(eventType, handlers);
    }
  }

  /**
   * Get system overview
   */
  getSystemOverview(): {
    totalQueues: number;
    totalProducers: number;
    totalConsumers: number;
    activeQueues: number;
    healthyQueues: number;
    degradedQueues: number;
    unhealthyQueues: number;
  } {
    const totalQueues = this.queueConfigs.size;
    const totalProducers = this.producers.size;
    const totalConsumers = this.consumers.size;
    const activeQueues = Array.from(this.queueConfigs.values()).filter(q => q.durable).length;
    
    return {
      totalQueues,
      totalProducers,
      totalConsumers,
      activeQueues,
      healthyQueues: 0, // Would need to check health status
      degradedQueues: 0,
      unhealthyQueues: 0,
    };
  }

  /**
   * Load default configurations
   */
  private async loadDefaultConfigurations(): Promise<void> {
    this.logger.log('Loading default queue configurations');
    
    const defaultConfigs: MessageQueueConfig[] = [
      {
        name: 'default-rabbitmq',
        type: 'rabbitmq',
        connection: {
          host: 'localhost',
          port: 5672,
          username: 'guest',
          password: 'guest',
          vhost: '/',
        },
        queue: {
          name: 'default-queue',
          durable: true,
          exclusive: false,
          autoDelete: false,
        },
        exchange: {
          name: 'default-exchange',
          type: 'direct',
          durable: true,
          autoDelete: false,
          routingKey: 'default',
        },
        durable: true,
        autoDelete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'default-redis',
        type: 'redis',
        connection: {
          host: 'localhost',
          port: 6379,
        },
        queue: {
          name: 'default-redis-queue',
          durable: false,
          exclusive: false,
          autoDelete: true,
        },
        durable: false,
        autoDelete: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'default-kafka',
        type: 'kafka',
        connection: {
          host: 'localhost',
          port: 9092,
        },
        queue: {
          name: 'default-kafka-topic',
          durable: false,
          exclusive: false,
          autoDelete: false,
        },
        topic: {
          name: 'default-topic',
          partitions: 1,
          replicationFactor: 1,
          consumerGroup: 'default-consumer-group',
          autoOffsetReset: 'latest',
          enableAutoCommit: true,
        },
        durable: false,
        autoDelete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const config of defaultConfigs) {
      try {
        await this.createQueue(config);
      } catch (error) {
        this.logger.warn(`Failed to create default queue ${config.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Scheduled health checks
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async performHealthChecks(): Promise<void> {
    this.logger.debug('Performing scheduled health checks for all queues');
    
    for (const queueName of this.queueConfigs.keys()) {
      try {
        const health = await this.getQueueHealth(queueName);
        if (health.status === 'unhealthy') {
          this.logger.warn(`Queue ${queueName} is unhealthy: ${health.error}`);
        }
      } catch (error) {
        this.logger.error(`Failed to check health for queue ${queueName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Scheduled cleanup
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async performCleanup(): Promise<void> {
    this.logger.log('Performing scheduled cleanup');
    
    // Clean up inactive producers and consumers
    const now = new Date();
    const inactiveThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [id, producer] of this.producers.entries()) {
      if (!producer.active && (now.getTime() - producer.updatedAt.getTime()) > inactiveThreshold) {
        this.producers.delete(id);
        this.logger.debug(`Cleaned up inactive producer: ${id}`);
      }
    }
    
    for (const [id, consumer] of this.consumers.entries()) {
      if (!consumer.active && (now.getTime() - consumer.updatedAt.getTime()) > inactiveThreshold) {
        this.consumers.delete(id);
        this.logger.debug(`Cleaned up inactive consumer: ${id}`);
      }
    }
  }
}
