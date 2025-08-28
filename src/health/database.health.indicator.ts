import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { MonitoringService } from '../monitoring/monitoring.service';

/**
 * Custom health indicator for monitoring database state
 *
 * Checks:
 * - Database connection availability
 * - Response time for simple query
 * - Number of active connections
 *
 * Automatically records metrics to Prometheus
 */
@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly monitoringService: MonitoringService) {
    super();
  }

  /**
   * Database health check
   *
   * @param key Key for check identification
   * @returns Database health check result
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      // Here should be real database check
      // For example, we use simple simulation
      await this.checkDatabaseConnection();

      const responseTime = Date.now() - startTime;

      // Record database performance metrics
      this.monitoringService.recordDatabaseQueryDuration(
        'HEALTH_CHECK',
        'system',
        responseTime / 1000 // convert to seconds
      );

      // Simulate number of active connections (in real app get from connection pool)
      const activeConnections = this.getActiveConnectionsCount();
      this.monitoringService.setDatabaseConnections(activeConnections);

      const result = this.getStatus(key, true, {
        responseTime: `${responseTime}ms`,
        activeConnections,
        status: 'up',
      });

      return result;
    } catch (error) {
      // Record error to metrics
      this.monitoringService.incrementApplicationErrors('database_error', '/health');

      throw new HealthCheckError(
        'Database health check failed',
        this.getStatus(key, false, {
          error: error instanceof Error ? error.message : String(error),
          status: 'down',
        })
      );
    }
  }

  /**
   * Check database connection
   * In real application should be code for database checking
   */
  private async checkDatabaseConnection(): Promise<void> {
    // Database check simulation
    // In real application should be code like:
    // await this.databaseService.query('SELECT 1');

    await new Promise(resolve => globalThis.setTimeout(resolve, Math.random() * 100)); // random delay 0-100ms

    // Simulate rare errors for demonstration
    if (Math.random() < 0.01) {
      // 1% error probability
      throw new Error('Database connection timeout');
    }
  }

  /**
   * Get number of active connections
   * In real application get from connection pool
   */
  private getActiveConnectionsCount(): number {
    // Connections count simulation
    // In real application:
    // return this.databaseService.getConnectionPool().activeConnections;
    return Math.floor(Math.random() * 10) + 1; // 1-10 connections
  }
}
