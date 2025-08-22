import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'ws') {
      return true;
    }

    const client: Socket = context.switchToWs().getClient();
    const request = client.request as unknown as Record<string, unknown>;

    try {
      // For now, we'll implement a simple token-based auth
      // In production, you'd want to implement proper JWT validation
      const token = this.extractToken(request);

      if (!token) {
        // Allow anonymous connections for now
        // In production, you might want to require authentication
        this.logger.debug('Anonymous WebSocket connection allowed');
        return true;
      }

      // Validate token (placeholder implementation)
      if (this.validateToken(token)) {
        // Extract user info and attach to socket
        const userInfo = this.extractUserFromToken(token);
        client.data.userId = userInfo.userId;
        client.data.userRole = userInfo.role;

        this.logger.debug(`Authenticated WebSocket connection for user: ${userInfo.userId}`);
        return true;
      }

      throw new WsException('Invalid token');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`WebSocket authentication failed: ${errorMessage}`);
      throw new WsException('Authentication failed');
    }
  }

  private extractToken(request: Record<string, unknown>): string | null {
    // Try to extract token from different sources
    const headers = request.headers as Record<string, unknown> | undefined;
    const authHeader = headers?.authorization as string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check query parameters
    const url = request.url as string | undefined;
    if (url) {
      const queryToken = url
        .split('?')[1]
        ?.split('&')
        .find(param => param.startsWith('token='))
        ?.split('=')[1];

      if (queryToken) {
        return queryToken;
      }
    }

    // Check handshake auth
    const handshake = request.handshake as Record<string, unknown> | undefined;
    const handshakeAuth = handshake?.auth as Record<string, unknown> | undefined;
    const token = handshakeAuth?.token as string | undefined;
    if (token) {
      return token;
    }

    return null;
  }

  private validateToken(token: string): boolean {
    // Placeholder implementation
    // In production, you'd validate JWT or other token format
    if (!token || token.length < 10) {
      return false;
    }

    // For demo purposes, accept any token that looks reasonable
    // In production, implement proper JWT validation
    return true;
  }

  private extractUserFromToken(token: string): { userId: string; role: string } {
    // Placeholder implementation
    // In production, you'd decode JWT and extract user info

    // For demo purposes, create a mock user ID from token
    const userId = `user_${token.substring(0, 8)}`;
    const role = 'user'; // Default role

    return { userId, role };
  }
}
