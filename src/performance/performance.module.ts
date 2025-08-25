import { Module, Global } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { PerformanceInterceptor } from './performance.interceptor';
import { PerformanceMiddleware } from './performance.middleware';

/**
 * Global Performance Monitoring Module
 *
 * This module provides comprehensive performance monitoring capabilities:
 * - Real-time performance metrics collection
 * - Request timing and analysis
 * - Memory usage monitoring
 * - Performance trend analysis
 * - Automated performance recommendations
 *
 * Components:
 * - PerformanceService: Core metrics collection and analysis
 * - PerformanceInterceptor: HTTP request performance tracking
 * - PerformanceMiddleware: Request lifecycle monitoring
 *
 * Features:
 * - Automatic request timing measurement
 * - Slow request detection and alerting
 * - Memory usage tracking
 * - Performance trend calculation
 * - Export capabilities for external analysis
 *
 * Global Scope:
 * - Automatically applied to all HTTP requests
 * - Provides application-wide performance insights
 * - Enables centralized performance monitoring
 */
@Global()
@Module({
  providers: [
    PerformanceService, // Core performance monitoring service
    PerformanceInterceptor, // HTTP request performance interceptor
    PerformanceMiddleware, // Request lifecycle middleware
  ],
  exports: [
    PerformanceService, // Export for use in other modules
    PerformanceInterceptor, // Export for manual application
    PerformanceMiddleware, // Export for manual application
  ],
})
export class PerformanceModule {}
