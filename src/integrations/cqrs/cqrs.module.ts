import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CqrsService } from './cqrs.service';
import { CqrsController } from './cqrs.controller';
import { InMemoryCommandBus } from './cqrs-buses.service';
import { InMemoryQueryBus } from './cqrs-buses.service';
import { InMemoryEventBus } from './cqrs-buses.service';
import { InMemoryEventStore } from './event-store.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CqrsController],
  providers: [
    CqrsService,
    InMemoryCommandBus,
    InMemoryQueryBus,
    InMemoryEventBus,
    InMemoryEventStore,
  ],
  exports: [CqrsService],
})
export class CqrsModule {}
