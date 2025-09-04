import { Injectable, Logger } from '@nestjs/common';
import {
  CommandBus,
  QueryBus,
  EventBus,
  Command,
  Query,
  Event,
  CommandHandler,
  QueryHandler,
  EventHandler,
} from '../interfaces/cqrs.interface';

@Injectable()
export class InMemoryCommandBus implements CommandBus {
  private readonly logger = new Logger(InMemoryCommandBus.name);
  private handlers: Map<string, CommandHandler> = new Map();

  async execute<T extends Command, R = any>(command: T): Promise<R> {
    this.logger.debug(`Executing command: ${command.type}`);
    
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`No handler registered for command type: ${command.type}`);
    }

    try {
      const result = await handler.handle(command);
      this.logger.debug(`Command executed successfully: ${command.type}`);
      return result;
    } catch (error) {
      this.logger.error(`Command execution failed: ${command.type}, error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  register<T extends Command, R = any>(commandType: string, handler: CommandHandler<T, R>): void {
    this.logger.log(`Registering command handler: ${commandType}`);
    this.handlers.set(commandType, handler);
  }

  unregister(commandType: string): void {
    this.logger.log(`Unregistering command handler: ${commandType}`);
    this.handlers.delete(commandType);
  }
}

@Injectable()
export class InMemoryQueryBus implements QueryBus {
  private readonly logger = new Logger(InMemoryQueryBus.name);
  private handlers: Map<string, QueryHandler> = new Map();

  async execute<T extends Query, R = any>(query: T): Promise<R> {
    this.logger.debug(`Executing query: ${query.type}`);
    
    const handler = this.handlers.get(query.type);
    if (!handler) {
      throw new Error(`No handler registered for query type: ${query.type}`);
    }

    try {
      const result = await handler.handle(query);
      this.logger.debug(`Query executed successfully: ${query.type}`);
      return result;
    } catch (error) {
      this.logger.error(`Query execution failed: ${query.type}, error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  register<T extends Query, R = any>(queryType: string, handler: QueryHandler<T, R>): void {
    this.logger.log(`Registering query handler: ${queryType}`);
    this.handlers.set(queryType, handler);
  }

  unregister(queryType: string): void {
    this.logger.log(`Unregistering query handler: ${queryType}`);
    this.handlers.delete(queryType);
  }
}

@Injectable()
export class InMemoryEventBus implements EventBus {
  private readonly logger = new Logger(InMemoryEventBus.name);
  private handlers: Map<string, EventHandler[]> = new Map();

  async publish<T extends Event>(event: T): Promise<void> {
    this.logger.debug(`Publishing event: ${event.type}`);
    
    const handlers = this.handlers.get(event.type) || [];
    
    if (handlers.length === 0) {
      this.logger.debug(`No handlers registered for event type: ${event.type}`);
      return;
    }

    const promises = handlers.map(handler => 
      handler.handle(event).catch(error => {
        this.logger.error(`Event handler failed: ${event.type}, error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      })
    );

    await Promise.all(promises);
    this.logger.debug(`Event published successfully: ${event.type}`);
  }

  async publishAll<T extends Event>(events: T[]): Promise<void> {
    this.logger.debug(`Publishing ${events.length} events`);
    
    for (const event of events) {
      await this.publish(event);
    }
    
    this.logger.debug(`All events published successfully`);
  }

  subscribe<T extends Event>(eventType: string, handler: EventHandler<T>): void {
    this.logger.log(`Subscribing to event: ${eventType}`);
    
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    this.logger.log(`Unsubscribing from event: ${eventType}`);
    
    const handlers = this.handlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.handlers.set(eventType, handlers);
    }
  }
}
