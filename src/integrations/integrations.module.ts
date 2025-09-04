import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhookModule } from './webhooks/webhook.module';
import { ApiIntegrationModule } from './api-integrations/api-integration.module';
import { EtlModule } from './etl/etl.module';
import { IntegrationMonitorModule } from './monitoring/integration-monitor.module';
import { MessageQueueModule } from './message-queues/message-queue.module';
import { CqrsModule } from './cqrs/cqrs.module';

/**
 * Integrations module for managing webhooks, API integrations, ETL, message queues, and CQRS
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    WebhookModule,
    ApiIntegrationModule,
    EtlModule,
    IntegrationMonitorModule,
    MessageQueueModule,
    CqrsModule,
  ],
  exports: [
    WebhookModule,
    ApiIntegrationModule,
    EtlModule,
    IntegrationMonitorModule,
    MessageQueueModule,
    CqrsModule,
  ],
})
export class IntegrationsModule {}
