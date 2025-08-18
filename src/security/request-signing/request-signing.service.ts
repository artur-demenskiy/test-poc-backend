/* eslint-disable no-undef */
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { AppConfigService } from '../../config/config.service';

export interface SignedRequest {
  signature: string;
  timestamp: string;
  nonce: string;
}

export interface RequestSigningConfig {
  secretKey: string;
  signatureExpirySeconds: number;
  clockSkewSeconds: number;
}

@Injectable()
export class RequestSigningService {
  private readonly config: RequestSigningConfig;

  constructor(private readonly configService: AppConfigService) {
    this.config = {
      secretKey: this.configService.get('REQUEST_SIGNING_SECRET', 'default-secret-key'),
      signatureExpirySeconds: 300, // 5 minutes
      clockSkewSeconds: 30, // 30 seconds
    };
  }

  /**
   * Generate signature for request
   */
  generateSignature(
    method: string,
    path: string,
    body: string,
    timestamp: string,
    nonce: string
  ): string {
    const payload = `${method.toUpperCase()}\n${path}\n${body}\n${timestamp}\n${nonce}`;
    return createHmac('sha256', this.config.secretKey).update(payload).digest('hex');
  }

  /**
   * Verify request signature
   */
  verifySignature(
    method: string,
    path: string,
    body: string,
    signedRequest: SignedRequest
  ): boolean {
    try {
      const { signature, timestamp, nonce } = signedRequest;

      // Validate timestamp
      if (!this.isTimestampValid(timestamp)) {
        throw new UnauthorizedException('Request timestamp expired or invalid');
      }

      // Validate nonce (should be unique per request)
      if (!nonce || nonce.length < 8) {
        throw new BadRequestException('Invalid nonce');
      }

      // Generate expected signature
      const expectedSignature = this.generateSignature(method, path, body, timestamp, nonce);

      // Use timing-safe comparison to prevent timing attacks
      // eslint-disable-next-line no-undef
      return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      return false;
    }
  }

  /**
   * Check if timestamp is within valid range
   */
  private isTimestampValid(timestamp: string): boolean {
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - requestTime);

    return timeDiff <= this.config.signatureExpirySeconds + this.config.clockSkewSeconds;
  }

  /**
   * Generate nonce for request
   */
  generateNonce(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Generate timestamp for request
   */
  generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  /**
   * Create signed request data
   */
  createSignedRequest(method: string, path: string, body: string): SignedRequest {
    const timestamp = this.generateTimestamp();
    const nonce = this.generateNonce();
    const signature = this.generateSignature(method, path, body, timestamp, nonce);

    return {
      signature,
      timestamp,
      nonce,
    };
  }
}
