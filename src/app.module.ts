import { Module, MiddlewareConsumer, RequestMethod, ValidationPipe } from '@nestjs/common';
import { APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { AppConfigModule } from './config/config.module';
import { SecurityModule } from './security/security.module';
import { LoggingModule } from './logging/logging.module';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';

// New performance and caching modules
import { CachingModule } from './caching/caching.module';
import { BackgroundJobsModule } from './background-jobs/background-jobs.module';
import { ScheduledTasksModule } from './scheduled-tasks/scheduled-tasks.module';
import { CompressionModule } from './compression/compression.module';
import { PerformanceModule } from './performance/performance.module';

// Interceptors
import { CacheInterceptor } from './caching/cache.interceptor';
import { PerformanceInterceptor } from './performance/performance.interceptor';

@Module({
  imports: [
    AppConfigModule,
    SecurityModule,
    HealthModule,
    LoggingModule,
    CachingModule,
    BackgroundJobsModule,
    ScheduledTasksModule,
    CompressionModule,
    PerformanceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
