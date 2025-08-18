import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { securityConfig } from './security.config';
import { ThrottlerBehindProxyGuard } from './throttler-behind-proxy.guard';

// API Key Management
import { ApiKeyService } from './api-key/api-key.service';
import { ApiKeyGuard } from './api-key/api-key.guard';

// IP Whitelist
import { IpWhitelistService } from './ip-whitelist/ip-whitelist.service';
import { IpWhitelistGuard } from './ip-whitelist/ip-whitelist.guard';

// Request Signing
import { RequestSigningService } from './request-signing/request-signing.service';
import { RequestSigningGuard } from './request-signing/request-signing.guard';

// XSS Protection
import { XssProtectionService } from './xss-protection/xss-protection.service';

// Controllers
import { ApiKeyController } from './api-key/api-key.controller';
import { IpWhitelistController } from './ip-whitelist/ip-whitelist.controller';

/**
 * Advanced Security module that provides comprehensive security features
 * - Rate limiting via ThrottlerModule
 * - Global ThrottlerBehindProxyGuard for all routes
 * - API Key management and validation
 * - IP whitelist management
 * - Request signing for secure API calls
 * - XSS protection and content sanitization
 */
@Global()
@Module({
  imports: [ThrottlerModule.forRoot(securityConfig.throttler())],
  controllers: [ApiKeyController, IpWhitelistController],
  providers: [
    // Core security guards
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },

    // Security services
    ApiKeyService,
    IpWhitelistService,
    RequestSigningService,
    XssProtectionService,

    // Security guards
    ApiKeyGuard,
    IpWhitelistGuard,
    RequestSigningGuard,
  ],
  exports: [
    ApiKeyService,
    IpWhitelistService,
    RequestSigningService,
    XssProtectionService,
    ApiKeyGuard,
    IpWhitelistGuard,
    RequestSigningGuard,
  ],
})
export class SecurityModule {}
