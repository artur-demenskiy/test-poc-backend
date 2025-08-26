/**
 * Storage Service - Simple and focused storage management
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Buffer } from 'buffer';
import { IStorageProvider } from './interfaces/storage.interface';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { SupabaseStorageProvider } from './providers/supabase-storage.provider';
import { GCSStorageProvider } from './providers/gcs-storage.provider';
import { MinIOStorageProvider } from './providers/minio-storage.provider';

/**
 * Storage Service - Simple and focused storage management
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly providers = new Map<string, IStorageProvider>();
  private readonly primaryProvider: string;
  private currentProvider: IStorageProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly s3Provider: S3StorageProvider,
    private readonly supabaseProvider: SupabaseStorageProvider,
    private readonly gcsProvider: GCSStorageProvider,
    private readonly minioProvider: MinIOStorageProvider
  ) {
    this.primaryProvider = this.configService.get<string>('STORAGE_PRIMARY_PROVIDER', 's3');
    this.initializeProviders();
  }

  /**
   * Initialize available storage providers
   */
  private initializeProviders(): void {
    // Add S3 provider if enabled
    if (this.configService.get<boolean>('STORAGE_S3_ENABLED', false)) {
      this.providers.set('s3', this.s3Provider);
    }

    // Add Supabase provider if enabled
    if (this.configService.get<boolean>('STORAGE_SUPABASE_ENABLED', false)) {
      this.providers.set('supabase', this.supabaseProvider);
    }

    // Add GCS provider if enabled
    if (this.configService.get<boolean>('STORAGE_GCS_ENABLED', false)) {
      this.providers.set('gcs', this.gcsProvider);
    }

    // Add MinIO provider if enabled
    if (this.configService.get<boolean>('STORAGE_MINIO_ENABLED', false)) {
      this.providers.set('minio', this.minioProvider);
    }

    // Set current provider
    this.currentProvider =
      this.providers.get(this.primaryProvider) || this.providers.values().next().value;

    if (!this.currentProvider) {
      this.logger.warn('No storage providers available');
    } else {
      this.logger.log(`Using storage provider: ${this.primaryProvider}`);
    }
  }

  /**
   * Get the current storage provider
   */
  getProvider(): IStorageProvider {
    if (!this.currentProvider) {
      throw new Error('No storage provider available');
    }
    return this.currentProvider;
  }

  /**
   * Switch to a different storage provider
   */
  async switchProvider(providerName: string): Promise<void> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    const isHealthy = await provider.isHealthy();
    if (!isHealthy) {
      throw new Error(`Provider ${providerName} is not healthy`);
    }

    this.currentProvider = provider;
    this.logger.log(`Switched to storage provider: ${providerName}`);
  }

  /**
   * Get all available providers
   */
  getProviders(): Map<string, IStorageProvider> {
    return new Map(this.providers);
  }

  /**
   * Check provider health
   */
  async isHealthy(): Promise<boolean> {
    if (!this.currentProvider) {
      return false;
    }
    return await this.currentProvider.isHealthy();
  }

  // Proxy methods to current provider

  async upload(
    file: Buffer | unknown,
    path: string,
    options?: Record<string, unknown>
  ): Promise<unknown> {
    return this.getProvider().upload(file as Buffer, path, options);
  }

  async download(path: string): Promise<unknown> {
    return this.getProvider().download(path);
  }

  async delete(path: string): Promise<unknown> {
    return this.getProvider().delete(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.getProvider().exists(path);
  }

  async getMetadata(path: string): Promise<unknown> {
    return this.getProvider().getMetadata(path);
  }

  async getUrl(path: string, options?: Record<string, unknown>): Promise<string> {
    return this.getProvider().getUrl(path, options);
  }

  async listFiles(path: string, options?: Record<string, unknown>): Promise<unknown> {
    return this.getProvider().listFiles(path, options);
  }
}
