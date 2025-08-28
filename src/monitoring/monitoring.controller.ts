import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';

/**
 * Monitoring controller
 *
 * Provides endpoints for getting Prometheus metrics:
 * - /metrics - metrics in Prometheus format (for scraping)
 * - /metrics/json - metrics in JSON format (for debugging)
 *
 * The /metrics endpoint is used by Prometheus server
 * for automatic collection of application metrics
 */
@ApiTags('Monitoring')
@Controller('metrics')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  /**
   * Get metrics in Prometheus format
   *
   * This endpoint is used by Prometheus server for scraping metrics.
   * Returns metrics in text format compatible with Prometheus.
   *
   * @returns Metrics in Prometheus format
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
   * Get metrics in JSON format
   *
   * Convenient endpoint for debugging and development.
   * Returns metrics in structured JSON format.
   *
   * @returns Metrics in JSON format
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
