import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { SupabaseStorageProvider } from './providers/supabase-storage.provider';
import { GCSStorageProvider } from './providers/gcs-storage.provider';
import { MinIOStorageProvider } from './providers/minio-storage.provider';

/**
 * Storage Module - Pluggable storage layer
 */
@Global()
@Module({
  imports: [ConfigModule],
  controllers: [StorageController],
  providers: [
    S3StorageProvider,
    SupabaseStorageProvider,
    GCSStorageProvider,
    MinIOStorageProvider,
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
