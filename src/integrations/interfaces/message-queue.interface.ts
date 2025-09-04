/**
 * Message queue message interface
 */
export interface QueueMessage<T = any> {
  /** Unique message ID */
  id: string;
  /** Message type/event name */
  type: string;
  /** Message payload */
  data: T;
  /** Message metadata */
  metadata?: Record<string, any>;
  /** Message timestamp */
  timestamp: Date;
  /** Message priority (higher = more important) */
  priority?: number;
  /** Message TTL in milliseconds */
  ttl?: number;
  /** Correlation ID for request-response pattern */
  correlationId?: string;
  /** Reply-to queue for request-response pattern */
  replyTo?: string;
  /** Message headers */
  headers?: Record<string, string>;
}

/**
 * Message queue producer interface
 */
export interface MessageProducer {
  /** Producer ID */
  id: string;
  /** Producer name */
  name: string;
  /** Queue configuration */
  queue: MessageQueueConfig;
  /** Whether the producer is active */
  active: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Message queue consumer interface
 */
export interface MessageConsumer {
  /** Consumer ID */
  id: string;
  /** Consumer name */
  name: string;
  /** Queue configuration */
  queue: MessageQueueConfig;
  /** Message handler function */
  handler: (message: QueueMessage) => Promise<void>;
  /** Whether the consumer is active */
  active: boolean;
  /** Consumer options */
  options?: ConsumerOptions;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Consumer options
 */
export interface ConsumerOptions {
  /** Prefetch count (RabbitMQ) */
  prefetchCount?: number;
  /** Consumer tag */
  consumerTag?: string;
  /** Whether to acknowledge messages automatically */
  noAck?: boolean;
  /** Consumer arguments */
  arguments?: Record<string, any>;
  /** Retry configuration */
  retry?: ConsumerRetryConfig;
  /** Dead letter queue configuration */
  deadLetterQueue?: DeadLetterQueueConfig;
}

/**
 * Consumer retry configuration
 */
export interface ConsumerRetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
  /** Retry delay multiplier */
  multiplier: number;
  /** Maximum retry delay */
  maxDelay: number;
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
}

/**
 * Dead letter queue configuration
 */
export interface DeadLetterQueueConfig {
  /** Dead letter exchange name */
  exchange: string;
  /** Dead letter routing key */
  routingKey: string;
  /** Whether to enable dead letter queue */
  enabled: boolean;
}

/**
 * Message queue statistics
 */
export interface QueueStats {
  /** Queue name */
  queueName: string;
  /** Total messages in queue */
  messageCount: number;
  /** Messages ready for consumption */
  readyMessages: number;
  /** Messages being processed */
  unacknowledgedMessages: number;
  /** Consumer count */
  consumerCount: number;
  /** Queue memory usage in bytes */
  memoryUsage: number;
  /** Last message timestamp */
  lastMessageAt?: Date;
  /** Queue creation timestamp */
  createdAt: Date;
}

/**
 * Message queue health status
 */
export interface QueueHealth {
  /** Queue name */
  queueName: string;
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Health check timestamp */
  checkedAt: Date;
  /** Error message if unhealthy */
  error?: string;
  /** Response time in milliseconds */
  responseTime?: number;
  /** Additional health details */
  details?: Record<string, any>;
}

/**
 * Message queue metrics
 */
export interface QueueMetrics {
  /** Queue name */
  queueName: string;
  /** Messages published per second */
  publishRate: number;
  /** Messages consumed per second */
  consumeRate: number;
  /** Average message processing time */
  averageProcessingTime: number;
  /** Error rate percentage */
  errorRate: number;
  /** Total messages published */
  totalPublished: number;
  /** Total messages consumed */
  totalConsumed: number;
  /** Total errors */
  totalErrors: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Message queue event types
 */
export enum QueueEventType {
  MESSAGE_PUBLISHED = 'message.published',
  MESSAGE_CONSUMED = 'message.consumed',
  MESSAGE_FAILED = 'message.failed',
  MESSAGE_RETRY = 'message.retry',
  MESSAGE_DLQ = 'message.dlq',
  CONSUMER_STARTED = 'consumer.started',
  CONSUMER_STOPPED = 'consumer.stopped',
  CONSUMER_ERROR = 'consumer.error',
  PRODUCER_STARTED = 'producer.started',
  PRODUCER_STOPPED = 'producer.stopped',
  PRODUCER_ERROR = 'producer.error',
  QUEUE_CREATED = 'queue.created',
  QUEUE_DELETED = 'queue.deleted',
  QUEUE_HEALTH_CHECK = 'queue.health_check',
}

/**
 * Message queue event
 */
export interface QueueEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: QueueEventType;
  /** Queue name */
  queueName: string;
  /** Event data */
  data: any;
  /** Event timestamp */
  timestamp: Date;
  /** Event metadata */
  metadata?: Record<string, any>;
}

/**
 * Message queue configuration for different providers
 */
export interface MessageQueueConfig {
  /** Queue name */
  name: string;
  /** Queue type */
  type: 'rabbitmq' | 'redis' | 'kafka';
  /** Connection configuration */
  connection: QueueConnectionConfig;
  /** Queue configuration */
  queue: QueueConfig;
  /** Exchange configuration (for RabbitMQ) */
  exchange?: ExchangeConfig;
  /** Topic configuration (for Kafka) */
  topic?: TopicConfig;
  /** Whether the queue is durable */
  durable: boolean;
  /** Whether to auto-delete the queue */
  autoDelete: boolean;
  /** Queue arguments */
  arguments?: Record<string, any>;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Queue connection configuration
 */
export interface QueueConnectionConfig {
  /** Host */
  host: string;
  /** Port */
  port: number;
  /** Username */
  username?: string;
  /** Password */
  password?: string;
  /** Virtual host (for RabbitMQ) */
  vhost?: string;
  /** SSL configuration */
  ssl?: boolean;
  /** Connection timeout */
  timeout?: number;
  /** Heartbeat interval */
  heartbeat?: number;
  /** Maximum frame size */
  frameMax?: number;
  /** Channel max */
  channelMax?: number;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  /** Queue name */
  name: string;
  /** Whether the queue is durable */
  durable: boolean;
  /** Whether the queue is exclusive */
  exclusive: boolean;
  /** Whether to auto-delete the queue */
  autoDelete: boolean;
  /** Queue arguments */
  arguments?: Record<string, any>;
  /** Dead letter exchange */
  deadLetterExchange?: string;
  /** Dead letter routing key */
  deadLetterRoutingKey?: string;
  /** Message TTL */
  messageTtl?: number;
  /** Maximum message size */
  maxMessageSize?: number;
  /** Maximum priority */
  maxPriority?: number;
}

/**
 * Exchange configuration (RabbitMQ)
 */
export interface ExchangeConfig {
  /** Exchange name */
  name: string;
  /** Exchange type */
  type: 'direct' | 'fanout' | 'topic' | 'headers';
  /** Whether the exchange is durable */
  durable: boolean;
  /** Whether to auto-delete the exchange */
  autoDelete: boolean;
  /** Exchange arguments */
  arguments?: Record<string, any>;
  /** Routing key */
  routingKey?: string;
  /** Binding pattern */
  bindingPattern?: string;
}

/**
 * Topic configuration (Kafka)
 */
export interface TopicConfig {
  /** Topic name */
  name: string;
  /** Number of partitions */
  partitions: number;
  /** Replication factor */
  replicationFactor: number;
  /** Topic configuration */
  config?: Record<string, any>;
  /** Consumer group */
  consumerGroup?: string;
  /** Auto offset reset */
  autoOffsetReset?: 'earliest' | 'latest';
  /** Enable auto commit */
  enableAutoCommit?: boolean;
  /** Session timeout */
  sessionTimeout?: number;
  /** Heartbeat interval */
  heartbeatInterval?: number;
}

/**
 * Message queue provider interface
 */
export interface MessageQueueProvider {
  /** Provider name */
  name: string;
  /** Provider type */
  type: 'rabbitmq' | 'redis' | 'kafka';
  /** Initialize the provider */
  initialize(config: MessageQueueConfig): Promise<void>;
  /** Create a producer */
  createProducer(config: MessageQueueConfig): Promise<MessageProducer>;
  /** Create a consumer */
  createConsumer(config: MessageQueueConfig, handler: (message: QueueMessage) => Promise<void>): Promise<MessageConsumer>;
  /** Publish a message */
  publish(producer: MessageProducer, message: QueueMessage): Promise<void>;
  /** Consume messages */
  consume(consumer: MessageConsumer): Promise<void>;
  /** Get queue statistics */
  getStats(queueName: string): Promise<QueueStats>;
  /** Get queue health */
  getHealth(queueName: string): Promise<QueueHealth>;
  /** Get queue metrics */
  getMetrics(queueName: string): Promise<QueueMetrics>;
  /** Delete a queue */
  deleteQueue(queueName: string): Promise<void>;
  /** Purge a queue */
  purgeQueue(queueName: string): Promise<void>;
  /** Close the provider */
  close(): Promise<void>;
}

/**
 * Message queue event handler
 */
export interface QueueEventHandler {
  /** Handle queue event */
  handle(event: QueueEvent): Promise<void>;
}

/**
 * Message queue error
 */
export interface QueueError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: any;
  /** Error timestamp */
  timestamp: Date;
  /** Queue name */
  queueName?: string;
  /** Message ID */
  messageId?: string;
}
