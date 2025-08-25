#!/usr/bin/env tsx
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BackgroundJobsService } from '../background-jobs/background-jobs.service';
import { Logger } from '@nestjs/common';

async function getJobsStatus() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const backgroundJobsService = app.get(BackgroundJobsService);
  const logger = new Logger('JobsStatus');

  try {
    logger.log('=== Background Jobs Status ===');

    // Get all queues stats
    const allQueuesStats = await backgroundJobsService.getAllQueuesStats();

    for (const [queueName, stats] of Object.entries(allQueuesStats)) {
      logger.log(`\n--- Queue: ${queueName} ---`);
      logger.log(`Total Jobs: ${stats.totalJobs}`);
      logger.log(`Active Jobs: ${stats.activeJobs}`);
      logger.log(`Failed Jobs: ${stats.failedJobs}`);
      logger.log(`Completed Jobs: ${stats.completedJobs}`);
      logger.log(`Waiting Jobs: ${stats.waitingJobs}`);
      logger.log(`Delayed Jobs: ${stats.delayedJobs}`);
    }

    // Get queue health
    const health = await backgroundJobsService.getHealth();
    logger.log(`\n=== Overall Health ===`);
    logger.log(`Status: ${health.status}`);
    if (health.details) {
      logger.log(`Details: ${health.details}`);
    }

    logger.log('=== End Jobs Status ===');
  } catch (error) {
    logger.error('Failed to get jobs status:', error);
  } finally {
    await app.close();
  }
}

getJobsStatus();
