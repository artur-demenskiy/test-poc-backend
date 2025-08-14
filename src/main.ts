import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { securityConfig } from './security/security.config';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Trust proxy for correct IP extraction (important for rate limiting behind proxy)
  app.set('trust proxy', true);
  
  // Apply security middleware
  app.use(helmet(securityConfig.helmet));
  
  // Get configuration service
  const configService = app.get(AppConfigService);
  
  // Enable CORS with configuration
  app.enableCors(securityConfig.cors(configService));
  
  const port = configService.port;
  
  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`🌍 Environment: ${configService.nodeEnv}`);
  console.log(`📝 Log Level: ${configService.logLevel}`);
  console.log(`🔒 Security: Helmet, CORS, Rate Limiting enabled`);
}

bootstrap();
