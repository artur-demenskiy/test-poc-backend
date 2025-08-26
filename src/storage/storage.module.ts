/**
 * Storage Module - Pluggable storage layer for NestJS applications
 * 
 * This module provides a comprehensive storage solution with support for multiple
 * storage backends including S3, Supabase Storage, Google Cloud Storage, and MinIO.
 * It offers a unified API for file operations with automatic provider selection,
 * fallback mechanisms, and health monitoring.
 * 
 * Key Features:
 * - Multi-provider support with automatic selection
 * - Provider health monitoring and fallback
 * - Unified API for all storage operations
 * - File processing and transformation capabilities
 * - Comprehensive error handling and logging
 * - Easy provider switching and configuration
 * 
 * Supported Storage Providers:
 * ├── AWS S3: Cloud storage with presigned URLs and access control
 * ├── Supabase Storage: Real-time storage with RLS and built-in processing
 * ├── Google Cloud Storage: Enterprise storage with lifecycle management
 * └── MinIO: S3-compatible self-hosted storage solution
 * 
 * Configuration:
 * - Environment-based provider selection
 * - Automatic health checks and monitoring
 * - Configurable fallback strategies
 * - Provider-specific credential management
 */
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { SupabaseStorageProvider } from './providers/supabase-storage.provider';
import { GCSStorageProvider } from './providers/gcs-storage.provider';
import { MinIOStorageProvider } from './providers/minio-storage.provider';

/**
 * Storage Module Configuration
 * 
 * This module provides a pluggable storage layer that supports multiple
 * storage backends with automatic provider selection and fallback mechanisms.
 */
@Global()
@Module({
  imports: [ConfigModule],
  controllers: [
    // HTTP API controller for storage operations
    StorageController,
  ],
  providers: [
    // Storage providers for different backends
    S3StorageProvider,
    SupabaseStorageProvider,
    GCSStorageProvider,
    MinIOStorageProvider,
    
    // Main storage service that manages all providers
    StorageService,
  ],
  exports: [
    // Export the main storage service for use in other modules
    StorageService,
    
    // Export individual providers for direct access if needed
    S3StorageProvider,
    SupabaseStorageProvider,
    GCSStorageProvider,
    MinIOStorageProvider,
  ],
})
export class StorageModule {} 