#!/usr/bin/env tsx
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CachingService } from '../caching/caching.service';
import { Logger } from '@nestjs/common';

async function clearCache() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const cachingService = app.get(CachingService);
  const logger = new Logger('ClearCache');

  try {
    logger.log('=== Clearing Cache ===');

    // Get cache stats before clearing
    const beforeStats = await cachingService.getStats();
    logger.log(`Cache keys before clearing: ${beforeStats.keys}`);

    // Clear the cache
    await cachingService.clear();
    logger.log('Cache cleared successfully');

    // Get cache stats after clearing
    const afterStats = await cachingService.getStats();
    logger.log(`Cache keys after clearing: ${afterStats.keys}`);

    logger.log('=== Cache Cleared ===');
  } catch (error) {
    logger.error('Failed to clear cache:', error);
  } finally {
    await app.close();
  }
}

clearCache();
