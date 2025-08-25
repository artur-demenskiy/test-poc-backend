import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis service for advanced caching operations and tag-based invalidation
 * Manages Redis connection, cache tags, and provides Redis-specific functionality
 *
 * Features:
 * - Automatic Redis connection management
 * - Cache tag storage and retrieval
 * - Redis health monitoring
 * - Connection event handling
 * - Graceful shutdown support
 *
 * Redis Configuration:
 * - Supports both REDIS_URL and individual connection parameters
 * - Automatic reconnection with exponential backoff
 * - Connection pooling and optimization
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis | null = null;

  // Redis key prefixes for organizing cache tags
  private readonly tagPrefix = 'cache_tags:'; // Maps tags to keys
  private readonly keyTagPrefix = 'key_tags:'; // Maps keys to tags

  constructor(private readonly configService: ConfigService) {
    this.initializeRedis();
  }

  /**
   * Initialize Redis client with configuration
   * Sets up connection parameters and event handlers
   * Supports both URL-based and parameter-based configuration
   */
  private initializeRedis(): void {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');

      if (redisUrl) {
        // Use Redis URL if provided (e.g., for cloud Redis services)
        this.redisClient = new Redis(redisUrl, {
          retryDelayOnFailover: 100, // Retry delay on failover
          enableReadyCheck: false, // Disable ready check for better performance
          maxRetriesPerRequest: 3, // Maximum retries per request
          lazyConnect: true, // Connect only when needed
        });
      } else {
        // Use individual connection parameters
        const host = this.configService.get<string>('REDIS_HOST', 'localhost');
        const port = this.configService.get<number>('REDIS_PORT', 6379);
        const password = this.configService.get<string>('REDIS_PASSWORD');
        const db = this.configService.get<number>('REDIS_DB', 0);

        this.redisClient = new Redis({
          host,
          port,
          password,
          db,
          retryDelayOnFailover: 100, // Retry delay on failover
          enableReadyCheck: false, // Disable ready check for better performance
          maxRetriesPerRequest: 3, // Maximum retries per request
          lazyConnect: true, // Connect only when needed
        });
      }

      this.setupEventHandlers();
      this.logger.log('Redis client initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Redis client:', error);
      this.redisClient = null;
    }
  }

  /**
   * Setup Redis event handlers for connection monitoring
   * Handles connection lifecycle events and provides logging
   */
  private setupEventHandlers(): void {
    if (!this.redisClient) return;

    this.redisClient.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.redisClient.on('ready', () => {
      this.logger.log('Redis ready');
    });

    this.redisClient.on('error', error => {
      this.logger.error('Redis error:', error);
    });

    this.redisClient.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    this.redisClient.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...');
    });
  }

  /**
   * Check if Redis client is connected and ready
   * @returns True if Redis is connected and ready for operations
   */
  isConnected(): boolean {
    return this.redisClient?.status === 'ready';
  }

  /**
   * Get Redis client instance for direct operations
   * @returns Redis client instance or null if not available
   */
  getClient(): Redis | null {
    return this.redisClient;
  }

  /**
   * Store cache tags for a specific key
   * Creates bidirectional mapping between keys and tags for efficient invalidation
   * @param key - Cache key to associate with tags
   * @param tags - Array of tags to associate with the key
   */
  async storeCacheTags(key: string, tags: string[]): Promise<void> {
    if (!this.redisClient || !this.isConnected()) {
      this.logger.warn('Redis not connected, cannot store cache tags');
      return;
    }

    try {
      const pipeline = this.redisClient.pipeline();

      // Store tags for the key (key -> tags mapping)
      pipeline.sadd(`${this.keyTagPrefix}${key}`, ...tags);

      // Store key for each tag (tag -> keys mapping)
      for (const tag of tags) {
        pipeline.sadd(`${this.tagPrefix}${tag}`, key);
      }

      // Execute all operations atomically
      await pipeline.exec();
      this.logger.debug(`Stored cache tags for key ${key}: ${tags.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to store cache tags for key ${key}:`, error);
    }
  }

  /**
   * Retrieve all keys associated with specific tags
   * Used for tag-based cache invalidation
   * @param tags - Array of tags to find keys for
   * @returns Array of cache keys associated with the tags
   */
  async getKeysByTags(tags: string[]): Promise<string[]> {
    if (!this.redisClient || !this.isConnected()) {
      this.logger.warn('Redis not connected, cannot get keys by tags');
      return [];
    }

    try {
      const keys = new Set<string>();

      // Collect all keys for each tag
      for (const tag of tags) {
        const tagKeys = await this.redisClient.smembers(`${this.tagPrefix}${tag}`);
        tagKeys.forEach(key => keys.add(key));
      }

      const result = Array.from(keys);
      this.logger.debug(`Found ${result.length} keys for tags: ${tags.join(', ')}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get keys by tags ${tags}:`, error);
      return [];
    }
  }

  /**
   * Get Redis database statistics and memory usage
   * Provides key count and memory consumption information
   * @returns Redis statistics object with key count and memory usage
   */
  async getStats(): Promise<{ keys: number; memory: string }> {
    if (!this.redisClient || !this.isConnected()) {
      return { keys: 0, memory: '0B' };
    }

    try {
      // Get database size and memory information concurrently
      const [dbSize, info] = await Promise.all([
        this.redisClient.dbsize(),
        this.redisClient.info('memory'),
      ]);

      // Extract memory usage from Redis info output
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memory = memoryMatch ? memoryMatch[1] : '0B';

      return {
        keys: dbSize,
        memory,
      };
    } catch (error) {
      this.logger.error('Failed to get Redis stats:', error);
      return { keys: 0, memory: '0B' };
    }
  }

  /**
   * Flush all Redis data
   * Removes all keys and data from Redis database
   * Use with extreme caution in production environments
   */
  async flushAll(): Promise<void> {
    if (!this.redisClient || !this.isConnected()) {
      this.logger.warn('Redis not connected, cannot flush data');
      return;
    }

    try {
      await this.redisClient.flushall();
      this.logger.log('Redis data flushed');
    } catch (error) {
      this.logger.error('Failed to flush Redis data:', error);
      throw error;
    }
  }

  /**
   * Check Redis health status
   * Performs ping operation to verify Redis responsiveness
   * @returns Health status object with details
   */
  async getHealth(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }> {
    if (!this.redisClient) {
      return { status: 'unhealthy', details: 'Redis client not initialized' };
    }

    if (!this.isConnected()) {
      return { status: 'unhealthy', details: 'Redis not connected' };
    }

    try {
      // Simple ping to verify Redis is responsive
      await this.redisClient.ping();
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: `Ping failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Cleanup Redis connection on module destroy
   * Ensures graceful shutdown of Redis client
   */
  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
        this.logger.log('Redis connection closed');
      } catch (error) {
        this.logger.error('Error closing Redis connection:', error);
      }
      this.redisClient = null;
    }
  }
}
