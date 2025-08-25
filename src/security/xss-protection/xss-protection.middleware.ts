import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { XssProtectionService } from './xss-protection.service';

@Injectable()
export class XssProtectionMiddleware implements NestMiddleware {
  constructor(private readonly xssProtectionService: XssProtectionService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    // Sanitize query parameters
    if (req.query) {
      this.sanitizeObject(req.query);
    }

    // Sanitize body parameters
    if (req.body) {
      this.sanitizeObject(req.body);
    }

    // Sanitize URL parameters
    if (req.params) {
      this.sanitizeObject(req.params);
    }

    next();
  }

  /**
   * Recursively sanitize object properties
   */
  private sanitizeObject(obj: Record<string, unknown>): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Check if content is potentially dangerous
        if (this.xssProtectionService.isPotentiallyDangerous(value)) {
          // Log potential XSS attempt
          // eslint-disable-next-line no-console
          console.warn(`Potential XSS attempt detected in ${key}:`, value);

          // Sanitize the content
          obj[key] = this.xssProtectionService.sanitizeText(value);
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        this.sanitizeObject(value as Record<string, unknown>);
      }
    }
  }
}
