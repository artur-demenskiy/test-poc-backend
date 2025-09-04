import { Injectable, Logger } from '@nestjs/common';
import {
  EventStore,
  Event,
  EventStoreStats,
} from '../interfaces/cqrs.interface';

@Injectable()
export class InMemoryEventStore implements EventStore {
  private readonly logger = new Logger(InMemoryEventStore.name);
  private events: Map<string, Event[]> = new Map(); // aggregateId -> events[]
  private eventIndex: Map<string, Event> = new Map(); // eventId -> event
  private sequenceNumbers: Map<string, number> = new Map(); // aggregateId -> next sequence number

  async appendEvents(aggregateId: string, events: Event[], expectedVersion: number): Promise<void> {
    this.logger.debug(`Appending ${events.length} events for aggregate: ${aggregateId}`);
    
    const existingEvents = this.events.get(aggregateId) || [];
    const currentVersion = existingEvents.length;
    
    if (currentVersion !== expectedVersion) {
      throw new Error(`Concurrency conflict: expected version ${expectedVersion}, but current version is ${currentVersion}`);
    }

    // Assign sequence numbers
    let nextSequence = this.sequenceNumbers.get(aggregateId) || 1;
    for (const event of events) {
      event.sequenceNumber = nextSequence++;
    }
    this.sequenceNumbers.set(aggregateId, nextSequence);

    // Store events
    const allEvents = [...existingEvents, ...events];
    this.events.set(aggregateId, allEvents);
    
    // Index events by ID
    for (const event of events) {
      this.eventIndex.set(event.id, event);
    }

    this.logger.debug(`Events appended successfully for aggregate: ${aggregateId}`);
  }

  async getEvents(aggregateId: string, fromVersion?: number, toVersion?: number): Promise<Event[]> {
    this.logger.debug(`Getting events for aggregate: ${aggregateId}, from: ${fromVersion}, to: ${toVersion}`);
    
    const events = this.events.get(aggregateId) || [];
    
    if (fromVersion !== undefined && toVersion !== undefined) {
      return events.filter(event => event.version >= fromVersion && event.version <= toVersion);
    } else if (fromVersion !== undefined) {
      return events.filter(event => event.version >= fromVersion);
    } else if (toVersion !== undefined) {
      return events.filter(event => event.version <= toVersion);
    }
    
    return events;
  }

  async getEventsByType(eventType: string, fromDate?: Date, toDate?: Date): Promise<Event[]> {
    this.logger.debug(`Getting events by type: ${eventType}`);
    
    const allEvents = Array.from(this.eventIndex.values());
    let filteredEvents = allEvents.filter(event => event.type === eventType);
    
    if (fromDate) {
      filteredEvents = filteredEvents.filter(event => event.timestamp >= fromDate);
    }
    
    if (toDate) {
      filteredEvents = filteredEvents.filter(event => event.timestamp <= toDate);
    }
    
    return filteredEvents.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  async getEventsByCorrelationId(correlationId: string): Promise<Event[]> {
    this.logger.debug(`Getting events by correlation ID: ${correlationId}`);
    
    const allEvents = Array.from(this.eventIndex.values());
    return allEvents.filter(event => event.correlationId === correlationId);
  }

  async getEventsByCausationId(causationId: string): Promise<Event[]> {
    this.logger.debug(`Getting events by causation ID: ${causationId}`);
    
    const allEvents = Array.from(this.eventIndex.values());
    return allEvents.filter(event => event.causationId === causationId);
  }

  async getEventsByAggregateType(aggregateType: string, fromDate?: Date, toDate?: Date): Promise<Event[]> {
    this.logger.debug(`Getting events by aggregate type: ${aggregateType}`);
    
    const allEvents = Array.from(this.eventIndex.values());
    let filteredEvents = allEvents.filter(event => event.aggregateType === aggregateType);
    
    if (fromDate) {
      filteredEvents = filteredEvents.filter(event => event.timestamp >= fromDate);
    }
    
    if (toDate) {
      filteredEvents = filteredEvents.filter(event => event.timestamp <= toDate);
    }
    
    return filteredEvents.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  async getEventsByDateRange(fromDate: Date, toDate: Date): Promise<Event[]> {
    this.logger.debug(`Getting events by date range: ${fromDate} to ${toDate}`);
    
    const allEvents = Array.from(this.eventIndex.values());
    return allEvents.filter(event => event.timestamp >= fromDate && event.timestamp <= toDate);
  }

  async getEventById(eventId: string): Promise<Event | null> {
    this.logger.debug(`Getting event by ID: ${eventId}`);
    
    return this.eventIndex.get(eventId) || null;
  }

  async getLastEvent(aggregateId: string): Promise<Event | null> {
    this.logger.debug(`Getting last event for aggregate: ${aggregateId}`);
    
    const events = this.events.get(aggregateId) || [];
    return events.length > 0 ? events[events.length - 1] : null;
  }

  async getAggregateVersion(aggregateId: string): Promise<number> {
    this.logger.debug(`Getting aggregate version: ${aggregateId}`);
    
    const events = this.events.get(aggregateId) || [];
    return events.length;
  }

  async aggregateExists(aggregateId: string): Promise<boolean> {
    this.logger.debug(`Checking if aggregate exists: ${aggregateId}`);
    
    return this.events.has(aggregateId);
  }

  async deleteEvents(aggregateId: string): Promise<void> {
    this.logger.debug(`Deleting events for aggregate: ${aggregateId}`);
    
    const events = this.events.get(aggregateId) || [];
    
    // Remove events from index
    for (const event of events) {
      this.eventIndex.delete(event.id);
    }
    
    // Remove events from storage
    this.events.delete(aggregateId);
    this.sequenceNumbers.delete(aggregateId);
    
    this.logger.debug(`Events deleted successfully for aggregate: ${aggregateId}`);
  }

  async getStats(): Promise<EventStoreStats> {
    this.logger.debug('Getting event store statistics');
    
    const allEvents = Array.from(this.eventIndex.values());
    const aggregateIds = new Set(allEvents.map(event => event.aggregateId));
    
    const eventsByType: Record<string, number> = {};
    const eventsByAggregateType: Record<string, number> = {};
    const eventsByDate: Record<string, number> = {};
    
    for (const event of allEvents) {
      // Count by type
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      
      // Count by aggregate type
      eventsByAggregateType[event.aggregateType] = (eventsByAggregateType[event.aggregateType] || 0) + 1;
      
      // Count by date
      const dateKey = event.timestamp.toISOString().split('T')[0];
      eventsByDate[dateKey] = (eventsByDate[dateKey] || 0) + 1;
    }
    
    const firstEvent = allEvents.length > 0 ? allEvents.reduce((earliest, current) => 
      current.timestamp < earliest.timestamp ? current : earliest
    ) : null;
    
    const lastEvent = allEvents.length > 0 ? allEvents.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    ) : null;
    
    return {
      totalEvents: allEvents.length,
      totalAggregates: aggregateIds.size,
      eventsByType,
      eventsByAggregateType,
      eventsByDate,
      storageSize: 0, // In-memory storage doesn't have a meaningful size
      firstEventAt: firstEvent?.timestamp,
      lastEventAt: lastEvent?.timestamp,
    };
  }
}
