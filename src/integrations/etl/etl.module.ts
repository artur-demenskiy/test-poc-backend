import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EtlService } from './etl.service';
import { EtlController } from './etl.controller';

/**
 * ETL module for managing data extraction, transformation, and loading pipelines
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [EtlController],
  providers: [EtlService],
  exports: [EtlService],
})
export class EtlModule {}
