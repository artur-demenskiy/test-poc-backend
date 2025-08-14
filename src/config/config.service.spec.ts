import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './config.service';
import { EnvironmentVariables } from './env.validation';

describe('AppConfigService', () => {
  let service: AppConfigService;
  let mockConfigService: jest.Mocked<ConfigService<EnvironmentVariables, true>>;

  const mockConfig: EnvironmentVariables = {
    PORT: 3000,
    NODE_ENV: 'development',
    LOG_LEVEL: 'info',
  };

  beforeEach(async () => {
    const mockConfigServiceProvider = {
      provide: ConfigService,
      useValue: {
        get: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AppConfigService, mockConfigServiceProvider],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
    mockConfigService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('port', () => {
    it('should return port from config', () => {
      mockConfigService.get.mockReturnValue(mockConfig.PORT);

      expect(service.port).toBe(mockConfig.PORT);
      expect(mockConfigService.get).toHaveBeenCalledWith('PORT', { infer: true });
    });
  });

  describe('nodeEnv', () => {
    it('should return node environment from config', () => {
      mockConfigService.get.mockReturnValue(mockConfig.NODE_ENV);

      expect(service.nodeEnv).toBe(mockConfig.NODE_ENV);
      expect(mockConfigService.get).toHaveBeenCalledWith('NODE_ENV', { infer: true });
    });
  });

  describe('logLevel', () => {
    it('should return log level from config', () => {
      mockConfigService.get.mockReturnValue(mockConfig.LOG_LEVEL);

      expect(service.logLevel).toBe(mockConfig.LOG_LEVEL);
      expect(mockConfigService.get).toHaveBeenCalledWith('LOG_LEVEL', { infer: true });
    });
  });

  describe('environment checks', () => {
    it('should correctly identify production environment', () => {
      mockConfigService.get.mockReturnValue('production');

      expect(service.isProduction).toBe(true);
      expect(service.isDevelopment).toBe(false);
      expect(service.isTest).toBe(false);
    });

    it('should correctly identify development environment', () => {
      mockConfigService.get.mockReturnValue('development');

      expect(service.isDevelopment).toBe(true);
      expect(service.isProduction).toBe(false);
      expect(service.isTest).toBe(false);
    });

    it('should correctly identify test environment', () => {
      mockConfigService.get.mockReturnValue('test');

      expect(service.isTest).toBe(true);
      expect(service.isProduction).toBe(false);
      expect(service.isDevelopment).toBe(false);
    });
  });

  describe('get', () => {
    it('should return config value with type inference', () => {
      const testValue = 'test-value';
      mockConfigService.get.mockReturnValue(testValue);

      const result = service.get('LOG_LEVEL');

      expect(result).toBe(testValue);
      expect(mockConfigService.get).toHaveBeenCalledWith('LOG_LEVEL', undefined);
    });

    it('should return default value when config is not found', () => {
      const defaultValue = 'default-value';
      mockConfigService.get.mockReturnValue(undefined);

      const result = service.get('LOG_LEVEL', defaultValue);

      expect(result).toBe(defaultValue);
      expect(mockConfigService.get).toHaveBeenCalledWith('LOG_LEVEL', defaultValue);
    });
  });
});
