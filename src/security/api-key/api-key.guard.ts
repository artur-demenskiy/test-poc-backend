import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from './api-key.service';

/**
 * API key scope requirement definition
 * Defines the resource and action required for endpoint access
 */
export interface ApiKeyScope {
  resource: string; // Resource identifier (e.g., 'users', 'posts')
  action: string; // Required action (e.g., 'read', 'write', 'delete')
}

/**
 * Metadata key for storing API key scope requirements
 * Used by the guard to retrieve scope information from route handlers
 */
export const API_KEY_SCOPE = 'api_key_scope';

/**
 * Decorator factory for requiring specific API key scopes
 * Applies scope requirements to route handlers for fine-grained access control
 *
 * @param resource - Resource identifier for the required scope
 * @param action - Action required for the resource
 * @returns Metadata decorator for the route handler
 *
 * Usage: @RequireApiKeyScope('users', 'read')
 */
export const RequireApiKeyScope = (resource: string, action: string) =>
  SetMetadata(API_KEY_SCOPE, { resource, action });

/**
 * API Key Authentication and Authorization Guard
 *
 * This guard provides comprehensive API key validation and scope-based access control:
 * - Extracts API key from multiple sources (headers, query params)
 * - Validates API key authenticity and expiration
 * - Enforces scope-based permissions for protected endpoints
 * - Stores validated key information in request context
 *
 * Security Features:
 * - Multiple API key extraction methods for flexibility
 * - Automatic scope validation for protected routes
 * - Comprehensive error handling and logging
 * - Request context enrichment with key information
 *
 * API Key Sources (in order of preference):
 * 1. Authorization: Bearer <api-key>
 * 2. X-API-Key header
 * 3. apiKey query parameter
 *
 * Scope Enforcement:
 * - Routes with @RequireApiKeyScope require specific permissions
 * - Routes without scope decorators only require valid API key
 * - Invalid or expired keys result in 401 Unauthorized
 * - Insufficient scope results in 401 Unauthorized
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService, // API key validation service
    private readonly reflector: Reflector // Metadata reflection service
  ) {}

  /**
   * Main guard activation method
   * Validates API key and enforces scope-based access control
   *
   * @param context - Execution context containing request information
   * @returns True if access is granted, false otherwise
   * @throws UnauthorizedException for invalid keys or insufficient scope
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract API key from request
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    // Check if specific scope is required for this endpoint
    const requiredScope = this.reflector.get<ApiKeyScope>(API_KEY_SCOPE, context.getHandler());

    if (requiredScope) {
      // Validate that API key has required scope permissions
      const hasScope = await this.apiKeyService.hasScope(
        apiKey,
        requiredScope.resource,
        requiredScope.action
      );

      if (!hasScope) {
        throw new UnauthorizedException('Insufficient API key scope');
      }
    }

    // Store validated API key information in request for later use
    request.apiKey = await this.apiKeyService.validateApiKey(apiKey);

    return true;
  }

  /**
   * Extract API key from request using multiple methods
   * Checks headers and query parameters in order of security preference
   *
   * @param request - HTTP request object with headers and query parameters
   * @returns API key string if found, null otherwise
   *
   * Extraction Priority:
   * 1. Authorization: Bearer <api-key> (most secure)
   * 2. X-API-Key header (standard practice)
   * 3. apiKey query parameter (least secure, for compatibility)
   */
  private extractApiKey(request: {
    headers: Record<string, string | undefined>;
    query: Record<string, string | undefined>;
    apiKey?: unknown;
  }): string | null {
    // Method 1: Check Authorization header with Bearer token
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7); // Remove 'Bearer ' prefix
    }

    // Method 2: Check X-API-Key header (standard API key header)
    if (request.headers['x-api-key']) {
      return request.headers['x-api-key'];
    }

    // Method 3: Check query parameter (for backward compatibility)
    if (request.query.apiKey) {
      return request.query.apiKey;
    }

    // No API key found in any location
    return null;
  }
}
