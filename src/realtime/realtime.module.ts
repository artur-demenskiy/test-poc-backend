import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { RealtimeController } from './realtime.controller';
import { SSEService } from './sse/sse.service';
import { SSEController } from './sse/sse.controller';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { WsThrottlerGuard } from './guards/ws-throttler.guard';

/**
 * Real-time Communication Module for NestJS
 *
 * This module provides comprehensive real-time communication capabilities including:
 * - WebSocket Gateway for bidirectional communication
 * - Server-Sent Events (SSE) for unidirectional streaming
 * - Room-based chat system with authentication
 * - Rate limiting and security guards
 * - Event-driven architecture with EventEmitter2
 *
 * Architecture Overview:
 * ├── RealtimeGateway: WebSocket connections and real-time messaging
 * ├── RealtimeService: Business logic for rooms and messages
 * ├── RealtimeController: HTTP API for administrative operations
 * ├── SSEService: Server-Sent Events management
 * ├── SSEController: SSE HTTP endpoints
 * ├── WsAuthGuard: WebSocket authentication
 * └── WsThrottlerGuard: Rate limiting for WebSocket operations
 *
 * Dependencies:
 * - EventEmitterModule: For event-driven communication between services
 * - Socket.IO: WebSocket implementation with fallback support
 * - Guards: Security and rate limiting for WebSocket connections
 */
@Module({
  imports: [
    // Event emitter for decoupled service communication
    EventEmitterModule.forRoot({
      // Global event emitter configuration
      wildcard: true, // Enable wildcard event listening
      delimiter: '.', // Event name delimiter for hierarchical events
      maxListeners: 100, // Maximum listeners per event
      verboseMemoryLeak: true, // Verbose memory leak detection
    }),
  ],
  controllers: [
    // HTTP API endpoints for real-time management
    RealtimeController, // Room management, statistics, and administrative operations
    SSEController, // Server-Sent Events endpoints
  ],
  providers: [
    // Core services and business logic
    RealtimeService, // Room and message management
    SSEService, // SSE connection and event management

    // WebSocket Gateway for real-time communication
    RealtimeGateway, // Socket.IO implementation with room support

    // Security and rate limiting guards
    WsAuthGuard, // WebSocket authentication guard
    WsThrottlerGuard, // Rate limiting guard for WebSocket operations
  ],
  exports: [
    // Export services for use in other modules
    RealtimeService, // Allow other modules to use real-time functionality
    SSEService, // Allow other modules to use SSE functionality
    RealtimeGateway, // Allow other modules to access WebSocket gateway
  ],
})
export class RealtimeModule {}
