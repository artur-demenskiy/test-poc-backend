import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiIntegrationService } from './api-integration.service';
import { ApiIntegrationController } from './api-integration.controller';

/**
 * API integration module for managing third-party API integrations
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ApiIntegrationController],
  providers: [ApiIntegrationService],
  exports: [ApiIntegrationService],
})
export class ApiIntegrationModule {}
