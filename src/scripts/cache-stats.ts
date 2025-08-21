#!/usr/bin/env tsx
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CachingService } from '../caching/caching.service';
import { RedisService } from '../caching/redis.service';
import { Logger } from '@nestjs/common';

async function getCacheStats() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const cachingService = app.get(CachingService);
  const redisService = app.get(RedisService);
  const logger = new Logger('CacheStats');

  try {
    logger.log('=== Cache Statistics ===');

    // Get cache stats
    const cacheStats = await cachingService.getStats();
    logger.log(`Cache Keys: ${cacheStats.keys}`);
    if (cacheStats.memory) {
      logger.log(`Memory Usage: ${cacheStats.memory}`);
    }

    // Get Redis stats
    const redisStats = await redisService.getStats();
    logger.log(`Redis Keys: ${redisStats.keys}`);
    logger.log(`Redis Memory: ${redisStats.memory}`);

    // Check Redis health
    const redisHealth = await redisService.getHealth();
    logger.log(`Redis Status: ${redisHealth.status}`);
    if (redisHealth.details) {
      logger.log(`Redis Details: ${redisHealth.details}`);
    }

    // Check cache availability
    const isAvailable = await cachingService.isAvailable();
    logger.log(`Cache Available: ${isAvailable}`);

    logger.log('=== End Cache Statistics ===');
  } catch (error) {
    logger.error('Failed to get cache stats:', error);
  } finally {
    await app.close();
  }
}

getCacheStats();
