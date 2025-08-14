import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';

interface RequestWithIPs {
  ips?: string[];
  ip: string;
}

/**
 * Custom ThrottlerGuard that works correctly behind a proxy
 * Extracts the real client IP from X-Forwarded-For header
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  /**
   * Override getTracker to extract real client IP when behind proxy
   */
  protected async getTracker(req: RequestWithIPs): Promise<string> {
    // Check if we have forwarded IPs (when behind proxy)
    if (req.ips && req.ips.length > 0) {
      return req.ips[0];
    }

    // Fallback to regular IP
    return req.ip;
  }
}
