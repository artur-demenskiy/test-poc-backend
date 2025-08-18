import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from './api-key.service';

export interface ApiKeyScope {
  resource: string;
  action: string;
}

export const API_KEY_SCOPE = 'api_key_scope';
export const RequireApiKeyScope = (resource: string, action: string) =>
  SetMetadata(API_KEY_SCOPE, { resource, action });

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    // Check if specific scope is required
    const requiredScope = this.reflector.get<ApiKeyScope>(API_KEY_SCOPE, context.getHandler());

    if (requiredScope) {
      const hasScope = await this.apiKeyService.hasScope(
        apiKey,
        requiredScope.resource,
        requiredScope.action
      );

      if (!hasScope) {
        throw new UnauthorizedException('Insufficient API key scope');
      }
    }

    // Store API key info in request for later use
    request.apiKey = await this.apiKeyService.validateApiKey(apiKey);

    return true;
  }

  private extractApiKey(request: {
    headers: Record<string, string | undefined>;
    query: Record<string, string | undefined>;
    apiKey?: unknown;
  }): string | null {
    // Check Authorization header: Bearer <api-key>
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check X-API-Key header
    if (request.headers['x-api-key']) {
      return request.headers['x-api-key'];
    }

    // Check query parameter
    if (request.query.apiKey) {
      return request.query.apiKey;
    }

    return null;
  }
}
