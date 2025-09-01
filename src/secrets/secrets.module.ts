import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SecretsService } from './secrets.service';
import { SecretsController } from './secrets.controller';

/**
 * Secrets module for managing application secrets with encryption
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SecretsController],
  providers: [SecretsService],
  exports: [SecretsService],
})
export class SecretsModule {}
