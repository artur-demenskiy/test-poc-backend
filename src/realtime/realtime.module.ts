import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RealtimeController } from './realtime.controller';
import { SSEService } from './sse/sse.service';
import { SSEController } from './sse/sse.controller';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
  ],
  controllers: [RealtimeController, SSEController],
  providers: [RealtimeGateway, RealtimeService, SSEService],
  exports: [RealtimeService, SSEService],
})
export class RealtimeModule {}
