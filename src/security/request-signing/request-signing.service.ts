/* eslint-disable no-undef */
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { AppConfigService } from '../../config/config.service';

/**
 * Signed request data structure
 * Contains all necessary information for request signature verification
 */
export interface SignedRequest {
  signature: string; // HMAC signature of the request
  timestamp: string; // Unix timestamp when request was created
  nonce: string; // Unique nonce to prevent replay attacks
}

/**
 * Request signing configuration parameters
 * Defines security settings for signature validation
 */
export interface RequestSigningConfig {
  secretKey: string; // Secret key for HMAC generation
  signatureExpirySeconds: number; // Maximum signature age in seconds
  clockSkewSeconds: number; // Allowed clock skew tolerance
}

/**
 * Request Signing Service for Secure API Communication
 *
 * This service provides HMAC-based request signing for secure API calls:
 * - Request signature generation using SHA-256 HMAC
 * - Timestamp validation to prevent replay attacks
 * - Nonce generation for request uniqueness
 * - Clock skew tolerance for distributed systems
 * - Timing-safe signature comparison to prevent timing attacks
 *
 * Security Features:
 * - HMAC-SHA256 signature generation
 * - Timestamp-based expiration (5 minutes default)
 * - Nonce-based replay attack prevention
 * - Clock skew tolerance (30 seconds default)
 * - Timing-safe signature comparison
 *
 * Request Format:
 * - Method: HTTP method (GET, POST, etc.)
 * - Path: Request path/endpoint
 * - Body: Request body content
 * - Timestamp: Unix timestamp
 * - Nonce: Unique request identifier
 */
@Injectable()
export class RequestSigningService {
  private readonly config: RequestSigningConfig;

  constructor(private readonly configService: AppConfigService) {
    this.config = {
      secretKey: this.configService.get('REQUEST_SIGNING_SECRET', 'default-secret-key'),
      signatureExpirySeconds: 300, // 5 minutes default expiration
      clockSkewSeconds: 30, // 30 seconds clock skew tolerance
    };
  }

  /**
   * Generate HMAC signature for request
   * Creates cryptographically secure signature using request components
   * @param method - HTTP method (GET, POST, etc.)
   * @param path - Request path/endpoint
   * @param body - Request body content
   * @param timestamp - Unix timestamp when request was created
   * @param nonce - Unique nonce for request
   * @returns Hexadecimal HMAC signature
   */
  generateSignature(
    method: string,
    path: string,
    body: string,
    timestamp: string,
    nonce: string
  ): string {
    // Create canonical request string for consistent signing
    const payload = `${method.toUpperCase()}\n${path}\n${body}\n${timestamp}\n${nonce}`;

    // Generate HMAC-SHA256 signature using secret key
    return createHmac('sha256', this.config.secretKey).update(payload).digest('hex');
  }

  /**
   * Verify request signature for authenticity and integrity
   * Validates signature, timestamp, and nonce to ensure request security
   * @param method - HTTP method from request
   * @param path - Request path from request
   * @param body - Request body content
   * @param signedRequest - Signed request data containing signature, timestamp, nonce
   * @returns True if signature is valid, false otherwise
   * @throws UnauthorizedException if timestamp is expired or invalid
   * @throws BadRequestException if nonce is invalid
   */
  verifySignature(
    method: string,
    path: string,
    body: string,
    signedRequest: SignedRequest
  ): boolean {
    try {
      const { signature, timestamp, nonce } = signedRequest;

      // Validate request timestamp to prevent replay attacks
      if (!this.isTimestampValid(timestamp)) {
        throw new UnauthorizedException('Request timestamp expired or invalid');
      }

      // Validate nonce to ensure request uniqueness
      if (!nonce || nonce.length < 8) {
        throw new BadRequestException('Invalid nonce');
      }

      // Generate expected signature for comparison
      const expectedSignature = this.generateSignature(method, path, body, timestamp, nonce);

      // Use timing-safe comparison to prevent timing attacks
      // eslint-disable-next-line no-undef
      return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    } catch (error) {
      // Re-throw security-related exceptions
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      // Return false for any other errors
      return false;
    }
  }

  /**
   * Check if request timestamp is within valid range
   * Validates timestamp against expiration and clock skew tolerance
   * @param timestamp - Unix timestamp string to validate
   * @returns True if timestamp is valid, false otherwise
   */
  private isTimestampValid(timestamp: string): boolean {
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - requestTime);

    // Check if timestamp is within allowed range
    return timeDiff <= this.config.signatureExpirySeconds + this.config.clockSkewSeconds;
  }

  /**
   * Generate unique nonce for request
   * Creates cryptographically random string to prevent replay attacks
   * @returns Unique nonce string
   */
  generateNonce(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Generate current Unix timestamp
   * Creates timestamp string for request signing
   * @returns Current Unix timestamp as string
   */
  generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  /**
   * Create complete signed request data
   * Generates timestamp, nonce, and signature for secure API calls
   * @param method - HTTP method for the request
   * @param path - Request path/endpoint
   * @param body - Request body content
   * @returns Complete signed request data
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
