import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { SSEService, SSEConnection } from './sse.service';

/**
 * Server-Sent Events (SSE) Controller for unidirectional real-time communication
 * Provides HTTP endpoints for establishing SSE connections and managing event subscriptions
 *
 * SSE is ideal for:
 * - Real-time notifications and updates
 * - Live data streaming (stock prices, sensor data)
 * - Server-to-client push notifications
 * - Broadcasting system events
 *
 * Features:
 * - Persistent HTTP connections with automatic reconnection
 * - Event subscription management
 * - Connection health monitoring with heartbeat
 * - Comprehensive connection statistics
 */
@Controller('api/sse')
export class SSEController {
  constructor(private readonly sseService: SSEService) {}

  /**
   * Establish Server-Sent Events connection
   * Creates persistent HTTP connection for real-time event streaming
   * Sets up SSE headers, connection tracking, and automatic heartbeat
   *
   * @param res - Express response object for SSE streaming
   * @param userAgent - Client browser/application information
   * @param userId - Optional user ID for authenticated connections
   * @param subscriptions - Comma-separated list of event types to subscribe to
   */
  @Get('connect')
  async connect(
    @Res() res: Response,
    @Headers('user-agent') userAgent: string,
    @Query('userId') userId?: string,
    @Query('subscriptions') subscriptions?: string
  ) {
    // Set required SSE headers for proper event streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', // SSE content type
      'Cache-Control': 'no-cache', // Prevent caching
      Connection: 'keep-alive', // Keep connection alive
      'Access-Control-Allow-Origin': '*', // CORS for cross-origin requests
      'Access-Control-Allow-Headers': 'Cache-Control', // Allow cache control headers
    });

    // Generate unique connection identifier for tracking
    const connectionId = this.generateConnectionId();

    // Register connection in SSE service for event routing
    const connection = this.sseService.registerConnection(
      connectionId,
      userId,
      userAgent,
      '127.0.0.1' // TODO: Extract actual client IP from request in production
    );

    // Subscribe to specified event types if provided
    if (subscriptions) {
      const eventTypes = subscriptions.split(',').map(s => s.trim());
      eventTypes.forEach(eventType => {
        this.sseService.subscribeToEvent(connectionId, eventType);
      });
    }

    // Send initial connection confirmation event
    this.sendSSEEvent(res, 'connected', {
      connectionId,
      message: 'SSE connection established',
      timestamp: new Date(),
      subscriptions: connection.subscriptions,
    });

    // Set up heartbeat to keep connection alive and detect disconnections
    // Heartbeat sends periodic events every 30 seconds
    // eslint-disable-next-line no-undef
    const heartbeat = setInterval(() => {
      this.sendSSEEvent(res, 'heartbeat', {
        timestamp: new Date(),
        connectionId,
      });
    }, 30000); // 30 seconds interval

    // Handle client disconnect (connection closed by client)
    res.on('close', () => {
      // eslint-disable-next-line no-undef
      clearInterval(heartbeat); // Stop heartbeat
      this.sseService.removeConnection(connectionId); // Clean up connection
      res.end(); // End response
    });

    // Handle connection errors (network issues, etc.)
    res.on('error', error => {
      // eslint-disable-next-line no-undef
      clearInterval(heartbeat); // Stop heartbeat
      this.sseService.removeConnection(connectionId); // Clean up connection
      this.logger.error(`SSE connection error: ${error.message}`);
      res.end(); // End response
    });
  }

  /**
   * Subscribe to specific event types
   * Allows clients to dynamically subscribe to events after connection establishment
   * @param data - Subscription request containing connection ID and event type
   * @returns Success/failure response with descriptive message
   */
  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @Body() data: { connectionId: string; eventType: string }
  ): Promise<{ success: boolean; message: string }> {
    const { connectionId, eventType } = data;

    // Validate required parameters
    if (!connectionId || !eventType) {
      return { success: false, message: 'Connection ID and event type are required' };
    }

    // Attempt to subscribe connection to specified event type
    const success = this.sseService.subscribeToEvent(connectionId, eventType);

    if (success) {
      return { success: true, message: `Subscribed to ${eventType}` };
    } else {
      return { success: false, message: 'Connection not found' };
    }
  }

  /**
   * Unsubscribe from specific event types
   * Allows clients to stop receiving certain event types
   * @param data - Unsubscription request containing connection ID and event type
   * @returns Success/failure response with descriptive message
   */
  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(
    @Body() data: { connectionId: string; eventType: string }
  ): Promise<{ success: boolean; message: string }> {
    const { connectionId, eventType } = data;

    // Validate required parameters
    if (!connectionId || !eventType) {
      return { success: false, message: 'Connection ID and event type are required' };
    }

    // Attempt to unsubscribe connection from specified event type
    const success = this.sseService.unsubscribeFromEvent(connectionId, eventType);

    if (success) {
      return { success: true, message: `Unsubscribed from ${eventType}` };
    } else {
      return { success: false, message: 'Connection not found' };
    }
  }

  /**
   * Send event to specific connection
   * Allows targeted event delivery to individual clients
   * @param data - Event data containing connection ID, event type, and payload
   * @returns Success/failure response with descriptive message
   */
  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendEvent(
    @Body() data: { connectionId: string; eventType: string; data: unknown }
  ): Promise<{ success: boolean; message: string }> {
    const { connectionId, eventType, data: eventData } = data;

    // Validate required parameters
    if (!connectionId || !eventType) {
      return { success: false, message: 'Connection ID and event type are required' };
    }

    // Attempt to send event to specific connection
    const success = this.sseService.sendEventToConnection(connectionId, eventType, eventData);

    if (success) {
      return { success: true, message: `Event sent to connection ${connectionId}` };
    } else {
      return { success: false, message: 'Connection not found or not subscribed to event type' };
    }
  }

  /**
   * Broadcast event to all connections
   * Sends event to all active SSE connections (useful for announcements)
   * @param data - Event data containing event type and payload
   * @returns Success response with count of connections that received the event
   */
  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  async broadcastEvent(
    @Body() data: { eventType: string; data: unknown }
  ): Promise<{ success: boolean; sentCount: number }> {
    const { eventType, data: eventData } = data;

    // Validate required parameters
    if (!eventType) {
      return { success: false, sentCount: 0 };
    }

    // Broadcast event to all connections and get count of successful deliveries
    const sentCount = this.sseService.broadcastEvent(eventType, eventData);

    return { success: true, sentCount };
  }

  /**
   * Get information about specific SSE connection
   * Provides connection details, subscriptions, and status information
   * @param id - Connection ID to look up
   * @returns Connection information or error if not found
   */
  @Get('connections/:id')
  async getConnection(@Param('id') id: string): Promise<SSEConnection | { error: string }> {
    const connection = this.sseService.getConnectionInfo(id);
    if (!connection) {
      return { error: 'Connection not found' };
    }
    return connection;
  }

  /**
   * Get all active SSE connections
   * Useful for monitoring and administrative purposes
   * @returns Array of all active connection information
   */
  @Get('connections')
  async getAllConnections(): Promise<SSEConnection[]> {
    return this.sseService.getAllConnections();
  }

  /**
   * Get all connections subscribed to specific event type
   * Useful for understanding event subscription patterns
   * @param eventType - Event type to find subscribers for
   * @returns Array of connections subscribed to the event type
   */
  @Get('events/:eventType/connections')
  async getConnectionsForEvent(@Param('eventType') eventType: string): Promise<SSEConnection[]> {
    return this.sseService.getConnectionsForEvent(eventType);
  }

  /**
   * Get event history for specific event type
   * Provides historical event data for debugging and analysis
   * @param eventType - Event type to get history for
   * @param limit - Maximum number of events to return (default: 50)
   * @returns Array of historical events
   */
  @Get('events/:eventType/history')
  async getEventHistory(
    @Param('eventType') eventType: string,
    @Query('limit') limit: string = '50'
  ) {
    const limitNum = parseInt(limit, 10) || 50;
    return this.sseService.getEventHistory(eventType, limitNum);
  }

  /**
   * Get SSE connection statistics
   * Provides overview of connection counts, event activity, and system health
   * @returns Connection statistics object
   */
  @Get('stats')
  async getStats() {
    return this.sseService.getConnectionStats();
  }

  /**
   * Clean up old connections and events
   * Removes stale connections and expired events to maintain system performance
   * @param data - Cleanup configuration with optional age limit
   * @returns Cleanup results with counts of removed items
   */
  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanup(
    @Body() data: { maxAgeHours?: number } = {}
  ): Promise<{ removedConnections: number; removedEvents: number }> {
    const maxAgeHours = data.maxAgeHours || 24; // Default to 24 hours
    return this.sseService.cleanup(maxAgeHours);
  }

  /**
   * Health check endpoint for SSE service
   * Provides service status and basic statistics for monitoring
   * @returns Health status with timestamp and statistics
   */
  @Get('health')
  async healthCheck() {
    const stats = this.sseService.getConnectionStats();

    return {
      status: 'healthy',
      timestamp: new Date(),
      stats,
    };
  }

  /**
   * Send Server-Sent Event to client
   * Formats event data according to SSE specification and writes to response stream
   * @param res - Express response object for SSE streaming
   * @param event - Event name/type
   * @param data - Event payload data (will be JSON stringified)
   */
  private sendSSEEvent(res: Response, event: string, data: unknown): void {
    const eventData = JSON.stringify(data);

    // Write SSE event according to specification:
    // - event: event type
    // - data: event payload
    // - id: unique event identifier
    // - retry: reconnection delay in milliseconds
    res.write(`event: ${event}\n`);
    res.write(`data: ${eventData}\n`);
    res.write(`id: ${Date.now()}\n`);
    res.write(`retry: 5000\n\n`); // Retry after 5 seconds if connection is lost
  }

  /**
   * Generate unique connection identifier
   * Creates timestamp-based ID with random suffix for uniqueness
   * @returns Unique connection identifier string
   */
  private generateConnectionId(): string {
    return `sse_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // TODO: Replace with proper logger injection
  private readonly logger = console;
}
