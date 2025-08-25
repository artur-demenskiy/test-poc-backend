import { Module, MiddlewareConsumer, RequestMethod, ValidationPipe } from '@nestjs/common';
import { APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { AppConfigModule } from './config/config.module';
import { SecurityModule } from './security/security.module';
import { LoggingModule } from './logging/logging.module';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';

// Performance and caching modules for enhanced application capabilities
import { CachingModule } from './caching/caching.module';
import { BackgroundJobsModule } from './background-jobs/background-jobs.module';
import { ScheduledTasksModule } from './scheduled-tasks/scheduled-tasks.module';
import { CompressionModule } from './compression/compression.module';
import { PerformanceModule } from './performance/performance.module';

// Global interceptors for application-wide functionality
import { CacheInterceptor } from './caching/cache.interceptor';
import { PerformanceInterceptor } from './performance/performance.interceptor';

/**
 * Root Application Module - Main orchestrator for the NestJS application
 *
 * This module serves as the entry point and coordinates all other modules:
 * - Core modules: Configuration, security, health, and logging
 * - Performance modules: Caching, background jobs, scheduled tasks, compression
 * - Global interceptors: Automatic caching and performance monitoring
 * - Middleware: Request logging and processing
 *
 * Architecture Overview:
 * ├── AppConfigModule: Environment configuration and validation
 * ├── SecurityModule: Security middleware and rate limiting
 * ├── HealthModule: Health checks and monitoring endpoints
 * ├── LoggingModule: Centralized logging configuration
 * ├── CachingModule: Multi-level caching with Redis support
 * ├── BackgroundJobsModule: Distributed task processing with Bull queues
 * ├── ScheduledTasksModule: Automated maintenance and monitoring tasks
 * ├── CompressionModule: HTTP response compression for performance
 * └── PerformanceModule: Real-time performance monitoring and metrics
 *
 * Global Features:
 * - Automatic request validation with ValidationPipe
 * - Performance monitoring for all HTTP requests
 * - Intelligent response caching for improved performance
 * - Request logging for debugging and monitoring
 */
@Module({
  imports: [
    // Core application modules
    AppConfigModule, // Environment configuration and validation
    SecurityModule, // Security middleware and rate limiting
    HealthModule, // Health checks and monitoring
    LoggingModule, // Centralized logging configuration

    // Performance and caching modules
    CachingModule, // Multi-level caching with Redis support
    BackgroundJobsModule, // Background job processing with Bull queues
    ScheduledTasksModule, // Automated maintenance and monitoring
    CompressionModule, // HTTP response compression
    PerformanceModule, // Real-time performance monitoring
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // Global validation pipe for automatic request validation
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },

    // Global performance interceptor for automatic request monitoring
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },

    // Global cache interceptor for automatic response caching
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class AppModule {
  /**
   * Configure global middleware for the application
   * Applies request logging middleware to all routes
   * @param consumer - Middleware consumer for applying middleware
   */
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
