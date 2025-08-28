import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { MonitoringMiddleware } from './monitoring.middleware';

/**
 * Monitoring module
 *
 * Provides Prometheus integration for collecting application metrics.
 *
 * Includes:
 * - MonitoringService - service for working with metrics
 * - MonitoringController - controller for metrics endpoints
 * - MonitoringMiddleware - middleware for automatic HTTP metrics collection
 *
 * Automatically collects:
 * - HTTP metrics (requests, response time, errors)
 * - Node.js system metrics (CPU, memory, GC)
 * - Custom business metrics
 *
 * Usage:
 * 1. Import module in AppModule
 * 2. Configure Prometheus for scraping /metrics endpoint
 * 3. Configure Grafana dashboards for visualization
 */
@Module({
  providers: [MonitoringService],
  controllers: [MonitoringController],
  exports: [MonitoringService], // Export service for use in other modules
})
export class MonitoringModule implements NestModule {
  /**
   * Configure middleware for automatic HTTP metrics collection
   *
   * Applied to all routes except metrics endpoints themselves
   * to avoid recursive metrics collection
   */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MonitoringMiddleware)
      .exclude('metrics', 'metrics/json') // Exclude metrics endpoints
      .forRoutes('*'); // Apply to all other routes
  }
}
