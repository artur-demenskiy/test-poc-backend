import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * Rate limiting information for a specific client and operation type
 * Tracks request count and reset time for sliding window rate limiting
 */
interface ThrottleInfo {
  count: number; // Number of requests in current window
  resetTime: number; // Timestamp when rate limit resets (milliseconds)
}

/**
 * WebSocket Rate Limiting Guard for preventing abuse and ensuring fair usage
 * Implements sliding window rate limiting for different types of WebSocket operations
 *
 * Rate Limits:
 * - Connections: 10 per minute per client
 * - Messages: 60 per minute per client
 * - Events: 100 per minute per client per event type
 *
 * Features:
 * - Per-client rate limiting with IP/user ID fallback
 * - Automatic cleanup of expired throttle entries
 * - Comprehensive logging and monitoring
 * - Configurable limits for different operation types
 */
@Injectable()
export class WsThrottlerGuard implements CanActivate {
  private readonly logger = new Logger(WsThrottlerGuard.name);

  // Rate limiting storage: maps throttle keys to throttle information
  private readonly throttleMap = new Map<string, ThrottleInfo>();

  // Rate limiting configuration constants
  private readonly maxConnectionsPerMinute = 10; // Max connection attempts per minute
  private readonly maxMessagesPerMinute = 60; // Max messages per minute
  private readonly maxEventsPerMinute = 100; // Max events per minute per event type

  /**
   * Main guard method that applies rate limiting based on operation type
   * Routes different operations to appropriate rate limiting checks
   * @param context - Execution context containing operation information
   * @returns True if operation is allowed, throws WsException if rate limited
   */
  canActivate(context: ExecutionContext): boolean {
    // Only apply rate limiting to WebSocket operations
    if (context.getType() !== 'ws') {
      return true;
    }

    const client: Socket = context.switchToWs().getClient();
    const handler = context.getHandler();
    const handlerName = handler.name;

    try {
      // Route different operation types to appropriate rate limiting checks
      if (handlerName === 'handleConnection') {
        return this.checkConnectionLimit(client);
      }

      if (handlerName === 'handleMessage') {
        return this.checkMessageLimit(client);
      }

      // Apply general event rate limiting for all other operations
      return this.checkEventLimit(client, handlerName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`WebSocket throttling failed: ${errorMessage}`);
      throw new WsException('Rate limit exceeded');
    }
  }

  /**
   * Check connection rate limiting for new WebSocket connections
   * Prevents rapid reconnection attempts and connection flooding
   * @param client - Socket.IO client attempting to connect
   * @returns True if connection is allowed, false if rate limited
   */
  private checkConnectionLimit(client: Socket): boolean {
    const clientId = this.getClientIdentifier(client);
    const now = Date.now();
    const throttleKey = `conn_${clientId}`; // Connection-specific throttle key
    const throttleInfo = this.throttleMap.get(throttleKey);

    if (!throttleInfo) {
      // First connection attempt - initialize throttle counter
      this.throttleMap.set(throttleKey, {
        count: 1,
        resetTime: now + 60000, // Reset in 1 minute (60,000 ms)
      });
      return true;
    }

    if (now > throttleInfo.resetTime) {
      // Rate limit window has expired - reset counter for new window
      throttleInfo.count = 1;
      throttleInfo.resetTime = now + 60000;
      return true;
    }

    if (throttleInfo.count >= this.maxConnectionsPerMinute) {
      this.logger.warn(`Connection rate limit exceeded for client: ${clientId}`);
      return false; // Rate limit exceeded
    }

    // Increment connection count for current window
    throttleInfo.count++;
    return true;
  }

  /**
   * Check message rate limiting for chat messages
   * Prevents spam and ensures fair message distribution
   * @param client - Socket.IO client sending message
   * @returns True if message is allowed, false if rate limited
   */
  private checkMessageLimit(client: Socket): boolean {
    const clientId = this.getClientIdentifier(client);
    const now = Date.now();
    const throttleKey = `msg_${clientId}`; // Message-specific throttle key
    const throttleInfo = this.throttleMap.get(throttleKey);

    if (!throttleInfo) {
      // First message from this client - initialize throttle counter
      this.throttleMap.set(throttleKey, {
        count: 1,
        resetTime: now + 60000, // Reset in 1 minute
      });
      return true;
    }

    if (now > throttleInfo.resetTime) {
      // Rate limit window has expired - reset counter for new window
      throttleInfo.count = 1;
      throttleInfo.resetTime = now + 60000;
      return true;
    }

    if (throttleInfo.count >= this.maxMessagesPerMinute) {
      this.logger.warn(`Message rate limit exceeded for client: ${clientId}`);
      return false; // Rate limit exceeded
    }

    // Increment message count for current window
    throttleInfo.count++;
    return true;
  }

  /**
   * Check general event rate limiting for all other WebSocket operations
   * Applies per-event-type rate limiting to prevent abuse
   * @param client - Socket.IO client performing operation
   * @param eventName - Name of the event being performed
   * @returns True if operation is allowed, false if rate limited
   */
  private checkEventLimit(client: Socket, eventName: string): boolean {
    const clientId = this.getClientIdentifier(client);
    const now = Date.now();
    const throttleKey = `event_${clientId}_${eventName}`; // Event-specific throttle key
    const throttleInfo = this.throttleMap.get(throttleKey);

    if (!throttleInfo) {
      // First occurrence of this event type - initialize throttle counter
      this.throttleMap.set(throttleKey, {
        count: 1,
        resetTime: now + 60000, // Reset in 1 minute
      });
      return true;
    }

    if (now > throttleInfo.resetTime) {
      // Rate limit window has expired - reset counter for new window
      throttleInfo.count = 1;
      throttleInfo.resetTime = now + 60000;
      return true;
    }

    if (throttleInfo.count >= this.maxEventsPerMinute) {
      this.logger.warn(`Event rate limit exceeded for client: ${clientId}, event: ${eventName}`);
      return false; // Rate limit exceeded
    }

    // Increment event count for current window
    throttleInfo.count++;
    return true;
  }

  /**
   * Get unique identifier for a client for rate limiting purposes
   * Prioritizes user ID if authenticated, falls back to IP address, then socket ID
   * @param client - Socket.IO client to identify
   * @returns Unique string identifier for the client
   */
  private getClientIdentifier(client: Socket): string {
    // Priority 1: Use authenticated user ID if available
    const userId = client.data?.userId;
    if (userId) {
      return userId;
    }

    // Priority 2: Use client IP address for anonymous users
    const ip = client.handshake.address;
    if (ip) {
      return ip;
    }

    // Priority 3: Fallback to socket ID (least reliable for rate limiting)
    return client.id;
  }

  /**
   * Clean up expired throttle entries to prevent memory bloat
   * Removes throttle entries that have exceeded their reset time
   * Should be called periodically (e.g., every few minutes)
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    // Find all expired throttle entries
    this.throttleMap.forEach((info, key) => {
      if (now > info.resetTime) {
        keysToDelete.push(key);
      }
    });

    // Remove expired entries
    keysToDelete.forEach(key => {
      this.throttleMap.delete(key);
    });

    if (keysToDelete.length > 0) {
      this.logger.debug(`Cleaned up ${keysToDelete.length} throttle entries`);
    }
  }

  /**
   * Get current throttle statistics for monitoring and debugging
   * Provides insights into rate limiting activity and memory usage
   * @returns Object containing throttle statistics
   */
  getThrottleStats(): {
    totalEntries: number; // Total throttle entries in memory
    activeThrottles: number; // Number of active (non-expired) throttles
  } {
    const now = Date.now();
    let activeThrottles = 0;

    // Count active (non-expired) throttle entries
    this.throttleMap.forEach(info => {
      if (now <= info.resetTime) {
        activeThrottles++;
      }
    });

    return {
      totalEntries: this.throttleMap.size,
      activeThrottles,
    };
  }
}
