import { Controller, Get, Post, Body, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { AppService } from './app.service';
import { ApiKeyGuard, RequireApiKeyScope } from './security/api-key/api-key.guard';
import { IpWhitelistGuard } from './security/ip-whitelist/ip-whitelist.guard';
import { RequireSignature } from './security/request-signing/request-signing.guard';
import { RequestSigningService } from './security/request-signing/request-signing.service';

/**
 * Main Application Controller
 *
 * This controller demonstrates the comprehensive security features implemented:
 * - Public endpoints with basic rate limiting
 * - Secure endpoints with multiple security layers
 * - API key authentication and scope-based access control
 * - IP whitelist validation for network-level security
 * - Request signing for integrity and authenticity verification
 *
 * Security Layers:
 * ├── Rate Limiting: Global throttling for all endpoints
 * ├── API Key Auth: Scope-based access control
 * ├── IP Whitelist: Network-level access restrictions
 * ├── Request Signing: HMAC-based request verification
 * └── XSS Protection: Content sanitization and validation
 *
 * Endpoint Security Levels:
 * - Public: Basic rate limiting only
 * - Secure: Full security stack (API key + IP + signature)
 */
@ApiTags('app')
@Controller()
export class AppController {
  constructor(
    private readonly _appService: AppService,
    @Inject('RequestSigningService') private readonly requestSigningService: RequestSigningService
  ) {}

  /**
   * Public hello endpoint
   * Basic endpoint with no authentication requirements
   *
   * @returns Simple hello message string
   *
   * Security: Basic rate limiting only
   * Access: Public (no authentication required)
   */
  @Get()
  @ApiOperation({ summary: 'Get hello message' })
  @ApiResponse({
    status: 200,
    description: 'Returns hello message',
    schema: {
      type: 'string',
      example: 'Hello World!',
    },
  })
  getHello(): string {
    return this._appService.getHello();
  }

  /**
   * High-security endpoint demonstrating all security features
   * Requires API key authentication, IP whitelist validation, and request signing
   *
   * @param _data - Request body data (processed securely)
   * @returns Secure operation result with timestamp and nonce
   *
   * Security Features:
   * - API Key: Requires 'secure:write' scope
   * - IP Whitelist: Client IP must be in allowed list
   * - Request Signing: HMAC signature verification required
   * - Rate Limiting: Global throttling applied
   *
   * Required Headers:
   * - X-API-Key: Valid API key with required scope
   * - X-Signature: HMAC signature of request
   * - X-Timestamp: Request timestamp for replay protection
   * - X-Nonce: Unique nonce for request uniqueness
   */
  @Post('secure-endpoint')
  @UseGuards(ApiKeyGuard, IpWhitelistGuard)
  @RequireApiKeyScope('secure', 'write')
  @RequireSignature()
  @ApiOperation({ summary: 'Secure endpoint requiring API key, IP whitelist, and request signing' })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key for authentication' })
  @ApiHeader({ name: 'X-Signature', description: 'Request signature' })
  @ApiHeader({ name: 'X-Timestamp', description: 'Request timestamp' })
  @ApiHeader({ name: 'X-Nonce', description: 'Unique request nonce' })
  @ApiResponse({
    status: 200,
    description: 'Secure operation completed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        timestamp: { type: 'string' },
        nonce: { type: 'string' },
      },
    },
  })
  async secureEndpoint(@Body() _data: Record<string, unknown>) {
    // This endpoint demonstrates all security features working together
    const timestamp = this.requestSigningService.generateTimestamp();
    const nonce = this.requestSigningService.generateNonce();

    return {
      message: 'Secure operation completed successfully',
      timestamp,
      nonce,
      data: 'Processed securely',
    };
  }

  /**
   * Public endpoint with basic security
   * Accessible without authentication but protected by rate limiting
   *
   * @returns Public message with current timestamp
   *
   * Security: Basic rate limiting only
   * Access: Public (no authentication required)
   * Use Case: Public APIs, health checks, status endpoints
   */
  @Get('public-endpoint')
  @ApiOperation({ summary: 'Public endpoint with basic rate limiting only' })
  @ApiResponse({
    status: 200,
    description: 'Public endpoint accessible without authentication',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
  })
  getPublicEndpoint() {
    return {
      message: 'This is a public endpoint with basic rate limiting',
      timestamp: new Date().toISOString(),
    };
  }
}
