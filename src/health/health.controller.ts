import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly _health: HealthCheckService) {}

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
  healthz() {
    return this._health.check([]);
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
  readiness() {
    return this._health.check([]);
  }
}
