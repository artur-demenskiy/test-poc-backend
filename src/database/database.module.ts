import { Module, OnModuleDestroy } from '@nestjs/common';
import { closePool } from './connection';

/**
 * Database module that provides database connection and services
 * This module is optional and won't break the application if database is not configured
 */
@Module({
  providers: [],
  exports: [],
})
export class DatabaseModule implements OnModuleDestroy {
  /**
   * Clean up database connections when the module is destroyed
   */
  async onModuleDestroy() {
    try {
      await closePool();
    } catch (error) {
      // Ignore errors during shutdown
      console.warn('Failed to close database pool:', error);
    }
  }
} 