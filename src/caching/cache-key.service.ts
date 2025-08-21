import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

export interface CacheKeyOptions {
  prefix?: string;
  version?: string;
  includeQuery?: boolean;
  includeHeaders?: string[];
  includeUser?: boolean;
}

@Injectable()
export class CacheKeyService {
  private readonly defaultPrefix = 'app';
  private readonly defaultVersion = 'v1';

  /**
   * Generate cache key for method calls
   */
  generateMethodKey(
    className: string,
    methodName: string,
    params: unknown[] = [],
    options: CacheKeyOptions = {}
  ): string {
    const prefix = options.prefix || this.defaultPrefix;
    const version = options.version || this.defaultVersion;
    const paramsHash = this.hashParams(params);

    return `${prefix}:${version}:method:${className}:${methodName}:${paramsHash}`;
  }

  /**
   * Generate cache key for database queries
   */
  generateQueryKey(
    table: string,
    operation: string,
    filters: Record<string, unknown> = {},
    options: CacheKeyOptions = {}
  ): string {
    const prefix = options.prefix || this.defaultPrefix;
    const version = options.version || this.defaultVersion;
    const filtersHash = this.hashObject(filters);

    return `${prefix}:${version}:query:${table}:${operation}:${filtersHash}`;
  }

  /**
   * Generate cache key for API endpoints
   */
  generateApiKey(
    path: string,
    method: string,
    query: Record<string, unknown> = {},
    options: CacheKeyOptions = {}
  ): string {
    const prefix = options.prefix || this.defaultPrefix;
    const version = options.version || this.defaultVersion;
    const queryHash = this.hashObject(query);

    return `${prefix}:${version}:api:${method}:${path}:${queryHash}`;
  }

  /**
   * Generate cache key for user-specific resources
   */
  generateUserKey(
    userId: string | number,
    resource: string,
    action: string,
    options: CacheKeyOptions = {}
  ): string {
    const prefix = options.prefix || this.defaultPrefix;
    const version = options.version || this.defaultVersion;

    return `${prefix}:${version}:user:${userId}:${resource}:${action}`;
  }

  /**
   * Generate cache key for pagination
   */
  generatePaginationKey(
    baseKey: string,
    page: number,
    limit: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): string {
    const sortPart = sortBy && sortOrder ? `:${sortBy}:${sortOrder}` : '';
    return `${baseKey}:page:${page}:limit:${limit}${sortPart}`;
  }

  /**
   * Generate cache key for search operations
   */
  generateSearchKey(
    baseKey: string,
    searchTerm: string,
    filters: Record<string, unknown> = {}
  ): string {
    const searchHash = this.hashString(searchTerm);
    const filtersHash = this.hashObject(filters);

    return `${baseKey}:search:${searchHash}:filters:${filtersHash}`;
  }

  /**
   * Generate cache key for aggregations
   */
  generateAggregationKey(
    baseKey: string,
    aggregationType: string,
    groupBy: string[] = [],
    filters: Record<string, unknown> = {}
  ): string {
    const groupByHash = this.hashArray(groupBy);
    const filtersHash = this.hashObject(filters);

    return `${baseKey}:agg:${aggregationType}:group:${groupByHash}:filters:${filtersHash}`;
  }

  /**
   * Generate cache key for time-based data
   */
  generateTimeBasedKey(baseKey: string, timeRange: 'hour' | 'day' | 'week' | 'month'): string {
    const timeKey = this.getTimeKey(timeRange);
    return `${baseKey}:${timeKey}`;
  }

  /**
   * Generate cache key for relationships
   */
  generateRelationshipKey(
    baseKey: string,
    relationType: string,
    sourceId: string | number,
    targetId: string | number
  ): string {
    return `${baseKey}:rel:${relationType}:${sourceId}:${targetId}`;
  }

  /**
   * Hash parameters for cache key generation
   */
  private hashParams(params: unknown[]): string {
    if (params.length === 0) return 'no-params';

    const paramString = params
      .map(param => {
        if (param === null) return 'null';
        if (param === undefined) return 'undefined';
        if (typeof param === 'object') return this.hashObject(param as Record<string, unknown>);
        return String(param);
      })
      .join(':');

    return this.hashString(paramString);
  }

  /**
   * Hash object for cache key generation
   */
  private hashObject(obj: Record<string, unknown>): string {
    if (Object.keys(obj).length === 0) return 'no-filters';

    const sortedKeys = Object.keys(obj).sort();
    const objString = sortedKeys.map(key => `${key}:${obj[key]}`).join(':');

    return this.hashString(objString);
  }

  /**
   * Hash array for cache key generation
   */
  private hashArray(arr: unknown[]): string {
    if (arr.length === 0) return 'no-groups';

    const arrString = arr.map(item => String(item)).join(':');
    return this.hashString(arrString);
  }

  /**
   * Hash string for cache key generation
   */
  private hashString(str: string): string {
    return createHash('md5').update(str).digest('hex').substring(0, 8);
  }

  /**
   * Get time key based on time range
   */
  private getTimeKey(timeUnit: 'hour' | 'day' | 'week' | 'month'): string {
    const now = new Date();
    switch (timeUnit) {
      case 'hour': {
        const hour = Math.floor(now.getTime() / (1000 * 60 * 60));
        return `h${hour}`;
      }
      case 'day': {
        const day = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
        return `d${day}`;
      }
      case 'week': {
        const week = Math.floor(now.getTime() / (1000 * 60 * 60 * 24 * 7));
        return `w${week}`;
      }
      case 'month': {
        const month = Math.floor(now.getTime() / (1000 * 60 * 60 * 24 * 30));
        return `m${month}`;
      }
      default:
        return 'unknown';
    }
  }

  /**
   * Validate cache key format
   */
  validateKey(key: string): boolean {
    if (!key || typeof key !== 'string') return false;
    if (key.length > 250) return false; // Redis key length limit
    if (key.includes(' ')) return false;
    return true;
  }

  /**
   * Sanitize cache key
   */
  sanitizeKey(key: string): string {
    if (!this.validateKey(key)) {
      // Remove spaces and limit length
      return key.replace(/\s+/g, '-').substring(0, 250);
    }
    return key;
  }
}
