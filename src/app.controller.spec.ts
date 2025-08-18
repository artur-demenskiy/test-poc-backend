import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Mock security services
const mockRequestSigningService = {
  generateTimestamp: jest.fn().mockReturnValue('1234567890'),
  generateNonce: jest.fn().mockReturnValue('test-nonce'),
};

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: 'RequestSigningService',
          useValue: mockRequestSigningService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('getPublicEndpoint', () => {
    it('should return public endpoint message', () => {
      const result = appController.getPublicEndpoint();
      expect(result.message).toBe('This is a public endpoint with basic rate limiting');
      expect(result.timestamp).toBeDefined();
    });
  });
});
