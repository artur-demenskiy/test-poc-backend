import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RedisService } from './redis.service';

/**
 * Cache configuration options for flexible caching behavior
 * Provides TTL, prefix, and tag-based invalidation support
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix for bulk operations
  tags?: string[]; // Cache tags for selective invalidation
}

/**
 * Core caching service for application-wide data caching
 * Provides unified interface for cache operations with Redis backend support
 *
 * Features:
 * - Multi-level caching (memory + Redis)
 * - Tag-based cache invalidation
 * - Automatic TTL management
 * - Bulk operations support
 * - Cache statistics and monitoring
 * - Fallback handling for cache failures
 */
@Injectable()
export class CachingService {
  private readonly logger = new Logger(CachingService.name);
  private readonly defaultTtl = 3600; // 1 hour default TTL

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly redisService: RedisService
  ) {}

  /**
   * Retrieve value from cache by key
   * Attempts to get value from cache manager with error handling
   * @param key - Cache key to retrieve
   * @returns Cached value or null if not found/error
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);
      return value || null;
    } catch (error) {
      this.logger.warn(`Failed to get cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Store value in cache with optional configuration
   * Sets value in cache manager and stores associated tags in Redis if available
   * @param key - Cache key to store value under
   * @param value - Value to cache (will be serialized)
   * @param options - Cache configuration options
   */
  async set(key: string, value: unknown, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || this.defaultTtl;
      await this.cacheManager.set(key, value, ttl);

      // Store cache tags in Redis for tag-based invalidation
      if (options.tags && options.tags.length > 0 && this.redisService.isConnected()) {
        await this.redisService.storeCacheTags(key, options.tags);
      }

      this.logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error(`Failed to set cache key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Remove value from cache by key or prefix
   * Supports both single key deletion and bulk prefix-based deletion
   * @param key - Cache key to delete, or prefix for bulk deletion
   * @param prefix - Optional prefix for bulk deletion operations
   */
  async delete(key: string, prefix?: string): Promise<void> {
    try {
      if (prefix) {
        // Delete all keys matching the prefix
        const keys = await this.getKeysByPrefix(prefix);
        for (const k of keys) {
          await this.cacheManager.del(k);
        }
        this.logger.debug(`Deleted ${keys.length} cache keys with prefix: ${prefix}`);
      } else {
        // Delete single key
        await this.cacheManager.del(key);
        this.logger.debug(`Cache deleted: ${key}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete cache key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Clear entire cache
   * Resets cache manager and flushes Redis if available
   * Use with caution in production environments
   */
  async clear(): Promise<void> {
    try {
      await this.cacheManager.reset();

      // Clear Redis data if available
      if (this.redisService.isConnected()) {
        await this.redisService.flushAll();
      }

      this.logger.log('Cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics and memory usage
   * Returns key count and memory usage from Redis if available
   * @returns Cache statistics object
   */
  async getStats(): Promise<{ keys: number; memory?: string }> {
    try {
      if (this.redisService.isConnected()) {
        return await this.redisService.getStats();
      }

      // Fallback to basic stats when Redis unavailable
      return { keys: 0 };
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return { keys: 0 };
    }
  }

  /**
   * Invalidate cache entries by tags
   * Removes all cache keys associated with specified tags
   * Requires Redis backend for tag-based invalidation
   * @param tags - Array of tags to invalidate
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      if (!this.redisService.isConnected()) {
        this.logger.warn('Redis not available, cannot invalidate by tags');
        return;
      }

      // Get all keys associated with the specified tags
      const keysToDelete = await this.redisService.getKeysByTags(tags);

      // Delete each associated key from cache
      for (const key of keysToDelete) {
        await this.cacheManager.del(key);
      }

      this.logger.debug(
        `Invalidated ${keysToDelete.length} cache keys by tags: ${tags.join(', ')}`
      );
    } catch (error) {
      this.logger.error('Failed to invalidate cache by tags:', error);
      throw error;
    }
  }

  /**
   * Get or set pattern for common caching scenarios
   * Attempts to retrieve from cache first, falls back to callback execution
   * Automatically caches the result for future requests
   * @param key - Cache key for the operation
   * @param callback - Function to execute if cache miss
   * @param options - Cache configuration options
   * @returns Cached value or callback result
   */
  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cachedValue = await this.get<T>(key);
      if (cachedValue !== null) {
        this.logger.debug(`Cache hit: ${key}`);
        return cachedValue;
      }

      // Cache miss - execute callback and store result
      this.logger.debug(`Cache miss: ${key}`);
      const value = await callback();
      await this.set(key, value, options);

      return value;
    } catch (error) {
      this.logger.error(`Failed to get or set cache key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if cache system is available and functioning
   * Performs a test write/read operation to verify cache health
   * @returns True if cache is operational, false otherwise
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Perform a test operation to verify cache functionality
      const testKey = '__cache_test__';
      const testValue = 'test';

      await this.set(testKey, testValue, { ttl: 10 });
      const retrievedValue = await this.get(testKey);
      await this.delete(testKey);

      return retrievedValue === testValue;
    } catch (error) {
      this.logger.warn('Cache availability check failed:', error);
      return false;
    }
  }

  /**
   * Get all cache keys matching a specific prefix
   * Uses Redis SCAN for efficient prefix-based key discovery
   * @param prefix - Key prefix to search for
   * @returns Array of matching cache keys
   */
  private async getKeysByPrefix(prefix: string): Promise<string[]> {
    try {
      if (this.redisService.isConnected()) {
        // Use Redis SCAN for better performance with large datasets
        const client = this.redisService.getClient();
        if (client) {
          const keys: string[] = [];
          let cursor = '0';

          // Scan through all keys matching the prefix
          do {
            const result = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', '100');
            cursor = result[0];
            keys.push(...result[1]);
          } while (cursor !== '0');

          return keys;
        }
      }

      // Fallback: return empty array when Redis unavailable
      return [];
    } catch (error) {
      this.logger.warn(`Failed to get keys by prefix ${prefix}:`, error);
      return [];
    }
  }
}
