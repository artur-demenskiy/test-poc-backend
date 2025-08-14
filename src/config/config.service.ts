import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './env.validation';

/**
 * Typed configuration service that provides safe access to environment variables
 */
@Injectable()
export class AppConfigService {
  constructor(
    private readonly configService: NestConfigService<EnvironmentVariables, true>
  ) {}

  /**
   * Get application port
   */
  get port(): number {
    return this.configService.get('PORT', { infer: true })!;
  }

  /**
   * Get current environment
   */
  get nodeEnv(): string {
    return this.configService.get('NODE_ENV', { infer: true })!;
  }

  /**
   * Get log level
   */
  get logLevel(): string {
    return this.configService.get('LOG_LEVEL', { infer: true })!;
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