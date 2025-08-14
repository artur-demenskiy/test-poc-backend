import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as rTracer from 'cls-rtracer';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const requestId = rTracer.id();

    // Log incoming request
    this.logger.log(`Incoming ${req.method} ${req.path} - Request ID: ${requestId}`);

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log response
      const logLevel = statusCode >= 400 ? 'error' : 'log';
      this.logger[logLevel](
        `${req.method} ${req.path} - ${statusCode} - ${duration}ms - Request ID: ${requestId}`
      );
    });

    next();
  }
}
