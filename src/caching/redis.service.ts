import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis | null = null;
  private readonly tagPrefix = 'cache_tags:';
  private readonly keyTagPrefix = 'key_tags:';

  constructor(private readonly configService: ConfigService) {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');

      if (redisUrl) {
        this.redisClient = new Redis(redisUrl, {
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
      } else {
        const host = this.configService.get<string>('REDIS_HOST', 'localhost');
        const port = this.configService.get<number>('REDIS_PORT', 6379);
        const password = this.configService.get<string>('REDIS_PASSWORD');
        const db = this.configService.get<number>('REDIS_DB', 0);

        this.redisClient = new Redis({
          host,
          port,
          password,
          db,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
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
   * Setup Redis event handlers
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
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.redisClient?.status === 'ready';
  }

  /**
   * Get Redis client instance
   */
  getClient(): Redis | null {
    return this.redisClient;
  }

  /**
   * Store cache tags for a key
   */
  async storeCacheTags(key: string, tags: string[]): Promise<void> {
    if (!this.redisClient || !this.isConnected()) {
      this.logger.warn('Redis not connected, cannot store cache tags');
      return;
    }

    try {
      const pipeline = this.redisClient.pipeline();

      // Store tags for the key
      pipeline.sadd(`${this.keyTagPrefix}${key}`, ...tags);

      // Store key for each tag
      for (const tag of tags) {
        pipeline.sadd(`${this.tagPrefix}${tag}`, key);
      }

      await pipeline.exec();
      this.logger.debug(`Stored cache tags for key ${key}: ${tags.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to store cache tags for key ${key}:`, error);
    }
  }

  /**
   * Get keys by tags
   */
  async getKeysByTags(tags: string[]): Promise<string[]> {
    if (!this.redisClient || !this.isConnected()) {
      this.logger.warn('Redis not connected, cannot get keys by tags');
      return [];
    }

    try {
      const keys = new Set<string>();

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
   * Get Redis statistics
   */
  async getStats(): Promise<{ keys: number; memory: string }> {
    if (!this.redisClient || !this.isConnected()) {
      return { keys: 0, memory: '0B' };
    }

    try {
      const [dbSize, info] = await Promise.all([
        this.redisClient.dbsize(),
        this.redisClient.info('memory'),
      ]);

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
   * Get Redis health status
   */
  async getHealth(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }> {
    if (!this.redisClient) {
      return { status: 'unhealthy', details: 'Redis client not initialized' };
    }

    if (!this.isConnected()) {
      return { status: 'unhealthy', details: 'Redis not connected' };
    }

    try {
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
   * Cleanup on module destroy
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
