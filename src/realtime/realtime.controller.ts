import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RealtimeService, MessageData, RoomInfo } from './realtime.service';
import { RealtimeGateway } from './realtime.gateway';

/**
 * HTTP API Controller for real-time communication management
 * Provides REST endpoints for room management, message operations, and system monitoring
 *
 * This controller complements the WebSocket Gateway by offering:
 * - Administrative operations (room creation/deletion)
 * - Message history and search functionality
 * - System statistics and monitoring
 * - Bulk operations and data export
 *
 * Features:
 * - Room lifecycle management
 * - Message history and search
 * - Real-time statistics
 * - System health monitoring
 */
@Controller('api/realtime')
export class RealtimeController {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly realtimeGateway: RealtimeGateway
  ) {}

  // ==================== ROOM MANAGEMENT ====================

  /**
   * Create a new chat room with specified configuration
   * Allows administrators and users to create custom rooms for specific purposes
   * @param data - Room creation data including name and configuration options
   * @returns Created room information
   */
  @Post('rooms')
  @HttpCode(HttpStatus.CREATED)
  async createRoom(
    @Body() data: { name: string; options?: Partial<RoomInfo>; createdBy?: string }
  ) {
    const { name, options = {}, createdBy } = data;

    try {
      const room = this.realtimeService.createRoom(name, options, createdBy);
      return { success: true, room };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get information about a specific room
   * Returns room details, capacity, privacy settings, and creation information
   * @param name - Room name to retrieve information for
   * @returns Room information or error if not found
   */
  @Get('rooms/:name')
  async getRoom(@Param('name') name: string) {
    const room = this.realtimeService.getRoomInfo(name);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    return { success: true, room };
  }

  /**
   * Get all available rooms in the system
   * Returns comprehensive list of all rooms with their configuration and status
   * @returns Array of all room information
   */
  @Get('rooms')
  async getAllRooms() {
    const rooms = this.realtimeService.getAllRooms();
    return { success: true, rooms, count: rooms.length };
  }

  /**
   * Delete an existing room and clean up associated data
   * Prevents deletion of system rooms and cleans up message history
   * @param name - Name of room to delete
   * @param data - Deletion request with optional user information
   * @returns Success/failure response with details
   */
  @Delete('rooms/:name')
  @HttpCode(HttpStatus.OK)
  async deleteRoom(@Param('name') name: string, @Body() data: { deletedBy?: string }) {
    try {
      const success = this.realtimeService.deleteRoom(name, data.deletedBy);
      if (success) {
        return { success: true, message: `Room ${name} deleted successfully` };
      } else {
        return { success: false, error: 'Room not found' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  // ==================== MESSAGE OPERATIONS ====================

  /**
   * Get message history for a specific room
   * Returns recent messages with pagination support for efficient data retrieval
   * @param room - Room name to get message history for
   * @param limit - Maximum number of messages to return (default: 50, max: 100)
   * @returns Array of recent messages in chronological order
   */
  @Get('rooms/:room/messages')
  async getRoomMessages(@Param('room') room: string, @Query('limit') limit: string = '50') {
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100); // Cap at 100 messages
    const messages = this.realtimeService.getMessageHistory(room, limitNum);

    return {
      success: true,
      room,
      messages,
      count: messages.length,
      limit: limitNum,
    };
  }

  /**
   * Search messages in a specific room
   * Performs text search across message content and sender information
   * @param room - Room name to search in
   * @param query - Search query string
   * @param limit - Maximum number of results to return (default: 20)
   * @returns Array of matching messages with search metadata
   */
  @Get('rooms/:room/search')
  async searchRoomMessages(
    @Param('room') room: string,
    @Query('q') query: string,
    @Query('limit') limit: string = '20'
  ) {
    if (!query || query.trim().length === 0) {
      return { success: false, error: 'Search query is required' };
    }

    const limitNum = parseInt(limit, 10) || 20;
    const messages = this.realtimeService.searchMessages(room, query.trim(), limitNum);

    return {
      success: true,
      room,
      query: query.trim(),
      messages,
      count: messages.length,
      limit: limitNum,
    };
  }

  /**
   * Send a message to a specific room via HTTP API
   * Alternative to WebSocket message sending for server-initiated messages
   * @param room - Room name to send message to
   * @param data - Message data including content and metadata
   * @returns Success/failure response with message details
   */
  @Post('rooms/:room/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param('room') room: string,
    @Body() data: { message: string; type?: string; clientId?: string; userId?: string }
  ) {
    const { message, type = 'text', clientId, userId } = data;

    if (!message || message.trim().length === 0) {
      return { success: false, error: 'Message content is required' };
    }

    // Create message data structure
    const messageData: MessageData = {
      id: this.generateMessageId(),
      clientId: clientId || 'system',
      room,
      message: message.trim(),
      type,
      timestamp: new Date(),
      userId,
    };

    // Broadcast message to room via realtime service
    this.realtimeService.broadcastMessage(room, messageData);

    return {
      success: true,
      message: messageData,
      room,
      timestamp: messageData.timestamp,
    };
  }

  // ==================== STATISTICS AND MONITORING ====================

  /**
   * Get comprehensive statistics for a specific room
   * Provides message counts, activity metrics, and user information
   * @param room - Room name to get statistics for
   * @returns Room statistics with detailed metrics
   */
  @Get('rooms/:room/stats')
  async getRoomStats(@Param('room') room: string) {
    const stats = this.realtimeService.getRoomStats(room);
    const roomInfo = this.realtimeService.getRoomInfo(room);

    return {
      success: true,
      room,
      stats,
      roomInfo,
      timestamp: new Date(),
    };
  }

  /**
   * Get global system statistics across all rooms
   * Provides system-wide metrics for monitoring and administration
   * @returns Global statistics with comprehensive system overview
   */
  @Get('stats')
  async getGlobalStats() {
    const stats = this.realtimeService.getGlobalStats();
    const rooms = this.realtimeService.getAllRooms();
    const connectedClients = this.realtimeGateway.getConnectedClients();

    return {
      success: true,
      stats,
      rooms: {
        total: rooms.length,
        public: rooms.filter(r => !r.isPrivate).length,
        private: rooms.filter(r => r.isPrivate).length,
      },
      clients: {
        total: connectedClients.length,
        byUser: this.groupClientsByUser(connectedClients),
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get real-time connection information
   * Returns detailed information about all currently connected WebSocket clients
   * @returns Array of client information with connection details
   */
  @Get('connections')
  async getConnections() {
    const clients = this.realtimeGateway.getConnectedClients();

    return {
      success: true,
      clients,
      count: clients.length,
      timestamp: new Date(),
    };
  }

  /**
   * Get information about a specific connected client
   * Provides detailed client information including rooms and activity
   * @param clientId - Client socket ID to look up
   * @returns Client information or error if not found
   */
  @Get('connections/:clientId')
  async getClientInfo(@Param('clientId') clientId: string) {
    const clientInfo = this.realtimeGateway.getClientInfo(clientId);

    if (!clientInfo) {
      return { success: false, error: 'Client not found' };
    }

    return {
      success: true,
      client: clientInfo,
      timestamp: new Date(),
    };
  }

  /**
   * Get all clients currently in a specific room
   * Useful for understanding room occupancy and user distribution
   * @param room - Room name to get clients for
   * @returns Array of clients in the specified room
   */
  @Get('rooms/:room/clients')
  async getRoomClients(@Param('room') room: string) {
    const clients = this.realtimeGateway.getRoomClients(room);

    return {
      success: true,
      room,
      clients,
      count: clients.length,
      timestamp: new Date(),
    };
  }

  // ==================== SYSTEM OPERATIONS ====================

  /**
   * Clean up old messages to maintain system performance
   * Removes messages older than specified age to prevent memory bloat
   * @param data - Cleanup configuration with optional age limit
   * @returns Cleanup results with counts of removed items
   */
  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanupMessages(@Body() data: { maxAgeHours?: number } = {}) {
    const maxAgeHours = data.maxAgeHours || 24; // Default to 24 hours
    const cleanedCount = this.realtimeService.cleanupOldMessages(maxAgeHours);

    return {
      success: true,
      cleanedCount,
      maxAgeHours,
      timestamp: new Date(),
    };
  }

  /**
   * Health check endpoint for real-time services
   * Provides service status and basic health metrics
   * @returns Health status with service information
   */
  @Get('health')
  async healthCheck() {
    const stats = this.realtimeService.getGlobalStats();
    const connections = this.realtimeGateway.getConnectedClients();

    return {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        realtime: 'operational',
        websocket: 'operational',
        messageHistory: 'operational',
      },
      metrics: {
        totalRooms: stats.totalRooms,
        totalMessages: stats.totalMessages,
        activeConnections: connections.length,
      },
    };
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Generate unique message ID for HTTP API messages
   * Creates timestamp-based ID with random suffix for uniqueness
   * @returns Unique message identifier string
   */
  private generateMessageId(): string {
    return `http_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Group connected clients by user ID for statistics
   * Creates user distribution statistics for monitoring
   * @param clients - Array of connected client information
   * @returns Object mapping user IDs to client counts
   */
  private groupClientsByUser(clients: Record<string, unknown>[]): Record<string, number> {
    const userCounts: Record<string, number> = {};

    clients.forEach(client => {
      const userId = (client.userId as string) || 'anonymous';
      userCounts[userId] = (userCounts[userId] || 0) + 1;
    });

    return userCounts;
  }
}
