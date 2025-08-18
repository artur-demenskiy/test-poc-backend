import { Controller, Get, Post, Body, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { AppService } from './app.service';
import { ApiKeyGuard, RequireApiKeyScope } from './security/api-key/api-key.guard';
import { IpWhitelistGuard } from './security/ip-whitelist/ip-whitelist.guard';
import { RequireSignature } from './security/request-signing/request-signing.guard';
import { RequestSigningService } from './security/request-signing/request-signing.service';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(
    private readonly _appService: AppService,
    @Inject('RequestSigningService') private readonly requestSigningService: RequestSigningService
  ) {}

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
