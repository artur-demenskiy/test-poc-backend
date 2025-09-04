import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';

/**
 * Webhook module for managing webhook configurations and deliveries
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
