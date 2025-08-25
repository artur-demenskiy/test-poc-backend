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
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(1).max(65535)),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),

  // Security Configuration
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform(val => val?.split(',').map(origin => origin.trim()) || []),

  REQUEST_SIGNING_SECRET: z.string().default('default-secret-key-change-in-production'),
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
    // eslint-disable-next-line no-console
    console.error('❌ Invalid environment variables:');
    // eslint-disable-next-line no-console
    console.error(result.error.format());
    throw new Error('Invalid environment variables');
  }

  return result.data;
}
