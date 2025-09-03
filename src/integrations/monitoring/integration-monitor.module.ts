import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IntegrationMonitorService } from './integration-monitor.service';
import { IntegrationMonitorController } from './integration-monitor.controller';
import { WebhookModule } from '../webhooks/webhook.module';
import { ApiIntegrationModule } from '../api-integrations/api-integration.module';
import { EtlModule } from '../etl/etl.module';

/**
 * Integration monitoring module for health checks and metrics
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    WebhookModule,
    ApiIntegrationModule,
    EtlModule,
  ],
  controllers: [IntegrationMonitorController],
  providers: [IntegrationMonitorService],
  exports: [IntegrationMonitorService],
})
export class IntegrationMonitorModule {}
