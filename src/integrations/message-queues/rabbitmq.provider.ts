import { Injectable, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import * as connectionManager from 'amqp-connection-manager';
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
export class RabbitMQProvider implements MessageQueueProvider {
  private readonly logger = new Logger(RabbitMQProvider.name);
  private connection: connectionManager.AmqpConnectionManager;
  private channel: amqp.Channel;
  private producers: Map<string, MessageProducer> = new Map();
  private consumers: Map<string, MessageConsumer> = new Map();
  private eventHandlers: Map<QueueEventType, ((event: QueueEvent) => Promise<void>)[]> = new Map();

  name = 'RabbitMQ';
  type = 'rabbitmq' as const;

  async initialize(config: MessageQueueConfig): Promise<void> {
    this.logger.log(`Initializing RabbitMQ provider for queue: ${config.name}`);
    
    try {
      // Create connection
      const connectionUrl = this.buildConnectionUrl(config.connection);
      this.connection = connectionManager.connect([connectionUrl]);
      
      // Create channel
      this.channel = await this.connection.createChannel() as any;
      
      // Assert queue
      await this.channel.assertQueue(config.queue.name, {
        durable: config.queue.durable,
        exclusive: config.queue.exclusive,
        autoDelete: config.queue.autoDelete,
        arguments: config.queue.arguments,
      });

      // Assert exchange if provided
      if (config.exchange) {
        await this.channel.assertExchange(config.exchange.name, config.exchange.type, {
          durable: config.exchange.durable,
          autoDelete: config.exchange.autoDelete,
          arguments: config.exchange.arguments,
        });

        // Bind queue to exchange
        await this.channel.bindQueue(
          config.queue.name,
          config.exchange.name,
          config.exchange.routingKey || '#'
        );
      }

      this.logger.log(`RabbitMQ provider initialized successfully for queue: ${config.name}`);
    } catch (error) {
      this.logger.error(`Failed to initialize RabbitMQ provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    
    this.logger.log(`Created RabbitMQ producer: ${producer.id}`);
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
        prefetchCount: 1,
        noAck: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.consumers.set(consumer.id, consumer);
    this.emitEvent(QueueEventType.CONSUMER_STARTED, config.name, consumer);
    
    this.logger.log(`Created RabbitMQ consumer: ${consumer.id}`);
    return consumer;
  }

  async publish(producer: MessageProducer, message: QueueMessage): Promise<void> {
    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      await this.channel.sendToQueue(producer.queue.queue.name, messageBuffer, {
        persistent: producer.queue.queue.durable,
        priority: message.priority,
        expiration: message.ttl,
        correlationId: message.correlationId,
        replyTo: message.replyTo,
        headers: message.headers,
      });

      this.emitEvent(QueueEventType.MESSAGE_PUBLISHED, producer.queue.name, message);
      this.logger.debug(`Published message to RabbitMQ queue: ${producer.queue.name}, message ID: ${message.id}`);
    } catch (error) {
      this.logger.error(`Failed to publish message to RabbitMQ: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.emitEvent(QueueEventType.PRODUCER_ERROR, producer.queue.name, { error, message });
      throw error;
    }
  }

  async consume(consumer: MessageConsumer): Promise<void> {
    try {
      await this.channel.consume(
        consumer.queue.queue.name,
        async (msg) => {
          if (!msg) return;

          try {
            const message: QueueMessage = JSON.parse(msg.content.toString());
            
            await consumer.handler(message);
            
            this.channel.ack(msg);
            this.emitEvent(QueueEventType.MESSAGE_CONSUMED, consumer.queue.name, message);
            
            this.logger.debug(`Consumed message from RabbitMQ queue: ${consumer.queue.name}, message ID: ${message.id}`);
          } catch (error) {
            this.logger.error(`Failed to process message: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.emitEvent(QueueEventType.MESSAGE_FAILED, consumer.queue.name, { error, message: msg });
            
            // Reject message and requeue
            this.channel.nack(msg, false, true);
          }
        },
        {
          consumerTag: consumer.options?.consumerTag,
          noAck: consumer.options?.noAck || false,
          arguments: consumer.options?.arguments,
        }
      );

      this.logger.log(`Started consuming from RabbitMQ queue: ${consumer.queue.name}`);
    } catch (error) {
      this.logger.error(`Failed to start consumer: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.emitEvent(QueueEventType.CONSUMER_ERROR, consumer.queue.name, { error });
      throw error;
    }
  }

  async getStats(queueName: string): Promise<QueueStats> {
    try {
      const queueInfo = await this.channel.checkQueue(queueName);
      
      return {
        queueName,
        messageCount: queueInfo.messageCount,
        readyMessages: queueInfo.messageCount,
        unacknowledgedMessages: 0, // RabbitMQ doesn't provide this directly
        consumerCount: queueInfo.consumerCount,
        memoryUsage: 0, // RabbitMQ doesn't provide this directly
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get RabbitMQ queue stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getHealth(queueName: string): Promise<QueueHealth> {
    const startTime = Date.now();
    
    try {
      await this.channel.checkQueue(queueName);
      
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
      await this.channel.deleteQueue(queueName);
      this.emitEvent(QueueEventType.QUEUE_DELETED, queueName, { queueName });
      this.logger.log(`Deleted RabbitMQ queue: ${queueName}`);
    } catch (error) {
      this.logger.error(`Failed to delete RabbitMQ queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async purgeQueue(queueName: string): Promise<void> {
    try {
      await this.channel.purgeQueue(queueName);
      this.logger.log(`Purged RabbitMQ queue: ${queueName}`);
    } catch (error) {
      this.logger.error(`Failed to purge RabbitMQ queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.logger.log('RabbitMQ provider closed');
    } catch (error) {
      this.logger.error(`Failed to close RabbitMQ provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private buildConnectionUrl(connection: any): string {
    const { host, port, username, password, vhost } = connection;
    const credentials = username && password ? `${username}:${password}@` : '';
    const vhostPath = vhost ? `/${vhost}` : '';
    
    return `amqp://${credentials}${host}:${port}${vhostPath}`;
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
