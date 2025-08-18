import { Test, TestingModule } from '@nestjs/testing';
import { SecurityModule } from './security.module';

// Mock database connection
jest.mock('../database/connection', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock AppConfigService
jest.mock('../config/config.service', () => ({
  AppConfigService: jest.fn().mockImplementation(() => ({
    requestSigningSecret: 'test-secret',
    signatureExpirySeconds: 300,
    clockSkewSeconds: 30,
  })),
}));

// Mock all security services
jest.mock('./api-key/api-key.service', () => ({
  ApiKeyService: jest.fn().mockImplementation(() => ({
    createApiKey: jest.fn(),
    validateApiKey: jest.fn(),
    hasScope: jest.fn(),
  })),
}));

jest.mock('./ip-whitelist/ip-whitelist.service', () => ({
  IpWhitelistService: jest.fn().mockImplementation(() => ({
    createIpWhitelist: jest.fn(),
    isIpWhitelisted: jest.fn(),
  })),
}));

jest.mock('./request-signing/request-signing.service', () => ({
  RequestSigningService: jest.fn().mockImplementation(() => ({
    generateSignature: jest.fn(),
    verifySignature: jest.fn(),
  })),
}));

jest.mock('./xss-protection/xss-protection.service', () => ({
  XssProtectionService: jest.fn().mockImplementation(() => ({
    sanitizeHtml: jest.fn(),
    sanitizeText: jest.fn(),
  })),
}));

describe('SecurityModule', () => {
  let module: SecurityModule;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SecurityModule],
    }).compile();

    module = moduleFixture.get<SecurityModule>(SecurityModule);
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should compile without errors', async () => {
    const moduleFixture = Test.createTestingModule({
      imports: [SecurityModule],
    });

    expect(async () => {
      await moduleFixture.compile();
    }).not.toThrow();
  });
});
