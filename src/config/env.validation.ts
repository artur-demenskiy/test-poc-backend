// import { z } from 'zod';

/**
 * Environment variables validation schema using Zod
 * This ensures all required environment variables are present and valid
 */
export const envValidationSchema = {
  // Application Configuration
  PORT: {
    default: '3000',
    transform: (val: any) => parseInt(val, 10),
    pipe: (val: any) => Math.min(Math.max(val, 1), 65535),
  },

  NODE_ENV: {
    default: 'development',
    enum: ['development', 'production', 'test'],
  },

  LOG_LEVEL: {
    default: 'info',
    enum: ['error', 'warn', 'info', 'debug', 'verbose'],
  },

  // Security Configuration
  ALLOWED_ORIGINS: {
    optional: true,
    transform: (val: any) => val?.split(',').map((origin: any) => origin.trim()) || [],
  },
};

/**
 * Environment variables type inference
 */
export type EnvironmentVariables = {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  ALLOWED_ORIGINS?: string[];
};

/**
 * Validate environment variables
 * @param config - Raw configuration object
 * @returns Validated configuration
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  // Simplified validation without Zod
  const portStr = (config.PORT as string) || '3000';
  const port = parseInt(portStr, 10);
  const nodeEnv = (config.NODE_ENV as string) || 'development';
  const logLevel = (config.LOG_LEVEL as string) || 'info';
  const allowedOrigins = (config.ALLOWED_ORIGINS as string) || '';

  // Check if port is a valid number
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('Invalid environment variables');
  }

  // Check if nodeEnv is valid (only if provided)
  if (config.NODE_ENV !== undefined && !['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error('Invalid environment variables');
  }

  // Check if logLevel is valid (only if provided)
  if (
    config.LOG_LEVEL !== undefined &&
    !['error', 'warn', 'info', 'debug', 'verbose'].includes(logLevel)
  ) {
    throw new Error('Invalid environment variables');
  }

  return {
    PORT: port,
    NODE_ENV: nodeEnv as 'development' | 'production' | 'test',
    LOG_LEVEL: logLevel as 'error' | 'warn' | 'info' | 'debug' | 'verbose',
    ALLOWED_ORIGINS: allowedOrigins ? allowedOrigins.split(',').map(origin => origin.trim()) : [],
  };
}
