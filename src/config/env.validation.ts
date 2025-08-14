import { z } from 'zod';

/**
 * Environment variables validation schema using Zod
 * This ensures all required environment variables are present and valid
 */
export const envValidationSchema = z.object({
  // Application Configuration
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(65535)),
  
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug', 'verbose'])
    .default('info'),

  // Security Configuration
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((val) => val?.split(',').map(origin => origin.trim()) || []),
});

/**
 * Environment variables type inference
 */
export type EnvironmentVariables = z.infer<typeof envValidationSchema>;

/**
 * Validate environment variables
 * @param config - Raw configuration object
 * @returns Validated configuration
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const result = envValidationSchema.safeParse(config);
  
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    throw new Error('Invalid environment variables');
  }
  
  return result.data;
} 