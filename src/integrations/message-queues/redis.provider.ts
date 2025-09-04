import { Injectable, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
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
export class RedisProvider implements MessageQueueProvider {
  private readonly logger = new Logger(RedisProvider.name);
  private client: RedisClientType;
  private producers: Map<string, MessageProducer> = new Map();
  private consumers: Map<string, MessageConsumer> = new Map();
  private eventHandlers: Map<QueueEventType, ((event: QueueEvent) => Promise<void>)[]> = new Map();
  private isConsuming = false;

  name = 'Redis';
  type = 'redis' as const;

  async initialize(config: MessageQueueConfig): Promise<void> {
    this.logger.log(`Initializing Redis provider for queue: ${config.name}`);
    
    try {
      // Create Redis client
      this.client = createClient({
        url: this.buildConnectionUrl(config.connection),
        socket: {
          connectTimeout: config.connection.timeout || 5000,
          keepAlive: true,
        },
      });

      // Connect to Redis
      await this.client.connect();
      
      this.logger.log(`Redis provider initialized successfully for queue: ${config.name}`);
    } catch (error) {
      this.logger.error(`Failed to initialize Redis provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async createProducer(config: MessageQueueConfig): Promise<MessageProducer> {
    const producer: MessageProducer = {
      id: `producer_${config.name}_${Date.now()}`,
      name: `Producer_${config.name}`,
      queue: config,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.producers.set(producer.id, producer);
    this.emitEvent(QueueEventType.PRODUCER_STARTED, config.name, producer);
    
    this.logger.log(`Created Redis producer: ${producer.id}`);
    return producer;
  }

  async createConsumer(
    config: MessageQueueConfig,
    handler: (message: QueueMessage) => Promise<void>
  ): Promise<MessageConsumer> {
    const consumer: MessageConsumer = {
      id: `consumer_${config.name}_${Date.now()}`,
      name: `Consumer_${config.name}`,
      queue: config,
      handler,
      active: true,
      options: {
        noAck: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.consumers.set(consumer.id, consumer);
    this.emitEvent(QueueEventType.CONSUMER_STARTED, config.name, consumer);
    
    this.logger.log(`Created Redis consumer: ${consumer.id}`);
    return consumer;
  }

  async publish(producer: MessageProducer, message: QueueMessage): Promise<void> {
    try {
      const queueKey = `queue:${producer.queue.queue.name}`;
      const messageData = JSON.stringify(message);
      
      // Add message to queue
      await this.client.lPush(queueKey, messageData);
      
      // Set TTL if specified
      if (message.ttl) {
        const messageKey = `message:${message.id}`;
        await this.client.setEx(messageKey, Math.floor(message.ttl / 1000), messageData);
      }

      this.emitEvent(QueueEventType.MESSAGE_PUBLISHED, producer.queue.name, message);
      this.logger.debug(`Published message to Redis queue: ${producer.queue.name}, message ID: ${message.id}`);
    } catch (error) {
      this.logger.error(`Failed to publish message to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.emitEvent(QueueEventType.PRODUCER_ERROR, producer.queue.name, { error, message });
      throw error;
    }
  }

  async consume(consumer: MessageConsumer): Promise<void> {
    if (this.isConsuming) {
      this.logger.warn('Consumer is already running');
      return;
    }

    this.isConsuming = true;
    const queueKey = `queue:${consumer.queue.queue.name}`;

    try {
      while (this.isConsuming && consumer.active) {
        // Use BRPOP for blocking pop with timeout
        const result = await this.client.brPop(queueKey, 1);
        
        if (result) {
          const [_, messageData] = result as unknown as [string, string];
          const message: QueueMessage = JSON.parse(messageData);
          
          try {
            await consumer.handler(message);
            this.emitEvent(QueueEventType.MESSAGE_CONSUMED, consumer.queue.name, message);
            this.logger.debug(`Consumed message from Redis queue: ${consumer.queue.name}, message ID: ${message.id}`);
          } catch (error) {
            this.logger.error(`Failed to process message: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.emitEvent(QueueEventType.MESSAGE_FAILED, consumer.queue.name, { error, message });
            
            // Re-queue the message for retry
            await this.client.lPush(queueKey, messageData);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to consume from Redis: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.emitEvent(QueueEventType.CONSUMER_ERROR, consumer.queue.name, { error });
      throw error;
    } finally {
      this.isConsuming = false;
    }
  }

  async getStats(queueName: string): Promise<QueueStats> {
    try {
      const queueKey = `queue:${queueName}`;
      const messageCount = await this.client.lLen(queueKey);
      
      return {
        queueName,
        messageCount,
        readyMessages: messageCount,
        unacknowledgedMessages: 0, // Redis doesn't track unacknowledged messages
        consumerCount: 0, // Redis doesn't track consumer count
        memoryUsage: 0, // Redis doesn't provide per-queue memory usage
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get Redis queue stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getHealth(queueName: string): Promise<QueueHealth> {
    const startTime = Date.now();
    
    try {
      // Simple ping to check Redis health
      await this.client.ping();
      
      return {
        queueName,
        status: 'healthy',
        checkedAt: new Date(),
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        queueName,
        status: 'unhealthy',
        checkedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime,
      };
    }
  }

  async getMetrics(queueName: string): Promise<QueueMetrics> {
    // Mock metrics for now - in real implementation, you'd collect these over time
    return {
      queueName,
      publishRate: 0,
      consumeRate: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      totalPublished: 0,
      totalConsumed: 0,
      totalErrors: 0,
      timestamp: new Date(),
    };
  }

  async deleteQueue(queueName: string): Promise<void> {
    try {
      const queueKey = `queue:${queueName}`;
      await this.client.del(queueKey);
      this.emitEvent(QueueEventType.QUEUE_DELETED, queueName, { queueName });
      this.logger.log(`Deleted Redis queue: ${queueName}`);
    } catch (error) {
      this.logger.error(`Failed to delete Redis queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async purgeQueue(queueName: string): Promise<void> {
    try {
      const queueKey = `queue:${queueName}`;
      await this.client.del(queueKey);
      this.logger.log(`Purged Redis queue: ${queueName}`);
    } catch (error) {
      this.logger.error(`Failed to purge Redis queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      this.isConsuming = false;
      if (this.client) {
        await this.client.quit();
      }
      this.logger.log('Redis provider closed');
    } catch (error) {
      this.logger.error(`Failed to close Redis provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private buildConnectionUrl(connection: any): string {
    const { host, port, username, password } = connection;
    const credentials = username && password ? `${username}:${password}@` : '';
    
    return `redis://${credentials}${host}:${port}`;
  }

  private emitEvent(type: QueueEventType, queueName: string, data: any): void {
    const event: QueueEvent = {
      id: `event_${Date.now()}_${Math.random()}`,
      type,
      queueName,
      data,
      timestamp: new Date(),
    };

    const handlers = this.eventHandlers.get(type) || [];
    handlers.forEach(handler => {
      handler(event).catch(error => {
        this.logger.error(`Failed to handle queue event: ${error instanceof Error ? error.message : 'Unknown error'}`);
      });
    });
  }
}
