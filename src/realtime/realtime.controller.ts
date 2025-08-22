import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RealtimeService, RoomInfo } from './realtime.service';
import { RealtimeGateway } from './realtime.gateway';
import { WsAuthGuard } from './guards/ws-auth.guard';

@Controller('api/realtime')
@UseGuards(WsAuthGuard)
export class RealtimeController {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly realtimeGateway: RealtimeGateway
  ) {}

  /**
   * Get all available rooms
   */
  @Get('rooms')
  async getRooms(): Promise<RoomInfo[]> {
    return this.realtimeService.getAllRooms();
  }

  /**
   * Get room information
   */
  @Get('rooms/:name')
  async getRoom(@Param('name') name: string): Promise<RoomInfo | { error: string }> {
    const room = this.realtimeService.getRoomInfo(name);
    if (!room) {
      return { error: 'Room not found' };
    }
    return room;
  }

  /**
   * Get room statistics
   */
  @Get('rooms/:name/stats')
  async getRoomStats(@Param('name') name: string) {
    return this.realtimeService.getRoomStats(name);
  }

  /**
   * Get message history for a room
   */
  @Get('rooms/:name/messages')
  async getMessageHistory(@Param('name') name: string, @Query('limit') limit: string = '50') {
    const limitNum = parseInt(limit, 10) || 50;
    return this.realtimeService.getMessageHistory(name, limitNum);
  }

  /**
   * Search messages in a room
   */
  @Get('rooms/:name/search')
  async searchMessages(
    @Param('name') name: string,
    @Query('q') query: string,
    @Query('limit') limit: string = '20'
  ) {
    if (!query) {
      return { error: 'Search query is required' };
    }

    const limitNum = parseInt(limit, 10) || 20;
    return this.realtimeService.searchMessages(name, query, limitNum);
  }

  /**
   * Create a new room
   */
  @Post('rooms')
  @HttpCode(HttpStatus.CREATED)
  async createRoom(
    @Body() data: { name: string; password?: string; maxClients?: number; isPrivate?: boolean }
  ): Promise<RoomInfo | { error: string }> {
    try {
      const room = this.realtimeService.createRoom(data.name, {
        password: data.password,
        maxClients: data.maxClients,
        isPrivate: data.isPrivate,
      });
      return room;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { error: errorMessage };
    }
  }

  /**
   * Delete a room
   */
  @Delete('rooms/:name')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoom(@Param('name') name: string): Promise<void> {
    const deleted = this.realtimeService.deleteRoom(name);
    if (!deleted) {
      throw new Error('Room not found or cannot be deleted');
    }
  }

  /**
   * Get connected clients
   */
  @Get('clients')
  async getConnectedClients() {
    return this.realtimeGateway.getConnectedClients();
  }

  /**
   * Get client information
   */
  @Get('clients/:id')
  async getClientInfo(@Param('id') id: string) {
    const client = this.realtimeGateway.getClientInfo(id);
    if (!client) {
      return { error: 'Client not found' };
    }
    return client;
  }

  /**
   * Get clients in a specific room
   */
  @Get('rooms/:name/clients')
  async getRoomClients(@Param('name') name: string) {
    return this.realtimeGateway.getRoomClients(name);
  }

  /**
   * Get global statistics
   */
  @Get('stats')
  async getGlobalStats() {
    return this.realtimeService.getGlobalStats();
  }

  /**
   * Broadcast announcement to all rooms
   */
  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  async broadcastAnnouncement(
    @Body() data: { message: string; type?: string }
  ): Promise<{ success: boolean; messageId: string }> {
    const messageData = {
      id: this.generateMessageId(),
      clientId: 'system',
      room: 'announcements',
      message: data.message,
      type: data.type || 'announcement',
      timestamp: new Date(),
      userId: 'system',
    };

    // Broadcast to announcements room
    this.realtimeService.broadcastMessage('announcements', messageData);

    // Also emit to general room
    this.realtimeService.broadcastMessage('general', {
      ...messageData,
      room: 'general',
    });

    return { success: true, messageId: messageData.id };
  }

  /**
   * Clean up old messages
   */
  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanupMessages(
    @Body() data: { maxAgeHours?: number } = {}
  ): Promise<{ cleanedCount: number }> {
    const maxAgeHours = data.maxAgeHours || 24;
    const cleanedCount = this.realtimeService.cleanupOldMessages(maxAgeHours);
    return { cleanedCount };
  }

  /**
   * Health check for realtime service
   */
  @Get('health')
  async healthCheck() {
    const stats = this.realtimeService.getGlobalStats();
    const connectedClients = this.realtimeGateway.getConnectedClients();

    return {
      status: 'healthy',
      timestamp: new Date(),
      stats: {
        ...stats,
        connectedClients: connectedClients.length,
      },
    };
  }

  private generateMessageId(): string {
    return `sys_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
