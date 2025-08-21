import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job, JobOptions } from 'bull';

export interface JobData {
  [key: string]: unknown;
}

export interface JobResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration?: number;
}

@Injectable()
export class BackgroundJobsService {
  private readonly logger = new Logger(BackgroundJobsService.name);

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('data-sync') private readonly dataSyncQueue: Queue,
    @InjectQueue('cleanup') private readonly cleanupQueue: Queue
  ) {}

  /**
   * Add email job to queue
   */
  async addEmailJob(data: JobData, options: JobOptions = {}): Promise<Job> {
    try {
      const job = await this.emailQueue.add('send-email', data, {
        priority: 1,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        ...options,
      });

      this.logger.log(`Email job ${job.id} added to queue`);
      return job;
    } catch (error) {
      this.logger.error('Failed to add email job to queue:', error);
      throw error;
    }
  }

  /**
   * Add data sync job to queue
   */
  async addDataSyncJob(data: JobData, options: JobOptions = {}): Promise<Job> {
    try {
      const job = await this.dataSyncQueue.add('sync-data', data, {
        priority: 2,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        ...options,
      });

      this.logger.log(`Data sync job ${job.id} added to queue`);
      return job;
    } catch (error) {
      this.logger.error('Failed to add data sync job to queue:', error);
      throw error;
    }
  }

  /**
   * Add cleanup job to queue
   */
  async addCleanupJob(data: JobData, options: JobOptions = {}): Promise<Job> {
    try {
      const job = await this.cleanupQueue.add('cleanup-data', data, {
        priority: 3,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        ...options,
      });

      this.logger.log(`Cleanup job ${job.id} added to queue`);
      return job;
    } catch (error) {
      this.logger.error('Failed to add cleanup job to queue:', error);
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(queueName: string, jobId: string): Promise<Job | null> {
    try {
      const queue = this.getQueueByName(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      const job = await queue.getJob(jobId);
      return job;
    } catch (error) {
      this.logger.error(`Failed to get job ${jobId} from queue ${queueName}:`, error);
      return null;
    }
  }

  /**
   * Get all jobs from queue
   */
  async getJobs(
    queueName: string,
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused' = 'waiting',
    start = 0,
    end = 100
  ): Promise<Job[]> {
    try {
      const queue = this.getQueueByName(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      const jobs = await queue.getJobs([status], start, end);
      return jobs;
    } catch (error) {
      this.logger.error(`Failed to get jobs from queue ${queueName}:`, error);
      return [];
    }
  }

  /**
   * Remove job from queue
   */
  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    try {
      const queue = this.getQueueByName(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Job ${jobId} removed from queue ${queueName}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Failed to remove job ${jobId} from queue ${queueName}:`, error);
      return false;
    }
  }

  /**
   * Pause queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    try {
      const queue = this.getQueueByName(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      await queue.pause();
      this.logger.log(`Queue ${queueName} paused`);
    } catch (error) {
      this.logger.error(`Failed to pause queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Resume queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    try {
      const queue = this.getQueueByName(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      await queue.resume();
      this.logger.log(`Queue ${queueName} resumed`);
    } catch (error) {
      this.logger.error(`Failed to resume queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<Record<string, unknown>> {
    try {
      const queue = this.getQueueByName(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length + delayed.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get stats for queue ${queueName}:`, error);
      return {};
    }
  }

  /**
   * Get all queues statistics
   */
  async getAllQueuesStats(): Promise<Record<string, Record<string, unknown>>> {
    const queues = ['email', 'data-sync', 'cleanup'];
    const stats: Record<string, Record<string, unknown>> = {};

    for (const queueName of queues) {
      stats[queueName] = await this.getQueueStats(queueName);
    }

    return stats;
  }

  /**
   * Clean completed and failed jobs
   */
  async cleanQueue(
    queueName: string,
    grace = 1000 * 60 * 60 * 24, // 24 hours
    status: 'completed' | 'failed' | 'wait' | 'active' | 'delayed' | 'paused' = 'completed'
  ): Promise<number> {
    try {
      const queue = this.getQueueByName(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      const cleaned = await queue.clean(grace, status);
      this.logger.log(`Cleaned ${cleaned.length} ${status} jobs from queue ${queueName}`);
      return cleaned.length;
    } catch (error) {
      this.logger.error(`Failed to clean queue ${queueName}:`, error);
      return 0;
    }
  }

  /**
   * Get queue by name
   */
  private getQueueByName(queueName: string): Queue | null {
    switch (queueName) {
      case 'email':
        return this.emailQueue;
      case 'data-sync':
        return this.dataSyncQueue;
      case 'cleanup':
        return this.cleanupQueue;
      default:
        return null;
    }
  }

  /**
   * Get all queue names
   */
  getQueueNames(): string[] {
    return ['email', 'data-sync', 'cleanup'];
  }

  /**
   * Check if queue is healthy
   */
  async isQueueHealthy(queueName: string): Promise<boolean> {
    try {
      const stats = await this.getQueueStats(queueName);
      if (!stats) return false;

      // Consider queue healthy if it's not completely stuck
      const totalJobs = stats.total as number;
      const activeJobs = stats.active as number;
      const failedJobs = stats.failed as number;

      // Queue is healthy if:
      // 1. It has reasonable number of total jobs
      // 2. Failed jobs are not more than 20% of total jobs
      // 3. Active jobs are not stuck (less than 100)
      return totalJobs < 10000 && failedJobs / totalJobs < 0.2 && activeJobs < 100;
    } catch (error) {
      this.logger.error(`Failed to check queue health for ${queueName}:`, error);
      return false;
    }
  }
}
