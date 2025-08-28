import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from './monitoring.service';

/**
 * Middleware for collecting HTTP metrics
 *
 * Automatically collects metrics for all HTTP requests:
 * - Number of requests by methods, routes and status codes
 * - Request execution time
 * - Error counter
 *
 * Applied globally to all application routes
 * for automatic monitoring without changing business logic
 */
@Injectable()
export class MonitoringMiddleware implements NestMiddleware {
  constructor(private readonly monitoringService: MonitoringService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    // Get basic request information
    const method = req.method;
    const originalUrl = req.originalUrl || req.url;

    // Normalize route for metrics (remove query parameters and ID)
    const route = this.normalizeRoute(originalUrl);

    // Intercept response completion
    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000; // convert to seconds
      const statusCode = res.statusCode;

      // Record metrics
      this.monitoringService.incrementHttpRequests(method, route, statusCode);
      this.monitoringService.recordHttpRequestDuration(method, route, statusCode, duration);

      // Record errors for status codes >= 400
      if (statusCode >= 400) {
        const errorType = this.getErrorType(statusCode);
        this.monitoringService.incrementApplicationErrors(errorType, route);
      }
    });

    next();
  }

  /**
   * Normalizes route for metrics
   *
   * Removes query parameters and replaces numeric IDs with placeholders
   * to reduce metrics cardinality
   *
   * @param url Original URL
   * @returns Normalized route
   */
  private normalizeRoute(url: string): string {
    // Remove query parameters
    const pathWithoutQuery = url.split('?')[0];

    // Replace numeric IDs with placeholders to reduce cardinality
    const normalizedPath = pathWithoutQuery
      .replace(/\/\d+/g, '/:id') // /users/123 -> /users/:id
      .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '/:uuid'); // UUID -> :uuid

    return normalizedPath || '/';
  }

  /**
   * Determines error type by status code
   *
   * @param statusCode HTTP status code
   * @returns Error type for metrics
   */
  private getErrorType(statusCode: number): string {
    if (statusCode >= 400 && statusCode < 500) {
      return 'client_error';
    }
    if (statusCode >= 500) {
      return 'server_error';
    }
    return 'unknown_error';
  }
}
