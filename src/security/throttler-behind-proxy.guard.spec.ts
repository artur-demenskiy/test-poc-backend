import { ThrottlerBehindProxyGuard } from './throttler-behind-proxy.guard';

describe('ThrottlerBehindProxyGuard', () => {
  let guard: ThrottlerBehindProxyGuard;

  beforeEach(() => {
    // Create a simple instance without complex dependencies
    guard = new ThrottlerBehindProxyGuard(
      {} as any, // ThrottlerModuleOptions
      {} as any, // ThrottlerStorage
      {} as any  // Reflector
    );
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('getTracker', () => {
    it('should return first IP from forwarded IPs when available', async () => {
      const mockReq = {
        ips: ['192.168.1.1', '10.0.0.1'] as string[],
        ip: '127.0.0.1',
      };

      const result = await guard['getTracker'](mockReq);
      expect(result).toBe('192.168.1.1');
    });

    it('should fallback to regular IP when no forwarded IPs', async () => {
      const mockReq = {
        ips: [] as string[],
        ip: '127.0.0.1',
      };

      const result = await guard['getTracker'](mockReq);
      expect(result).toBe('127.0.0.1');
    });

    it('should fallback to regular IP when ips is undefined', async () => {
      const mockReq = {
        ip: '127.0.0.1',
      };

      const result = await guard['getTracker'](mockReq);
      expect(result).toBe('127.0.0.1');
    });
  });
}); 