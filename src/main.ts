import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as rTracer from 'cls-rtracer';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { securityConfig } from './security/security.config';
import helmet from 'helmet';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust proxy for correct IP extraction (important for rate limiting behind proxy)
  app.set('trust proxy', true);

  // Apply request ID middleware
  app.use(rTracer.expressMiddleware());

  // Apply security middleware
  app.use(helmet(securityConfig.helmet));

  // Apply compression middleware
  app.use(
    compression({
      level: 6, // Good balance between compression and speed
      threshold: 1024, // Only compress responses larger than 1KB
      filter: (req, res) => {
        // Don't compress if request has no-compression header
        if (req.headers['x-no-compression']) {
          return false;
        }

        // Don't compress if response is already compressed
        if (res.getHeader('content-encoding')) {
          return false;
        }

        // Don't compress health check endpoints
        if (req.path === '/health' || req.path.startsWith('/health/')) {
          return false;
        }

        return true;
      },
    })
  );

  // Get configuration service
  const configService = app.get(AppConfigService);

  // Enable CORS with configuration
  app.enableCors(securityConfig.cors(configService));

  // Swagger documentation setup
  if (!configService.isProduction) {
    const config = new DocumentBuilder()
      .setTitle('NestJS Boilerplate API')
      .setDescription(
        'Production-ready NestJS boilerplate with TypeScript, Caching, and Performance Monitoring'
      )
      .setVersion('1.0.0')
      .addTag('health', 'Health check endpoints')
      .addTag('app', 'Application endpoints')
      .addTag('cache', 'Caching management endpoints')
      .addTag('performance', 'Performance monitoring endpoints')
      .addTag('background-jobs', 'Background job management endpoints')
      .addTag('scheduled-tasks', 'Scheduled task management endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: false,
      },
      customSiteTitle: 'NestJS Boilerplate API Docs',
    });
  }

  const port = configService.port;

  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`🌍 Environment: ${configService.nodeEnv}`);
  console.log(`📝 Log Level: ${configService.logLevel}`);
  console.log(`🔒 Security: Helmet, CORS, Rate Limiting enabled`);
  console.log(`⚡ Performance: Caching, Background Jobs, Scheduled Tasks enabled`);
  console.log(`🗜️  Compression: Gzip compression enabled`);
  if (!configService.isProduction) {
    console.log(`📚 API Documentation: http://localhost:${port}/docs`);
  }
}

bootstrap();
