import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { MessageQueueService } from './message-queue.service';
import {
  MessageQueueConfig,
  QueueMessage,
  QueueStats,
  QueueHealth,
  QueueMetrics,
  QueueEvent,
  QueueEventType,
} from '../interfaces/message-queue.interface';

export class CreateQueueDto {
  /** Queue name */
  name: string;
  /** Queue type */
  type: 'rabbitmq' | 'redis' | 'kafka';
  /** Connection configuration */
  connection: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    vhost?: string;
    ssl?: boolean;
    timeout?: number;
  };
  /** Queue configuration */
  queue: {
    name: string;
    durable: boolean;
    exclusive: boolean;
    autoDelete: boolean;
    arguments?: Record<string, any>;
  };
  /** Exchange configuration (for RabbitMQ) */
  exchange?: {
    name: string;
    type: 'direct' | 'fanout' | 'topic' | 'headers';
    durable: boolean;
    autoDelete: boolean;
    routingKey?: string;
  };
  /** Topic configuration (for Kafka) */
  topic?: {
    name: string;
    partitions: number;
    replicationFactor: number;
    consumerGroup?: string;
    autoOffsetReset?: 'earliest' | 'latest';
  };
  /** Whether the queue is durable */
  durable: boolean;
  /** Whether to auto-delete the queue */
  autoDelete: boolean;
}

export class UpdateQueueDto {
  /** Queue configuration updates */
  connection?: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    vhost?: string;
    ssl?: boolean;
    timeout?: number;
  };
  /** Queue configuration updates */
  queue?: {
    durable?: boolean;
    exclusive?: boolean;
    autoDelete?: boolean;
    arguments?: Record<string, any>;
  };
  /** Exchange configuration updates */
  exchange?: {
    durable?: boolean;
    autoDelete?: boolean;
    routingKey?: string;
  };
  /** Topic configuration updates */
  topic?: {
    partitions?: number;
    replicationFactor?: number;
    consumerGroup?: string;
    autoOffsetReset?: 'earliest' | 'latest';
  };
  /** Whether the queue is durable */
  durable?: boolean;
  /** Whether to auto-delete the queue */
  autoDelete?: boolean;
}

export class PublishMessageDto {
  /** Message type */
  type: string;
  /** Message data */
  data: any;
  /** Message metadata */
  metadata?: Record<string, any>;
  /** Message priority */
  priority?: number;
  /** Message TTL in milliseconds */
  ttl?: number;
  /** Correlation ID */
  correlationId?: string;
  /** Reply-to queue */
  replyTo?: string;
  /** Message headers */
  headers?: Record<string, string>;
}

export class CreateConsumerDto {
  /** Consumer name */
  name: string;
  /** Message handler configuration */
  handler: {
    type: 'function' | 'webhook' | 'event';
    config: Record<string, any>;
  };
  /** Consumer options */
  options?: {
    prefetchCount?: number;
    noAck?: boolean;
    retry?: {
      maxAttempts: number;
      retryDelay: number;
      multiplier: number;
      maxDelay: number;
      exponentialBackoff: boolean;
    };
  };
}

@ApiTags('Message Queues')
@Controller('message-queues')
export class MessageQueueController {
  constructor(private readonly messageQueueService: MessageQueueService) {}

  @Post()
  @ApiOperation({ summary: 'Create new message queue' })
  @ApiResponse({ status: 201, description: 'Queue created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid queue configuration' })
  async createQueue(@Body() createDto: CreateQueueDto): Promise<{ id: string; message: string }> {
    const config: MessageQueueConfig = {
      ...createDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const id = await this.messageQueueService.createQueue(config);
    return {
      id,
      message: 'Message queue created successfully',
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all queue configurations' })
  @ApiResponse({ status: 200, description: 'Queue configurations retrieved' })
  async listQueues(): Promise<MessageQueueConfig[]> {
    return this.messageQueueService.listQueueConfigs();
  }

  @Get(':name')
  @ApiOperation({ summary: 'Get queue configuration' })
  @ApiParam({ name: 'name', description: 'Queue name' })
  @ApiResponse({ status: 200, description: 'Queue configuration retrieved' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async getQueue(@Param('name') name: string): Promise<MessageQueueConfig> {
    const config = this.messageQueueService.getQueueConfig(name);
    if (!config) {
      throw new Error(`Queue configuration not found: ${name}`);
    }
    return config;
  }

  @Put(':name')
  @ApiOperation({ summary: 'Update queue configuration' })
  @ApiParam({ name: 'name', description: 'Queue name' })
  @ApiResponse({ status: 200, description: 'Queue configuration updated' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async updateQueue(
    @Param('name') name: string,
    @Body() updateDto: UpdateQueueDto
  ): Promise<{ message: string }> {
    // Convert UpdateQueueDto to Partial<MessageQueueConfig>
    const configUpdate: any = {
      ...updateDto,
      updatedAt: new Date(),
    };
    
    await this.messageQueueService.updateQueue(name, configUpdate);
    return { message: 'Queue configuration updated successfully' };
  }

  @Delete(':name')
  @ApiOperation({ summary: 'Delete queue configuration' })
  @ApiParam({ name: 'name', description: 'Queue name' })
  @ApiResponse({ status: 200, description: 'Queue configuration deleted' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async deleteQueue(@Param('name') name: string): Promise<{ message: string }> {
    await this.messageQueueService.deleteQueue(name);
    return { message: 'Queue configuration deleted successfully' };
  }

  @Post(':name/publish')
  @ApiOperation({ summary: 'Publish message to queue' })
  @ApiParam({ name: 'name', description: 'Queue name' })
  @ApiResponse({ status: 200, description: 'Message published successfully' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async publishMessage(
    @Param('name') name: string,
    @Body() publishDto: PublishMessageDto
  ): Promise<{ message: string; messageId: string }> {
    const message: QueueMessage = {
      id: `msg_${Date.now()}_${Math.random()}`,
      type: publishDto.type,
      data: publishDto.data,
      metadata: publishDto.metadata,
      timestamp: new Date(),
      priority: publishDto.priority,
      ttl: publishDto.ttl,
      correlationId: publishDto.correlationId,
      replyTo: publishDto.replyTo,
      headers: publishDto.headers,
    };

    await this.messageQueueService.publishMessage(name, message);
    return {
      message: 'Message published successfully',
      messageId: message.id,
    };
  }

  @Post(':name/consume')
  @ApiOperation({ summary: 'Start consuming messages from queue' })
  @ApiParam({ name: 'name', description: 'Queue name' })
  @ApiResponse({ status: 200, description: 'Consumer started successfully' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async startConsumer(
    @Param('name') name: string,
    @Body() consumerDto: CreateConsumerDto
  ): Promise<{ message: string; consumerId: string }> {
    const handler = async (message: QueueMessage): Promise<void> => {
      // Mock handler - in real implementation, this would be configurable
      console.log(`Processing message: ${message.id} of type: ${message.type}`);
      
      if (consumerDto.handler.type === 'webhook') {
        // Send to webhook
        console.log(`Sending to webhook: ${consumerDto.handler.config.url}`);
      } else if (consumerDto.handler.type === 'event') {
        // Emit event
        console.log(`Emitting event: ${consumerDto.handler.config.eventType}`);
      }
    };

    const consumer = await this.messageQueueService.createConsumer(name, handler);
    await this.messageQueueService.startConsumer(name, handler);
    
    return {
      message: 'Consumer started successfully',
      consumerId: consumer.id,
    };
  }

  @Get(':name/stats')
  @ApiOperation({ summary: 'Get queue statistics' })
  @ApiParam({ name: 'name', description: 'Queue name' })
  @ApiResponse({ status: 200, description: 'Queue statistics retrieved' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async getQueueStats(@Param('name') name: string): Promise<QueueStats> {
    return await this.messageQueueService.getQueueStats(name);
  }

  @Get(':name/health')
  @ApiOperation({ summary: 'Get queue health status' })
  @ApiParam({ name: 'name', description: 'Queue name' })
  @ApiResponse({ status: 200, description: 'Queue health status retrieved' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async getQueueHealth(@Param('name') name: string): Promise<QueueHealth> {
    return await this.messageQueueService.getQueueHealth(name);
  }

  @Get(':name/metrics')
  @ApiOperation({ summary: 'Get queue metrics' })
  @ApiParam({ name: 'name', description: 'Queue name' })
  @ApiQuery({ name: 'timeRange', required: false, description: 'Time range for metrics' })
  @ApiResponse({ status: 200, description: 'Queue metrics retrieved' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async getQueueMetrics(
    @Param('name') name: string,
    @Query('timeRange') _timeRange?: string
  ): Promise<QueueMetrics> {
    return await this.messageQueueService.getQueueMetrics(name);
  }

  @Get('stats/all')
  @ApiOperation({ summary: 'Get all queue statistics' })
  @ApiResponse({ status: 200, description: 'All queue statistics retrieved' })
  async getAllQueueStats(): Promise<QueueStats[]> {
    return await this.messageQueueService.getAllQueueStats();
  }

  @Get('health/all')
  @ApiOperation({ summary: 'Get all queue health statuses' })
  @ApiResponse({ status: 200, description: 'All queue health statuses retrieved' })
  async getAllQueueHealth(): Promise<QueueHealth[]> {
    return await this.messageQueueService.getAllQueueHealth();
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get message queue system overview' })
  @ApiResponse({ status: 200, description: 'System overview retrieved' })
  getSystemOverview(): {
    totalQueues: number;
    totalProducers: number;
    totalConsumers: number;
    activeQueues: number;
    healthyQueues: number;
    degradedQueues: number;
    unhealthyQueues: number;
  } {
    return this.messageQueueService.getSystemOverview();
  }

  @Post('health/check')
  @ApiOperation({ summary: 'Perform health check for all queues' })
  @ApiResponse({ status: 200, description: 'Health check completed' })
  async performHealthCheck(): Promise<{ message: string; results: QueueHealth[] }> {
    const results = await this.messageQueueService.getAllQueueHealth();
    return {
      message: 'Health check completed',
      results,
    };
  }

  @Post('events/subscribe')
  @ApiOperation({ summary: 'Subscribe to queue events' })
  @ApiResponse({ status: 200, description: 'Event subscription created' })
  async subscribeToEvents(@Body() subscription: {
    eventType: QueueEventType;
    handler: {
      type: 'webhook' | 'function';
      config: Record<string, any>;
    };
  }): Promise<{ message: string; subscriptionId: string }> {
    const handler = async (_event: QueueEvent): Promise<void> => {
      if (subscription.handler.type === 'webhook') {
        // Send to webhook
        console.log(`Sending event to webhook: ${subscription.handler.config.url}`);
      } else {
        // Execute function
        console.log(`Executing function: ${subscription.handler.config.functionName}`);
      }
    };

    this.messageQueueService.subscribeToEvents(subscription.eventType, handler);
    
    return {
      message: 'Event subscription created successfully',
      subscriptionId: `sub_${Date.now()}_${Math.random()}`,
    };
  }
}
