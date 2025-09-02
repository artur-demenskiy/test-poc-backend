/**
 * Webhook configuration interface
 */
export interface WebhookConfig {
  /** Unique identifier for the webhook */
  id: string;
  /** Webhook name */
  name: string;
  /** Target URL for webhook delivery */
  url: string;
  /** HTTP method for webhook delivery */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Event types that trigger this webhook */
  events: string[];
  /** Headers to include in webhook request */
  headers?: Record<string, string>;
  /** Authentication configuration */
  auth?: WebhookAuth;
  /** Retry configuration */
  retry?: WebhookRetryConfig;
  /** Whether the webhook is active */
  active: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Webhook authentication configuration
 */
export interface WebhookAuth {
  /** Authentication type */
  type: 'none' | 'basic' | 'bearer' | 'hmac' | 'custom';
  /** Username for basic auth */
  username?: string;
  /** Password for basic auth */
  password?: string;
  /** Bearer token */
  token?: string;
  /** HMAC secret key */
  secret?: string;
  /** Custom auth headers */
  customHeaders?: Record<string, string>;
}

/**
 * Webhook retry configuration
 */
export interface WebhookRetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial retry delay in milliseconds */
  initialDelay: number;
  /** Maximum retry delay in milliseconds */
  maxDelay: number;
  /** Retry delay multiplier */
  multiplier: number;
  /** HTTP status codes that trigger retry */
  retryStatusCodes: number[];
}

/**
 * Webhook delivery attempt */
export interface WebhookDelivery {
  /** Delivery attempt ID */
  id: string;
  /** Webhook ID */
  webhookId: string;
  /** Event that triggered the delivery */
  event: string;
  /** Payload sent in the webhook */
  payload: any;
  /** HTTP status code received */
  statusCode?: number;
  /** Response body received */
  responseBody?: string;
  /** Error message if delivery failed */
  error?: string;
  /** Attempt number */
  attempt: number;
  /** Delivery timestamp */
  deliveredAt: Date;
  /** Next retry timestamp */
  nextRetryAt?: Date;
}

/**
 * API integration configuration */
export interface ApiIntegrationConfig {
  /** Unique identifier for the integration */
  id: string;
  /** Integration name */
  name: string;
  /** Integration provider (e.g., 'stripe', 'github', 'slack') */
  provider: string;
  /** Base URL for API calls */
  baseUrl: string;
  /** API version */
  version?: string;
  /** Authentication configuration */
  auth: ApiAuthConfig;
  /** Rate limiting configuration */
  rateLimit?: ApiRateLimitConfig;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Whether the integration is active */
  active: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * API authentication configuration */
export interface ApiAuthConfig {
  /** Authentication type */
  type: 'none' | 'api_key' | 'bearer' | 'oauth2' | 'basic' | 'custom';
  /** API key */
  apiKey?: string;
  /** Bearer token */
  token?: string;
  /** OAuth2 configuration */
  oauth2?: OAuth2Config;
  /** Username for basic auth */
  username?: string;
  /** Password for basic auth */
  password?: string;
  /** Custom headers */
  customHeaders?: Record<string, string>;
}

/**
 * OAuth2 configuration */
export interface OAuth2Config {
  /** Client ID */
  clientId: string;
  /** Client secret */
  clientSecret: string;
  /** Authorization URL */
  authorizationUrl: string;
  /** Token URL */
  tokenUrl: string;
  /** Scopes */
  scopes: string[];
  /** Redirect URI */
  redirectUri: string;
}

/**
 * API rate limiting configuration */
export interface ApiRateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Whether to use distributed rate limiting */
  distributed: boolean;
}

/**
 * ETL pipeline configuration */
export interface EtlPipelineConfig {
  /** Unique identifier for the pipeline */
  id: string;
  /** Pipeline name */
  name: string;
  /** Pipeline description */
  description?: string;
  /** Source configuration */
  source: EtlSourceConfig;
  /** Transform configuration */
  transform: EtlTransformConfig;
  /** Destination configuration */
  destination: EtlDestinationConfig;
  /** Schedule configuration */
  schedule?: EtlScheduleConfig;
  /** Error handling configuration */
  errorHandling: EtlErrorHandlingConfig;
  /** Whether the pipeline is active */
  active: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * ETL source configuration */
export interface EtlSourceConfig {
  /** Source type */
  type: 'database' | 'api' | 'file' | 'message_queue' | 'stream';
  /** Source connection details */
  connection: Record<string, any>;
  /** Query or filter for data extraction */
  query?: string;
  /** Batch size for processing */
  batchSize?: number;
  /** Incremental loading configuration */
  incremental?: EtlIncrementalConfig;
}

/**
 * ETL incremental loading configuration */
export interface EtlIncrementalConfig {
  /** Column to track for incremental loading */
  trackingColumn: string;
  /** Last processed value */
  lastProcessedValue?: any;
  /** Whether to use timestamp-based tracking */
  useTimestamp: boolean;
}

/**
 * ETL transform configuration */
export interface EtlTransformConfig {
  /** Transform type */
  type: 'none' | 'mapping' | 'filter' | 'aggregate' | 'custom';
  /** Field mappings */
  mappings?: Record<string, string>;
  /** Filter conditions */
  filters?: EtlFilterCondition[];
  /** Aggregation configuration */
  aggregations?: EtlAggregationConfig[];
  /** Custom transform function */
  customTransform?: string;
}

/**
 * ETL filter condition */
export interface EtlFilterCondition {
  /** Field name */
  field: string;
  /** Operator */
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'regex';
  /** Value to compare against */
  value: any;
}

/**
 * ETL aggregation configuration */
export interface EtlAggregationConfig {
  /** Aggregation type */
  type: 'sum' | 'count' | 'average' | 'min' | 'max' | 'group_by';
  /** Field to aggregate */
  field: string;
  /** Group by fields */
  groupBy?: string[];
}

/**
 * ETL destination configuration */
export interface EtlDestinationConfig {
  /** Destination type */
  type: 'database' | 'api' | 'file' | 'message_queue' | 'data_warehouse';
  /** Destination connection details */
  connection: Record<string, any>;
  /** Table or endpoint name */
  target: string;
  /** Write mode */
  mode: 'insert' | 'update' | 'upsert' | 'replace';
  /** Conflict resolution strategy */
  conflictResolution?: 'ignore' | 'update' | 'error';
}

/**
 * ETL schedule configuration */
export interface EtlScheduleConfig {
  /** Schedule type */
  type: 'manual' | 'scheduled' | 'event_driven';
  /** Cron expression for scheduled runs */
  cronExpression?: string;
  /** Trigger events */
  triggerEvents?: string[];
  /** Timezone */
  timezone?: string;
}

/**
 * ETL error handling configuration */
export interface EtlErrorHandlingConfig {
  /** Maximum retry attempts */
  maxRetries: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
  /** Whether to continue on error */
  continueOnError: boolean;
  /** Error notification configuration */
  notifications?: EtlNotificationConfig[];
}

/**
 * ETL notification configuration */
export interface EtlNotificationConfig {
  /** Notification type */
  type: 'email' | 'webhook' | 'slack' | 'sms';
  /** Notification target */
  target: string;
  /** Notification template */
  template?: string;
}

/**
 * Message queue configuration */
export interface MessageQueueConfig {
  /** Unique identifier for the queue */
  id: string;
  /** Queue name */
  name: string;
  /** Queue type */
  type: 'rabbitmq' | 'redis' | 'kafka' | 'sqs' | 'pubsub';
  /** Connection configuration */
  connection: MessageQueueConnectionConfig;
  /** Queue configuration */
  queue: MessageQueueQueueConfig;
  /** Exchange configuration (for RabbitMQ) */
  exchange?: MessageQueueExchangeConfig;
  /** Consumer configuration */
  consumer?: MessageQueueConsumerConfig;
  /** Whether the queue is active */
  active: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Message queue connection configuration */
export interface MessageQueueConnectionConfig {
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
}

/**
 * Message queue configuration */
export interface MessageQueueQueueConfig {
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
}

/**
 * Message queue exchange configuration */
export interface MessageQueueExchangeConfig {
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
}

/**
 * Message queue consumer configuration */
export interface MessageQueueConsumerConfig {
  /** Consumer tag */
  tag?: string;
  /** Whether to acknowledge messages automatically */
  noAck: boolean;
  /** Consumer arguments */
  arguments?: Record<string, any>;
  /** Prefetch count */
  prefetchCount?: number;
}

/**
 * Event sourcing configuration */
export interface EventSourcingConfig {
  /** Unique identifier for the event store */
  id: string;
  /** Event store name */
  name: string;
  /** Event store type */
  type: 'database' | 'file' | 'stream';
  /** Connection configuration */
  connection: Record<string, any>;
  /** Event serialization format */
  serializationFormat: 'json' | 'avro' | 'protobuf';
  /** Event versioning strategy */
  versioning: 'none' | 'semantic' | 'timestamp';
  /** Snapshot configuration */
  snapshot?: EventSnapshotConfig;
  /** Whether the event store is active */
  active: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Event snapshot configuration */
export interface EventSnapshotConfig {
  /** Snapshot frequency (number of events) */
  frequency: number;
  /** Snapshot retention period */
  retentionPeriod: number;
  /** Snapshot storage location */
  storageLocation: string;
}

/**
 * Event interface */
export interface Event {
  /** Event ID */
  id: string;
  /** Event type */
  type: string;
  /** Aggregate ID */
  aggregateId: string;
  /** Aggregate type */
  aggregateType: string;
  /** Event version */
  version: number;
  /** Event data */
  data: any;
  /** Event metadata */
  metadata?: Record<string, any>;
  /** Event timestamp */
  timestamp: Date;
  /** Event sequence number */
  sequenceNumber: number;
}

/**
 * CQRS command interface */
export interface Command {
  /** Command ID */
  id: string;
  /** Command type */
  type: string;
  /** Command data */
  data: any;
  /** Command metadata */
  metadata?: Record<string, any>;
  /** Command timestamp */
  timestamp: Date;
  /** User ID who issued the command */
  userId?: string;
}

/**
 * CQRS query interface */
export interface Query {
  /** Query ID */
  id: string;
  /** Query type */
  type: string;
  /** Query parameters */
  params: any;
  /** Query metadata */
  metadata?: Record<string, any>;
  /** Query timestamp */
  timestamp: Date;
  /** User ID who issued the query */
  userId?: string;
}

/**
 * Integration monitoring metrics */
export interface IntegrationMetrics {
  /** Integration ID */
  integrationId: string;
  /** Integration type */
  type: 'webhook' | 'api' | 'etl' | 'message_queue';
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Average response time */
  averageResponseTime: number;
  /** Last request timestamp */
  lastRequestAt?: Date;
  /** Error rate percentage */
  errorRate: number;
  /** Throughput (requests per minute) */
  throughput: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Integration health status */
export interface IntegrationHealth {
  /** Integration ID */
  integrationId: string;
  /** Integration type */
  type: 'webhook' | 'api' | 'etl' | 'message_queue';
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
