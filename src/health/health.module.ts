import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { DatabaseHealthIndicator } from './database.health.indicator';

@Module({
  imports: [TerminusModule, MonitoringModule],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator],
})
export class HealthModule {}
