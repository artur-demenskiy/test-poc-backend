import { envValidationSchema, validateEnv, EnvironmentVariables } from './env.validation';

describe('Environment Validation', () => {
  describe('envValidationSchema', () => {
    it('should validate correct environment variables', () => {
      const validEnv = {
        PORT: '3000',
        NODE_ENV: 'development',
        LOG_LEVEL: 'info',
      };

      const result = envValidationSchema.safeParse(validEnv);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.PORT).toBe(3000);
        expect(result.data.NODE_ENV).toBe('development');
        expect(result.data.LOG_LEVEL).toBe('info');
      }
    });

    it('should use default values when environment variables are missing', () => {
      const envWithDefaults = {};

      const result = envValidationSchema.safeParse(envWithDefaults);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.PORT).toBe(3000);
        expect(result.data.NODE_ENV).toBe('development');
        expect(result.data.LOG_LEVEL).toBe('info');
      }
    });

    it('should transform PORT string to number', () => {
      const envWithStringPort = {
        PORT: '8080',
      };

      const result = envValidationSchema.safeParse(envWithStringPort);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.PORT).toBe(8080);
        expect(typeof result.data.PORT).toBe('number');
      }
    });

    it('should validate PORT range', () => {
      const invalidPorts = ['0', '65536', '-1', 'abc'];

      invalidPorts.forEach(port => {
        const result = envValidationSchema.safeParse({ PORT: port });
        expect(result.success).toBe(false);
      });

      const validPorts = ['1', '1024', '3000', '65535'];
      validPorts.forEach(port => {
        const result = envValidationSchema.safeParse({ PORT: port });
        expect(result.success).toBe(true);
      });
    });

    it('should validate NODE_ENV enum values', () => {
      const validEnvs = ['development', 'production', 'test'];
      const invalidEnvs = ['staging', 'dev', 'prod', ''];

      validEnvs.forEach(env => {
        const result = envValidationSchema.safeParse({ NODE_ENV: env });
        expect(result.success).toBe(true);
      });

      invalidEnvs.forEach(env => {
        const result = envValidationSchema.safeParse({ NODE_ENV: env });
        expect(result.success).toBe(false);
      });
    });

    it('should validate LOG_LEVEL enum values', () => {
      const validLevels = ['error', 'warn', 'info', 'debug', 'verbose'];
      const invalidLevels = ['trace', 'log', ''];

      validLevels.forEach(level => {
        const result = envValidationSchema.safeParse({ LOG_LEVEL: level });
        expect(result.success).toBe(true);
      });

      invalidLevels.forEach(level => {
        const result = envValidationSchema.safeParse({ LOG_LEVEL: level });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('validateEnv', () => {
    it('should return validated environment variables', () => {
      const validEnv = {
        PORT: '3000',
        NODE_ENV: 'production',
        LOG_LEVEL: 'warn',
      };

      const result = validateEnv(validEnv);
      
      expect(result.PORT).toBe(3000);
      expect(result.NODE_ENV).toBe('production');
      expect(result.LOG_LEVEL).toBe('warn');
    });

    it('should throw error for invalid environment variables', () => {
      const invalidEnv = {
        PORT: 'invalid',
        NODE_ENV: 'invalid',
        LOG_LEVEL: 'invalid',
      };

      expect(() => validateEnv(invalidEnv)).toThrow('Invalid environment variables');
    });

    it('should handle partial environment variables with defaults', () => {
      const partialEnv = {
        NODE_ENV: 'test',
      };

      const result = validateEnv(partialEnv);
      
      expect(result.PORT).toBe(3000); // default
      expect(result.NODE_ENV).toBe('test'); // provided
      expect(result.LOG_LEVEL).toBe('info'); // default
    });
  });

  describe('EnvironmentVariables type', () => {
    it('should infer correct types from schema', () => {
      // This test ensures TypeScript types are correctly inferred
      const env: EnvironmentVariables = {
        PORT: 3000,
        NODE_ENV: 'development',
        LOG_LEVEL: 'info',
      };

      expect(typeof env.PORT).toBe('number');
      expect(typeof env.NODE_ENV).toBe('string');
      expect(typeof env.LOG_LEVEL).toBe('string');
      
      expect(env.PORT).toBeGreaterThan(0);
      expect(env.PORT).toBeLessThan(65536);
      expect(['development', 'production', 'test']).toContain(env.NODE_ENV);
      expect(['error', 'warn', 'info', 'debug', 'verbose']).toContain(env.LOG_LEVEL);
    });
  });
}); 