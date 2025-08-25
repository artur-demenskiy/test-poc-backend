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

/**
 * Client information interface for tracking connected WebSocket clients
 * Stores essential data about each client connection for management and monitoring
 */
export interface ClientInfo {
  id: string; // Unique socket ID
  userId?: string; // User ID if authenticated
  userAgent?: string; // Client browser/application info
  ip?: string; // Client IP address
  rooms: string[]; // Rooms the client is currently in
  connectedAt: Date; // Connection timestamp
  lastActivity: Date; // Last activity timestamp for cleanup
}

/**
 * WebSocket Gateway for real-time bidirectional communication
 * Handles WebSocket connections, room management, and message broadcasting
 * Uses Socket.IO for reliable WebSocket implementation with fallback support
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*', // CORS configuration for cross-origin requests
    credentials: true, // Allow credentials (cookies, auth headers)
  },
  namespace: '/realtime', // WebSocket namespace for this gateway
  transports: ['websocket', 'polling'], // Support both WebSocket and HTTP polling fallback
})
@UseGuards(WsAuthGuard, WsThrottlerGuard) // Apply authentication and rate limiting guards
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server; // Socket.IO server instance

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly clients = new Map<string, ClientInfo>(); // Track all connected clients

  constructor(private readonly realtimeService: RealtimeService) {}

  /**
   * Initialize WebSocket Gateway after server startup
   * Sets up global middleware and prepares the gateway for connections
   * @param server - Socket.IO server instance
   */
  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Set up global middleware for all incoming connections
    server.use((socket, next) => {
      // Initialize client info with connection details
      socket.data.clientInfo = {
        id: socket.id,
        userAgent: socket.handshake.headers['user-agent'], // Extract browser info
        ip: socket.handshake.address, // Extract client IP
        rooms: [], // Initialize empty rooms array
        connectedAt: new Date(), // Record connection time
        lastActivity: new Date(), // Set initial activity time
      };
      next(); // Continue to next middleware/handler
    });
  }

  /**
   * Handle new WebSocket client connections
   * Automatically adds clients to general room and notifies other clients
   * @param client - Connected Socket.IO client
   */
  handleConnection(client: Socket) {
    const clientInfo = client.data.clientInfo as ClientInfo;
    this.clients.set(client.id, clientInfo); // Store client info for tracking

    this.logger.log(`Client connected: ${client.id}`);

    // Automatically join default 'general' room for all new connections
    client.join('general');
    clientInfo.rooms.push('general');

    // Notify all clients in general room about new connection
    this.realtimeService.emitToRoom('general', 'client.connected', {
      clientId: client.id,
      timestamp: new Date(),
      totalClients: this.clients.size, // Send updated client count
    });

    // Send welcome message to newly connected client
    client.emit('welcome', {
      message: 'Welcome to real-time communication!',
      clientId: client.id,
      timestamp: new Date(),
    });
  }

  /**
   * Handle WebSocket client disconnections
   * Cleans up client data and notifies other clients about departure
   * @param client - Disconnected Socket.IO client
   */
  handleDisconnect(client: Socket) {
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      this.logger.log(`Client disconnected: ${client.id}`);

      // Leave all rooms and notify remaining members
      clientInfo.rooms.forEach(room => {
        client.leave(room);
        this.realtimeService.emitToRoom(room, 'client.disconnected', {
          clientId: client.id,
          timestamp: new Date(),
          totalClients: this.clients.size - 1, // Updated count after disconnect
        });
      });

      this.clients.delete(client.id); // Remove client from tracking
    }
  }

  /**
   * Handle client request to join a specific room
   * Validates room access, handles room switching, and notifies participants
   * @param data - Room join request data (room name, optional password)
   * @param client - Socket.IO client requesting to join
   * @returns Success/error response with room information
   */
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
      // Validate room access permissions (password check, capacity, etc.)
      if (!this.realtimeService.canJoinRoom(client.id, room, password)) {
        return { error: 'Access denied to room' };
      }

      // Leave current rooms (except general room which is always active)
      clientInfo.rooms.forEach(currentRoom => {
        if (currentRoom !== 'general') {
          client.leave(currentRoom);
        }
      });

      // Join the requested room
      client.join(room);
      clientInfo.rooms = ['general', room]; // Keep general + new room
      clientInfo.lastActivity = new Date(); // Update activity timestamp

      this.logger.log(`Client ${client.id} joined room: ${room}`);

      // Notify all clients in the room about new member
      this.realtimeService.emitToRoom(room, 'client.joined', {
        clientId: client.id,
        room,
        timestamp: new Date(),
        totalClients: this.getRoomClientCount(room), // Send updated room count
      });

      return { success: true, room, totalClients: this.getRoomClientCount(room) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to join room: ${errorMessage}`);
      return { error: 'Failed to join room' };
    }
  }

  /**
   * Handle client request to leave a specific room
   * Prevents leaving general room and notifies remaining participants
   * @param data - Room leave request data
   * @param client - Socket.IO client requesting to leave
   * @returns Success/error response
   */
  @SubscribeMessage('leave_room')
  handleLeaveRoom(@MessageBody() data: { room: string }, @ConnectedSocket() client: Socket) {
    const { room } = data;
    const clientInfo = this.clients.get(client.id);

    // Prevent leaving the general room (always active)
    if (!clientInfo || room === 'general') {
      return { error: 'Cannot leave general room' };
    }

    client.leave(room);
    clientInfo.rooms = clientInfo.rooms.filter(r => r !== room); // Remove room from client's list
    clientInfo.lastActivity = new Date(); // Update activity timestamp

    this.logger.log(`Client ${client.id} left room: ${room}`);

    // Notify remaining clients in the room
    this.realtimeService.emitToRoom(room, 'client.left', {
      clientId: client.id,
      room,
      timestamp: new Date(),
      totalClients: this.getRoomClientCount(room), // Send updated room count
    });

    return { success: true, room };
  }

  /**
   * Handle message sending in rooms
   * Validates message content, applies rate limiting, and broadcasts to room members
   * @param data - Message data (room, content, type)
   * @param client - Socket.IO client sending the message
   * @returns Success/error response with message ID
   */
  @SubscribeMessage('send_message')
  handleMessage(
    @MessageBody() data: { room: string; message: string; type?: string },
    @ConnectedSocket() client: Socket
  ) {
    const { room, message, type = 'text' } = data;
    const clientInfo = this.clients.get(client.id);

    // Verify client is in the specified room
    if (!clientInfo || !clientInfo.rooms.includes(room)) {
      return { error: 'Not in room' };
    }

    // Validate message content (prevent empty messages)
    if (!message || message.trim().length === 0) {
      return { error: 'Message cannot be empty' };
    }

    // Check rate limiting before allowing message
    if (!this.realtimeService.canSendMessage(client.id)) {
      return { error: 'Rate limit exceeded' };
    }

    // Create message object with metadata
    const messageData = {
      id: this.generateMessageId(), // Generate unique message ID
      clientId: client.id, // Sender's client ID
      room, // Target room
      message: message.trim(), // Cleaned message content
      type, // Message type (text, image, etc.)
      timestamp: new Date(), // Message timestamp
      userId: clientInfo.userId, // User ID if authenticated
    };

    // Broadcast message to all clients in the room
    this.realtimeService.emitToRoom(room, 'new_message', messageData);

    // Update client's last activity timestamp
    clientInfo.lastActivity = new Date();

    // Log message for debugging (truncated for privacy)
    this.logger.debug(`Message sent in room ${room}: ${message.substring(0, 50)}...`);

    return { success: true, messageId: messageData.id };
  }

  /**
   * Handle typing indicators for real-time feedback
   * Broadcasts typing status to other clients in the same room
   * @param data - Typing indicator data
   * @param client - Socket.IO client sending typing status
   */
  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { room: string; isTyping: boolean },
    @ConnectedSocket() client: Socket
  ) {
    const { room, isTyping } = data;
    const clientInfo = this.clients.get(client.id);

    // Only process if client is in the specified room
    if (!clientInfo || !clientInfo.rooms.includes(room)) {
      return;
    }

    // Emit typing indicator to room (excluding sender to avoid echo)
    client.to(room).emit('user_typing', {
      clientId: client.id,
      room,
      isTyping,
      timestamp: new Date(),
    });
  }

  /**
   * Handle ping requests for connection health monitoring
   * Updates client activity timestamp and responds with pong
   * @param client - Socket.IO client sending ping
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      clientInfo.lastActivity = new Date(); // Update activity timestamp
    }
    client.emit('pong', { timestamp: new Date() }); // Send pong response
  }

  /**
   * Handle client statistics request
   * Returns comprehensive information about client connection and activity
   * @param client - Socket.IO client requesting stats
   * @returns Client statistics and connection information
   */
  @SubscribeMessage('get_stats')
  handleGetStats(@ConnectedSocket() client: Socket) {
    const clientInfo = this.clients.get(client.id);
    if (!clientInfo) {
      return { error: 'Client not found' };
    }

    return {
      clientId: client.id,
      connectedAt: clientInfo.connectedAt, // Connection timestamp
      lastActivity: clientInfo.lastActivity, // Last activity timestamp
      rooms: clientInfo.rooms, // Current rooms
      totalClients: this.clients.size, // Total connected clients
      uptime: Date.now() - clientInfo.connectedAt.getTime(), // Connection duration
    };
  }

  /**
   * Get the number of clients currently in a specific room
   * Uses Socket.IO's built-in room management for accurate counts
   * @param room - Room name to count clients in
   * @returns Number of clients in the room
   */
  private getRoomClientCount(room: string): number {
    const roomSockets = this.server.sockets.adapter.rooms.get(room);
    return roomSockets ? roomSockets.size : 0;
  }

  /**
   * Generate unique message ID for tracking and deduplication
   * Combines timestamp and random string for uniqueness
   * @returns Unique message identifier
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Public methods for external use (e.g., from other services)

  /**
   * Get all currently connected clients
   * Useful for monitoring and administrative purposes
   * @returns Array of all connected client information
   */
  getConnectedClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get specific client information by ID
   * @param clientId - Client socket ID to look up
   * @returns Client information or undefined if not found
   */
  getClientInfo(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all clients currently in a specific room
   * @param room - Room name to get clients for
   * @returns Array of clients in the specified room
   */
  getRoomClients(room: string): ClientInfo[] {
    return Array.from(this.clients.values()).filter(client => client.rooms.includes(room));
  }
}
