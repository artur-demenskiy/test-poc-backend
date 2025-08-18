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
