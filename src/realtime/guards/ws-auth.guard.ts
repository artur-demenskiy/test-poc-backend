import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * WebSocket Authentication Guard for securing real-time connections
 * Implements token-based authentication for WebSocket connections
 * Currently supports basic token validation with extensible architecture
 *
 * Features:
 * - Token extraction from multiple sources (headers, query params, handshake)
 * - Anonymous connection support for public features
 * - User information extraction and attachment to socket
 * - Comprehensive error handling and logging
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  /**
   * Main guard method that determines if a WebSocket connection is allowed
   * Only processes WebSocket connections, bypasses other context types
   * @param context - Execution context containing connection information
   * @returns True if connection is allowed, throws WsException if denied
   */
  canActivate(context: ExecutionContext): boolean {
    // Only apply this guard to WebSocket connections
    if (context.getType() !== 'ws') {
      return true;
    }

    const client: Socket = context.switchToWs().getClient();
    const request = client.request as unknown as Record<string, unknown>;

    try {
      // Extract authentication token from the request
      const token = this.extractToken(request);

      if (!token) {
        // Allow anonymous connections for public features
        // In production, you might want to require authentication for all connections
        this.logger.debug('Anonymous WebSocket connection allowed');
        return true;
      }

      // Validate the extracted token
      if (this.validateToken(token)) {
        // Extract user information from valid token and attach to socket
        const userInfo = this.extractUserFromToken(token);
        client.data.userId = userInfo.userId; // Attach user ID to socket
        client.data.userRole = userInfo.role; // Attach user role to socket

        this.logger.debug(`Authenticated WebSocket connection for user: ${userInfo.userId}`);
        return true;
      }

      // Token validation failed
      throw new WsException('Invalid token');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`WebSocket authentication failed: ${errorMessage}`);
      throw new WsException('Authentication failed');
    }
  }

  /**
   * Extract authentication token from multiple possible sources
   * Tries different locations in order of preference for maximum compatibility
   * @param request - WebSocket request object containing connection details
   * @returns Extracted token string or null if not found
   */
  private extractToken(request: Record<string, unknown>): string | null {
    // Method 1: Try to extract from Authorization header (Bearer token)
    const headers = request.headers as Record<string, unknown> | undefined;
    const authHeader = headers?.authorization as string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7); // Remove 'Bearer ' prefix
    }

    // Method 2: Check URL query parameters for token
    const url = request.url as string | undefined;
    if (url) {
      const queryToken = url
        .split('?')[1] // Get query string part
        ?.split('&') // Split query parameters
        .find(param => param.startsWith('token=')) // Find token parameter
        ?.split('=')[1]; // Extract token value

      if (queryToken) {
        return queryToken;
      }
    }

    // Method 3: Check handshake authentication data
    const handshake = request.handshake as Record<string, unknown> | undefined;
    const handshakeAuth = handshake?.auth as Record<string, unknown> | undefined;
    const token = handshakeAuth?.token as string | undefined;
    if (token) {
      return token;
    }

    // No token found in any location
    return null;
  }

  /**
   * Validate the extracted authentication token
   * Currently implements basic validation - should be extended for production use
   * @param token - Token string to validate
   * @returns True if token is valid, false otherwise
   */
  private validateToken(token: string): boolean {
    // TODO: Implement proper JWT validation for production
    // Current implementation is a placeholder for development/demo purposes

    // Basic validation: token must exist and have minimum length
    if (!token || token.length < 10) {
      return false;
    }

    // For demo purposes, accept any token that looks reasonable
    // In production, implement proper JWT validation with:
    // - Signature verification
    // - Expiration checking
    // - Issuer validation
    // - Audience validation
    return true;
  }

  /**
   * Extract user information from a validated token
   * Currently creates mock user data - should decode JWT payload in production
   * @param token - Validated authentication token
   * @returns Object containing user ID and role
   */
  private extractUserFromToken(token: string): { userId: string; role: string } {
    // TODO: Implement proper JWT decoding for production
    // Current implementation is a placeholder for development/demo purposes

    // For demo purposes, create a mock user ID from token
    // In production, decode JWT and extract actual user information:
    // - User ID from 'sub' claim
    // - Role from 'role' claim
    // - Additional claims as needed
    const userId = `user_${token.substring(0, 8)}`; // Use first 8 chars of token
    const role = 'user'; // Default role for all users

    return { userId, role };
  }
}
