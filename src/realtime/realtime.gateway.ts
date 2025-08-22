import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RealtimeService } from './realtime.service';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { WsThrottlerGuard } from './guards/ws-throttler.guard';

export interface ClientInfo {
  id: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  rooms: string[];
  connectedAt: Date;
  lastActivity: Date;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/realtime',
  transports: ['websocket', 'polling'],
})
@UseGuards(WsAuthGuard, WsThrottlerGuard)
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly clients = new Map<string, ClientInfo>();

  constructor(private readonly realtimeService: RealtimeService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Set up global middleware
    server.use((socket, next) => {
      // Add client info
      socket.data.clientInfo = {
        id: socket.id,
        userAgent: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address,
        rooms: [],
        connectedAt: new Date(),
        lastActivity: new Date(),
      };
      next();
    });
  }

  handleConnection(client: Socket) {
    const clientInfo = client.data.clientInfo as ClientInfo;
    this.clients.set(client.id, clientInfo);

    this.logger.log(`Client connected: ${client.id}`);

    // Join default room
    client.join('general');
    clientInfo.rooms.push('general');

    // Emit connection event
    this.realtimeService.emitToRoom('general', 'client.connected', {
      clientId: client.id,
      timestamp: new Date(),
      totalClients: this.clients.size,
    });

    // Send welcome message
    client.emit('welcome', {
      message: 'Welcome to real-time communication!',
      clientId: client.id,
      timestamp: new Date(),
    });
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      this.logger.log(`Client disconnected: ${client.id}`);

      // Leave all rooms
      clientInfo.rooms.forEach(room => {
        client.leave(room);
        this.realtimeService.emitToRoom(room, 'client.disconnected', {
          clientId: client.id,
          timestamp: new Date(),
          totalClients: this.clients.size - 1,
        });
      });

      this.clients.delete(client.id);
    }
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @MessageBody() data: { room: string; password?: string },
    @ConnectedSocket() client: Socket
  ) {
    const { room, password } = data;
    const clientInfo = this.clients.get(client.id);

    if (!clientInfo) {
      return { error: 'Client not found' };
    }

    try {
      // Validate room access
      if (!this.realtimeService.canJoinRoom(client.id, room, password)) {
        return { error: 'Access denied to room' };
      }

      // Leave current rooms (except general)
      clientInfo.rooms.forEach(currentRoom => {
        if (currentRoom !== 'general') {
          client.leave(currentRoom);
        }
      });

      // Join new room
      client.join(room);
      clientInfo.rooms = ['general', room];
      clientInfo.lastActivity = new Date();

      this.logger.log(`Client ${client.id} joined room: ${room}`);

      // Notify room members
      this.realtimeService.emitToRoom(room, 'client.joined', {
        clientId: client.id,
        room,
        timestamp: new Date(),
        totalClients: this.getRoomClientCount(room),
      });

      return { success: true, room, totalClients: this.getRoomClientCount(room) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to join room: ${errorMessage}`);
      return { error: 'Failed to join room' };
    }
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(@MessageBody() data: { room: string }, @ConnectedSocket() client: Socket) {
    const { room } = data;
    const clientInfo = this.clients.get(client.id);

    if (!clientInfo || room === 'general') {
      return { error: 'Cannot leave general room' };
    }

    client.leave(room);
    clientInfo.rooms = clientInfo.rooms.filter(r => r !== room);
    clientInfo.lastActivity = new Date();

    this.logger.log(`Client ${client.id} left room: ${room}`);

    // Notify room members
    this.realtimeService.emitToRoom(room, 'client.left', {
      clientId: client.id,
      room,
      timestamp: new Date(),
      totalClients: this.getRoomClientCount(room),
    });

    return { success: true, room };
  }

  @SubscribeMessage('send_message')
  handleMessage(
    @MessageBody() data: { room: string; message: string; type?: string },
    @ConnectedSocket() client: Socket
  ) {
    const { room, message, type = 'text' } = data;
    const clientInfo = this.clients.get(client.id);

    if (!clientInfo || !clientInfo.rooms.includes(room)) {
      return { error: 'Not in room' };
    }

    if (!message || message.trim().length === 0) {
      return { error: 'Message cannot be empty' };
    }

    // Rate limiting check
    if (!this.realtimeService.canSendMessage(client.id)) {
      return { error: 'Rate limit exceeded' };
    }

    const messageData = {
      id: this.generateMessageId(),
      clientId: client.id,
      room,
      message: message.trim(),
      type,
      timestamp: new Date(),
      userId: clientInfo.userId,
    };

    // Broadcast to room
    this.realtimeService.emitToRoom(room, 'new_message', messageData);

    // Update client activity
    clientInfo.lastActivity = new Date();

    // Log message
    this.logger.debug(`Message sent in room ${room}: ${message.substring(0, 50)}...`);

    return { success: true, messageId: messageData.id };
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { room: string; isTyping: boolean },
    @ConnectedSocket() client: Socket
  ) {
    const { room, isTyping } = data;
    const clientInfo = this.clients.get(client.id);

    if (!clientInfo || !clientInfo.rooms.includes(room)) {
      return;
    }

    // Emit typing indicator to room (excluding sender)
    client.to(room).emit('user_typing', {
      clientId: client.id,
      room,
      isTyping,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      clientInfo.lastActivity = new Date();
    }
    client.emit('pong', { timestamp: new Date() });
  }

  @SubscribeMessage('get_stats')
  handleGetStats(@ConnectedSocket() client: Socket) {
    const clientInfo = this.clients.get(client.id);
    if (!clientInfo) {
      return { error: 'Client not found' };
    }

    return {
      clientId: client.id,
      connectedAt: clientInfo.connectedAt,
      lastActivity: clientInfo.lastActivity,
      rooms: clientInfo.rooms,
      totalClients: this.clients.size,
      uptime: Date.now() - clientInfo.connectedAt.getTime(),
    };
  }

  private getRoomClientCount(room: string): number {
    const roomSockets = this.server.sockets.adapter.rooms.get(room);
    return roomSockets ? roomSockets.size : 0;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Public methods for external use
  getConnectedClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  getClientInfo(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }

  getRoomClients(room: string): ClientInfo[] {
    return Array.from(this.clients.values()).filter(client => client.rooms.includes(room));
  }
}
