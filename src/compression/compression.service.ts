import { Injectable } from '@nestjs/common';
import * as compression from 'compression';
import { Request, Response } from 'express';

export interface CompressionOptions {
  level?: number;
  threshold?: number;
  filter?: (req: Request, res: Response) => boolean;
  dictionary?: Uint8Array | string;
}

@Injectable()
export class CompressionService {
  private readonly defaultLevel = 6;
  private readonly defaultThreshold = 1024;
  private readonly supportedAlgorithms = ['gzip', 'deflate', 'br'];

  /**
   * Get compression middleware with custom options
   */
  getMiddleware(options: CompressionOptions = {}): ReturnType<typeof compression> {
    return compression({
      level: options.level || this.defaultLevel,
      threshold: options.threshold || this.defaultThreshold,
      filter: options.filter || this.defaultFilter,
      dictionary: options.dictionary,
    });
  }

  /**
   * Get compression middleware optimized for API responses
   */
  getApiCompressionMiddleware(): ReturnType<typeof compression> {
    return compression({
      level: this.defaultLevel,
      threshold: this.defaultThreshold,
      filter: this.apiFilter,
    });
  }

  /**
   * Get compression middleware optimized for static files
   */
  getStaticFileCompressionMiddleware(): ReturnType<typeof compression> {
    return compression({
      level: this.defaultLevel,
      threshold: this.defaultThreshold,
      filter: this.staticFileFilter,
    });
  }

  /**
   * Get compression middleware optimized for HTML content
   */
  getHtmlCompressionMiddleware(): ReturnType<typeof compression> {
    return compression({
      level: this.defaultLevel,
      threshold: this.defaultThreshold,
      filter: this.htmlFilter,
    });
  }

  /**
   * Default filter for compression
   */
  private defaultFilter(req: Request, res: Response): boolean {
    // Don't compress if request doesn't accept compression
    if (req.headers['accept-encoding'] === undefined) {
      return false;
    }

    // Don't compress if response is already compressed
    if (res.getHeader('content-encoding')) {
      return false;
    }

    // Don't compress if response is too small
    const contentLength = res.getHeader('content-length');
    if (contentLength && parseInt(contentLength as string, 10) < this.defaultThreshold) {
      return false;
    }

    // Don't compress if response is a redirect
    if (res.statusCode >= 300 && res.statusCode < 400) {
      return false;
    }

    return true;
  }

  /**
   * Filter for API responses
   */
  private apiFilter(req: Request, res: Response): boolean {
    // Only compress JSON and text responses
    const contentType = res.getHeader('content-type') as string;
    if (
      !contentType ||
      (!contentType.includes('application/json') && !contentType.includes('text/'))
    ) {
      return false;
    }

    return this.defaultFilter(req, res);
  }

  /**
   * Filter for static files
   */
  private staticFileFilter(req: Request, res: Response): boolean {
    // Compress all static files
    const path = req.path;
    if (path.includes('.') && !path.includes('..')) {
      return this.defaultFilter(req, res);
    }

    return false;
  }

  /**
   * Filter for HTML content
   */
  private htmlFilter(req: Request, res: Response): boolean {
    // Only compress HTML responses
    const contentType = res.getHeader('content-type') as string;
    if (!contentType || !contentType.includes('text/html')) {
      return false;
    }

    return this.defaultFilter(req, res);
  }

  /**
   * Get compression statistics
   */
  getCompressionStats(): {
    enabled: boolean;
    defaultLevel: number;
    defaultThreshold: number;
    supportedAlgorithms: string[];
  } {
    return {
      enabled: true,
      defaultLevel: this.defaultLevel,
      defaultThreshold: this.defaultThreshold,
      supportedAlgorithms: this.supportedAlgorithms,
    };
  }

  /**
   * Check if compression is supported
   */
  isSupported(): boolean {
    try {
      // Test if compression module is available
      return typeof compression === 'function';
    } catch {
      return false;
    }
  }
}
