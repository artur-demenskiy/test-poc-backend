import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface SSEConnection {
  id: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: string[];
}

export interface SSEEvent {
  id: string;
  event: string;
  data: unknown;
  timestamp: Date;
  retry?: number;
}

@Injectable()
export class SSEService {
  private readonly logger = new Logger(SSEService.name);
  private readonly connections = new Map<string, SSEConnection>();
  private readonly eventHistory = new Map<string, SSEEvent[]>();
  private readonly maxHistoryPerEvent = 100;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for SSE
   */
  private setupEventListeners(): void {
    // Listen for realtime events and convert them to SSE
    this.eventEmitter.on('room.*', (data: unknown, eventName: string) => {
      const [_, roomName, eventType] = eventName.split('.');
      this.broadcastEvent(`room.${roomName}.${eventType}`, data);
    });

    this.eventEmitter.on('message.sent', (data: unknown) => {
      this.broadcastEvent('message.sent', data);
    });

    this.eventEmitter.on('room.created', (data: unknown) => {
      this.broadcastEvent('room.created', data);
    });

    this.eventEmitter.on('room.deleted', (data: unknown) => {
      this.broadcastEvent('room.deleted', data);
    });

    this.logger.log('SSE event listeners configured');
  }

  /**
   * Register a new SSE connection
   */
  registerConnection(id: string, userId?: string, userAgent?: string, ip?: string): SSEConnection {
    const connection: SSEConnection = {
      id,
      userId,
      userAgent,
      ip,
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: ['general'],
    };

    this.connections.set(id, connection);
    this.logger.log(`SSE connection registered: ${id}`);

    // Send welcome event
    this.sendEventToConnection(id, 'welcome', {
      message: 'Welcome to Server-Sent Events!',
      connectionId: id,
      timestamp: new Date(),
    });

    return connection;
  }

  /**
   * Remove an SSE connection
   */
  removeConnection(id: string): boolean {
    const connection = this.connections.get(id);
    if (!connection) {
      return false;
    }

    this.connections.delete(id);
    this.logger.log(`SSE connection removed: ${id}`);
    return true;
  }

  /**
   * Subscribe connection to an event type
   */
  subscribeToEvent(connectionId: string, eventType: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    if (!connection.subscriptions.includes(eventType)) {
      connection.subscriptions.push(eventType);
      connection.lastActivity = new Date();

      this.logger.debug(`Connection ${connectionId} subscribed to ${eventType}`);
    }

    return true;
  }

  /**
   * Unsubscribe connection from an event type
   */
  unsubscribeFromEvent(connectionId: string, eventType: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    const index = connection.subscriptions.indexOf(eventType);
    if (index > -1) {
      connection.subscriptions.splice(index, 1);
      connection.lastActivity = new Date();

      this.logger.debug(`Connection ${connectionId} unsubscribed from ${eventType}`);
    }

    return true;
  }

  /**
   * Send event to specific connection
   */
  sendEventToConnection(connectionId: string, eventType: string, data: unknown): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // Check if connection is subscribed to this event type
    if (!connection.subscriptions.includes(eventType) && !connection.subscriptions.includes('*')) {
      return false;
    }

    const event: SSEEvent = {
      id: this.generateEventId(),
      event: eventType,
      data,
      timestamp: new Date(),
    };

    // Store event in history
    this.storeEventInHistory(eventType, event);

    // Update connection activity
    connection.lastActivity = new Date();

    // Emit event for the connection to pick up
    this.eventEmitter.emit(`sse.connection.${connectionId}`, event);

    return true;
  }

  /**
   * Broadcast event to all connections subscribed to the event type
   */
  broadcastEvent(eventType: string, data: unknown): number {
    let sentCount = 0;

    this.connections.forEach((connection, connectionId) => {
      if (connection.subscriptions.includes(eventType) || connection.subscriptions.includes('*')) {
        if (this.sendEventToConnection(connectionId, eventType, data)) {
          sentCount++;
        }
      }
    });

    this.logger.debug(`SSE event ${eventType} broadcasted to ${sentCount} connections`);
    return sentCount;
  }

  /**
   * Broadcast event to connections in specific room
   */
  broadcastEventToRoom(room: string, eventType: string, data: unknown): number {
    let sentCount = 0;

    this.connections.forEach((connection, connectionId) => {
      if (
        connection.subscriptions.includes(`room.${room}.*`) ||
        connection.subscriptions.includes(eventType) ||
        connection.subscriptions.includes('*')
      ) {
        if (this.sendEventToConnection(connectionId, eventType, data)) {
          sentCount++;
        }
      }
    });

    this.logger.debug(
      `SSE event ${eventType} broadcasted to ${sentCount} connections in room ${room}`
    );
    return sentCount;
  }

  /**
   * Store event in history
   */
  private storeEventInHistory(eventType: string, event: SSEEvent): void {
    const history = this.eventHistory.get(eventType) || [];
    history.push(event);

    // Keep only recent events
    if (history.length > this.maxHistoryPerEvent) {
      history.splice(0, history.length - this.maxHistoryPerEvent);
    }

    this.eventHistory.set(eventType, history);
  }

  /**
   * Get event history for a specific event type
   */
  getEventHistory(eventType: string, limit: number = 50): SSEEvent[] {
    const history = this.eventHistory.get(eventType) || [];
    return history.slice(-limit);
  }

  /**
   * Get connection information
   */
  getConnectionInfo(connectionId: string): SSEConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections
   */
  getAllConnections(): SSEConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connections subscribed to specific event type
   */
  getConnectionsForEvent(eventType: string): SSEConnection[] {
    return Array.from(this.connections.values()).filter(
      connection =>
        connection.subscriptions.includes(eventType) || connection.subscriptions.includes('*')
    );
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    activeConnections: number;
    totalSubscriptions: number;
    averageSubscriptionsPerConnection: number;
  } {
    const connections = Array.from(this.connections.values());
    const totalSubscriptions = connections.reduce(
      (sum, conn) => sum + conn.subscriptions.length,
      0
    );

    return {
      totalConnections: connections.length,
      activeConnections: connections.length, // All connections are considered active for now
      totalSubscriptions,
      averageSubscriptionsPerConnection:
        connections.length > 0 ? totalSubscriptions / connections.length : 0,
    };
  }

  /**
   * Clean up old connections and events
   */
  cleanup(maxAgeHours: number = 24): {
    removedConnections: number;
    removedEvents: number;
  } {
    const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;
    let removedConnections = 0;
    let removedEvents = 0;

    // Clean up old connections (this would typically be done by the client)
    this.connections.forEach((connection, id) => {
      if (connection.lastActivity.getTime() < cutoffTime) {
        this.connections.delete(id);
        removedConnections++;
      }
    });

    // Clean up old events
    this.eventHistory.forEach((history, eventType) => {
      const originalLength = history.length;
      const filteredHistory = history.filter(event => event.timestamp.getTime() > cutoffTime);

      if (filteredHistory.length !== originalLength) {
        this.eventHistory.set(eventType, filteredHistory);
        removedEvents += originalLength - filteredHistory.length;
      }
    });

    if (removedConnections > 0 || removedEvents > 0) {
      this.logger.log(
        `SSE cleanup: removed ${removedConnections} connections, ${removedEvents} events`
      );
    }

    return { removedConnections, removedEvents };
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `sse_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Handle application shutdown
   */
  onApplicationShutdown(): void {
    this.logger.log('Cleaning up SSE service...');

    // Clear all connections
    this.connections.clear();

    // Clear event history
    this.eventHistory.clear();

    // Emit shutdown event
    this.eventEmitter.emit('sse.shutdown', {
      timestamp: new Date(),
      reason: 'application_shutdown',
    });
  }
}
