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
 * Advanced Security Module - Comprehensive security framework for NestJS applications
 *
 * This module provides enterprise-grade security features including:
 * - Rate limiting and DDoS protection via ThrottlerModule
 * - API key management with scope-based access control
 * - IP whitelist management with CIDR block support
 * - Request signing for secure API communication
 * - XSS protection and content sanitization
 * - Global security guards for all application routes
 *
 * Security Features:
 * ├── Rate Limiting: Configurable throttling with proxy support
 * ├── API Key Management: Secure key generation and scope validation
 * ├── IP Whitelist: Network-level access control with expiration
 * ├── Request Signing: HMAC-based request verification
 * ├── XSS Protection: HTML sanitization and content validation
 * └── Global Guards: Automatic security enforcement across all endpoints
 *
 * Configuration:
 * - Global scope for application-wide security enforcement
 * - Configurable rate limiting thresholds
 * - Flexible security policy management
 * - Comprehensive logging and monitoring
 */
@Global()
@Module({
  imports: [
    // Rate limiting configuration with security settings
    ThrottlerModule.forRoot(securityConfig.throttler()),
  ],
  controllers: [
    ApiKeyController, // API key management endpoints
    IpWhitelistController, // IP whitelist management endpoints
  ],
  providers: [
    // Global rate limiting guard for all routes
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },

    // Core security services
    ApiKeyService, // API key generation and validation
    IpWhitelistService, // IP address whitelist management
    RequestSigningService, // Request signature verification
    XssProtectionService, // XSS protection and content sanitization

    // Security guards for route protection
    ApiKeyGuard, // API key authentication guard
    IpWhitelistGuard, // IP whitelist validation guard
    RequestSigningGuard, // Request signature validation guard
  ],
  exports: [
    // Export services for use in other modules
    ApiKeyService, // Allow other modules to manage API keys
    IpWhitelistService, // Allow other modules to check IP whitelist
    RequestSigningService, // Allow other modules to verify signatures
    XssProtectionService, // Allow other modules to sanitize content

    // Export guards for manual application
    ApiKeyGuard, // Manual API key protection
    IpWhitelistGuard, // Manual IP whitelist protection
    RequestSigningGuard, // Manual request signing protection
  ],
})
export class SecurityModule {}
