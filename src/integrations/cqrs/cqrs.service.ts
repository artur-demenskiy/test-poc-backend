import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InMemoryCommandBus } from './cqrs-buses.service';
import { InMemoryQueryBus } from './cqrs-buses.service';
import { InMemoryEventBus } from './cqrs-buses.service';
import { InMemoryEventStore } from './event-store.service';
import {
  Command,
  Query,
  Event,
  CommandHandler,
  QueryHandler,
  EventHandler,
  EventStoreStats,
  Projection,
  ProjectionHandler,
  ProjectionStats,
} from '../interfaces/cqrs.interface';

@Injectable()
export class CqrsService implements OnModuleInit {
  private readonly logger = new Logger(CqrsService.name);
  private projections: Map<string, Projection> = new Map();
  private projectionHandlers: Map<string, ProjectionHandler> = new Map();

  constructor(
    private readonly commandBus: InMemoryCommandBus,
    private readonly queryBus: InMemoryQueryBus,
    private readonly eventBus: InMemoryEventBus,
    private readonly eventStore: InMemoryEventStore,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing CQRS Service');
    
    // Register default handlers
    await this.registerDefaultHandlers();
    
    this.logger.log('CQRS Service initialized');
  }

  /**
   * Execute a command
   */
  async executeCommand<T extends Command, R = any>(command: T): Promise<R> {
    this.logger.debug(`Executing command: ${command.type}`);
    return await this.commandBus.execute(command);
  }

  /**
   * Execute a query
   */
  async executeQuery<T extends Query, R = any>(query: T): Promise<R> {
    this.logger.debug(`Executing query: ${query.type}`);
    return await this.queryBus.execute(query);
  }

  /**
   * Publish an event
   */
  async publishEvent<T extends Event>(event: T): Promise<void> {
    this.logger.debug(`Publishing event: ${event.type}`);
    
    // Store event first
    await this.eventStore.appendEvents(event.aggregateId, [event], event.version - 1);
    
    // Then publish to event bus
    await this.eventBus.publish(event);
    
    // Update projections
    await this.updateProjections(event);
  }

  /**
   * Publish multiple events
   */
  async publishEvents<T extends Event>(events: T[]): Promise<void> {
    this.logger.debug(`Publishing ${events.length} events`);
    
    for (const event of events) {
      await this.publishEvent(event);
    }
  }

  /**
   * Register a command handler
   */
  registerCommandHandler<T extends Command, R = any>(
    commandType: string,
    handler: CommandHandler<T, R>
  ): void {
    this.logger.log(`Registering command handler: ${commandType}`);
    this.commandBus.register(commandType, handler);
  }

  /**
   * Register a query handler
   */
  registerQueryHandler<T extends Query, R = any>(
    queryType: string,
    handler: QueryHandler<T, R>
  ): void {
    this.logger.log(`Registering query handler: ${queryType}`);
    this.queryBus.register(queryType, handler);
  }

  /**
   * Subscribe to events
   */
  subscribeToEvents<T extends Event>(eventType: string, handler: EventHandler<T>): void {
    this.logger.log(`Subscribing to events: ${eventType}`);
    this.eventBus.subscribe(eventType, handler);
  }

  /**
   * Unsubscribe from events
   */
  unsubscribeFromEvents(eventType: string, handler: EventHandler): void {
    this.logger.log(`Unsubscribing from events: ${eventType}`);
    this.eventBus.unsubscribe(eventType, handler);
  }

  /**
   * Create a projection
   */
  async createProjection(projection: Projection): Promise<string> {
    this.logger.log(`Creating projection: ${projection.name}`);
    
    this.projections.set(projection.id, projection);
    
    this.logger.log(`Projection created: ${projection.id}`);
    return projection.id;
  }

  /**
   * Get projection by ID
   */
  getProjection(projectionId: string): Projection | undefined {
    return this.projections.get(projectionId);
  }

  /**
   * List all projections
   */
  listProjections(): Projection[] {
    return Array.from(this.projections.values());
  }

  /**
   * Update projection
   */
  async updateProjection(projectionId: string, updates: Partial<Projection>): Promise<void> {
    this.logger.log(`Updating projection: ${projectionId}`);
    
    const projection = this.projections.get(projectionId);
    if (!projection) {
      throw new Error(`Projection not found: ${projectionId}`);
    }

    const updatedProjection = { ...projection, ...updates, updatedAt: new Date() };
    this.projections.set(projectionId, updatedProjection);
    
    this.logger.log(`Projection updated: ${projectionId}`);
  }

  /**
   * Delete projection
   */
  async deleteProjection(projectionId: string): Promise<void> {
    this.logger.log(`Deleting projection: ${projectionId}`);
    
    const projection = this.projections.get(projectionId);
    if (!projection) {
      throw new Error(`Projection not found: ${projectionId}`);
    }

    this.projections.delete(projectionId);
    this.projectionHandlers.delete(projectionId);
    
    this.logger.log(`Projection deleted: ${projectionId}`);
  }

  /**
   * Register a projection handler
   */
  registerProjectionHandler<TProjection extends Projection = Projection>(
    projectionId: string,
    handler: ProjectionHandler<TProjection>
  ): void {
    this.logger.log(`Registering projection handler: ${projectionId}`);
    this.projectionHandlers.set(projectionId, handler);
  }

  /**
   * Get event store statistics
   */
  async getEventStoreStats(): Promise<EventStoreStats> {
    return await this.eventStore.getStats();
  }

  /**
   * Get projection statistics
   */
  async getProjectionStats(): Promise<ProjectionStats> {
    const projections = Array.from(this.projections.values());
    const projectionsByType: Record<string, number> = {};
    
    for (const projection of projections) {
      projectionsByType[projection.type] = (projectionsByType[projection.type] || 0) + 1;
    }
    
    const activeProjections = projections.filter(p => p.active).length;
    const inactiveProjections = projections.filter(p => !p.active).length;
    
    const lastUpdate = projections.length > 0 ? 
      projections.reduce((latest, current) => 
        current.updatedAt > latest.updatedAt ? current : latest
      ).updatedAt : undefined;
    
    return {
      totalProjections: projections.length,
      projectionsByType,
      activeProjections,
      inactiveProjections,
      lastProjectionUpdate: lastUpdate,
      storageSize: 0, // In-memory storage
    };
  }

  /**
   * Get system overview
   */
  getSystemOverview(): {
    totalCommands: number;
    totalQueries: number;
    totalEvents: number;
    totalProjections: number;
    activeProjections: number;
    eventStoreSize: number;
  } {
    const projections = Array.from(this.projections.values());
    
    return {
      totalCommands: 0, // Would need to track command execution count
      totalQueries: 0, // Would need to track query execution count
      totalEvents: 0, // Would need to track event count
      totalProjections: projections.length,
      activeProjections: projections.filter(p => p.active).length,
      eventStoreSize: 0, // Would need to get from event store
    };
  }

  /**
   * Update projections for an event
   */
  private async updateProjections(event: Event): Promise<void> {
    this.logger.debug(`Updating projections for event: ${event.type}`);
    
    for (const [projectionId, projection] of this.projections.entries()) {
      if (!projection.active) continue;
      
      const handler = this.projectionHandlers.get(projectionId);
      if (!handler) continue;
      
      try {
        const updatedProjection = await handler.handle(event, projection);
        this.projections.set(projectionId, updatedProjection);
      } catch (error) {
        this.logger.error(`Failed to update projection ${projectionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Register default handlers
   */
  private async registerDefaultHandlers(): Promise<void> {
    this.logger.log('Registering default CQRS handlers');
    
    // Example command handler
    this.registerCommandHandler('CreateUser', {
      handle: async (command) => {
        this.logger.debug(`Handling CreateUser command: ${command.id}`);
        // Mock implementation
        return { userId: `user_${Date.now()}` };
      }
    });

    // Example query handler
    this.registerQueryHandler('GetUser', {
      handle: async (query) => {
        this.logger.debug(`Handling GetUser query: ${query.id}`);
        // Mock implementation
        return { id: query.params.userId, name: 'John Doe' };
      }
    });

    // Example event handler
    this.subscribeToEvents('UserCreated', {
      handle: async (event) => {
        this.logger.debug(`Handling UserCreated event: ${event.id}`);
        // Mock implementation
        console.log(`User created: ${event.aggregateId}`);
      }
    });

    this.logger.log('Default CQRS handlers registered');
  }

  /**
   * Scheduled cleanup
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async performCleanup(): Promise<void> {
    this.logger.log('Performing CQRS cleanup');
    
    // Clean up inactive projections
    const now = new Date();
    const inactiveThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const [id, projection] of this.projections.entries()) {
      if (!projection.active && (now.getTime() - projection.updatedAt.getTime()) > inactiveThreshold) {
        this.projections.delete(id);
        this.projectionHandlers.delete(id);
        this.logger.debug(`Cleaned up inactive projection: ${id}`);
      }
    }
  }
}
