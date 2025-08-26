/**
 * Storage Service - Central service for managing multiple storage providers
 *
 * This service provides a unified interface to multiple storage providers,
 * including automatic provider selection, fallback mechanisms, and health monitoring.
 *
 * Key Features:
 * - Multi-provider management with automatic selection
 * - Health monitoring and automatic fallback
 * - Provider switching and load balancing
 * - Unified API for all storage operations
 * - Error handling and retry logic
 */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setInterval, clearInterval } from 'timers';
import {
  IStorageProvider,
  UploadOptions,
  UploadResult,
  DownloadOptions,
  DownloadResult,
  DeleteResult,
  FileMetadata,
  UpdateResult,
  ListResult,
  AccessControlResult,
  StorageProviderInfo,
  ListOptions,
  UrlOptions,
  ProcessOptions,
  ProcessResult,
  CopyOptions,
  CopyResult,
  MoveResult,
} from './interfaces/storage.interface';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { SupabaseStorageProvider } from './providers/supabase-storage.provider';
import { GCSStorageProvider } from './providers/gcs-storage.provider';
import { MinIOStorageProvider } from './providers/minio-storage.provider';

/**
 * Storage Provider Configuration
 */
export interface StorageProviderConfig {
  /** Provider instance */
  provider: IStorageProvider;
  /** Provider name */
  name: string;
  /** Provider type */
  type: string;
  /** Whether this is the primary provider */
  primary: boolean;
  /** Provider priority (lower number = higher priority) */
  priority: number;
  /** Whether the provider is healthy */
  healthy: boolean;
  /** Last health check timestamp */
  lastHealthCheck: Date;
  /** Provider-specific configuration */
  config: Record<string, unknown>;
}

/**
 * Storage Service - Central service for managing multiple storage providers
 *
 * This service provides a unified interface to multiple storage providers,
 * including automatic provider selection, fallback mechanisms, and health monitoring.
 *
 * Key Features:
 * - Multi-provider management with automatic selection
 * - Health monitoring and automatic fallback
 * - Provider switching and load balancing
 * - Unified API for all storage operations
 * - Error handling and retry logic
 */
@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private readonly providers = new Map<string, StorageProviderConfig>();
  private readonly primaryProvider: string;
  private currentProvider: string;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly s3Provider: S3StorageProvider,
    private readonly supabaseProvider: SupabaseStorageProvider,
    private readonly gcsProvider: GCSStorageProvider,
    private readonly minioProvider: MinIOStorageProvider
  ) {
    this.primaryProvider = this.configService.get<string>('STORAGE_PRIMARY_PROVIDER', 's3');
    this.currentProvider = this.primaryProvider;
  }

  /**
   * Initialize the storage service
   */
  async onModuleInit(): Promise<void> {
    await this.initializeProviders();
    this.startHealthChecks();
  }

  /**
   * Cleanup when module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    this.stopHealthChecks();
  }

  /**
   * Initialize all storage providers
   */
  private async initializeProviders(): Promise<void> {
    try {
      // Initialize S3 provider
      if (this.configService.get<boolean>('STORAGE_S3_ENABLED', false)) {
        this.providers.set('s3', {
          provider: this.s3Provider,
          name: 'AWS S3',
          type: 's3',
          primary: this.primaryProvider === 's3',
          priority: 1,
          healthy: true,
          lastHealthCheck: new Date(),
          config: {
            bucket: this.configService.get<string>('STORAGE_S3_BUCKET'),
            region: this.configService.get<string>('STORAGE_S3_REGION'),
          },
        });
      }

      // Initialize Supabase provider
      if (this.configService.get<boolean>('STORAGE_SUPABASE_ENABLED', false)) {
        this.providers.set('supabase', {
          provider: this.supabaseProvider,
          name: 'Supabase Storage',
          type: 'supabase',
          primary: this.primaryProvider === 'supabase',
          priority: 2,
          healthy: true,
          lastHealthCheck: new Date(),
          config: {
            bucket: this.configService.get<string>('STORAGE_SUPABASE_BUCKET'),
            url: this.configService.get<string>('STORAGE_SUPABASE_URL'),
          },
        });
      }

      // Initialize GCS provider
      if (this.configService.get<boolean>('STORAGE_GCS_ENABLED', false)) {
        this.providers.set('gcs', {
          provider: this.gcsProvider,
          name: 'Google Cloud Storage',
          type: 'gcs',
          primary: this.primaryProvider === 'gcs',
          priority: 3,
          healthy: true,
          lastHealthCheck: new Date(),
          config: {
            bucket: this.configService.get<string>('STORAGE_GCS_BUCKET'),
            projectId: this.configService.get<string>('STORAGE_GCS_PROJECT_ID'),
          },
        });
      }

      // Initialize MinIO provider
      if (this.configService.get<boolean>('STORAGE_MINIO_ENABLED', false)) {
        this.providers.set('minio', {
          provider: this.minioProvider,
          name: 'MinIO',
          type: 'minio',
          primary: this.primaryProvider === 'minio',
          priority: 4,
          healthy: true,
          lastHealthCheck: new Date(),
          config: {
            bucket: this.configService.get<string>('STORAGE_MINIO_BUCKET'),
            endpoint: this.configService.get<string>('STORAGE_MINIO_ENDPOINT'),
          },
        });
      }

      this.logger.log(`Initialized ${this.providers.size} storage providers`);
    } catch (error) {
      this.logger.error('Failed to initialize storage providers', error);
    }
  }

  /**
   * Get the primary storage provider
   */
  getPrimaryProvider(): IStorageProvider | null {
    for (const [name, config] of this.providers) {
      if (config.primary) {
        return config.provider;
      }
    }
    return null;
  }

  /**
   * Get the best available storage provider
   */
  getBestProvider(): IStorageProvider | null {
    // Sort providers by priority and health status
    const sortedProviders = Array.from(this.providers.values()).sort((a, b) => {
      // Healthy providers first
      if (a.healthy !== b.healthy) {
        return a.healthy ? -1 : 1;
      }
      // Then by priority
      return a.priority - b.priority;
    });

    return sortedProviders[0]?.provider || null;
  }

  /**
   * Check if a provider is healthy
   */
  async isProviderHealthy(providerName: string): Promise<boolean> {
    const config = this.providers.get(providerName);
    if (!config) {
      return false;
    }

    try {
      await config.provider.getProviderInfo();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Perform health check on all providers
   */
  async performHealthCheck(): Promise<void> {
    for (const [name, config] of this.providers) {
      try {
        const healthy = await this.isProviderHealthy(name);
        config.healthy = healthy;
        config.lastHealthCheck = new Date();

        if (!healthy) {
          this.logger.warn(`Storage provider ${name} is unhealthy`);
        }
      } catch (error) {
        config.healthy = false;
        config.lastHealthCheck = new Date();
        this.logger.error(`Health check failed for provider ${name}`, error);
      }
    }
  }

  /**
   * Get the current active provider
   */
  getCurrentProvider(): IStorageProvider | null {
    const config = this.providers.get(this.currentProvider);
    return config?.provider || null;
  }

  /**
   * Get all available providers
   */
  getAllProviders(): Map<string, StorageProviderConfig> {
    return new Map(this.providers);
  }

  /**
   * Get provider health information
   */
  getProviderHealth(providerName: string): StorageProviderConfig | null {
    return this.providers.get(providerName) || null;
  }

  /**
   * Switch to a different storage provider
   */
  async switchProvider(providerName: string): Promise<boolean> {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider ${providerName} not found`);
    }

    const config = this.providers.get(providerName);
    if (!config?.healthy) {
      throw new Error(`Provider ${providerName} is not healthy`);
    }

    this.currentProvider = providerName;
    this.logger.log(`Switched to storage provider: ${providerName}`);
    return true;
  }

  // Storage operation methods - these proxy to the current provider

  /**
   * Upload a file to storage
   */
  async upload(options: UploadOptions): Promise<UploadResult> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    try {
      return await provider.upload(options);
    } catch (error) {
      // Try fallback to another provider
      const fallbackProvider = this.getBestProvider();
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(`Upload failed on ${this.currentProvider}, trying fallback provider`);
        return await fallbackProvider.upload(options);
      }
      throw error;
    }
  }

  /**
   * Download a file from storage
   */
  async download(options: DownloadOptions): Promise<DownloadResult> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    try {
      return await provider.download(options);
    } catch (error) {
      // Try fallback to another provider
      const fallbackProvider = this.getBestProvider();
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(`Download failed on ${this.currentProvider}, trying fallback provider`);
        return await fallbackProvider.download(options);
      }
      throw error;
    }
  }

  /**
   * Delete a file from storage
   */
  async delete(filePath: string): Promise<DeleteResult> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    try {
      return await provider.delete(filePath);
    } catch (error) {
      // Try fallback to another provider
      const fallbackProvider = this.getBestProvider();
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(`Delete failed on ${this.currentProvider}, trying fallback provider`);
        return await fallbackProvider.delete(filePath);
      }
      throw error;
    }
  }

  /**
   * Check if a file exists in storage
   */
  async exists(filePath: string): Promise<boolean> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    try {
      return await provider.exists(filePath);
    } catch (error) {
      // Try fallback to another provider
      const fallbackProvider = this.getBestProvider();
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(
          `Exists check failed on ${this.currentProvider}, trying fallback provider`
        );
        return await fallbackProvider.exists(filePath);
      }
      throw error;
    }
  }

  /**
   * Get metadata for a file
   */
  async getMetadata(filePath: string): Promise<FileMetadata> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    try {
      return await provider.getMetadata(filePath);
    } catch (error) {
      // Try fallback to another provider
      const fallbackProvider = this.getBestProvider();
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(
          `Get metadata failed on ${this.currentProvider}, trying fallback provider`
        );
        return await fallbackProvider.getMetadata(filePath);
      }
      throw error;
    }
  }

  /**
   * Update metadata for a file
   */
  async updateMetadata(filePath: string, metadata: Record<string, string>): Promise<UpdateResult> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    try {
      return await provider.updateMetadata(filePath, metadata);
    } catch (error) {
      // Try fallback to another provider
      const fallbackProvider = this.getBestProvider();
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(
          `Update metadata failed on ${this.currentProvider}, trying fallback provider`
        );
        return await fallbackProvider.updateMetadata(filePath, metadata);
      }
      throw error;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(options: ListOptions): Promise<ListResult> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    try {
      return await provider.listFiles(options);
    } catch (error) {
      // Try fallback to another provider
      const fallbackProvider = this.getBestProvider();
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(`List files failed on ${this.currentProvider}, trying fallback provider`);
        return await fallbackProvider.listFiles(options);
      }
      throw error;
    }
  }

  /**
   * Generate a URL for accessing a file
   */
  async generateUrl(options: UrlOptions): Promise<string> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    try {
      return await provider.generateUrl(options);
    } catch (error) {
      // Try fallback to another provider
      const fallbackProvider = this.getBestProvider();
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(
          `Generate URL failed on ${this.currentProvider}, trying fallback provider`
        );
        return await fallbackProvider.generateUrl(options);
      }
      throw error;
    }
  }

  /**
   * Copy a file to a new location
   */
  async copy(options: CopyOptions): Promise<CopyResult> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    try {
      return await provider.copy(options);
    } catch (error) {
      // Try fallback to another provider
      const fallbackProvider = this.getBestProvider();
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(`Copy failed on ${this.currentProvider}, trying fallback provider`);
        return await fallbackProvider.copy(options);
      }
      throw error;
    }
  }

  /**
   * Move a file to a new location
   */
  async move(sourcePath: string, destinationPath: string): Promise<MoveResult> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    try {
      return await provider.move(sourcePath, destinationPath);
    } catch (error) {
      // Try fallback to another provider
      const fallbackProvider = this.getBestProvider();
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(`Move failed on ${this.currentProvider}, trying fallback provider`);
        return await fallbackProvider.move(sourcePath, destinationPath);
      }
      throw error;
    }
  }

  /**
   * Rename a file
   */
  async rename(oldPath: string, newPath: string): Promise<MoveResult> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    try {
      return await provider.rename(oldPath, newPath);
    } catch (error) {
      // Try fallback to another provider
      const fallbackProvider = this.getBestProvider();
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(`Rename failed on ${this.currentProvider}, trying fallback provider`);
        return await fallbackProvider.rename(oldPath, newPath);
      }
      throw error;
    }
  }

  /**
   * Process a file
   */
  async process(filePath: string, options: ProcessOptions): Promise<ProcessResult> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    try {
      return await provider.process(filePath, options);
    } catch (error) {
      // Try fallback to another provider
      const fallbackProvider = this.getBestProvider();
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(`Process failed on ${this.currentProvider}, trying fallback provider`);
        return await fallbackProvider.process(filePath, options);
      }
      throw error;
    }
  }

  /**
   * Set file access to public
   */
  async setPublic(filePath: string): Promise<AccessControlResult> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    try {
      return await provider.setPublic(filePath);
    } catch (error) {
      // Try fallback to another provider
      const fallbackProvider = this.getBestProvider();
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(`Set public failed on ${this.currentProvider}, trying fallback provider`);
        return await fallbackProvider.setPublic(filePath);
      }
      throw error;
    }
  }

  /**
   * Set file access to private
   */
  async setPrivate(filePath: string): Promise<AccessControlResult> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    try {
      return await provider.setPrivate(filePath);
    } catch (error) {
      // Try fallback to another provider
      const fallbackProvider = this.getBestProvider();
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(`Set private failed on ${this.currentProvider}, trying fallback provider`);
        return await fallbackProvider.setPrivate(filePath);
      }
      throw error;
    }
  }

  /**
   * Get information about the current storage provider
   */
  async getProviderInfo(): Promise<StorageProviderInfo> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    return await provider.getProviderInfo();
  }

  // Private methods

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    const interval = this.configService.get<number>('STORAGE_HEALTH_CHECK_INTERVAL', 30000); // 30 seconds

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, interval);

    this.logger.log(`Started health checks every ${interval}ms`);
  }

  /**
   * Stop periodic health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.logger.log('Stopped health checks');
    }
  }
}
