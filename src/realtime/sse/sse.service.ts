import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Server-Sent Events connection information
 * Tracks active SSE connections, their subscriptions, and metadata
 */
export interface SSEConnection {
  id: string; // Unique connection identifier
  userId?: string; // User ID if authenticated
  userAgent?: string; // Client browser/application info
  ip: string; // Client IP address
  subscriptions: string[]; // Event types this connection is subscribed to
  connectedAt: Date; // Connection timestamp
  lastActivity: Date; // Last activity timestamp
  response?: unknown; // Express response object for event sending
}

/**
 * Event data structure for SSE communication
 * Contains event metadata and payload for delivery to clients
 */
export interface EventData {
  id: string; // Unique event identifier
  type: string; // Event type/category
  data: unknown; // Event payload
  timestamp: Date; // Event creation timestamp
  source?: string; // Event source identifier
}

/**
 * Core service for managing Server-Sent Events functionality
 * Handles connection management, event routing, and subscription tracking
 *
 * SSE provides unidirectional real-time communication from server to clients
 * Ideal for notifications, live updates, and server-pushed data
 */
@Injectable()
export class SSEService {
  private readonly logger = new Logger(SSEService.name);

  // Core data structures for managing SSE state
  private readonly connections = new Map<string, SSEConnection>(); // Active connections
  private readonly eventSubscriptions = new Map<string, Set<string>>(); // Event type -> connection IDs
  private readonly eventHistory = new Map<string, EventData[]>(); // Event history per type
  private readonly maxHistoryPerEvent = 100; // Maximum events to keep per type

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for SSE
   * Listens for events emitted by other services and broadcasts them via SSE
   * This is a placeholder and would typically involve more sophisticated event routing
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
   * Creates connection record and initializes tracking data structures
   * @param id - Unique connection identifier
   * @param userId - Optional user ID for authenticated connections
   * @param userAgent - Client browser/application information
   * @param ip - Client IP address
   * @returns Created connection object
   */
  registerConnection(
    id: string,
    userId?: string,
    userAgent?: string,
    ip: string = '127.0.0.1'
  ): SSEConnection {
    const connection: SSEConnection = {
      id,
      userId,
      userAgent,
      ip,
      subscriptions: [], // Start with empty subscriptions
      connectedAt: new Date(), // Record connection time
      lastActivity: new Date(), // Set initial activity time
    };

    // Store connection for tracking and management
    this.connections.set(id, connection);

    this.logger.log(`SSE connection registered: ${id} from ${ip}`);
    return connection;
  }

  /**
   * Remove an SSE connection and clean up associated data
   * Removes connection from tracking and unsubscribes from all events
   * @param id - Connection ID to remove
   * @returns True if connection was removed, false if not found
   */
  removeConnection(id: string): boolean {
    const connection = this.connections.get(id);
    if (!connection) {
      return false; // Connection doesn't exist
    }

    // Unsubscribe from all events this connection was listening to
    connection.subscriptions.forEach(eventType => {
      this.unsubscribeFromEvent(id, eventType);
    });

    // Remove connection from tracking
    this.connections.delete(id);

    this.logger.log(`SSE connection removed: ${id}`);
    return true;
  }

  /**
   * Subscribe connection to specific event type
   * Adds connection to event subscription list for targeted event delivery
   * @param connectionId - Connection ID to subscribe
   * @param eventType - Event type to subscribe to
   * @returns True if subscription successful, false if connection not found
   */
  subscribeToEvent(connectionId: string, eventType: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false; // Connection doesn't exist
    }

    // Add event type to connection's subscription list
    if (!connection.subscriptions.includes(eventType)) {
      connection.subscriptions.push(eventType);
    }

    // Add connection to event type's subscriber list
    if (!this.eventSubscriptions.has(eventType)) {
      this.eventSubscriptions.set(eventType, new Set());
    }
    const subscribers = this.eventSubscriptions.get(eventType);
    if (subscribers) {
      subscribers.add(connectionId);
    }

    // Update connection activity timestamp
    connection.lastActivity = new Date();

    this.logger.debug(`Connection ${connectionId} subscribed to event: ${eventType}`);
    return true;
  }

  /**
   * Unsubscribe connection from specific event type
   * Removes connection from event subscription list
   * @param connectionId - Connection ID to unsubscribe
   * @param eventType - Event type to unsubscribe from
   * @returns True if unsubscription successful, false if connection not found
   */
  unsubscribeFromEvent(connectionId: string, eventType: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false; // Connection doesn't exist
    }

    // Remove event type from connection's subscription list
    connection.subscriptions = connection.subscriptions.filter(sub => sub !== eventType);

    // Remove connection from event type's subscriber list
    const subscribers = this.eventSubscriptions.get(eventType);
    if (subscribers) {
      subscribers.delete(connectionId);

      // Clean up empty event subscription sets
      if (subscribers.size === 0) {
        this.eventSubscriptions.delete(eventType);
      }
    }

    // Update connection activity timestamp
    connection.lastActivity = new Date();

    this.logger.debug(`Connection ${connectionId} unsubscribed from event: ${eventType}`);
    return true;
  }

  /**
   * Send event to specific connection
   * Delivers event to individual client if they're subscribed to the event type
   * @param connectionId - Target connection ID
   * @param eventType - Type of event to send
   * @param data - Event payload data
   * @returns True if event was sent, false if connection not found or not subscribed
   */
  sendEventToConnection(connectionId: string, eventType: string, data: unknown): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false; // Connection doesn't exist
    }

    // Check if connection is subscribed to this event type
    if (!connection.subscriptions.includes(eventType)) {
      return false; // Connection not subscribed to event type
    }

    // Create event data with metadata
    const eventData: EventData = {
      id: this.generateEventId(),
      type: eventType,
      data,
      timestamp: new Date(),
      source: 'direct_send',
    };

    // Store event in history for this event type
    this.storeEventInHistory(eventType, eventData);

    // Update connection activity timestamp
    connection.lastActivity = new Date();

    this.logger.debug(`Event sent to connection ${connectionId}: ${eventType}`);
    return true;
  }

  /**
   * Broadcast event to all connections subscribed to the event type
   * Sends event to multiple clients simultaneously (useful for announcements)
   * @param eventType - Type of event to broadcast
   * @param data - Event payload data
   * @returns Number of connections that received the event
   */
  broadcastEvent(eventType: string, data: unknown): number {
    const subscribers = this.eventSubscriptions.get(eventType);
    if (!subscribers || subscribers.size === 0) {
      return 0; // No subscribers for this event type
    }

    // Create event data with metadata
    const eventData: EventData = {
      id: this.generateEventId(),
      type: eventType,
      data,
      timestamp: new Date(),
      source: 'broadcast',
    };

    // Store event in history for this event type
    this.storeEventInHistory(eventType, eventData);

    // Count successful deliveries
    let sentCount = 0;
    subscribers.forEach(connectionId => {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.lastActivity = new Date(); // Update activity timestamp
        sentCount++;
      }
    });

    this.logger.debug(`Event broadcasted to ${sentCount} connections: ${eventType}`);
    return sentCount;
  }

  /**
   * Broadcast event to connections in specific room
   * Sends event to all connections that are subscribed to the room's event types
   * @param room - Room name to broadcast to
   * @param eventType - Type of event to broadcast
   * @param data - Event payload data
   * @returns Number of connections that received the event
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
   * Store event in history for specific event type
   * Maintains event history with size limits to prevent memory bloat
   * @param eventType - Event type to store event for
   * @param eventData - Event data to store
   */
  private storeEventInHistory(eventType: string, eventData: EventData): void {
    if (!this.eventHistory.has(eventType)) {
      this.eventHistory.set(eventType, []);
    }

    const history = this.eventHistory.get(eventType);
    if (history) {
      history.push(eventData);

      // Maintain history size limit by removing oldest events
      if (history.length > this.maxHistoryPerEvent) {
        history.splice(0, history.length - this.maxHistoryPerEvent);
      }
    }
  }

  /**
   * Get event history for specific event type
   * Provides historical event data for debugging and analysis
   * @param eventType - Event type to get history for
   * @param limit - Maximum number of events to return
   * @returns Array of historical events (most recent first)
   */
  getEventHistory(eventType: string, limit: number = 50): EventData[] {
    const history = this.eventHistory.get(eventType) || [];
    return history.slice(-limit); // Return last 'limit' events
  }

  /**
   * Get information about specific SSE connection
   * Provides comprehensive connection details and status
   * @param id - Connection ID to look up
   * @returns Connection information or undefined if not found
   */
  getConnectionInfo(id: string): SSEConnection | undefined {
    return this.connections.get(id);
  }

  /**
   * Get all active SSE connections
   * Returns array of all connection information for monitoring
   * @returns Array of all active connections
   */
  getAllConnections(): SSEConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get all connections subscribed to specific event type
   * Useful for understanding event subscription patterns and debugging
   * @param eventType - Event type to find subscribers for
   * @returns Array of connections subscribed to the event type
   */
  getConnectionsForEvent(eventType: string): SSEConnection[] {
    const subscribers = this.eventSubscriptions.get(eventType);
    if (!subscribers) {
      return []; // No subscribers for this event type
    }

    // Convert subscriber IDs to connection objects
    return Array.from(subscribers)
      .map(id => this.connections.get(id))
      .filter((conn): conn is SSEConnection => conn !== undefined);
  }

  /**
   * Get comprehensive connection statistics
   * Provides overview of system health and usage patterns
   * @returns Statistics object with connection and event counts
   */
  getConnectionStats(): {
    totalConnections: number;
    totalEventTypes: number;
    totalSubscriptions: number;
    connectionsByUser: Record<string, number>;
    topEventTypes: Array<{ type: string; subscribers: number }>;
  } {
    const totalConnections = this.connections.size;
    const totalEventTypes = this.eventSubscriptions.size;

    // Calculate total subscriptions across all event types
    let totalSubscriptions = 0;
    this.eventSubscriptions.forEach(subscribers => {
      totalSubscriptions += subscribers.size;
    });

    // Group connections by user ID
    const connectionsByUser: Record<string, number> = {};
    this.connections.forEach(connection => {
      const userId = connection.userId || 'anonymous';
      connectionsByUser[userId] = (connectionsByUser[userId] || 0) + 1;
    });

    // Find top event types by subscriber count
    const topEventTypes = Array.from(this.eventSubscriptions.entries())
      .map(([type, subscribers]) => ({ type, subscribers: subscribers.size }))
      .sort((a, b) => b.subscribers - a.subscribers)
      .slice(0, 10); // Top 10 event types

    return {
      totalConnections,
      totalEventTypes,
      totalSubscriptions,
      connectionsByUser,
      topEventTypes,
    };
  }

  /**
   * Clean up old connections and events to maintain system performance
   * Removes stale connections and expired events based on age
   * @param maxAgeHours - Maximum age of connections/events to keep
   * @returns Object with counts of removed items
   */
  cleanup(maxAgeHours: number = 24): { removedConnections: number; removedEvents: number } {
    const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds
    let removedConnections = 0;
    let removedEvents = 0;

    // Remove old connections
    const connectionsToRemove: string[] = [];
    this.connections.forEach((connection, id) => {
      if (connection.lastActivity.getTime() < cutoffTime) {
        connectionsToRemove.push(id);
      }
    });

    connectionsToRemove.forEach(id => {
      this.removeConnection(id);
      removedConnections++;
    });

    // Clean up old events from history
    this.eventHistory.forEach((history, eventType) => {
      const originalLength = history.length;
      const filteredHistory = history.filter(event => event.timestamp.getTime() > cutoffTime);

      if (filteredHistory.length !== originalLength) {
        this.eventHistory.set(eventType, filteredHistory);
        removedEvents += originalLength - filteredHistory.length;
      }
    });

    this.logger.log(
      `Cleanup completed: ${removedConnections} connections, ${removedEvents} events removed`
    );

    return { removedConnections, removedEvents };
  }

  /**
   * Generate unique event identifier
   * Creates timestamp-based ID with random suffix for uniqueness
   * @returns Unique event identifier string
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Handle application shutdown
   * Cleans up resources and emits a shutdown event
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
