import { Injectable, OnModuleInit } from '@nestjs/common';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

/**
 * Сервис мониторинга для интеграции с Prometheus
 *
 * Предоставляет базовые метрики приложения:
 * - HTTP запросы (количество, время ответа, коды статусов)
 * - Системные метрики (CPU, память, GC и т.д.)
 * - Кастомные бизнес-метрики
 *
 * Используется для экспорта метрик в формате Prometheus
 * для дальнейшей визуализации в Grafana
 */
@Injectable()
export class MonitoringService implements OnModuleInit {
  // Счетчик HTTP запросов с лейблами для метода, пути и статуса
  public readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  });

  // Гистограмма времени выполнения HTTP запросов
  public readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10], // секунды
    registers: [register],
  });

  // Счетчик активных соединений
  public readonly activeConnections = new Gauge({
    name: 'active_connections',
    help: 'Number of active connections',
    registers: [register],
  });

  // Счетчик ошибок приложения
  public readonly applicationErrors = new Counter({
    name: 'application_errors_total',
    help: 'Total number of application errors',
    labelNames: ['error_type', 'endpoint'],
    registers: [register],
  });

  // Метрики базы данных
  public readonly databaseConnections = new Gauge({
    name: 'database_connections_active',
    help: 'Number of active database connections',
    registers: [register],
  });

  public readonly databaseQueryDuration = new Histogram({
    name: 'database_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['query_type', 'table'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [register],
  });

  onModuleInit() {
    // Инициализация сбора стандартных метрик Node.js
    // Включает метрики CPU, памяти, GC, event loop и т.д.
    collectDefaultMetrics({
      register,
      prefix: 'nestjs_app_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // секунды
    });
  }

  /**
   * Получить все метрики в формате Prometheus
   * @returns Строка с метриками в формате Prometheus
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Получить метрики в JSON формате
   * @returns Объект с метриками
   */
  async getMetricsAsJson() {
    return register.getMetricsAsJSON();
  }

  /**
   * Очистить все метрики (используется в тестах)
   */
  clearMetrics(): void {
    register.clear();
  }

  /**
   * Инкремент счетчика HTTP запросов
   * @param method HTTP метод
   * @param route Маршрут
   * @param statusCode Код статуса
   */
  incrementHttpRequests(method: string, route: string, statusCode: number): void {
    this.httpRequestsTotal.inc({
      method: method.toUpperCase(),
      route,
      status_code: statusCode.toString(),
    });
  }

  /**
   * Записать время выполнения HTTP запроса
   * @param method HTTP метод
   * @param route Маршрут
   * @param statusCode Код статуса
   * @param duration Время выполнения в секундах
   */
  recordHttpRequestDuration(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): void {
    this.httpRequestDuration.observe(
      {
        method: method.toUpperCase(),
        route,
        status_code: statusCode.toString(),
      },
      duration
    );
  }

  /**
   * Инкремент счетчика ошибок приложения
   * @param errorType Тип ошибки
   * @param endpoint Эндпоинт где произошла ошибка
   */
  incrementApplicationErrors(errorType: string, endpoint: string): void {
    this.applicationErrors.inc({
      error_type: errorType,
      endpoint,
    });
  }

  /**
   * Установить количество активных соединений
   * @param count Количество соединений
   */
  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  /**
   * Записать время выполнения запроса к БД
   * @param queryType Тип запроса (SELECT, INSERT, UPDATE, DELETE)
   * @param table Таблица
   * @param duration Время выполнения в секундах
   */
  recordDatabaseQueryDuration(queryType: string, table: string, duration: number): void {
    this.databaseQueryDuration.observe(
      {
        query_type: queryType.toUpperCase(),
        table,
      },
      duration
    );
  }

  /**
   * Установить количество активных соединений с БД
   * @param count Количество соединений
   */
  setDatabaseConnections(count: number): void {
    this.databaseConnections.set(count);
  }
}
