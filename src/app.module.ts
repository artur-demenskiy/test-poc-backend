import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { AppConfigModule } from './config/config.module';

@Module({
  imports: [AppConfigModule, HealthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
