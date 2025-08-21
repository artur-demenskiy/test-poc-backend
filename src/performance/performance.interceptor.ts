import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PerformanceService, RequestMetrics } from './performance.service';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  constructor(private readonly performanceService: PerformanceService) {}

  /**
   * Intercept method to measure performance
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(_data => {
        const duration = Date.now() - startTime;
        const metrics: RequestMetrics = {
          path: request.route?.path || request.path,
          method: request.method,
          duration,
          statusCode: response.statusCode,
          timestamp: new Date(),
          userId: undefined, // Simplified for now
          ip: request.ip || request.connection?.remoteAddress,
          userAgent: request.headers['user-agent'],
        };

        this.performanceService.recordRequest(metrics);
      }),
      catchError(error => {
        const duration = Date.now() - startTime;
        const metrics: RequestMetrics = {
          path: request.route?.path || request.path,
          method: request.method,
          duration,
          statusCode: 500,
          timestamp: new Date(),
          userId: undefined, // Simplified for now
          ip: request.ip || request.connection?.remoteAddress,
          userAgent: request.headers['user-agent'],
        };

        this.performanceService.recordRequest(metrics);
        throw error;
      })
    );
  }
}
