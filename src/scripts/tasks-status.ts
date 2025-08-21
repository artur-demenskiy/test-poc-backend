#!/usr/bin/env tsx
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ScheduledTasksService } from '../scheduled-tasks/scheduled-tasks.service';
import { Logger } from '@nestjs/common';

async function getTasksStatus() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const scheduledTasksService = app.get(ScheduledTasksService);
  const logger = new Logger('TasksStatus');

  try {
    logger.log('=== Scheduled Tasks Status ===');

    // Get all tasks
    const allTasks = scheduledTasksService.getAllTasks();
    logger.log(`Total Tasks: ${allTasks.length}`);

    // Display task details
    for (const task of allTasks) {
      logger.log(`\n--- Task: ${task.name} ---`);
      logger.log(`Cron Expression: ${task.cronExpression}`);
      logger.log(`Enabled: ${task.enabled ? 'Yes' : 'No'}`);
      logger.log(`Run Count: ${task.runCount}`);
      logger.log(`Error Count: ${task.errorCount}`);
      logger.log(`Average Duration: ${task.averageDuration.toFixed(2)}ms`);

      if (task.lastRun) {
        logger.log(`Last Run: ${task.lastRun.toISOString()}`);
      }

      if (task.nextRun) {
        logger.log(`Next Run: ${task.nextRun.toISOString()}`);
      }

      if (task.lastError) {
        logger.log(`Last Error: ${task.lastError}`);
      }
    }

    // Get running tasks
    const runningTasks = scheduledTasksService.getRunningTasks();
    if (runningTasks.length > 0) {
      logger.log(`\n=== Currently Running Tasks ===`);
      runningTasks.forEach(taskName => {
        logger.log(`- ${taskName}`);
      });
    } else {
      logger.log(`\nNo tasks are currently running`);
    }

    logger.log('=== End Tasks Status ===');
  } catch (error) {
    logger.error('Failed to get tasks status:', error);
  } finally {
    await app.close();
  }
}

getTasksStatus();
