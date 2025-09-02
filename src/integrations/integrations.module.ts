import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhookModule } from './webhooks/webhook.module';

/**
 * Integrations module for managing webhooks, API integrations, ETL, and message queues
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    WebhookModule,
  ],
  exports: [
    WebhookModule,
  ],
})
export class IntegrationsModule {}
