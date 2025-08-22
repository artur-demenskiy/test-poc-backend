import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

interface ThrottleInfo {
  count: number;
  resetTime: number;
}

@Injectable()
export class WsThrottlerGuard implements CanActivate {
  private readonly logger = new Logger(WsThrottlerGuard.name);
  private readonly throttleMap = new Map<string, ThrottleInfo>();

  // Rate limiting configuration
  private readonly maxConnectionsPerMinute = 10;
  private readonly maxMessagesPerMinute = 60;
  private readonly maxEventsPerMinute = 100;

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'ws') {
      return true;
    }

    const client: Socket = context.switchToWs().getClient();
    const handler = context.getHandler();
    const handlerName = handler.name;

    try {
      // Check connection rate limiting
      if (handlerName === 'handleConnection') {
        return this.checkConnectionLimit(client);
      }

      // Check message rate limiting
      if (handlerName === 'handleMessage') {
        return this.checkMessageLimit(client);
      }

      // Check general event rate limiting
      return this.checkEventLimit(client, handlerName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`WebSocket throttling failed: ${errorMessage}`);
      throw new WsException('Rate limit exceeded');
    }
  }

  private checkConnectionLimit(client: Socket): boolean {
    const clientId = this.getClientIdentifier(client);
    const now = Date.now();
    const throttleInfo = this.throttleMap.get(`conn_${clientId}`);

    if (!throttleInfo) {
      this.throttleMap.set(`conn_${clientId}`, {
        count: 1,
        resetTime: now + 60000, // 1 minute
      });
      return true;
    }

    if (now > throttleInfo.resetTime) {
      // Reset throttle
      throttleInfo.count = 1;
      throttleInfo.resetTime = now + 60000;
      return true;
    }

    if (throttleInfo.count >= this.maxConnectionsPerMinute) {
      this.logger.warn(`Connection rate limit exceeded for client: ${clientId}`);
      return false;
    }

    throttleInfo.count++;
    return true;
  }

  private checkMessageLimit(client: Socket): boolean {
    const clientId = this.getClientIdentifier(client);
    const now = Date.now();
    const throttleInfo = this.throttleMap.get(`msg_${clientId}`);

    if (!throttleInfo) {
      this.throttleMap.set(`msg_${clientId}`, {
        count: 1,
        resetTime: now + 60000, // 1 minute
      });
      return true;
    }

    if (now > throttleInfo.resetTime) {
      // Reset throttle
      throttleInfo.count = 1;
      throttleInfo.resetTime = now + 60000;
      return true;
    }

    if (throttleInfo.count >= this.maxMessagesPerMinute) {
      this.logger.warn(`Message rate limit exceeded for client: ${clientId}`);
      return false;
    }

    throttleInfo.count++;
    return true;
  }

  private checkEventLimit(client: Socket, eventName: string): boolean {
    const clientId = this.getClientIdentifier(client);
    const now = Date.now();
    const throttleKey = `event_${clientId}_${eventName}`;
    const throttleInfo = this.throttleMap.get(throttleKey);

    if (!throttleInfo) {
      this.throttleMap.set(throttleKey, {
        count: 1,
        resetTime: now + 60000, // 1 minute
      });
      return true;
    }

    if (now > throttleInfo.resetTime) {
      // Reset throttle
      throttleInfo.count = 1;
      throttleInfo.resetTime = now + 60000;
      return true;
    }

    if (throttleInfo.count >= this.maxEventsPerMinute) {
      this.logger.warn(`Event rate limit exceeded for client: ${clientId}, event: ${eventName}`);
      return false;
    }

    throttleInfo.count++;
    return true;
  }

  private getClientIdentifier(client: Socket): string {
    // Try to get user ID if authenticated, otherwise use IP address
    const userId = client.data?.userId;
    if (userId) {
      return userId;
    }

    const ip = client.handshake.address;
    if (ip) {
      return ip;
    }

    // Fallback to socket ID
    return client.id;
  }

  /**
   * Clean up old throttle entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.throttleMap.forEach((info, key) => {
      if (now > info.resetTime) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.throttleMap.delete(key);
    });

    if (keysToDelete.length > 0) {
      this.logger.debug(`Cleaned up ${keysToDelete.length} throttle entries`);
    }
  }

  /**
   * Get throttle statistics
   */
  getThrottleStats(): {
    totalEntries: number;
    activeThrottles: number;
  } {
    const now = Date.now();
    let activeThrottles = 0;

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
