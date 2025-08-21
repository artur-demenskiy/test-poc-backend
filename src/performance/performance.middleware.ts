import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PerformanceService, RequestMetrics } from './performance.service';

@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PerformanceMiddleware.name);

  constructor(private readonly performanceService: PerformanceService) {}

  /**
   * Middleware to capture request performance metrics
   */
  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    res.setHeader('X-Request-ID', requestId);
    this.logger.debug(`Request started: ${req.method} ${req.path} (ID: ${requestId})`);

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const metrics: RequestMetrics = {
        path: req.route?.path || req.path,
        method: req.method,
        duration,
        statusCode: res.statusCode,
        timestamp: new Date(),
        userId: undefined, // Simplified for now
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      // eslint-disable-next-line no-undef
      setImmediate(() => {
        try {
          this.performanceService.recordRequest(metrics);
        } catch (error) {
          this.logger.warn('Failed to record request metrics:', error);
        }
      });
    });

    next();
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
