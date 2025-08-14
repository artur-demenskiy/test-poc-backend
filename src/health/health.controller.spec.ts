import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService } from '@nestjs/terminus';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockResolvedValue({
              status: 'ok',
              info: {},
              error: {},
              details: {},
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('healthz', () => {
    it('should return health check result', async () => {
      const result = await controller.healthz();
      
      expect(healthCheckService.check).toHaveBeenCalledWith([]);
      expect(result).toEqual({
        status: 'ok',
        info: {},
        error: {},
        details: {},
      });
    });
  });

  describe('readiness', () => {
    it('should return readiness check result', async () => {
      const result = await controller.readiness();
      
      expect(healthCheckService.check).toHaveBeenCalledWith([]);
      expect(result).toEqual({
        status: 'ok',
        info: {},
        error: {},
        details: {},
      });
    });
  });
}); 