import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringService } from './monitoring.service';
import { register } from 'prom-client';

describe('MonitoringService', () => {
  let service: MonitoringService;

  beforeEach(async () => {
    // Очищаем регистр метрик перед каждым тестом
    register.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MonitoringService],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
  });

  afterEach(() => {
    // Очищаем метрики после каждого теста
    service.clearMetrics();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('HTTP metrics', () => {
    it('should increment HTTP requests counter', async () => {
      service.incrementHttpRequests('GET', '/test', 200);

      const metrics = await service.httpRequestsTotal.get();
      expect(metrics.values).toHaveLength(1);
      expect(metrics.values[0].value).toBe(1);
      expect(metrics.values[0].labels).toEqual({
        method: 'GET',
        route: '/test',
        status_code: '200',
      });
    });

    it('should record HTTP request duration', async () => {
      service.recordHttpRequestDuration('POST', '/api/users', 201, 0.5);

      const metrics = await service.httpRequestDuration.get();
      expect(metrics.values.length).toBeGreaterThan(0);

      // Проверяем что есть значения с правильными лейблами
      const hasCorrectLabels = metrics.values.some(
        value =>
          value.labels.method === 'POST' &&
          value.labels.route === '/api/users' &&
          value.labels.status_code === '201'
      );
      expect(hasCorrectLabels).toBe(true);
    });
  });

  describe('Error metrics', () => {
    it('should increment application errors counter', async () => {
      service.incrementApplicationErrors('validation_error', '/api/users');

      const metrics = await service.applicationErrors.get();
      expect(metrics.values).toHaveLength(1);
      expect(metrics.values[0].value).toBe(1);
      expect(metrics.values[0].labels).toEqual({
        error_type: 'validation_error',
        endpoint: '/api/users',
      });
    });
  });

  describe('Connection metrics', () => {
    it('should set active connections gauge', async () => {
      service.setActiveConnections(10);

      const metrics = await service.activeConnections.get();
      expect(metrics.values[0].value).toBe(10);
    });

    it('should set database connections gauge', async () => {
      service.setDatabaseConnections(5);

      const metrics = await service.databaseConnections.get();
      expect(metrics.values[0].value).toBe(5);
    });
  });

  describe('Database metrics', () => {
    it('should record database query duration', async () => {
      service.recordDatabaseQueryDuration('SELECT', 'users', 0.1);

      const metrics = await service.databaseQueryDuration.get();
      expect(metrics.values.length).toBeGreaterThan(0);

      // Проверяем что есть значения с правильными лейблами
      const hasCorrectLabels = metrics.values.some(
        value => value.labels.query_type === 'SELECT' && value.labels.table === 'users'
      );
      expect(hasCorrectLabels).toBe(true);
    });
  });

  describe('Metrics export', () => {
    it('should return metrics in Prometheus format', async () => {
      service.incrementHttpRequests('GET', '/test', 200);

      const metrics = await service.getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('http_requests_total');
    });

    it('should return metrics in JSON format', async () => {
      service.incrementHttpRequests('GET', '/test', 200);

      const metrics = await service.getMetricsAsJson();
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
    });
  });
});
