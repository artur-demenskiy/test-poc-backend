/**
 * Command interface for CQRS pattern
 */
export interface Command<T = any> {
  /** Command ID */
  id: string;
  /** Command type */
  type: string;
  /** Command data */
  data: T;
  /** Command metadata */
  metadata?: Record<string, any>;
  /** Command timestamp */
  timestamp: Date;
  /** User ID who issued the command */
  userId?: string;
  /** Command version */
  version?: number;
  /** Command correlation ID */
  correlationId?: string;
  /** Command causation ID */
  causationId?: string;
}

/**
 * Query interface for CQRS pattern
 */
export interface Query<T = any> {
  /** Query ID */
  id: string;
  /** Query type */
  type: string;
  /** Query parameters */
  params: T;
  /** Query metadata */
  metadata?: Record<string, any>;
  /** Query timestamp */
  timestamp: Date;
  /** User ID who issued the query */
  userId?: string;
  /** Query version */
  version?: number;
  /** Query correlation ID */
  correlationId?: string;
}

/**
 * Event interface for CQRS pattern
 */
export interface Event<T = any> {
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
  data: T;
  /** Event metadata */
  metadata?: Record<string, any>;
  /** Event timestamp */
  timestamp: Date;
  /** Event sequence number */
  sequenceNumber: number;
  /** Event correlation ID */
  correlationId?: string;
  /** Event causation ID */
  causationId?: string;
}

/**
 * Command handler interface
 */
export interface CommandHandler<TCommand extends Command = Command, TResult = any> {
  /** Handle command */
  handle(command: TCommand): Promise<TResult>;
}

/**
 * Query handler interface
 */
export interface QueryHandler<TQuery extends Query = Query, TResult = any> {
  /** Handle query */
  handle(query: TQuery): Promise<TResult>;
}

/**
 * Event handler interface
 */
export interface EventHandler<TEvent extends Event = Event> {
  /** Handle event */
  handle(event: TEvent): Promise<void>;
}

/**
 * Command bus interface
 */
export interface CommandBus {
  /** Execute command */
  execute<T extends Command, R = any>(command: T): Promise<R>;
  /** Register command handler */
  register<T extends Command, R = any>(commandType: string, handler: CommandHandler<T, R>): void;
  /** Unregister command handler */
  unregister(commandType: string): void;
}

/**
 * Query bus interface
 */
export interface QueryBus {
  /** Execute query */
  execute<T extends Query, R = any>(query: T): Promise<R>;
  /** Register query handler */
  register<T extends Query, R = any>(queryType: string, handler: QueryHandler<T, R>): void;
  /** Unregister query handler */
  unregister(queryType: string): void;
}

/**
 * Event bus interface
 */
export interface EventBus {
  /** Publish event */
  publish<T extends Event>(event: T): Promise<void>;
  /** Publish multiple events */
  publishAll<T extends Event>(events: T[]): Promise<void>;
  /** Subscribe to events */
  subscribe<T extends Event>(eventType: string, handler: EventHandler<T>): void;
  /** Unsubscribe from events */
  unsubscribe(eventType: string, handler: EventHandler): void;
}

/**
 * Aggregate interface for CQRS pattern
 */
export interface Aggregate {
  /** Aggregate ID */
  id: string;
  /** Aggregate type */
  type: string;
  /** Aggregate version */
  version: number;
  /** Aggregate state */
  state: any;
  /** Uncommitted events */
  uncommittedEvents: Event[];
  /** Apply event to aggregate */
  apply(event: Event): void;
  /** Get uncommitted events */
  getUncommittedEvents(): Event[];
  /** Mark events as committed */
  markEventsAsCommitted(): void;
  /** Load from events */
  loadFromEvents(events: Event[]): void;
}

/**
 * Repository interface for aggregates
 */
export interface Repository<TAggregate extends Aggregate = Aggregate> {
  /** Save aggregate */
  save(aggregate: TAggregate): Promise<void>;
  /** Get aggregate by ID */
  getById(id: string): Promise<TAggregate | null>;
  /** Get aggregate by ID with version */
  getByIdAndVersion(id: string, version: number): Promise<TAggregate | null>;
  /** Delete aggregate */
  delete(id: string): Promise<void>;
  /** Check if aggregate exists */
  exists(id: string): Promise<boolean>;
}

/**
 * Event store interface
 */
export interface EventStore {
  /** Append events */
  appendEvents(aggregateId: string, events: Event[], expectedVersion: number): Promise<void>;
  /** Get events for aggregate */
  getEvents(aggregateId: string, fromVersion?: number, toVersion?: number): Promise<Event[]>;
  /** Get events by type */
  getEventsByType(eventType: string, fromDate?: Date, toDate?: Date): Promise<Event[]>;
  /** Get events by correlation ID */
  getEventsByCorrelationId(correlationId: string): Promise<Event[]>;
  /** Get events by causation ID */
  getEventsByCausationId(causationId: string): Promise<Event[]>;
  /** Get events by aggregate type */
  getEventsByAggregateType(aggregateType: string, fromDate?: Date, toDate?: Date): Promise<Event[]>;
  /** Get events by date range */
  getEventsByDateRange(fromDate: Date, toDate: Date): Promise<Event[]>;
  /** Get event by ID */
  getEventById(eventId: string): Promise<Event | null>;
  /** Get last event for aggregate */
  getLastEvent(aggregateId: string): Promise<Event | null>;
  /** Get aggregate version */
  getAggregateVersion(aggregateId: string): Promise<number>;
  /** Check if aggregate exists */
  aggregateExists(aggregateId: string): Promise<boolean>;
  /** Delete events for aggregate */
  deleteEvents(aggregateId: string): Promise<void>;
  /** Get event store statistics */
  getStats(): Promise<EventStoreStats>;
}

/**
 * Event store statistics
 */
export interface EventStoreStats {
  /** Total events */
  totalEvents: number;
  /** Total aggregates */
  totalAggregates: number;
  /** Events by type */
  eventsByType: Record<string, number>;
  /** Events by aggregate type */
  eventsByAggregateType: Record<string, number>;
  /** Events by date */
  eventsByDate: Record<string, number>;
  /** Storage size in bytes */
  storageSize: number;
  /** Last event timestamp */
  lastEventAt?: Date;
  /** First event timestamp */
  firstEventAt?: Date;
}

/**
 * Snapshot store interface
 */
export interface SnapshotStore {
  /** Save snapshot */
  save(aggregateId: string, aggregate: Aggregate): Promise<void>;
  /** Get snapshot */
  get(aggregateId: string): Promise<Aggregate | null>;
  /** Get snapshot by version */
  getByVersion(aggregateId: string, version: number): Promise<Aggregate | null>;
  /** Delete snapshot */
  delete(aggregateId: string): Promise<void>;
  /** Get snapshot statistics */
  getStats(): Promise<SnapshotStoreStats>;
}

/**
 * Snapshot store statistics
 */
export interface SnapshotStoreStats {
  /** Total snapshots */
  totalSnapshots: number;
  /** Snapshots by aggregate type */
  snapshotsByAggregateType: Record<string, number>;
  /** Storage size in bytes */
  storageSize: number;
  /** Last snapshot timestamp */
  lastSnapshotAt?: Date;
  /** First snapshot timestamp */
  firstSnapshotAt?: Date;
}

/**
 * Projection interface
 */
export interface Projection {
  /** Projection ID */
  id: string;
  /** Projection name */
  name: string;
  /** Projection type */
  type: string;
  /** Projection state */
  state: any;
  /** Projection version */
  version: number;
  /** Last processed event */
  lastProcessedEvent?: Event;
  /** Last processed event timestamp */
  lastProcessedAt?: Date;
  /** Whether projection is active */
  active: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Projection handler interface
 */
export interface ProjectionHandler<TProjection extends Projection = Projection> {
  /** Handle event for projection */
  handle(event: Event, projection: TProjection): Promise<TProjection>;
  /** Get projection by ID */
  getById(id: string): Promise<TProjection | null>;
  /** Save projection */
  save(projection: TProjection): Promise<void>;
  /** Delete projection */
  delete(id: string): Promise<void>;
  /** Reset projection */
  reset(id: string): Promise<void>;
  /** Get projection statistics */
  getStats(): Promise<ProjectionStats>;
}

/**
 * Projection statistics
 */
export interface ProjectionStats {
  /** Total projections */
  totalProjections: number;
  /** Projections by type */
  projectionsByType: Record<string, number>;
  /** Active projections */
  activeProjections: number;
  /** Inactive projections */
  inactiveProjections: number;
  /** Last projection update */
  lastProjectionUpdate?: Date;
  /** Storage size in bytes */
  storageSize: number;
}

/**
 * CQRS configuration
 */
export interface CqrsConfig {
  /** Event store configuration */
  eventStore: EventStoreConfig;
  /** Snapshot store configuration */
  snapshotStore?: SnapshotStoreConfig;
  /** Projection configuration */
  projections?: ProjectionConfig[];
  /** Command bus configuration */
  commandBus?: CommandBusConfig;
  /** Query bus configuration */
  queryBus?: QueryBusConfig;
  /** Event bus configuration */
  eventBus?: EventBusConfig;
}

/**
 * Event store configuration
 */
export interface EventStoreConfig {
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
  /** Event retention configuration */
  retention?: EventRetentionConfig;
}

/**
 * Event snapshot configuration
 */
export interface EventSnapshotConfig {
  /** Snapshot frequency (number of events) */
  frequency: number;
  /** Snapshot retention period */
  retentionPeriod: number;
  /** Snapshot storage location */
  storageLocation: string;
}

/**
 * Event retention configuration
 */
export interface EventRetentionConfig {
  /** Event retention period */
  retentionPeriod: number;
  /** Archive events after retention period */
  archiveAfterRetention: boolean;
  /** Archive storage location */
  archiveStorageLocation?: string;
  /** Compress archived events */
  compressArchived: boolean;
}

/**
 * Snapshot store configuration
 */
export interface SnapshotStoreConfig {
  /** Snapshot store type */
  type: 'database' | 'file' | 'cache';
  /** Connection configuration */
  connection: Record<string, any>;
  /** Snapshot serialization format */
  serializationFormat: 'json' | 'avro' | 'protobuf';
  /** Snapshot compression */
  compression: boolean;
}

/**
 * Projection configuration
 */
export interface ProjectionConfig {
  /** Projection name */
  name: string;
  /** Projection type */
  type: string;
  /** Event types to handle */
  eventTypes: string[];
  /** Projection handler class */
  handler: string;
  /** Projection options */
  options?: Record<string, any>;
}

import { MessageQueueConfig } from './message-queue.interface';

/**
 * Command bus configuration
 */
export interface CommandBusConfig {
  /** Command bus type */
  type: 'in-memory' | 'message-queue' | 'distributed';
  /** Message queue configuration (if using message queue) */
  messageQueue?: MessageQueueConfig;
  /** Command timeout */
  timeout: number;
  /** Retry configuration */
  retry?: CommandRetryConfig;
}

/**
 * Command retry configuration
 */
export interface CommandRetryConfig {
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
 * Query bus configuration
 */
export interface QueryBusConfig {
  /** Query bus type */
  type: 'in-memory' | 'message-queue' | 'distributed';
  /** Message queue configuration (if using message queue) */
  messageQueue?: MessageQueueConfig;
  /** Query timeout */
  timeout: number;
  /** Cache configuration */
  cache?: QueryCacheConfig;
}

/**
 * Query cache configuration
 */
export interface QueryCacheConfig {
  /** Cache type */
  type: 'memory' | 'redis' | 'database';
  /** Cache TTL */
  ttl: number;
  /** Cache key prefix */
  keyPrefix: string;
  /** Cache connection configuration */
  connection?: Record<string, any>;
}

/**
 * Event bus configuration
 */
export interface EventBusConfig {
  /** Event bus type */
  type: 'in-memory' | 'message-queue' | 'distributed';
  /** Message queue configuration (if using message queue) */
  messageQueue?: MessageQueueConfig;
  /** Event persistence */
  persistence: boolean;
  /** Event ordering */
  ordering: boolean;
  /** Event deduplication */
  deduplication: boolean;
}
