import { Injectable, Logger } from '@nestjs/common';
import { CachingService } from '../caching/caching.service';

/**
 * Comprehensive performance metrics for application monitoring
 * Provides real-time insights into application performance and health
 */
export interface PerformanceMetrics {
  requestCount: number; // Total requests in time window
  averageResponseTime: number; // Average response time in milliseconds
  slowRequests: number; // Number of requests above warning threshold
  errorCount: number; // Number of failed requests (4xx, 5xx)
  cacheHitRate: number; // Cache hit rate percentage (0-1)
  memoryUsage: {
    heapUsed: number; // Current heap memory usage in bytes
    heapTotal: number; // Total heap memory allocated in bytes
    external: number; // External memory usage in bytes
    rss: number; // Resident set size in bytes
  };
  uptime: number; // Application uptime in seconds
  timestamp: Date; // Metrics collection timestamp
}

/**
 * Individual request performance data
 * Captures detailed information about each HTTP request
 */
export interface RequestMetrics {
  path: string; // Request path/endpoint
  method: string; // HTTP method (GET, POST, etc.)
  duration: number; // Request duration in milliseconds
  statusCode: number; // HTTP response status code
  timestamp: Date; // Request timestamp
  userId?: string; // User ID if authenticated
  ip?: string; // Client IP address
  userAgent?: string; // Client user agent string
}

/**
 * Configurable thresholds for slow request detection
 * Defines warning, error, and critical response time levels
 */
export interface SlowRequestThresholds {
  warning: number; // Warning threshold in milliseconds
  error: number; // Error threshold in milliseconds
  critical: number; // Critical threshold in milliseconds
}

/**
 * Performance monitoring service for application health tracking
 * Collects, analyzes, and reports performance metrics in real-time
 *
 * Features:
 * - Request performance tracking
 * - Memory usage monitoring
 * - Slow request detection and alerting
 * - Performance trend analysis
 * - Automated recommendations
 * - Metrics export and reporting
 */
@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);

  // In-memory storage for request metrics (last 10,000 requests)
  private readonly requestMetrics: RequestMetrics[] = [];

  // Configurable thresholds for slow request detection
  private readonly slowRequestThresholds: SlowRequestThresholds = {
    warning: 1000, // 1 second - warning level
    error: 3000, // 3 seconds - error level
    critical: 10000, // 10 seconds - critical level
  };

  constructor(private readonly cachingService: CachingService) {}

  /**
   * Record performance metrics for a single request
   * Stores request data and triggers slow request detection
   * @param metrics - Request performance data to record
   */
  recordRequest(metrics: RequestMetrics): void {
    this.requestMetrics.push(metrics);

    // Maintain metrics array size to prevent memory bloat
    if (this.requestMetrics.length > 10000) {
      this.requestMetrics.splice(0, this.requestMetrics.length - 10000);
    }

    // Check if request exceeds slow request thresholds
    this.checkSlowRequest(metrics);
  }

  /**
   * Get current performance metrics for the last 5 minutes
   * Calculates real-time performance statistics
   * @returns Current performance metrics object
   */
  getMetrics(): PerformanceMetrics {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    const recentMetrics = this.getRecentMetrics(5 * 60 * 1000); // Last 5 minutes

    if (recentMetrics.length === 0) {
      return {
        requestCount: 0,
        averageResponseTime: 0,
        slowRequests: 0,
        errorCount: 0,
        cacheHitRate: 0,
        memoryUsage: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
        },
        uptime,
        timestamp: new Date(),
      };
    }

    // Calculate performance statistics from recent metrics
    const totalDuration = recentMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    const averageResponseTime = totalDuration / recentMetrics.length;
    const slowRequests = recentMetrics.filter(
      metric => metric.duration > this.slowRequestThresholds.warning
    ).length;
    const errorCount = recentMetrics.filter(metric => metric.statusCode >= 400).length;

    // TODO: Implement actual cache hit rate calculation
    const cacheHitRate = 0.85; // Placeholder value

    return {
      requestCount: recentMetrics.length,
      averageResponseTime,
      slowRequests,
      errorCount,
      cacheHitRate,
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
      },
      uptime,
      timestamp: new Date(),
    };
  }

  /**
   * Get performance metrics for a specific time range
   * Useful for historical analysis and trend detection
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @returns Array of metrics within the specified time range
   */
  getMetricsForTimeRange(startTime: Date, endTime: Date): RequestMetrics[] {
    return this.requestMetrics.filter(
      metric => metric.timestamp >= startTime && metric.timestamp <= endTime
    );
  }

  /**
   * Get performance metrics for a specific endpoint
   * Allows endpoint-specific performance analysis
   * @param path - Request path to filter by
   * @param method - Optional HTTP method filter
   * @returns Array of metrics for the specified endpoint
   */
  getMetricsForEndpoint(path: string, method?: string): RequestMetrics[] {
    return this.requestMetrics.filter(metric => {
      if (method && metric.method !== method) return false;
      return metric.path === path;
    });
  }

  /**
   * Get all requests that exceed performance thresholds
   * Identifies problematic requests for optimization
   * @param threshold - Custom threshold in milliseconds (optional)
   * @returns Array of slow request metrics
   */
  getSlowRequests(threshold?: number): RequestMetrics[] {
    const actualThreshold = threshold || this.slowRequestThresholds.warning;
    return this.requestMetrics.filter(metric => metric.duration > actualThreshold);
  }

  /**
   * Get all failed requests for error analysis
   * Filters requests with 4xx and 5xx status codes
   * @returns Array of error request metrics
   */
  getErrorRequests(): RequestMetrics[] {
    return this.requestMetrics.filter(metric => metric.statusCode >= 400);
  }

  /**
   * Get comprehensive performance summary with trends and recommendations
   * Provides actionable insights for performance optimization
   * @returns Performance summary with current metrics, trends, and recommendations
   */
  async getPerformanceSummary(): Promise<{
    current: PerformanceMetrics;
    trends: {
      responseTime: 'improving' | 'stable' | 'degrading';
      errorRate: 'improving' | 'stable' | 'degrading';
      throughput: 'improving' | 'stable' | 'degrading';
    };
    recommendations: string[];
  }> {
    const current = await this.getMetrics();
    const trends = this.calculateTrends();
    const recommendations = this.generateRecommendations(current, trends);

    return {
      current,
      trends,
      recommendations,
    };
  }

  /**
   * Update slow request detection thresholds
   * Allows dynamic adjustment of performance monitoring sensitivity
   * @param thresholds - New threshold values to apply
   */
  setSlowRequestThresholds(thresholds: Partial<SlowRequestThresholds>): void {
    Object.assign(this.slowRequestThresholds, thresholds);
    this.logger.log(
      `Slow request thresholds updated: ${JSON.stringify(this.slowRequestThresholds)}`
    );
  }

  /**
   * Get current slow request thresholds
   * @returns Copy of current threshold configuration
   */
  getSlowRequestThresholds(): SlowRequestThresholds {
    return { ...this.slowRequestThresholds };
  }

  /**
   * Clear all stored performance metrics
   * Resets metrics collection for fresh monitoring
   */
  clearMetrics(): void {
    this.requestMetrics.length = 0;
    this.logger.log('All performance metrics cleared');
  }

  /**
   * Export all metrics as JSON string
   * Useful for external analysis and reporting
   * @returns JSON string containing all metrics and configuration
   */
  exportMetrics(): string {
    return JSON.stringify(
      {
        metrics: this.requestMetrics,
        thresholds: this.slowRequestThresholds,
        exportTime: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Check if request exceeds slow request thresholds
   * Logs appropriate warnings based on threshold levels
   * @param metrics - Request metrics to check
   */
  private checkSlowRequest(metrics: RequestMetrics): void {
    if (metrics.duration > this.slowRequestThresholds.critical) {
      this.logger.error(
        `Critical slow request: ${metrics.method} ${metrics.path} took ${metrics.duration}ms`
      );
    } else if (metrics.duration > this.slowRequestThresholds.error) {
      this.logger.warn(
        `Error slow request: ${metrics.method} ${metrics.path} took ${metrics.duration}ms`
      );
    } else if (metrics.duration > this.slowRequestThresholds.warning) {
      this.logger.warn(
        `Warning slow request: ${metrics.method} ${metrics.path} took ${metrics.duration}ms`
      );
    }
  }

  /**
   * Get metrics within a specified time window
   * Filters metrics by timestamp for time-based analysis
   * @param timeWindowMs - Time window in milliseconds
   * @returns Array of metrics within the time window
   */
  private getRecentMetrics(timeWindowMs: number): RequestMetrics[] {
    const cutoffTime = Date.now() - timeWindowMs;
    return this.requestMetrics.filter(metric => metric.timestamp.getTime() > cutoffTime);
  }

  /**
   * Calculate performance trends by comparing recent vs previous metrics
   * Analyzes response time, error rate, and throughput changes
   * @returns Trend indicators for key performance metrics
   */
  private calculateTrends(): {
    responseTime: 'improving' | 'stable' | 'degrading';
    errorRate: 'improving' | 'stable' | 'degrading';
    throughput: 'improving' | 'stable' | 'degrading';
  } {
    const recentMetrics = this.getRecentMetrics(5 * 60 * 1000); // Last 5 minutes
    const previousMetrics = this.getRecentMetrics(10 * 60 * 1000).slice(0, recentMetrics.length); // Previous 5 minutes

    if (recentMetrics.length === 0 || previousMetrics.length === 0) {
      return {
        responseTime: 'stable',
        errorRate: 'stable',
        throughput: 'stable',
      };
    }

    // Calculate response time trends
    const recentAvgResponseTime =
      recentMetrics.reduce((sum, metric) => sum + metric.duration, 0) / recentMetrics.length;
    const previousAvgResponseTime =
      previousMetrics.reduce((sum, metric) => sum + metric.duration, 0) / previousMetrics.length;
    const responseTimeChange = recentAvgResponseTime - previousAvgResponseTime;

    // Calculate error rate trends
    const recentErrorRate =
      recentMetrics.filter(metric => metric.statusCode >= 400).length / recentMetrics.length;
    const previousErrorRate =
      previousMetrics.filter(metric => metric.statusCode >= 400).length / previousMetrics.length;
    const errorRateChange = recentErrorRate - previousErrorRate;

    // Calculate throughput trends (requests per minute)
    const recentThroughput = recentMetrics.length / 5;
    const previousThroughput = previousMetrics.length / 5;
    const throughputChange = recentThroughput - previousThroughput;

    return {
      responseTime:
        responseTimeChange < -100 ? 'improving' : responseTimeChange > 100 ? 'degrading' : 'stable',
      errorRate:
        errorRateChange < -0.05 ? 'improving' : errorRateChange > 0.05 ? 'degrading' : 'stable',
      throughput:
        throughputChange > 10 ? 'improving' : throughputChange < -10 ? 'degrading' : 'stable',
    };
  }

  /**
   * Generate performance optimization recommendations
   * Analyzes current metrics and trends to provide actionable advice
   * @param metrics - Current performance metrics
   * @param trends - Performance trend indicators
   * @returns Array of optimization recommendations
   */
  private generateRecommendations(
    metrics: PerformanceMetrics,
    trends: Record<string, string>
  ): string[] {
    const recommendations: string[] = [];

    // Response time recommendations
    if (metrics.averageResponseTime > this.slowRequestThresholds.error) {
      recommendations.push('Consider implementing response caching for slow endpoints');
      recommendations.push('Review database query performance and add indexes if needed');
    } else if (metrics.averageResponseTime > this.slowRequestThresholds.warning) {
      recommendations.push('Monitor response times closely, consider optimization');
    }

    // Error rate recommendations
    if (metrics.errorCount > 0) {
      recommendations.push('Investigate and fix error endpoints to improve reliability');
    }

    // Memory usage recommendations
    if (metrics.memoryUsage.heapUsed > 100 * 1024 * 1024) {
      // 100MB threshold
      recommendations.push('High memory usage detected, consider memory optimization');
    }

    // Cache recommendations
    if (metrics.cacheHitRate < 0.7) {
      recommendations.push('Low cache hit rate, consider expanding cache coverage');
    }

    // Trend-based recommendations
    if (trends.responseTime === 'degrading') {
      recommendations.push('Response times are degrading, investigate recent changes');
    }

    if (trends.errorRate === 'degrading') {
      recommendations.push('Error rates are increasing, review error handling');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is stable, continue monitoring');
    }

    return recommendations;
  }
}
