import { Injectable, Logger } from '@nestjs/common';
import { CachingService } from '../caching/caching.service';

export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  slowRequests: number;
  errorCount: number;
  cacheHitRate: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  uptime: number;
  timestamp: Date;
}

export interface RequestMetrics {
  path: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: Date;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

export interface SlowRequestThresholds {
  warning: number;
  error: number;
  critical: number;
}

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);
  private readonly requestMetrics: RequestMetrics[] = [];
  private readonly slowRequestThresholds: SlowRequestThresholds = {
    warning: 1000,
    error: 3000,
    critical: 10000,
  };

  constructor(private readonly cachingService: CachingService) {}

  /**
   * Record request metrics
   */
  recordRequest(metrics: RequestMetrics): void {
    this.requestMetrics.push(metrics);

    // Keep only recent metrics (last 10,000 requests)
    if (this.requestMetrics.length > 10000) {
      this.requestMetrics.splice(0, this.requestMetrics.length - 10000);
    }

    // Check for slow requests
    this.checkSlowRequest(metrics);
  }

  /**
   * Get current performance metrics
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

    const totalDuration = recentMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    const averageResponseTime = totalDuration / recentMetrics.length;
    const slowRequests = recentMetrics.filter(
      metric => metric.duration > this.slowRequestThresholds.warning
    ).length;
    const errorCount = recentMetrics.filter(metric => metric.statusCode >= 400).length;

    // Calculate cache hit rate (simplified - you might want to implement actual cache hit tracking)
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
   * Get metrics for a specific time range
   */
  getMetricsForTimeRange(startTime: Date, endTime: Date): RequestMetrics[] {
    return this.requestMetrics.filter(
      metric => metric.timestamp >= startTime && metric.timestamp <= endTime
    );
  }

  /**
   * Get metrics for a specific endpoint
   */
  getMetricsForEndpoint(path: string, method?: string): RequestMetrics[] {
    return this.requestMetrics.filter(metric => {
      if (method && metric.method !== method) return false;
      return metric.path === path;
    });
  }

  /**
   * Get slow requests above threshold
   */
  getSlowRequests(threshold?: number): RequestMetrics[] {
    const actualThreshold = threshold || this.slowRequestThresholds.warning;
    return this.requestMetrics.filter(metric => metric.duration > actualThreshold);
  }

  /**
   * Get error requests
   */
  getErrorRequests(): RequestMetrics[] {
    return this.requestMetrics.filter(metric => metric.statusCode >= 400);
  }

  /**
   * Get performance summary with trends and recommendations
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
   * Set slow request thresholds
   */
  setSlowRequestThresholds(thresholds: Partial<SlowRequestThresholds>): void {
    Object.assign(this.slowRequestThresholds, thresholds);
    this.logger.log(
      `Slow request thresholds updated: ${JSON.stringify(this.slowRequestThresholds)}`
    );
  }

  /**
   * Get current slow request thresholds
   */
  getSlowRequestThresholds(): SlowRequestThresholds {
    return { ...this.slowRequestThresholds };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.requestMetrics.length = 0;
    this.logger.log('All performance metrics cleared');
  }

  /**
   * Export metrics as JSON string
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
   * Check if request is slow and log warning
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
   * Get recent metrics within time window
   */
  private getRecentMetrics(timeWindowMs: number): RequestMetrics[] {
    const cutoffTime = Date.now() - timeWindowMs;
    return this.requestMetrics.filter(metric => metric.timestamp.getTime() > cutoffTime);
  }

  /**
   * Calculate performance trends
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

    const recentAvgResponseTime =
      recentMetrics.reduce((sum, metric) => sum + metric.duration, 0) / recentMetrics.length;
    const previousAvgResponseTime =
      previousMetrics.reduce((sum, metric) => sum + metric.duration, 0) / previousMetrics.length;
    const responseTimeChange = recentAvgResponseTime - previousAvgResponseTime;

    const recentErrorRate =
      recentMetrics.filter(metric => metric.statusCode >= 400).length / recentMetrics.length;
    const previousErrorRate =
      previousMetrics.filter(metric => metric.statusCode >= 400).length / previousMetrics.length;
    const errorRateChange = recentErrorRate - previousErrorRate;

    const recentThroughput = recentMetrics.length / 5; // requests per minute
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
   * Generate performance recommendations
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
      // 100MB
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
