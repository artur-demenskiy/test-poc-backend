import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Message data structure for real-time communication
 * Contains all necessary information about a message sent in a room
 */
export interface MessageData {
  id: string; // Unique message identifier
  clientId: string; // ID of the client who sent the message
  room: string; // Room where message was sent
  message: string; // Actual message content
  type: string; // Message type (text, image, file, etc.)
  timestamp: Date; // When the message was sent
  userId?: string; // User ID if client is authenticated
}

/**
 * Room information structure for managing chat rooms
 * Defines room properties, access control, and capacity limits
 */
export interface RoomInfo {
  name: string; // Unique room name/identifier
  password?: string; // Optional password for private rooms
  maxClients: number; // Maximum number of clients allowed
  isPrivate: boolean; // Whether room requires authentication
  createdAt: Date; // Room creation timestamp
  createdBy?: string; // User who created the room
}

/**
 * Core service for managing real-time communication functionality
 * Handles room management, message broadcasting, rate limiting, and event emission
 * Uses EventEmitter2 for decoupled event-driven architecture
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  // Core data structures for managing real-time state
  private readonly rooms = new Map<string, RoomInfo>(); // Active rooms
  private readonly messageHistory = new Map<string, MessageData[]>(); // Message storage per room
  private readonly rateLimitMap = new Map<string, { count: number; resetTime: number }>(); // Rate limiting per client

  // Configuration constants
  private readonly maxMessagesPerMinute = 30; // Rate limit: messages per minute per client
  private readonly maxHistoryPerRoom = 100; // Maximum messages to keep in history per room

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initializeDefaultRooms();
  }

  /**
   * Initialize default system rooms that are always available
   * Creates general, announcements, and support rooms with appropriate settings
   * These rooms serve as the foundation for basic communication
   */
  private initializeDefaultRooms(): void {
    const defaultRooms: RoomInfo[] = [
      {
        name: 'general', // Main public room for all users
        maxClients: 1000, // High capacity for general discussion
        isPrivate: false, // Public access
        createdAt: new Date(),
      },
      {
        name: 'announcements', // Room for system announcements
        maxClients: 1000, // High capacity for broadcasts
        isPrivate: false, // Public access
        createdAt: new Date(),
      },
      {
        name: 'support', // Room for user support
        maxClients: 100, // Moderate capacity for support discussions
        isPrivate: false, // Public access
        createdAt: new Date(),
      },
    ];

    // Create each default room and initialize empty message history
    defaultRooms.forEach(room => {
      this.rooms.set(room.name, room);
      this.messageHistory.set(room.name, []);
    });

    this.logger.log('Default rooms initialized');
  }

  /**
   * Create a new custom room with specified options
   * Validates room name uniqueness and sets up room infrastructure
   * @param name - Unique room name
   * @param options - Room configuration options (capacity, privacy, password)
   * @param createdBy - User ID who created the room
   * @returns Created room information
   * @throws Error if room name already exists
   */
  createRoom(name: string, options: Partial<RoomInfo> = {}, createdBy?: string): RoomInfo {
    if (this.rooms.has(name)) {
      throw new Error(`Room ${name} already exists`);
    }

    // Create room with provided options and defaults
    const room: RoomInfo = {
      name,
      maxClients: options.maxClients || 50, // Default capacity of 50 clients
      isPrivate: options.isPrivate || false, // Default to public
      password: options.password, // Optional password for private rooms
      createdAt: new Date(),
      createdBy,
    };

    // Store room and initialize empty message history
    this.rooms.set(name, room);
    this.messageHistory.set(name, []);

    this.logger.log(`Room created: ${name} by ${createdBy || 'system'}`);

    // Emit event for other services to react to room creation
    this.eventEmitter.emit('room.created', room);

    return room;
  }

  /**
   * Delete an existing room and clean up associated data
   * Prevents deletion of system rooms (like 'general')
   * @param name - Name of room to delete
   * @param deletedBy - User ID who deleted the room
   * @returns True if room was deleted, false if not found
   * @throws Error if attempting to delete system rooms
   */
  deleteRoom(name: string, deletedBy?: string): boolean {
    // Prevent deletion of essential system rooms
    if (name === 'general') {
      throw new Error('Cannot delete general room');
    }

    const room = this.rooms.get(name);
    if (!room) {
      return false; // Room doesn't exist
    }

    // Clean up room data and message history
    this.rooms.delete(name);
    this.messageHistory.delete(name);

    this.logger.log(`Room deleted: ${name} by ${deletedBy || 'system'}`);

    // Emit event for other services to react to room deletion
    this.eventEmitter.emit('room.deleted', { name, deletedBy });

    return true;
  }

  /**
   * Get information about a specific room
   * @param name - Room name to look up
   * @returns Room information or undefined if not found
   */
  getRoomInfo(name: string): RoomInfo | undefined {
    return this.rooms.get(name);
  }

  /**
   * Get all available rooms in the system
   * @returns Array of all room information
   */
  getAllRooms(): RoomInfo[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Check if a client can join a specific room
   * Validates room existence, privacy settings, and password requirements
   * @param _clientId - Client ID requesting to join (unused in current implementation)
   * @param roomName - Name of room to join
   * @param password - Optional password for private rooms
   * @returns True if client can join, false otherwise
   */
  canJoinRoom(_clientId: string, roomName: string, password?: string): boolean {
    const room = this.rooms.get(roomName);
    if (!room) {
      return false; // Room doesn't exist
    }

    // Check if room is private and requires password authentication
    if (room.isPrivate && room.password && room.password !== password) {
      return false; // Wrong password for private room
    }

    // TODO: Implement room capacity checking
    // For now, assume all rooms are under capacity
    // This would need to be implemented with actual client count tracking

    return true;
  }

  /**
   * Check if a client can send a message based on rate limiting
   * Implements sliding window rate limiting (30 messages per minute per client)
   * @param clientId - Client ID to check rate limit for
   * @returns True if client can send message, false if rate limit exceeded
   */
  canSendMessage(clientId: string): boolean {
    const now = Date.now();
    const clientRateLimit = this.rateLimitMap.get(clientId);

    if (!clientRateLimit) {
      // First message from this client - initialize rate limit
      this.rateLimitMap.set(clientId, { count: 1, resetTime: now + 60000 }); // Reset in 1 minute
      return true;
    }

    if (now > clientRateLimit.resetTime) {
      // Rate limit window has expired - reset counter
      this.rateLimitMap.set(clientId, { count: 1, resetTime: now + 60000 });
      return true;
    }

    if (clientRateLimit.count >= this.maxMessagesPerMinute) {
      return false; // Rate limit exceeded
    }

    // Increment message count for current window
    clientRateLimit.count++;
    return true;
  }

  /**
   * Emit an event to all clients in a specific room
   * Uses EventEmitter2 for decoupled event broadcasting
   * @param room - Room name to emit event to
   * @param event - Event name/type
   * @param data - Event payload data
   */
  emitToRoom(room: string, event: string, data: unknown): void {
    // Emit room-specific event that other services can listen to
    this.eventEmitter.emit(`room.${room}.${event}`, data);
    this.logger.debug(`Event emitted to room ${room}: ${event}`);
  }

  /**
   * Emit an event to all active rooms in the system
   * Useful for system-wide announcements or notifications
   * @param event - Event name/type
   * @param data - Event payload data
   */
  emitToAllRooms(event: string, data: unknown): void {
    this.rooms.forEach((_, roomName) => {
      this.emitToRoom(roomName, event, data);
    });
  }

  /**
   * Broadcast a message to all clients in a specific room
   * Stores message in history and emits events for real-time delivery
   * @param room - Room name to broadcast to
   * @param message - Message data to broadcast
   */
  broadcastMessage(room: string, message: MessageData): void {
    // Add message to room's message history
    const history = this.messageHistory.get(room) || [];
    history.push(message);

    // Maintain history size limit by removing oldest messages
    if (history.length > this.maxHistoryPerRoom) {
      history.splice(0, history.length - this.maxHistoryPerRoom);
    }

    this.messageHistory.set(room, history);

    // Emit message event to room subscribers
    this.emitToRoom(room, 'new_message', message);

    // Emit global message event for other services
    this.eventEmitter.emit('message.sent', message);
  }

  /**
   * Get recent message history for a specific room
   * Returns messages in chronological order (oldest first)
   * @param room - Room name to get history for
   * @param limit - Maximum number of messages to return (default: 50)
   * @returns Array of recent messages
   */
  getMessageHistory(room: string, limit: number = 50): MessageData[] {
    const history = this.messageHistory.get(room) || [];
    return history.slice(-limit); // Return last 'limit' messages
  }

  /**
   * Search messages in a room by content or sender
   * Performs case-insensitive search across message content and client IDs
   * @param room - Room name to search in
   * @param query - Search query string
   * @param limit - Maximum number of results to return
   * @returns Array of matching messages
   */
  searchMessages(room: string, query: string, limit: number = 20): MessageData[] {
    const history = this.messageHistory.get(room) || [];

    // Filter messages by search query (case-insensitive)
    const searchResults = history
      .filter(
        msg =>
          msg.message.toLowerCase().includes(query.toLowerCase()) || // Search in message content
          msg.clientId.toLowerCase().includes(query.toLowerCase()) // Search by sender ID
      )
      .slice(-limit); // Return last 'limit' matching messages

    return searchResults;
  }

  /**
   * Get statistics for a specific room
   * Provides message count, last activity, and user count information
   * @param room - Room name to get stats for
   * @returns Room statistics object
   */
  getRoomStats(room: string): {
    name: string;
    messageCount: number;
    lastMessage?: Date;
    activeUsers: number;
  } {
    const history = this.messageHistory.get(room) || [];

    return {
      name: room,
      messageCount: history.length,
      lastMessage: history.length > 0 ? history[history.length - 1].timestamp : undefined,
      activeUsers: 0, // TODO: Implement actual user count tracking
    };
  }

  /**
   * Get global statistics across all rooms
   * Provides system-wide metrics for monitoring and administration
   * @returns Global statistics object
   */
  getGlobalStats(): {
    totalRooms: number;
    totalMessages: number;
    totalActiveUsers: number;
    uptime: number;
  } {
    let totalMessages = 0;

    // Calculate total messages across all rooms
    this.messageHistory.forEach(history => {
      totalMessages += history.length;
    });

    return {
      totalRooms: this.rooms.size,
      totalMessages,
      totalActiveUsers: 0, // TODO: Implement actual user count tracking
      uptime: Date.now() - this.getStartTime(),
    };
  }

  /**
   * Clean up old messages to prevent memory bloat
   * Removes messages older than specified age to maintain performance
   * @param maxAgeHours - Maximum age of messages to keep (default: 24 hours)
   * @returns Number of messages cleaned up
   */
  cleanupOldMessages(maxAgeHours: number = 24): number {
    const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds
    let cleanedCount = 0;

    this.messageHistory.forEach((history, room) => {
      const originalLength = history.length;

      // Filter out messages older than cutoff time
      const filteredHistory = history.filter(msg => msg.timestamp.getTime() > cutoffTime);

      if (filteredHistory.length !== originalLength) {
        this.messageHistory.set(room, filteredHistory);
        cleanedCount += originalLength - filteredHistory.length;
      }
    });

    this.logger.log(`Cleaned up ${cleanedCount} old messages`);
    return cleanedCount;
  }

  /**
   * Get application start time for uptime calculation
   * Currently returns a placeholder value - should be set during service initialization
   * @returns Application start timestamp
   */
  private getStartTime(): number {
    // TODO: Store actual start time when service initializes
    // For now, return a reasonable default (24 hours ago)
    return Date.now() - 24 * 60 * 60 * 1000;
  }

  /**
   * Handle graceful shutdown of the realtime service
   * Cleans up resources and emits shutdown events for other services
   * Should be called during application shutdown
   */
  onApplicationShutdown(): void {
    this.logger.log('Cleaning up realtime service...');

    // Clear rate limiting data
    this.rateLimitMap.clear();

    // Emit shutdown event for other services to react
    this.eventEmitter.emit('realtime.shutdown', {
      timestamp: new Date(),
      reason: 'application_shutdown',
    });
  }
}
