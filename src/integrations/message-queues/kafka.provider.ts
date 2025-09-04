import { Injectable, Logger } from '@nestjs/common';
import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
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
export class KafkaProvider implements MessageQueueProvider {
  private readonly logger = new Logger(KafkaProvider.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private producers: Map<string, MessageProducer> = new Map();
  private consumers: Map<string, MessageConsumer> = new Map();
  private eventHandlers: Map<QueueEventType, ((event: QueueEvent) => Promise<void>)[]> = new Map();
  private isConsuming = false;

  name = 'Kafka';
  type = 'kafka' as const;

  async initialize(config: MessageQueueConfig): Promise<void> {
    this.logger.log(`Initializing Kafka provider for topic: ${config.topic?.name}`);
    
    try {
      // Create Kafka client
      this.kafka = new Kafka({
        clientId: `kafka-provider-${config.name}`,
        brokers: [`${config.connection.host}:${config.connection.port}`],
        ssl: config.connection.ssl,
        sasl: config.connection.username && config.connection.password ? {
          mechanism: 'plain',
          username: config.connection.username,
          password: config.connection.password,
        } : undefined,
        connectionTimeout: config.connection.timeout || 3000,
        requestTimeout: 30000,
      });

      // Create producer
      this.producer = this.kafka.producer();
      await this.producer.connect();

      // Create consumer
      this.consumer = this.kafka.consumer({
        groupId: config.topic?.consumerGroup || `consumer-group-${config.name}`,
        sessionTimeout: config.topic?.sessionTimeout || 30000,
        heartbeatInterval: config.topic?.heartbeatInterval || 3000,
      });
      await this.consumer.connect();

      // Subscribe to topic
      if (config.topic) {
        await this.consumer.subscribe({
          topic: config.topic.name,
          fromBeginning: config.topic.autoOffsetReset === 'earliest',
        });
      }

      this.logger.log(`Kafka provider initialized successfully for topic: ${config.topic?.name}`);
    } catch (error) {
      this.logger.error(`Failed to initialize Kafka provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    
    this.logger.log(`Created Kafka producer: ${producer.id}`);
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
    
    this.logger.log(`Created Kafka consumer: ${consumer.id}`);
    return consumer;
  }

  async publish(producer: MessageProducer, message: QueueMessage): Promise<void> {
    try {
      const topic = producer.queue.topic?.name || producer.queue.name;
      
      await this.producer.send({
        topic,
        messages: [
          {
            key: message.id,
            value: JSON.stringify(message),
            headers: message.headers,
            timestamp: message.timestamp.getTime().toString(),
          },
        ],
      });

      this.emitEvent(QueueEventType.MESSAGE_PUBLISHED, producer.queue.name, message);
      this.logger.debug(`Published message to Kafka topic: ${topic}, message ID: ${message.id}`);
    } catch (error) {
      this.logger.error(`Failed to publish message to Kafka: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    try {
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          const { topic, message } = payload;
          
          try {
            const queueMessage: QueueMessage = JSON.parse(message.value?.toString() || '{}');
            
            await consumer.handler(queueMessage);
            
            this.emitEvent(QueueEventType.MESSAGE_CONSUMED, consumer.queue.name, queueMessage);
            this.logger.debug(`Consumed message from Kafka topic: ${topic}, message ID: ${queueMessage.id}`);
          } catch (error) {
            this.logger.error(`Failed to process message: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.emitEvent(QueueEventType.MESSAGE_FAILED, consumer.queue.name, { error, message });
            
            // Note: Kafka doesn't support message requeuing like RabbitMQ
            // Failed messages would typically be sent to a dead letter topic
          }
        },
        eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
          for (const message of batch.messages) {
            if (!isRunning() || isStale()) break;
            
            try {
              const queueMessage: QueueMessage = JSON.parse(message.value?.toString() || '{}');
              await consumer.handler(queueMessage);
              resolveOffset(message.offset);
              this.emitEvent(QueueEventType.MESSAGE_CONSUMED, consumer.queue.name, queueMessage);
            } catch (error) {
              this.logger.error(`Failed to process batch message: ${error instanceof Error ? error.message : 'Unknown error'}`);
              this.emitEvent(QueueEventType.MESSAGE_FAILED, consumer.queue.name, { error, message });
            }
            
            await heartbeat();
          }
        },
      });

      this.logger.log(`Started consuming from Kafka topic: ${consumer.queue.topic?.name}`);
    } catch (error) {
      this.logger.error(`Failed to start Kafka consumer: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.emitEvent(QueueEventType.CONSUMER_ERROR, consumer.queue.name, { error });
      throw error;
    } finally {
      this.isConsuming = false;
    }
  }

  async getStats(queueName: string): Promise<QueueStats> {
    try {
      // Kafka doesn't provide direct queue stats like RabbitMQ
      // This would require admin client to get topic metadata
      return {
        queueName,
        messageCount: 0, // Would need admin client to get this
        readyMessages: 0,
        unacknowledgedMessages: 0,
        consumerCount: 0,
        memoryUsage: 0,
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get Kafka queue stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getHealth(queueName: string): Promise<QueueHealth> {
    const startTime = Date.now();
    
    try {
      // Simple health check by trying to get metadata
      const admin = this.kafka.admin();
      await admin.connect();
      await admin.listTopics();
      await admin.disconnect();
      
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
      const admin = this.kafka.admin();
      await admin.connect();
      await admin.deleteTopics({
        topics: [queueName],
      });
      await admin.disconnect();
      
      this.emitEvent(QueueEventType.QUEUE_DELETED, queueName, { queueName });
      this.logger.log(`Deleted Kafka topic: ${queueName}`);
    } catch (error) {
      this.logger.error(`Failed to delete Kafka topic: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async purgeQueue(_queueName: string): Promise<void> {
    try {
      // Kafka doesn't support purging topics directly
      // This would require deleting and recreating the topic
      this.logger.warn(`Kafka doesn't support purging topics. Use deleteQueue instead.`);
    } catch (error) {
      this.logger.error(`Failed to purge Kafka topic: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      this.isConsuming = false;
      
      if (this.consumer) {
        await this.consumer.disconnect();
      }
      
      if (this.producer) {
        await this.producer.disconnect();
      }
      
      this.logger.log('Kafka provider closed');
    } catch (error) {
      this.logger.error(`Failed to close Kafka provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
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
