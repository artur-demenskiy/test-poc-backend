import { Module, MiddlewareConsumer, RequestMethod, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { AppConfigModule } from './config/config.module';
import { SecurityModule } from './security/security.module';
import { LoggingModule } from './logging/logging.module';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';
import { RealtimeModule } from './realtime/realtime.module';

/**
 * Root application module for the NestJS application
 *
 * This module serves as the entry point and orchestrates all other modules:
 * - ConfigModule: Environment configuration and validation
 * - HealthModule: Health checks and monitoring endpoints
 * - DatabaseModule: Database connection and migrations
 * - LoggingModule: Centralized logging configuration
 * - SecurityModule: Security middleware and rate limiting
 * - RealtimeModule: Real-time communication capabilities
 *
 * The RealtimeModule provides:
 * - WebSocket Gateway for bidirectional real-time communication
 * - Server-Sent Events for unidirectional streaming
 * - Room-based chat system with authentication
 * - Comprehensive HTTP API for administrative operations
 */
@Module({
  imports: [
    // Configuration and environment management
    AppConfigModule,

    // Core application modules
    HealthModule, // Health checks and monitoring
    SecurityModule, // Security middleware and rate limiting
    LoggingModule, // Centralized logging configuration

    // Real-time communication module
    RealtimeModule, // WebSocket, SSE, and real-time messaging capabilities
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
