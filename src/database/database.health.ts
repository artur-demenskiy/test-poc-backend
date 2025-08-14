import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { getPool } from './connection';

/**
 * Database health indicator for NestJS Terminus
 * This indicator checks database connectivity but won't break readiness if DB is not configured
 */
@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  /**
   * Check database health
   * Returns unhealthy only if database is configured but unreachable
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const pool = getPool();

      // Simple ping query
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();

      return this.getStatus(key, true);
    } catch (error) {
      // If database is not configured or unreachable, return unhealthy
      // but this won't break the overall readiness check
      return this.getStatus(key, false, {
        message: 'Database is not accessible',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check if database is configured and accessible
   * This is a separate method that can be used for detailed health checks
   */
  async isConfigured(key: string): Promise<HealthIndicatorResult> {
    const isConfigured = !!(
      process.env.DATABASE_URL ||
      (process.env.DATABASE_HOST && process.env.DATABASE_NAME)
    );

    return this.getStatus(key, isConfigured, {
      message: isConfigured ? 'Database is configured' : 'Database is not configured',
    });
  }
}
