import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigurationService } from './configuration.service';
import { ConfigurationController } from './configuration.controller';

/**
 * Configuration module for managing dynamic application configuration
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ConfigurationController],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
