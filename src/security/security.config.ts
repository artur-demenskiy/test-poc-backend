import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { seconds } from '@nestjs/throttler';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { AppConfigService } from '../config/config.service';

/**
 * Security configuration for the application
 */
export const securityConfig = {
  /**
   * Helmet configuration for security headers
   */
  helmet: {
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        styleSrc: [`'self'`, `'unsafe-inline'`],
        scriptSrc: [`'self'`, `'unsafe-inline'`],
        imgSrc: [`'self'`, 'data:', 'https:'],
        fontSrc: [`'self'`, 'https:', 'data:'],
        connectSrc: [`'self'`],
        frameSrc: [`'self'`],
        objectSrc: [`'none'`],
        upgradeInsecureRequests: [] as string[],
      },
    },
  },

  /**
   * CORS configuration
   */
  cors: (configService: AppConfigService): CorsOptions => ({
    origin: configService.allowedOrigins.length > 0 
      ? configService.allowedOrigins 
      : ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'X-Total-Count'],
    credentials: true,
    maxAge: 86400, // 24 hours
  }),

  /**
   * Rate limiting configuration
   */
  throttler: (): ThrottlerModuleOptions => ({
    throttlers: [
      {
        name: 'short',
        ttl: seconds(1),
        limit: 10,
      },
      {
        name: 'medium',
        ttl: seconds(10),
        limit: 50,
      },
      {
        name: 'long',
        ttl: seconds(60),
        limit: 100,
      },
    ],
    errorMessage: 'Too many requests, please try again later.',
    // Custom storage can be configured here if needed
    // storage: new RedisThrottlerStorage(),
  }),
}; 