import { Module, Global } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { PerformanceInterceptor } from './performance.interceptor';
import { PerformanceMiddleware } from './performance.middleware';

@Global()
@Module({
  providers: [PerformanceService, PerformanceInterceptor, PerformanceMiddleware],
  exports: [PerformanceService, PerformanceInterceptor, PerformanceMiddleware],
})
export class PerformanceModule {}
