import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { IpWhitelistService } from './ip-whitelist.service';

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  constructor(private readonly ipWhitelistService: IpWhitelistService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const clientIp = this.extractClientIp(request);

    const isWhitelisted = await this.ipWhitelistService.isIpWhitelisted(clientIp);

    if (!isWhitelisted) {
      throw new ForbiddenException('Access denied: IP address not whitelisted');
    }

    return true;
  }

  private extractClientIp(request: {
    headers: Record<string, string | undefined>;
    connection?: { remoteAddress?: string };
    socket?: { remoteAddress?: string };
    ip?: string;
  }): string {
    // Check for forwarded headers (when behind proxy)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      // Take the first IP in the chain
      return forwardedFor.split(',')[0].trim();
    }

    // Check for real IP header
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return realIp;
    }

    // Fallback to connection remote address
    return (
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      '127.0.0.1'
    );
  }
}
