import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import { CachingService } from './caching.service';
import { RedisService } from './redis.service';
import { CacheInterceptor } from './cache.interceptor';
import { CacheKeyService } from './cache-key.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (redisUrl) {
          // Redis configuration
          return {
            store: redisStore,
            url: redisUrl,
            ttl: 60 * 60 * 24, // 24 hours default TTL
            max: 1000, // Maximum number of items in cache
            isGlobal: true,
          };
        } else {
          // In-memory cache fallback
          return {
            ttl: 60 * 60 * 24, // 24 hours default TTL
            max: 1000, // Maximum number of items in cache
            isGlobal: true,
          };
        }
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CachingService, RedisService, CacheInterceptor, CacheKeyService],
  exports: [CachingService, RedisService, CacheInterceptor, CacheKeyService, CacheModule],
})
export class CachingModule {}
