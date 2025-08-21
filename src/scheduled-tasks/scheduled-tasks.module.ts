import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { CacheCleanupTask } from './tasks/cache-cleanup.task';
import { DatabaseMaintenanceTask } from './tasks/database-maintenance.task';
import { HealthCheckTask } from './tasks/health-check.task';
import { MetricsCollectionTask } from './tasks/metrics-collection.task';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    ScheduledTasksService,
    CacheCleanupTask,
    DatabaseMaintenanceTask,
    HealthCheckTask,
    MetricsCollectionTask,
  ],
  exports: [ScheduledTasksService],
})
export class ScheduledTasksModule {}
