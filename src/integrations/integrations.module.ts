import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhookModule } from './webhooks/webhook.module';
import { ApiIntegrationModule } from './api-integrations/api-integration.module';
import { EtlModule } from './etl/etl.module';
import { IntegrationMonitorModule } from './monitoring/integration-monitor.module';

/**
 * Integrations module for managing webhooks, API integrations, ETL, and message queues
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    WebhookModule,
    ApiIntegrationModule,
    EtlModule,
    IntegrationMonitorModule,
  ],
  exports: [
    WebhookModule,
    ApiIntegrationModule,
    EtlModule,
    IntegrationMonitorModule,
  ],
})
export class IntegrationsModule {}
