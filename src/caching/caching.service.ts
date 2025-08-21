import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RedisService } from './redis.service';

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
  tags?: string[];
}

@Injectable()
export class CachingService {
  private readonly logger = new Logger(CachingService.name);
  private readonly defaultTtl = 3600; // 1 hour

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly redisService: RedisService
  ) {}

  /**
   * Get value from cache
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
   * Set value in cache
   */
  async set(key: string, value: unknown, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || this.defaultTtl;
      await this.cacheManager.set(key, value, ttl);

      // Store cache tags if Redis is available
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
   * Delete value from cache
   */
  async delete(key: string, prefix?: string): Promise<void> {
    try {
      if (prefix) {
        // Delete all keys with prefix
        const keys = await this.getKeysByPrefix(prefix);
        for (const k of keys) {
          await this.cacheManager.del(k);
        }
        this.logger.debug(`Deleted ${keys.length} cache keys with prefix: ${prefix}`);
      } else {
        await this.cacheManager.del(key);
        this.logger.debug(`Cache deleted: ${key}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete cache key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      await this.cacheManager.reset();

      // Clear Redis if available
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
   * Get cache statistics
   */
  async getStats(): Promise<{ keys: number; memory?: string }> {
    try {
      if (this.redisService.isConnected()) {
        return await this.redisService.getStats();
      }

      // Fallback to basic stats
      return { keys: 0 };
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return { keys: 0 };
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      if (!this.redisService.isConnected()) {
        this.logger.warn('Redis not available, cannot invalidate by tags');
        return;
      }

      const keysToDelete = await this.redisService.getKeysByTags(tags);

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
   * Get or set value in cache
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

      // If not in cache, execute callback and store result
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
   * Check if cache is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try to set and get a test value
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
   * Get all keys with a specific prefix
   */
  private async getKeysByPrefix(prefix: string): Promise<string[]> {
    try {
      if (this.redisService.isConnected()) {
        // Use Redis SCAN for better performance
        const client = this.redisService.getClient();
        if (client) {
          const keys: string[] = [];
          let cursor = '0';

          do {
            const result = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', '100');
            cursor = result[0];
            keys.push(...result[1]);
          } while (cursor !== '0');

          return keys;
        }
      }

      // Fallback: return empty array
      return [];
    } catch (error) {
      this.logger.warn(`Failed to get keys by prefix ${prefix}:`, error);
      return [];
    }
  }
}
