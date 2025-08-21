import { z } from 'z';

export const envValidationSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('3000'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Database
  DATABASE_URL: z.string().optional(),
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('5432'),
  DATABASE_NAME: z.string().default('nestjs_boilerplate'),
  DATABASE_USER: z.string().default('postgres'),
  DATABASE_PASSWORD: z.string().default('postgres'),

  // CORS
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform(val => (val ? val.split(',') : [])),

  // Security
  REQUEST_SIGNING_SECRET: z.string().optional(),

  // Redis (for caching and background jobs)
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('0'),

  // Performance
  CACHE_TTL: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('3600'),
  CACHE_MAX_KEYS: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('1000'),
  COMPRESSION_LEVEL: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('6'),
  COMPRESSION_THRESHOLD: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('1024'),

  // Background Jobs
  QUEUE_MAX_ATTEMPTS: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('3'),
  QUEUE_BACKOFF_DELAY: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('2000'),
  QUEUE_CLEANUP_GRACE: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('86400000'),

  // Scheduled Tasks
  TASK_CACHE_CLEANUP_CRON: z.string().default('0 2 * * *'),
  TASK_DB_MAINTENANCE_CRON: z.string().default('0 3 * * 0'),
  TASK_HEALTH_CHECK_CRON: z.string().default('*/5 * * * *'),
  TASK_METRICS_COLLECTION_CRON: z.string().default('* * * * *'),

  // Performance Monitoring
  PERFORMANCE_SLOW_REQUEST_WARNING: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('1000'),
  PERFORMANCE_SLOW_REQUEST_ERROR: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('3000'),
  PERFORMANCE_SLOW_REQUEST_CRITICAL: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('10000'),
  PERFORMANCE_METRICS_HISTORY_SIZE: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('10000'),
});

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
