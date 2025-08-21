import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CachingService } from './caching.service';
import { CacheKeyService } from './cache-key.service';

export interface CacheInterceptorOptions {
  ttl?: number;
  tags?: string[];
  key?: string;
  includeQuery?: boolean;
  includeHeaders?: string[];
  includeUser?: boolean;
}

export interface CacheInvalidateOptions {
  tags: string[];
}

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly cachingService: CachingService,
    private readonly cacheKeyService: CacheKeyService
  ) {}

  /**
   * Intercept method to handle caching
   */
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();

    // Check if caching is disabled for this endpoint
    const cacheOptions = this.getCacheOptions(handler);
    if (!cacheOptions) {
      return next.handle();
    }

    // Check if cache invalidation is requested
    const invalidateOptions = this.getInvalidateOptions(handler);
    if (invalidateOptions) {
      await this.handleCacheInvalidation(invalidateOptions);
      return next.handle();
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(request, cacheOptions);
    if (!cacheKey) {
      return next.handle();
    }

    // Try to get from cache
    const cachedValue = await this.cachingService.get(cacheKey);
    if (cachedValue !== null) {
      this.logger.debug(`Cache hit for key: ${cacheKey}`);
      return of(cachedValue);
    }

    // If not in cache, execute handler and cache result
    this.logger.debug(`Cache miss for key: ${cacheKey}`);
    return next.handle().pipe(
      tap(async data => {
        try {
          await this.cachingService.set(cacheKey, data, {
            ttl: cacheOptions.ttl,
            tags: cacheOptions.tags,
          });
          this.logger.debug(`Cached response for key: ${cacheKey}`);
        } catch (error) {
          this.logger.warn(`Failed to cache response for key ${cacheKey}:`, error);
        }
      })
    );
  }

  /**
   * Get cache options from handler metadata
   */
  private getCacheOptions(handler: Function): CacheInterceptorOptions | null {
    const metadata = Reflect.getMetadata('cache:options', handler);
    return metadata || null;
  }

  /**
   * Get cache invalidation options from handler metadata
   */
  private getInvalidateOptions(handler: Function): CacheInvalidateOptions | null {
    const metadata = Reflect.getMetadata('cache:invalidate', handler);
    return metadata || null;
  }

  /**
   * Handle cache invalidation
   */
  private async handleCacheInvalidation(options: CacheInvalidateOptions): Promise<void> {
    try {
      await this.cachingService.invalidateByTags(options.tags);
      this.logger.debug(`Cache invalidated for tags: ${options.tags.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for tags ${options.tags}:`, error);
    }
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(
    request: Record<string, unknown>,
    options: CacheInterceptorOptions
  ): string | null {
    try {
      if (options.key) {
        return options.key;
      }

      const route = request.route as Record<string, unknown> | undefined;
      const path = (route?.path || request.path) as string;
      const method = request.method as string;
      const query = options.includeQuery ? (request.query as Record<string, unknown>) : {};
      const headers = options.includeHeaders
        ? this.extractHeaders(request, options.includeHeaders)
        : {};
      const user = options.includeUser ? this.extractUser(request) : null;

      let key = this.cacheKeyService.generateApiKey(path, method, query);

      if (user) {
        key = `${key}:user:${user}`;
      }

      if (Object.keys(headers).length > 0) {
        const headersHash = this.cacheKeyService.generateApiKey('', '', headers);
        key = `${key}:headers:${headersHash}`;
      }

      return key;
    } catch (error) {
      this.logger.warn('Failed to generate cache key:', error);
      return null;
    }
  }

  /**
   * Extract specific headers from request
   */
  private extractHeaders(
    request: Record<string, unknown>,
    headerNames: string[]
  ): Record<string, unknown> {
    const headers: Record<string, unknown> = {};

    for (const headerName of headerNames) {
      const headerValue = (request.headers as Record<string, unknown>)[headerName.toLowerCase()];
      if (headerValue !== undefined) {
        headers[headerName] = headerValue;
      }
    }

    return headers;
  }

  /**
   * Extract user information from request
   */
  private extractUser(request: Record<string, unknown>): string | null {
    // Try to extract user ID from various sources
    const user = request.user as Record<string, unknown> | undefined;
    if (user && typeof user === 'object' && 'id' in user) {
      return String(user.id);
    }

    const userId = request.userId as string | undefined;
    if (userId) {
      return String(userId);
    }

    const headers = request.headers as Record<string, unknown> | undefined;
    const authHeader = headers?.authorization as string | undefined;
    if (authHeader && typeof authHeader === 'string') {
      // Extract user from JWT token or other auth header
      return `auth_${authHeader.substring(0, 8)}`;
    }

    return null;
  }
}

/**
 * Cache decorator for methods
 */
export function Cache(options: CacheInterceptorOptions = {}) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata('cache:options', options, descriptor.value);
    return descriptor;
  };
}

/**
 * Cache invalidation decorator
 */
export function CacheInvalidate(tags: string[]) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata('cache:invalidate', { tags }, descriptor.value);
    return descriptor;
  };
}
