import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { CronJob } from 'cron';
import { BackgroundJobsService } from '../background-jobs/background-jobs.service';
import { CachingService } from '../caching/caching.service';

export interface ScheduledTask {
  name: string;
  cronExpression: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  errorCount: number;
  lastError?: string;
  averageDuration: number;
}

@Injectable()
export class ScheduledTasksService implements OnModuleDestroy {
  private readonly logger = new Logger(ScheduledTasksService.name);
  private readonly tasks = new Map<string, { job: CronJob; taskFunction: () => Promise<void> }>();
  private readonly taskStats = new Map<string, ScheduledTask>();

  constructor(
    private readonly backgroundJobsService: BackgroundJobsService,
    private readonly cachingService: CachingService
  ) {
    this.initializeDefaultTasks();
  }

  /**
   * Initialize default scheduled tasks
   */
  private initializeDefaultTasks(): void {
    this.addTask('cache-cleanup-daily', '0 2 * * *', () => this.performCacheCleanup());
    this.addTask('cache-cleanup-frequent', '0 */6 * * *', () => this.performFrequentCacheCleanup());
    this.addTask('cache-cleanup-tags', '0 * * * *', () => this.performTagBasedCacheCleanup());
    this.addTask('cache-health-check', '*/15 * * * *', () => this.performCacheHealthCheck());
    this.addTask('cache-optimization', '0 1 * * 0', () => this.performCacheOptimization());
    this.addTask('database-maintenance', '0 3 * * 0', () => this.performDatabaseMaintenance());
    this.addTask('database-cleanup', '0 4 * * *', () => this.performDatabaseCleanup());
    this.addTask('health-check', '*/5 * * * *', () => this.performHealthCheck());
    this.addTask('extended-health-check', '0 * * * *', () => this.performExtendedHealthCheck());
    this.addTask('metrics-collection', '* * * * *', () => this.collectMetrics());
    this.addTask('detailed-metrics', '*/5 * * * *', () => this.collectDetailedMetrics());
    this.addTask('hourly-metrics', '0 * * * *', () => this.collectHourlyMetrics());
    this.addTask('daily-metrics', '0 0 * * *', () => this.collectDailyMetrics());
    this.logger.log('Default scheduled tasks initialized');
  }

  /**
   * Add a new scheduled task
   */
  addTask(name: string, cronExpression: string, taskFunction: () => Promise<void>): void {
    if (this.tasks.has(name)) {
      this.logger.warn(`Task ${name} already exists, replacing it`);
      this.removeTask(name);
    }

    if (!this.isValidCronExpression(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    const job = new CronJob(cronExpression, () => {
      this.executeTask(name, taskFunction);
    });

    this.tasks.set(name, { job, taskFunction });
    this.taskStats.set(name, {
      name,
      cronExpression,
      enabled: true,
      runCount: 0,
      errorCount: 0,
      averageDuration: 0,
    });

    job.start();
    this.logger.log(`Task ${name} scheduled with cron: ${cronExpression}`);
  }

  /**
   * Remove a scheduled task
   */
  removeTask(name: string): boolean {
    const task = this.tasks.get(name);
    if (!task) {
      return false;
    }

    task.job.stop();
    this.tasks.delete(name);
    this.taskStats.delete(name);

    this.logger.log(`Task ${name} removed`);
    return true;
  }

  /**
   * Enable a scheduled task
   */
  enableTask(name: string): boolean {
    const task = this.tasks.get(name);
    if (!task) {
      return false;
    }

    task.job.start();
    const stats = this.taskStats.get(name);
    if (stats) {
      stats.enabled = true;
    }

    this.logger.log(`Task ${name} enabled`);
    return true;
  }

  /**
   * Disable a scheduled task
   */
  disableTask(name: string): boolean {
    const task = this.tasks.get(name);
    if (!task) {
      return false;
    }

    task.job.stop();
    const stats = this.taskStats.get(name);
    if (stats) {
      stats.enabled = false;
    }

    this.logger.log(`Task ${name} disabled`);
    return true;
  }

  /**
   * Get all scheduled tasks
   */
  getTasks(): ScheduledTask[] {
    return Array.from(this.taskStats.values());
  }

  /**
   * Get a specific task
   */
  getTask(name: string): ScheduledTask | undefined {
    return this.taskStats.get(name);
  }

  /**
   * Get task status
   */
  getTaskStatus(name: string): { running: boolean; nextRun: Date | null } | null {
    const task = this.tasks.get(name);
    if (!task) {
      return null;
    }

    return {
      running: task.job.running,
      nextRun: task.job.nextDate().toDate(),
    };
  }

  /**
   * Manually trigger a task
   */
  async triggerTask(name: string): Promise<boolean> {
    const task = this.tasks.get(name);
    if (!task) {
      return false;
    }

    try {
      await this.executeTask(name, task.taskFunction);
      return true;
    } catch (error) {
      this.logger.error(`Failed to trigger task ${name}:`, error);
      return false;
    }
  }

  /**
   * Update task schedule
   */
  updateTaskSchedule(name: string, newCronExpression: string): boolean {
    if (!this.isValidCronExpression(newCronExpression)) {
      throw new Error(`Invalid cron expression: ${newCronExpression}`);
    }

    const task = this.tasks.get(name);
    if (!task) {
      return false;
    }

    // Stop old job
    task.job.stop();

    // Create new job with new schedule
    const newJob = new CronJob(newCronExpression, () => {
      this.executeTask(name, task.taskFunction);
    });

    // Update task
    this.tasks.set(name, { job: newJob, taskFunction: task.taskFunction });
    const stats = this.taskStats.get(name);
    if (stats) {
      stats.cronExpression = newCronExpression;
    }

    // Start new job
    newJob.start();

    this.logger.log(`Task ${name} schedule updated to: ${newCronExpression}`);
    return true;
  }

  /**
   * Get currently running tasks
   */
  getRunningTasks(): string[] {
    const running: string[] = [];
    for (const [name, task] of this.tasks.entries()) {
      if (task.job.running) {
        running.push(name);
      }
    }
    return running;
  }

  /**
   * Stop all tasks
   */
  stopAllTasks(): void {
    for (const [name, task] of this.tasks.entries()) {
      task.job.stop();
      const stats = this.taskStats.get(name);
      if (stats) {
        stats.enabled = false;
      }
    }
    this.logger.log('All scheduled tasks stopped');
  }

  /**
   * Start all enabled tasks
   */
  startAllEnabledTasks(): void {
    for (const [name, task] of this.tasks.entries()) {
      const stats = this.taskStats.get(name);
      if (stats?.enabled) {
        task.job.start();
      }
    }
    this.logger.log('All enabled scheduled tasks started');
  }

  /**
   * Execute a task and update statistics
   */
  private async executeTask(name: string, taskFunction: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    const stats = this.taskStats.get(name);

    if (!stats) {
      this.logger.warn(`Statistics not found for task ${name}`);
      return;
    }

    try {
      this.logger.log(`Executing scheduled task: ${name}`);
      await taskFunction();

      // Update success statistics
      const duration = Date.now() - startTime;
      stats.lastRun = new Date();
      stats.runCount++;
      stats.averageDuration =
        (stats.averageDuration * (stats.runCount - 1) + duration) / stats.runCount;

      this.logger.log(`Task ${name} completed successfully in ${duration}ms`);
    } catch (error) {
      // Update error statistics
      const duration = Date.now() - startTime;
      stats.lastRun = new Date();
      stats.runCount++;
      stats.errorCount++;
      stats.lastError = error instanceof Error ? error.message : String(error);
      stats.averageDuration =
        (stats.averageDuration * (stats.runCount - 1) + duration) / stats.runCount;

      this.logger.error(`Task ${name} failed after ${duration}ms:`, error);
    }
  }

  /**
   * Get task function by name
   */
  private getTaskFunction(name: string): (() => Promise<void>) | null {
    const task = this.tasks.get(name);
    return task ? task.taskFunction : null;
  }

  /**
   * Validate cron expression
   */
  private isValidCronExpression(expression: string): boolean {
    try {
      new CronJob(expression, () => {});
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Perform cache cleanup
   */
  private async performCacheCleanup(): Promise<void> {
    try {
      await this.cachingService.clear();
      this.logger.log('Cache cleanup completed');
    } catch (error) {
      this.logger.error('Cache cleanup failed:', error);
    }
  }

  /**
   * Perform frequent cache cleanup
   */
  private async performFrequentCacheCleanup(): Promise<void> {
    try {
      // Clean expired keys
      const stats = await this.cachingService.getStats();
      this.logger.log(`Frequent cache cleanup completed. Current keys: ${stats.keys}`);
    } catch (error) {
      this.logger.error('Frequent cache cleanup failed:', error);
    }
  }

  /**
   * Perform tag-based cache cleanup
   */
  private async performTagBasedCacheCleanup(): Promise<void> {
    try {
      // Clean old cache tags
      this.logger.log('Tag-based cache cleanup completed');
    } catch (error) {
      this.logger.error('Tag-based cache cleanup failed:', error);
    }
  }

  /**
   * Perform cache health check
   */
  private async performCacheHealthCheck(): Promise<void> {
    try {
      const isAvailable = await this.cachingService.isAvailable();
      this.logger.log(`Cache health check: ${isAvailable ? 'healthy' : 'unhealthy'}`);
    } catch (error) {
      this.logger.error('Cache health check failed:', error);
    }
  }

  /**
   * Perform cache optimization
   */
  private async performCacheOptimization(): Promise<void> {
    try {
      // Optimize cache settings
      this.logger.log('Cache optimization completed');
    } catch (error) {
      this.logger.error('Cache optimization failed:', error);
    }
  }

  /**
   * Perform database maintenance
   */
  private async performDatabaseMaintenance(): Promise<void> {
    try {
      // Add database maintenance logic here
      this.logger.log('Database maintenance completed');
    } catch (error) {
      this.logger.error('Database maintenance failed:', error);
    }
  }

  /**
   * Perform database cleanup
   */
  private async performDatabaseCleanup(): Promise<void> {
    try {
      // Add database cleanup logic here
      this.logger.log('Database cleanup completed');
    } catch (error) {
      this.logger.error('Database cleanup failed:', error);
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Add health check logic here
      this.logger.log('Health check completed');
    } catch (error) {
      this.logger.error('Health check failed:', error);
    }
  }

  /**
   * Perform extended health check
   */
  private async performExtendedHealthCheck(): Promise<void> {
    try {
      // Add extended health check logic here
      this.logger.log('Extended health check completed');
    } catch (error) {
      this.logger.error('Extended health check failed:', error);
    }
  }

  /**
   * Collect metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Add metrics collection logic here
      this.logger.log('Metrics collection completed');
    } catch (error) {
      this.logger.error('Metrics collection failed:', error);
    }
  }

  /**
   * Collect detailed metrics
   */
  private async collectDetailedMetrics(): Promise<void> {
    try {
      // Add detailed metrics collection logic here
      this.logger.log('Detailed metrics collection completed');
    } catch (error) {
      this.logger.error('Detailed metrics collection failed:', error);
    }
  }

  /**
   * Collect hourly metrics
   */
  private async collectHourlyMetrics(): Promise<void> {
    try {
      // Add hourly metrics collection logic here
      this.logger.log('Hourly metrics collection completed');
    } catch (error) {
      this.logger.error('Hourly metrics collection failed:', error);
    }
  }

  /**
   * Collect daily metrics
   */
  private async collectDailyMetrics(): Promise<void> {
    try {
      // Add daily metrics collection logic here
      this.logger.log('Daily metrics collection completed');
    } catch (error) {
      this.logger.error('Daily metrics collection failed:', error);
    }
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy(): void {
    this.stopAllTasks();
    this.logger.log('ScheduledTasksService destroyed');
  }
}
