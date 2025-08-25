import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BackgroundJobsService } from './background-jobs.service';
import { EmailProcessor } from './processors/email.processor';
import { DataSyncProcessor } from './processors/data-sync.processor';
import { CleanupProcessor } from './processors/cleanup.processor';

/**
 * Global Background Jobs Module for distributed task processing
 *
 * This module provides robust background job processing capabilities using Bull queues:
 * - Priority-based job scheduling
 * - Automatic retry mechanisms with exponential backoff
 * - Redis-based job persistence and distribution
 * - Multiple specialized job queues for different task types
 *
 * Queue Configuration:
 * - Email Queue: High priority (1) for user communications
 * - Data Sync Queue: Medium priority (2) for data operations
 * - Cleanup Queue: Low priority (3) for maintenance tasks
 *
 * Features:
 * - Redis connection with fallback to in-memory queues
 * - Configurable retry strategies and backoff policies
 * - Job lifecycle management and monitoring
 * - Stalled job detection and recovery
 * - Comprehensive job statistics and health monitoring
 *
 * Redis Configuration:
 * - Automatic connection management with retry logic
 * - Optimized connection parameters for production use
 * - Graceful fallback for development environments
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (redisUrl) {
          // Production Redis configuration with optimized settings
          return {
            redis: {
              url: redisUrl, // Redis connection URL
              maxRetriesPerRequest: 3, // Maximum retries per Redis request
              enableReadyCheck: false, // Disable ready check for better performance
              retryDelayOnFailover: 100, // Retry delay on failover (ms)
              connectTimeout: 10000, // Connection timeout (ms)
              commandTimeout: 5000, // Command timeout (ms)
              keepAlive: 30000, // Keep-alive interval (ms)
            },
            defaultJobOptions: {
              removeOnComplete: 100, // Keep last 100 completed jobs
              removeOnFail: 50, // Keep last 50 failed jobs
              attempts: 3, // Retry failed jobs 3 times
              backoff: {
                type: 'exponential', // Exponential backoff strategy
                delay: 2000, // Start with 2 seconds delay
              },
            },
            settings: {
              stalledInterval: 30000, // Check for stalled jobs every 30 seconds
              maxStalledCount: 1, // Mark job as failed after 1 stall
            },
          };
        } else {
          // Fallback to in-memory queue for development without Redis
          return {
            redis: false, // Disable Redis, use in-memory
            defaultJobOptions: {
              removeOnComplete: 100, // Keep last 100 completed jobs
              removeOnFail: 50, // Keep last 50 failed jobs
              attempts: 3, // Retry failed jobs 3 times
              backoff: {
                type: 'exponential', // Exponential backoff strategy
                delay: 2000, // Start with 2 seconds delay
              },
            },
          };
        }
      },
      inject: [ConfigService],
    }),

    // Register specialized job queues with priority-based configuration
    BullModule.registerQueue(
      {
        name: 'email', // High-priority email processing queue
        defaultJobOptions: {
          priority: 1, // Highest priority for user communications
          delay: 0, // No delay, process immediately
        },
      },
      {
        name: 'data-sync', // Medium-priority data synchronization queue
        defaultJobOptions: {
          priority: 2, // Medium priority for data operations
          delay: 0, // No delay, process immediately
        },
      },
      {
        name: 'cleanup', // Low-priority maintenance queue
        defaultJobOptions: {
          priority: 3, // Lowest priority for cleanup tasks
          delay: 0, // No delay, process immediately
        },
      }
    ),
  ],
  providers: [
    BackgroundJobsService, // Core job management service
    EmailProcessor, // Email job processor
    DataSyncProcessor, // Data synchronization processor
    CleanupProcessor, // Cleanup and maintenance processor
  ],
  exports: [
    BackgroundJobsService, // Export for use in other modules
    BullModule, // Export Bull functionality
  ],
})
export class BackgroundJobsModule {}
