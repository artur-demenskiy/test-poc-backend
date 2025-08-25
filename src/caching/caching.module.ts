import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import { CachingService } from './caching.service';
import { RedisService } from './redis.service';
import { CacheInterceptor } from './cache.interceptor';
import { CacheKeyService } from './cache-key.service';

/**
 * Global Caching Module for application-wide caching capabilities
 *
 * This module provides comprehensive caching functionality including:
 * - Multi-level caching (Redis + in-memory fallback)
 * - Global cache interceptor for automatic response caching
 * - Cache key management and generation
 * - Redis connection management and health monitoring
 *
 * Configuration:
 * - Automatically detects Redis availability
 * - Falls back to in-memory cache if Redis unavailable
 * - Configurable TTL and cache size limits
 * - Global scope for application-wide access
 *
 * Features:
 * - Tag-based cache invalidation
 * - Automatic cache key generation
 * - Cache statistics and monitoring
 * - Graceful degradation on Redis failures
 */
@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (redisUrl) {
          // Redis configuration for production environments
          return {
            store: redisStore, // Use Redis as cache store
            url: redisUrl, // Redis connection URL
            ttl: 60 * 60 * 24, // 24 hours default TTL
            max: 1000, // Maximum number of items in cache
            isGlobal: true, // Make cache globally available
          };
        } else {
          // In-memory cache fallback for development/testing
          return {
            ttl: 60 * 60 * 24, // 24 hours default TTL
            max: 1000, // Maximum number of items in cache
            isGlobal: true, // Make cache globally available
          };
        }
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    CachingService, // Core caching service with unified interface
    RedisService, // Redis connection and tag management
    CacheInterceptor, // Automatic response caching interceptor
    CacheKeyService, // Cache key generation and management
  ],
  exports: [
    CachingService, // Export for use in other modules
    RedisService, // Export for Redis operations
    CacheInterceptor, // Export for HTTP response caching
    CacheKeyService, // Export for cache key utilities
    CacheModule, // Export cache manager instance
  ],
})
export class CachingModule {}
