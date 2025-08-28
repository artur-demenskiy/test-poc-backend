import { Injectable, OnModuleInit } from '@nestjs/common';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

/**
 * Monitoring service for Prometheus integration
 *
 * Provides basic application metrics:
 * - HTTP requests (count, response time, status codes)
 * - System metrics (CPU, memory, GC, etc.)
 * - Custom business metrics
 *
 * Used for exporting metrics in Prometheus format
 * for further visualization in Grafana
 */
@Injectable()
export class MonitoringService implements OnModuleInit {
  // HTTP requests counter with labels for method, path and status
  public readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  });

  // Histogram of HTTP request execution time
  public readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10], // seconds
    registers: [register],
  });

  // Active connections counter
  public readonly activeConnections = new Gauge({
    name: 'active_connections',
    help: 'Number of active connections',
    registers: [register],
  });

  // Application errors counter
  public readonly applicationErrors = new Counter({
    name: 'application_errors_total',
    help: 'Total number of application errors',
    labelNames: ['error_type', 'endpoint'],
    registers: [register],
  });

  // Database metrics
  public readonly databaseConnections = new Gauge({
    name: 'database_connections_active',
    help: 'Number of active database connections',
    registers: [register],
  });

  public readonly databaseQueryDuration = new Histogram({
    name: 'database_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['query_type', 'table'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [register],
  });

  onModuleInit() {
    // Initialize collection of standard Node.js metrics
    // Includes CPU, memory, GC, event loop metrics, etc.
    collectDefaultMetrics({
      register,
      prefix: 'nestjs_app_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // seconds
    });
  }

  /**
   * Get all metrics in Prometheus format
   * @returns String with metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Get metrics in JSON format
   * @returns Object with metrics
   */
  async getMetricsAsJson() {
    return register.getMetricsAsJSON();
  }

  /**
   * Clear all metrics (used in tests)
   */
  clearMetrics(): void {
    register.clear();
  }

  /**
   * Increment HTTP requests counter
   * @param method HTTP method
   * @param route Route
   * @param statusCode Status code
   */
  incrementHttpRequests(method: string, route: string, statusCode: number): void {
    this.httpRequestsTotal.inc({
      method: method.toUpperCase(),
      route,
      status_code: statusCode.toString(),
    });
  }

  /**
   * Record HTTP request execution time
   * @param method HTTP method
   * @param route Route
   * @param statusCode Status code
   * @param duration Execution time in seconds
   */
  recordHttpRequestDuration(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): void {
    this.httpRequestDuration.observe(
      {
        method: method.toUpperCase(),
        route,
        status_code: statusCode.toString(),
      },
      duration
    );
  }

  /**
   * Increment application errors counter
   * @param errorType Error type
   * @param endpoint Endpoint where error occurred
   */
  incrementApplicationErrors(errorType: string, endpoint: string): void {
    this.applicationErrors.inc({
      error_type: errorType,
      endpoint,
    });
  }

  /**
   * Set number of active connections
   * @param count Number of connections
   */
  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  /**
   * Record database query execution time
   * @param queryType Query type (SELECT, INSERT, UPDATE, DELETE)
   * @param table Table
   * @param duration Execution time in seconds
   */
  recordDatabaseQueryDuration(queryType: string, table: string, duration: number): void {
    this.databaseQueryDuration.observe(
      {
        query_type: queryType.toUpperCase(),
        table,
      },
      duration
    );
  }

  /**
   * Set number of active database connections
   * @param count Number of connections
   */
  setDatabaseConnections(count: number): void {
    this.databaseConnections.set(count);
  }
}
