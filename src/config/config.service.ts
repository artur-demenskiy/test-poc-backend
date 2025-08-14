import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './env.validation';

/**
 * Typed configuration service that provides safe access to environment variables
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly configService: NestConfigService<EnvironmentVariables, true>) {}

  /**
   * Get application port
   */
  get port(): number {
    const port = this.configService.get('PORT', { infer: true });
    if (port === undefined) {
      throw new Error('PORT environment variable is not set');
    }
    return port;
  }

  /**
   * Get current environment
   */
  get nodeEnv(): string {
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
    if (nodeEnv === undefined) {
      throw new Error('NODE_ENV environment variable is not set');
    }
    return nodeEnv;
  }

  /**
   * Get log level
   */
  get logLevel(): string {
    const logLevel = this.configService.get('LOG_LEVEL', { infer: true });
    if (logLevel === undefined) {
      throw new Error('LOG_LEVEL environment variable is not set');
    }
    return logLevel;
  }

  /**
   * Get allowed origins for CORS
   */
  get allowedOrigins(): string[] {
    return this.configService.get('ALLOWED_ORIGINS', { infer: true }) || [];
  }

  /**
   * Check if current environment is production
   */
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  /**
   * Check if current environment is development
   */
  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  /**
   * Check if current environment is test
   */
  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  /**
   * Get generic configuration value with type inference
   */
  get<T = string>(key: keyof EnvironmentVariables, defaultValue?: T): T {
    const value = this.configService.get(key, defaultValue);
    return value ?? defaultValue;
  }
}
