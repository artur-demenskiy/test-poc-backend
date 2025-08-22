import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface MessageData {
  id: string;
  clientId: string;
  room: string;
  message: string;
  type: string;
  timestamp: Date;
  userId?: string;
}

export interface RoomInfo {
  name: string;
  password?: string;
  maxClients: number;
  isPrivate: boolean;
  createdAt: Date;
  createdBy?: string;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly rooms = new Map<string, RoomInfo>();
  private readonly messageHistory = new Map<string, MessageData[]>();
  private readonly rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  private readonly maxMessagesPerMinute = 30;
  private readonly maxHistoryPerRoom = 100;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initializeDefaultRooms();
  }

  /**
   * Initialize default rooms
   */
  private initializeDefaultRooms(): void {
    const defaultRooms: RoomInfo[] = [
      {
        name: 'general',
        maxClients: 1000,
        isPrivate: false,
        createdAt: new Date(),
      },
      {
        name: 'announcements',
        maxClients: 1000,
        isPrivate: false,
        createdAt: new Date(),
      },
      {
        name: 'support',
        maxClients: 100,
        isPrivate: false,
        createdAt: new Date(),
      },
    ];

    defaultRooms.forEach(room => {
      this.rooms.set(room.name, room);
      this.messageHistory.set(room.name, []);
    });

    this.logger.log('Default rooms initialized');
  }

  /**
   * Create a new room
   */
  createRoom(name: string, options: Partial<RoomInfo> = {}, createdBy?: string): RoomInfo {
    if (this.rooms.has(name)) {
      throw new Error(`Room ${name} already exists`);
    }

    const room: RoomInfo = {
      name,
      maxClients: options.maxClients || 50,
      isPrivate: options.isPrivate || false,
      password: options.password,
      createdAt: new Date(),
      createdBy,
    };

    this.rooms.set(name, room);
    this.messageHistory.set(name, []);

    this.logger.log(`Room created: ${name} by ${createdBy || 'system'}`);

    // Emit room created event
    this.eventEmitter.emit('room.created', room);

    return room;
  }

  /**
   * Delete a room
   */
  deleteRoom(name: string, deletedBy?: string): boolean {
    if (name === 'general') {
      throw new Error('Cannot delete general room');
    }

    const room = this.rooms.get(name);
    if (!room) {
      return false;
    }

    this.rooms.delete(name);
    this.messageHistory.delete(name);

    this.logger.log(`Room deleted: ${name} by ${deletedBy || 'system'}`);

    // Emit room deleted event
    this.eventEmitter.emit('room.deleted', { name, deletedBy });

    return true;
  }

  /**
   * Get room information
   */
  getRoomInfo(name: string): RoomInfo | undefined {
    return this.rooms.get(name);
  }

  /**
   * Get all rooms
   */
  getAllRooms(): RoomInfo[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Check if client can join room
   */
  canJoinRoom(_clientId: string, roomName: string, password?: string): boolean {
    const room = this.rooms.get(roomName);
    if (!room) {
      return false;
    }

    // Check if room is private and password is required
    if (room.isPrivate && room.password && room.password !== password) {
      return false;
    }

    // Check room capacity (this would need to be implemented with actual client count)
    // For now, we'll assume it's always under capacity

    return true;
  }

  /**
   * Check if client can send message (rate limiting)
   */
  canSendMessage(clientId: string): boolean {
    const now = Date.now();
    const clientRateLimit = this.rateLimitMap.get(clientId);

    if (!clientRateLimit) {
      this.rateLimitMap.set(clientId, { count: 1, resetTime: now + 60000 });
      return true;
    }

    if (now > clientRateLimit.resetTime) {
      // Reset rate limit
      this.rateLimitMap.set(clientId, { count: 1, resetTime: now + 60000 });
      return true;
    }

    if (clientRateLimit.count >= this.maxMessagesPerMinute) {
      return false;
    }

    clientRateLimit.count++;
    return true;
  }

  /**
   * Emit event to specific room
   */
  emitToRoom(room: string, event: string, data: unknown): void {
    this.eventEmitter.emit(`room.${room}.${event}`, data);
    this.logger.debug(`Event emitted to room ${room}: ${event}`);
  }

  /**
   * Emit event to all rooms
   */
  emitToAllRooms(event: string, data: unknown): void {
    this.rooms.forEach((_, roomName) => {
      this.emitToRoom(roomName, event, data);
    });
  }

  /**
   * Broadcast message to room
   */
  broadcastMessage(room: string, message: MessageData): void {
    // Add to message history
    const history = this.messageHistory.get(room) || [];
    history.push(message);

    // Keep only recent messages
    if (history.length > this.maxHistoryPerRoom) {
      history.splice(0, history.length - this.maxHistoryPerRoom);
    }

    this.messageHistory.set(room, history);

    // Emit message event
    this.emitToRoom(room, 'new_message', message);

    // Emit global message event
    this.eventEmitter.emit('message.sent', message);
  }

  /**
   * Get message history for room
   */
  getMessageHistory(room: string, limit: number = 50): MessageData[] {
    const history = this.messageHistory.get(room) || [];
    return history.slice(-limit);
  }

  /**
   * Search messages in room
   */
  searchMessages(room: string, query: string, limit: number = 20): MessageData[] {
    const history = this.messageHistory.get(room) || [];
    const searchResults = history
      .filter(
        msg =>
          msg.message.toLowerCase().includes(query.toLowerCase()) ||
          msg.clientId.toLowerCase().includes(query.toLowerCase())
      )
      .slice(-limit);

    return searchResults;
  }

  /**
   * Get room statistics
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
      activeUsers: 0, // This would need to be implemented with actual client tracking
    };
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): {
    totalRooms: number;
    totalMessages: number;
    totalActiveUsers: number;
    uptime: number;
  } {
    let totalMessages = 0;
    this.messageHistory.forEach(history => {
      totalMessages += history.length;
    });

    return {
      totalRooms: this.rooms.size,
      totalMessages,
      totalActiveUsers: 0, // This would need to be implemented with actual client tracking
      uptime: Date.now() - this.getStartTime(),
    };
  }

  /**
   * Clean up old messages
   */
  cleanupOldMessages(maxAgeHours: number = 24): number {
    const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;
    let cleanedCount = 0;

    this.messageHistory.forEach((history, room) => {
      const originalLength = history.length;
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
   * Get application start time
   */
  private getStartTime(): number {
    // This would typically be stored when the service starts
    // For now, we'll use a reasonable default
    return Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
  }

  /**
   * Handle server shutdown
   */
  onApplicationShutdown(): void {
    this.logger.log('Cleaning up realtime service...');

    // Clean up rate limit map
    this.rateLimitMap.clear();

    // Emit shutdown event
    this.eventEmitter.emit('realtime.shutdown', {
      timestamp: new Date(),
      reason: 'application_shutdown',
    });
  }
}
