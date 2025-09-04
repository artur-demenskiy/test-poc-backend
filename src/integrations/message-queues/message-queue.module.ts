import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MessageQueueService } from './message-queue.service';
import { MessageQueueController } from './message-queue.controller';
import { RabbitMQProvider } from './rabbitmq.provider';
import { RedisProvider } from './redis.provider';
import { KafkaProvider } from './kafka.provider';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [MessageQueueController],
  providers: [
    MessageQueueService,
    RabbitMQProvider,
    RedisProvider,
    KafkaProvider,
  ],
  exports: [MessageQueueService],
})
export class MessageQueueModule {}
