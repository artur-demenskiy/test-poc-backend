import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BackgroundJobsService } from './background-jobs.service';
import { EmailProcessor } from './processors/email.processor';
import { DataSyncProcessor } from './processors/data-sync.processor';
import { CleanupProcessor } from './processors/cleanup.processor';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (redisUrl) {
          return {
            redis: {
              url: redisUrl,
              maxRetriesPerRequest: 3,
              enableReadyCheck: false,
              retryDelayOnFailover: 100,
              connectTimeout: 10000,
              commandTimeout: 5000,
              keepAlive: 30000,
            },
            defaultJobOptions: {
              removeOnComplete: 100, // Keep last 100 completed jobs
              removeOnFail: 50, // Keep last 50 failed jobs
              attempts: 3, // Retry failed jobs 3 times
              backoff: {
                type: 'exponential',
                delay: 2000, // Start with 2 seconds
              },
            },
            settings: {
              stalledInterval: 30000, // Check for stalled jobs every 30 seconds
              maxStalledCount: 1, // Mark job as failed after 1 stall
            },
          };
        } else {
          // Fallback to in-memory queue (for development without Redis)
          return {
            redis: false,
            defaultJobOptions: {
              removeOnComplete: 100,
              removeOnFail: 50,
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
            },
          };
        }
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      {
        name: 'email',
        defaultJobOptions: {
          priority: 1, // High priority for emails
          delay: 0,
        },
      },
      {
        name: 'data-sync',
        defaultJobOptions: {
          priority: 2, // Medium priority for data sync
          delay: 0,
        },
      },
      {
        name: 'cleanup',
        defaultJobOptions: {
          priority: 3, // Low priority for cleanup tasks
          delay: 0,
        },
      }
    ),
  ],
  providers: [BackgroundJobsService, EmailProcessor, DataSyncProcessor, CleanupProcessor],
  exports: [BackgroundJobsService, BullModule],
})
export class BackgroundJobsModule {}
