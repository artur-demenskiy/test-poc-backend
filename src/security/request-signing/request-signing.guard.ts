import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestSigningService } from './request-signing.service';

export const REQUIRE_SIGNATURE = 'require_signature';
export const RequireSignature = () => SetMetadata(REQUIRE_SIGNATURE, true);

@Injectable()
export class RequestSigningGuard implements CanActivate {
  constructor(
    private readonly requestSigningService: RequestSigningService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireSignature = this.reflector.get<boolean>(REQUIRE_SIGNATURE, context.getHandler());

    if (!requireSignature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { method, path, body, headers } = request;

    // Extract signature headers
    const signature = headers['x-signature'];
    const timestamp = headers['x-timestamp'];
    const nonce = headers['x-nonce'];

    if (!signature || !timestamp || !nonce) {
      throw new UnauthorizedException('Missing signature headers');
    }

    // Convert body to string if it's an object
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body || '');

    // Verify signature
    const isValid = this.requestSigningService.verifySignature(method, path, bodyString, {
      signature,
      timestamp,
      nonce,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid request signature');
    }

    return true;
  }
}
