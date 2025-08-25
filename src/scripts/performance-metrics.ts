#!/usr/bin/env tsx
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PerformanceService } from '../performance/performance.service';
import { Logger } from '@nestjs/common';

async function getPerformanceMetrics() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const performanceService = app.get(PerformanceService);
  const logger = new Logger('PerformanceMetrics');

  try {
    logger.log('=== Performance Metrics ===');

    // Get current metrics
    const metrics = performanceService.getMetrics();
    logger.log(`Request Count: ${metrics.requestCount}`);
    logger.log(`Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms`);
    logger.log(`Slow Requests: ${metrics.slowRequests}`);
    logger.log(`Error Count: ${metrics.errorCount}`);
    logger.log(`Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(2)}%`);
    logger.log(`Memory Usage: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    logger.log(`Uptime: ${(metrics.uptime / 60).toFixed(2)} minutes`);

    // Get metrics summary
    const summary = performanceService.getMetricsSummary();
    logger.log(`\n=== Metrics Summary ===`);
    logger.log(`Total Requests: ${summary.totalRequests}`);
    logger.log(`Success Rate: ${(summary.successRate * 100).toFixed(2)}%`);
    logger.log(`Average Throughput: ${summary.averageThroughput.toFixed(2)} req/min`);

    // Get slow requests
    const slowRequests = performanceService.getSlowRequests();
    if (slowRequests.length > 0) {
      logger.log(`\n=== Slow Requests (Top 5) ===`);
      slowRequests.slice(0, 5).forEach((request, index) => {
        logger.log(`${index + 1}. ${request.method} ${request.path} - ${request.duration}ms`);
      });
    }

    logger.log('=== End Performance Metrics ===');
  } catch (error) {
    logger.error('Failed to get performance metrics:', error);
  } finally {
    await app.close();
  }
}

getPerformanceMetrics();
