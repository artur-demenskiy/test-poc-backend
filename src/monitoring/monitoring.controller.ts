import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';

/**
 * Контроллер мониторинга
 *
 * Предоставляет эндпоинты для получения метрик Prometheus:
 * - /metrics - метрики в формате Prometheus (для scraping)
 * - /metrics/json - метрики в JSON формате (для отладки)
 *
 * Эндпоинт /metrics используется Prometheus сервером
 * для автоматического сбора метрик приложения
 */
@ApiTags('Monitoring')
@Controller('metrics')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  /**
   * Получить метрики в формате Prometheus
   *
   * Этот эндпоинт используется Prometheus сервером для scraping метрик.
   * Возвращает метрики в текстовом формате, совместимом с Prometheus.
   *
   * @returns Метрики в формате Prometheus
   */
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description: 'Returns application metrics in Prometheus format for scraping',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics in Prometheus format',
    content: {
      'text/plain': {
        example: `# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/health",status_code="200"} 42

# HELP http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/api/health",status_code="200",le="0.1"} 40`,
      },
    },
  })
  async getMetrics(): Promise<string> {
    return this.monitoringService.getMetrics();
  }

  /**
   * Получить метрики в JSON формате
   *
   * Удобный эндпоинт для отладки и разработки.
   * Возвращает метрики в структурированном JSON формате.
   *
   * @returns Метрики в JSON формате
   */
  @Get('json')
  @ApiOperation({
    summary: 'Get metrics in JSON format',
    description: 'Returns application metrics in JSON format for debugging',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics in JSON format',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'http_requests_total' },
          help: { type: 'string', example: 'Total number of HTTP requests' },
          type: { type: 'string', example: 'counter' },
          values: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                value: { type: 'number', example: 42 },
                labels: {
                  type: 'object',
                  example: { method: 'GET', route: '/api/health', status_code: '200' },
                },
              },
            },
          },
        },
      },
    },
  })
  async getMetricsAsJson() {
    return this.monitoringService.getMetricsAsJson();
  }
}
