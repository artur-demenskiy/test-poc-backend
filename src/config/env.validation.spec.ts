import { validateEnv, EnvironmentVariables } from './env.validation';

describe('Environment Validation', () => {
  describe('validateEnv', () => {
    it('should validate correct environment variables', () => {
      const validEnv = {
        PORT: '3000',
        NODE_ENV: 'development',
        LOG_LEVEL: 'info',
      };

      const result = validateEnv(validEnv);

      expect(result.PORT).toBe(3000);
      expect(result.NODE_ENV).toBe('development');
      expect(result.LOG_LEVEL).toBe('info');
    });

    it('should use default values when environment variables are missing', () => {
      const envWithDefaults = {};

      const result = validateEnv(envWithDefaults);

      expect(result.PORT).toBe(3000);
      expect(result.NODE_ENV).toBe('development');
      expect(result.LOG_LEVEL).toBe('info');
    });

    it('should transform PORT string to number', () => {
      const envWithStringPort = {
        PORT: '8080',
      };

      const result = validateEnv(envWithStringPort);

      expect(result.PORT).toBe(8080);
      expect(typeof result.PORT).toBe('number');
    });

    it('should validate PORT range', () => {
      const validPorts = ['1', '1024', '3000', '65535'];
      validPorts.forEach(port => {
        const result = validateEnv({ PORT: port });
        expect(result.PORT).toBe(parseInt(port, 10));
      });

      const invalidPorts = ['0', '65536', '-1', 'abc'];
      invalidPorts.forEach(port => {
        expect(() => validateEnv({ PORT: port })).toThrow();
      });
    });

    it('should validate NODE_ENV enum values', () => {
      const validEnvs = ['development', 'production', 'test'];
      validEnvs.forEach(env => {
        const result = validateEnv({ NODE_ENV: env });
        expect(result.NODE_ENV).toBe(env);
      });

      const invalidEnvs = ['staging', 'dev', 'prod', ''];
      invalidEnvs.forEach(env => {
        expect(() => validateEnv({ NODE_ENV: env, PORT: '3000', LOG_LEVEL: 'info' })).toThrow();
      });
    });

    it('should validate LOG_LEVEL enum values', () => {
      const validLevels = ['error', 'warn', 'info', 'debug', 'verbose'];
      validLevels.forEach(level => {
        const result = validateEnv({ LOG_LEVEL: level });
        expect(result.LOG_LEVEL).toBe(level);
      });

      const invalidLevels = ['trace', 'log', ''];
      invalidLevels.forEach(level => {
        expect(() =>
          validateEnv({ LOG_LEVEL: level, PORT: '3000', NODE_ENV: 'development' })
        ).toThrow();
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
