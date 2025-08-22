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

@Controller('api/sse')
export class SSEController {
  constructor(private readonly sseService: SSEService) {}

  /**
   * Establish SSE connection
   */
  @Get('connect')
  async connect(
    @Res() res: Response,
    @Headers('user-agent') userAgent: string,
    @Query('userId') userId?: string,
    @Query('subscriptions') subscriptions?: string
  ) {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Generate connection ID
    const connectionId = this.generateConnectionId();

    // Register connection
    const connection = this.sseService.registerConnection(
      connectionId,
      userId,
      userAgent,
      '127.0.0.1' // This would be extracted from request in production
    );

    // Subscribe to specified events
    if (subscriptions) {
      const eventTypes = subscriptions.split(',').map(s => s.trim());
      eventTypes.forEach(eventType => {
        this.sseService.subscribeToEvent(connectionId, eventType);
      });
    }

    // Send initial connection event
    this.sendSSEEvent(res, 'connected', {
      connectionId,
      message: 'SSE connection established',
      timestamp: new Date(),
      subscriptions: connection.subscriptions,
    });

    // Keep connection alive with heartbeat
    // eslint-disable-next-line no-undef
    const heartbeat = setInterval(() => {
      this.sendSSEEvent(res, 'heartbeat', {
        timestamp: new Date(),
        connectionId,
      });
    }, 30000); // Every 30 seconds

    // Handle client disconnect
    res.on('close', () => {
      // eslint-disable-next-line no-undef
      clearInterval(heartbeat);
      this.sseService.removeConnection(connectionId);
      res.end();
    });

    // Handle client error
    res.on('error', error => {
      // eslint-disable-next-line no-undef
      clearInterval(heartbeat);
      this.sseService.removeConnection(connectionId);
      this.logger.error(`SSE connection error: ${error.message}`);
      res.end();
    });
  }

  /**
   * Subscribe to events
   */
  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @Body() data: { connectionId: string; eventType: string }
  ): Promise<{ success: boolean; message: string }> {
    const { connectionId, eventType } = data;

    if (!connectionId || !eventType) {
      return { success: false, message: 'Connection ID and event type are required' };
    }

    const success = this.sseService.subscribeToEvent(connectionId, eventType);

    if (success) {
      return { success: true, message: `Subscribed to ${eventType}` };
    } else {
      return { success: false, message: 'Connection not found' };
    }
  }

  /**
   * Unsubscribe from events
   */
  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(
    @Body() data: { connectionId: string; eventType: string }
  ): Promise<{ success: boolean; message: string }> {
    const { connectionId, eventType } = data;

    if (!connectionId || !eventType) {
      return { success: false, message: 'Connection ID and event type are required' };
    }

    const success = this.sseService.unsubscribeFromEvent(connectionId, eventType);

    if (success) {
      return { success: true, message: `Unsubscribed from ${eventType}` };
    } else {
      return { success: false, message: 'Connection not found' };
    }
  }

  /**
   * Send event to specific connection
   */
  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendEvent(
    @Body() data: { connectionId: string; eventType: string; data: unknown }
  ): Promise<{ success: boolean; message: string }> {
    const { connectionId, eventType, data: eventData } = data;

    if (!connectionId || !eventType) {
      return { success: false, message: 'Connection ID and event type are required' };
    }

    const success = this.sseService.sendEventToConnection(connectionId, eventType, eventData);

    if (success) {
      return { success: true, message: `Event sent to connection ${connectionId}` };
    } else {
      return { success: false, message: 'Connection not found or not subscribed to event type' };
    }
  }

  /**
   * Broadcast event to all connections
   */
  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  async broadcastEvent(
    @Body() data: { eventType: string; data: unknown }
  ): Promise<{ success: boolean; sentCount: number }> {
    const { eventType, data: eventData } = data;

    if (!eventType) {
      return { success: false, sentCount: 0 };
    }

    const sentCount = this.sseService.broadcastEvent(eventType, eventData);

    return { success: true, sentCount };
  }

  /**
   * Get connection information
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
   * Get all connections
   */
  @Get('connections')
  async getAllConnections(): Promise<SSEConnection[]> {
    return this.sseService.getAllConnections();
  }

  /**
   * Get connections for specific event type
   */
  @Get('events/:eventType/connections')
  async getConnectionsForEvent(@Param('eventType') eventType: string): Promise<SSEConnection[]> {
    return this.sseService.getConnectionsForEvent(eventType);
  }

  /**
   * Get event history
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
   * Get connection statistics
   */
  @Get('stats')
  async getStats() {
    return this.sseService.getConnectionStats();
  }

  /**
   * Clean up old connections and events
   */
  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanup(
    @Body() data: { maxAgeHours?: number } = {}
  ): Promise<{ removedConnections: number; removedEvents: number }> {
    const maxAgeHours = data.maxAgeHours || 24;
    return this.sseService.cleanup(maxAgeHours);
  }

  /**
   * Health check for SSE service
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
   * Send SSE event to client
   */
  private sendSSEEvent(res: Response, event: string, data: unknown): void {
    const eventData = JSON.stringify(data);

    res.write(`event: ${event}\n`);
    res.write(`data: ${eventData}\n`);
    res.write(`id: ${Date.now()}\n`);
    res.write(`retry: 5000\n\n`); // Retry after 5 seconds if connection is lost
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `sse_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private readonly logger = console; // Replace with proper logger in production
}
