import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  /**
   * Health check endpoint for liveness probe
   * Used by Kubernetes liveness probe and general health monitoring
   */
  @Get('healthz')
  @HealthCheck()
  healthz() {
    return this.health.check([]);
  }

  /**
   * Readiness check endpoint for readiness probe
   * Used by Kubernetes readiness probe and load balancer health checks
   * Should be lightweight and fast
   */
  @Get('readiness')
  @HealthCheck()
  readiness() {
    return this.health.check([]);
  }
} 