import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { securityConfig } from './security.config';
import { AppConfigService } from '../config/config.service';

describe('SecurityConfig', () => {
  let configService: AppConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    configService = module.get<AppConfigService>(AppConfigService);
  });

  describe('helmet', () => {
    it('should have correct helmet configuration', () => {
      const helmetConfig = securityConfig.helmet;

      expect(helmetConfig.crossOriginEmbedderPolicy).toBe(false);
      expect(helmetConfig.contentSecurityPolicy).toBeDefined();
      expect(helmetConfig.contentSecurityPolicy.directives).toBeDefined();

      const directives = helmetConfig.contentSecurityPolicy.directives;
      expect(directives.defaultSrc).toContain(`'self'`);
      expect(directives.styleSrc).toContain(`'unsafe-inline'`);
      expect(directives.scriptSrc).toContain(`'unsafe-inline'`);
      expect(directives.objectSrc).toContain(`'none'`);
    });
  });

  describe('cors', () => {
    it('should return CORS configuration function', () => {
      expect(typeof securityConfig.cors).toBe('function');
    });

    it('should return valid CORS options', () => {
      const corsOptions = securityConfig.cors(configService);

      expect(corsOptions.methods).toContain('GET');
      expect(corsOptions.methods).toContain('POST');
      expect(corsOptions.methods).toContain('OPTIONS');
      expect(corsOptions.credentials).toBe(true);
      expect(corsOptions.maxAge).toBe(86400);
    });

    it('should use default origins when allowedOrigins is empty', () => {
      jest.spyOn(configService, 'allowedOrigins', 'get').mockReturnValue([]);

      const corsOptions = securityConfig.cors(configService);
      expect(corsOptions.origin).toContain('http://localhost:3000');
      expect(corsOptions.origin).toContain('http://localhost:3001');
    });

    it('should use configured origins when available', () => {
      const customOrigins = ['https://example.com', 'https://test.com'];
      jest.spyOn(configService, 'allowedOrigins', 'get').mockReturnValue(customOrigins);

      const corsOptions = securityConfig.cors(configService);
      expect(corsOptions.origin).toEqual(customOrigins);
    });
  });

  describe('throttler', () => {
    it('should return throttler configuration function', () => {
      expect(typeof securityConfig.throttler).toBe('function');
    });

    it('should return valid throttler options', () => {
      const throttlerOptions = securityConfig.throttler();

      // Check that the function returns an object
      expect(typeof throttlerOptions).toBe('object');
      expect(throttlerOptions).toBeDefined();

      // Basic validation that it's a valid configuration object
      expect(throttlerOptions).toHaveProperty('throttlers');
      expect(throttlerOptions).toHaveProperty('errorMessage');
    });
  });
});
