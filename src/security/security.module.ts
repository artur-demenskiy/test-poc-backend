import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { securityConfig } from './security.config';
import { ThrottlerBehindProxyGuard } from './throttler-behind-proxy.guard';

/**
 * Security module that provides global security features
 * - Rate limiting via ThrottlerModule
 * - Global ThrottlerBehindProxyGuard for all routes
 */
@Module({
  imports: [
    ThrottlerModule.forRoot(securityConfig.throttler()),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
  ],
})
export class SecurityModule {} 