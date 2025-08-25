import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { CacheCleanupTask } from './tasks/cache-cleanup.task';
import { DatabaseMaintenanceTask } from './tasks/database-maintenance.task';
import { HealthCheckTask } from './tasks/health-check.task';
import { MetricsCollectionTask } from './tasks/metrics-collection.task';

/**
 * Global Scheduled Tasks Module for automated system maintenance
 *
 * This module provides automated background tasks that run on schedules:
 * - Cache cleanup and maintenance
 * - Database optimization and health checks
 * - System health monitoring
 * - Performance metrics collection
 *
 * Scheduled Tasks:
 * - CacheCleanupTask: Regular cache maintenance and cleanup
 * - DatabaseMaintenanceTask: Database optimization and health checks
 * - HealthCheckTask: System health monitoring and alerting
 * - MetricsCollectionTask: Performance metrics gathering and storage
 *
 * Features:
 * - Cron-based scheduling for precise timing
 * - Automatic task execution and monitoring
 * - Error handling and retry mechanisms
 * - Task status tracking and reporting
 * - Configurable execution intervals
 *
 * Global Scope:
 * - Provides application-wide scheduled task capabilities
 * - Centralized task management and monitoring
 * - Automatic cleanup and maintenance across all modules
 */
@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable NestJS scheduling capabilities
  ],
  providers: [
    ScheduledTasksService, // Core task management and coordination
    CacheCleanupTask, // Cache maintenance and cleanup tasks
    DatabaseMaintenanceTask, // Database optimization tasks
    HealthCheckTask, // System health monitoring tasks
    MetricsCollectionTask, // Performance metrics collection tasks
  ],
  exports: [
    ScheduledTasksService, // Export for use in other modules
  ],
})
export class ScheduledTasksModule {}
