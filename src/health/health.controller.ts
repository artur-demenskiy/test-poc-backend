import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';

import { DatabaseHealthIndicator } from './database.health.indicator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly _health: HealthCheckService,
    private readonly databaseHealthIndicator: DatabaseHealthIndicator
  ) {}

  /**
   * Health check endpoint for liveness probe
   * Used by Kubernetes liveness probe and general health monitoring
   */
  @Get('healthz')
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Used by Kubernetes liveness probe and general health monitoring',
  })
  @ApiResponse({
    status: 200,
    description: 'Health check successful',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: { type: 'object' },
        error: { type: 'object' },
        details: { type: 'object' },
      },
    },
  })
  async healthz() {
    const result = await this._health.check([
      // Добавляем проверку базы данных
      () => this.databaseHealthIndicator.isHealthy('database'),
    ]);

    // Обновляем метрики состояния приложения
    // Если health check прошел успешно, считаем приложение здоровым
    if (result.status === 'ok') {
      // Здесь можно добавить специфичные метрики здоровья
      // Например, время последней успешной проверки здоровья
    }

    return result;
  }

  /**
   * Readiness check endpoint for readiness probe
   * Used by Kubernetes readiness probe and load balancer health checks
   * Should be lightweight and fast
   */
  @Get('readiness')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness check endpoint',
    description:
      'Used by Kubernetes readiness probe and load balancer health checks. Should be lightweight and fast.',
  })
  @ApiResponse({
    status: 200,
    description: 'Readiness check successful',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: { type: 'object' },
        error: { type: 'object' },
        details: { type: 'object' },
      },
    },
  })
  async readiness() {
    const result = await this._health.check([
      // Для readiness также проверяем базу данных
      () => this.databaseHealthIndicator.isHealthy('database'),
    ]);

    // Обновляем метрики готовности приложения
    if (result.status === 'ok') {
      // Приложение готово принимать трафик
      // Можно обновить метрику времени последней успешной проверки готовности
    }

    return result;
  }
}
