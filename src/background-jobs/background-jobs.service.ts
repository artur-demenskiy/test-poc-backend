import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job, JobOptions } from 'bull';

/**
 * Generic job data interface for flexible job payloads
 * Allows any key-value structure for job-specific data
 */
export interface JobData {
  [key: string]: unknown;
}

/**
 * Standard job execution result format
 * Provides consistent response structure across all job types
 */
export interface JobResult {
  success: boolean; // Job execution success status
  data?: unknown; // Job result data if successful
  error?: string; // Error message if failed
  duration?: number; // Job execution duration in milliseconds
}

/**
 * Background job management service for distributed task processing
 * Manages multiple job queues with different priorities and retry strategies
 *
 * Queue Types:
 * - Email Queue: High priority, fast processing for user communications
 * - Data Sync Queue: Medium priority, data synchronization operations
 * - Cleanup Queue: Low priority, maintenance and cleanup tasks
 *
 * Features:
 * - Priority-based job scheduling
 * - Exponential backoff retry strategies
 * - Queue health monitoring
 * - Job lifecycle management
 * - Comprehensive statistics and monitoring
 */
@Injectable()
export class BackgroundJobsService {
  private readonly logger = new Logger(BackgroundJobsService.name);

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('data-sync') private readonly dataSyncQueue: Queue,
    @InjectQueue('cleanup') private readonly cleanupQueue: Queue
  ) {}

  /**
   * Add email job to high-priority queue
   * Email jobs are processed first due to user experience requirements
   * @param data - Job data payload
   * @param options - Custom job options to override defaults
   * @returns Created job instance
   */
  async addEmailJob(data: JobData, options: JobOptions = {}): Promise<Job> {
    try {
      const job = await this.emailQueue.add('send-email', data, {
        priority: 1, // Highest priority for user communications
        attempts: 3, // Retry up to 3 times on failure
        backoff: {
          type: 'exponential', // Exponential backoff for retries
          delay: 2000, // Start with 2 second delay
        },
        ...options, // Allow custom options to override defaults
      });

      this.logger.log(`Email job ${job.id} added to queue`);
      return job;
    } catch (error) {
      this.logger.error('Failed to add email job to queue:', error);
      throw error;
    }
  }

  /**
   * Add data synchronization job to medium-priority queue
   * Data sync jobs handle background data processing and synchronization
   * @param data - Job data payload
   * @param options - Custom job options to override defaults
   * @returns Created job instance
   */
  async addDataSyncJob(data: JobData, options: JobOptions = {}): Promise<Job> {
    try {
      const job = await this.dataSyncQueue.add('sync-data', data, {
        priority: 2, // Medium priority for data operations
        attempts: 3, // Retry up to 3 times on failure
        backoff: {
          type: 'exponential', // Exponential backoff for retries
          delay: 5000, // Start with 5 second delay
        },
        ...options, // Allow custom options to override defaults
      });

      this.logger.log(`Data sync job ${job.id} added to queue`);
      return job;
    } catch (error) {
      this.logger.error('Failed to add data sync job to queue:', error);
      throw error;
    }
  }

  /**
   * Add cleanup job to low-priority queue
   * Cleanup jobs handle maintenance tasks and can be delayed
   * @param data - Job data payload
   * @param options - Custom job options to override defaults
   * @returns Created job instance
   */
  async addCleanupJob(data: JobData, options: JobOptions = {}): Promise<Job> {
    try {
      const job = await this.cleanupQueue.add('cleanup-data', data, {
        priority: 3, // Lowest priority for maintenance tasks
        attempts: 2, // Fewer retries for cleanup operations
        backoff: {
          type: 'exponential', // Exponential backoff for retries
          delay: 10000, // Start with 10 second delay
        },
        ...options, // Allow custom options to override defaults
      });

      this.logger.log(`Cleanup job ${job.id} added to queue`);
      return job;
    } catch (error) {
      this.logger.error('Failed to add cleanup job to queue:', error);
      throw error;
    }
  }

  /**
   * Retrieve job by ID from specified queue
   * @param queueName - Name of the queue to search
   * @param jobId - Unique job identifier
   * @returns Job instance or null if not found
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
   * Get jobs from queue by status with pagination support
   * @param queueName - Name of the queue to query
   * @param status - Job status filter (waiting, active, completed, etc.)
   * @param start - Starting index for pagination
   * @param end - Ending index for pagination
   * @returns Array of jobs matching the criteria
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
   * Remove job from queue by ID
   * @param queueName - Name of the queue containing the job
   * @param jobId - Unique job identifier to remove
   * @returns True if job was removed, false if not found
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
   * Pause queue to stop processing new jobs
   * Existing active jobs continue running, new jobs are queued but not processed
   * @param queueName - Name of the queue to pause
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
   * Resume paused queue to continue processing jobs
   * @param queueName - Name of the queue to resume
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
   * Get comprehensive statistics for a specific queue
   * Provides counts for all job statuses and total queue metrics
   * @param queueName - Name of the queue to get stats for
   * @returns Queue statistics object
   */
  async getQueueStats(queueName: string): Promise<Record<string, unknown>> {
    try {
      const queue = this.getQueueByName(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      // Get counts for all job statuses concurrently
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
   * Get statistics for all managed queues
   * Provides overview of all queue performance and status
   * @returns Object containing stats for all queues
   */
  async getAllQueuesStats(): Promise<Record<string, Record<string, unknown>>> {
    const queues = ['email', 'data-sync', 'cleanup'];
    const stats: Record<string, Record<string, unknown>> = {};

    // Collect stats for all queues
    for (const queueName of queues) {
      stats[queueName] = await this.getQueueStats(queueName);
    }

    return stats;
  }

  /**
   * Clean completed and failed jobs from queue
   * Removes old jobs to prevent queue bloat and improve performance
   * @param queueName - Name of the queue to clean
   * @param grace - Grace period in milliseconds before cleaning (default: 24 hours)
   * @param status - Job status to clean (default: completed)
   * @returns Number of jobs cleaned from queue
   */
  async cleanQueue(
    queueName: string,
    grace = 1000 * 60 * 60 * 24, // 24 hours default grace period
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
   * Get queue instance by name
   * Maps queue names to their corresponding queue instances
   * @param queueName - Name of the queue to retrieve
   * @returns Queue instance or null if not found
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
   * Get list of all available queue names
   * @returns Array of queue names managed by this service
   */
  getQueueNames(): string[] {
    return ['email', 'data-sync', 'cleanup'];
  }

  /**
   * Check if queue is healthy and functioning properly
   * Analyzes queue metrics to determine health status
   * @param queueName - Name of the queue to check
   * @returns True if queue is healthy, false otherwise
   */
  async isQueueHealthy(queueName: string): Promise<boolean> {
    try {
      const stats = await this.getQueueStats(queueName);
      if (!stats) return false;

      // Extract queue metrics for health analysis
      const totalJobs = stats.total as number;
      const activeJobs = stats.active as number;
      const failedJobs = stats.failed as number;

      // Queue health criteria:
      // 1. Reasonable total job count (not overwhelmed)
      // 2. Failed jobs should not exceed 20% of total jobs
      // 3. Active jobs should not be stuck (less than 100)
      return totalJobs < 10000 && failedJobs / totalJobs < 0.2 && activeJobs < 100;
    } catch (error) {
      this.logger.error(`Failed to check queue health for ${queueName}:`, error);
      return false;
    }
  }
}
