#!/usr/bin/env tsx

/**
 * Cache Statistics Script
 *
 * This script provides comprehensive cache system monitoring and reporting:
 * - Cache key count and memory usage statistics
 * - Redis connection health and performance metrics
 * - Cache availability and functionality verification
 * - System status reporting for monitoring and debugging
 *
 * Usage:
 * npm run cache:stats
 *
 * Output:
 * - Cache system statistics
 * - Redis health status
 * - Memory usage information
 * - System availability status
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CachingService } from '../caching/caching.service';
import { RedisService } from '../caching/redis.service';
import { Logger } from '@nestjs/common';

/**
 * Main function to retrieve and display cache statistics
 * Creates application context, retrieves services, and displays comprehensive cache information
 */
async function getCacheStats() {
  // Create application context to access services without full HTTP server
  const app = await NestFactory.createApplicationContext(AppModule);

  // Get required services for cache monitoring
  const cachingService = app.get(CachingService);
  const redisService = app.get(RedisService);
  const logger = new Logger('CacheStats');

  try {
    logger.log('=== Cache Statistics ===');

    // Retrieve and display cache manager statistics
    const cacheStats = await cachingService.getStats();
    logger.log(`Cache Keys: ${cacheStats.keys}`);
    if (cacheStats.memory) {
      logger.log(`Memory Usage: ${cacheStats.memory}`);
    }

    // Retrieve and display Redis-specific statistics
    const redisStats = await redisService.getStats();
    logger.log(`Redis Keys: ${redisStats.keys}`);
    logger.log(`Redis Memory: ${redisStats.memory}`);

    // Check Redis connection health and status
    const redisHealth = await redisService.getHealth();
    logger.log(`Redis Status: ${redisHealth.status}`);
    if (redisHealth.details) {
      logger.log(`Redis Details: ${redisHealth.details}`);
    }

    // Verify overall cache system availability
    const isAvailable = await cachingService.isAvailable();
    logger.log(`Cache Available: ${isAvailable}`);

    logger.log('=== End Cache Statistics ===');
  } catch (error) {
    logger.error('Failed to get cache stats:', error);
  } finally {
    // Ensure proper cleanup of application context
    await app.close();
  }
}

// Execute the cache statistics script
getCacheStats();
