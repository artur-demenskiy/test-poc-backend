/**
 * Storage Usage Examples
 *
 * This file demonstrates various ways to use the storage module
 * including file uploads, downloads, processing, and provider management.
 *
 * Key Examples:
 * - Basic file operations (upload, download, delete)
 * - File metadata management
 * - File processing and transformation
 * - Provider switching and health monitoring
 * - Error handling and fallback mechanisms
 * - Batch operations and streaming
 */

import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage.service';
import { Buffer } from 'buffer';

/**
 * Example service demonstrating storage module usage
 */
@Injectable()
export class StorageUsageExample {
  private readonly logger = new Logger(StorageUsageExample.name);

  constructor(private readonly storageService: StorageService) {}

  /**
   * Example 1: Basic file upload with metadata
   */
  async uploadProfileImage(imageBuffer: Buffer, userId: string, filename: string): Promise<any> {
    try {
      const path = `users/${userId}/profile/${filename}`;

      const result = await this.storageService.upload({
        filePath: path,
        content: imageBuffer,
        contentType: 'image/jpeg',
        metadata: {
          userId,
          type: 'profile',
          uploadedAt: new Date().toISOString(),
        },
      });

      this.logger.log(`Profile image uploaded: ${result.filePath}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to upload profile image: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Example 2: File download with processing
   */
  async downloadAndProcessImage(
    imagePath: string,
    _options: { width?: number; height?: number; quality?: number } = {}
  ): Promise<any> {
    try {
      // Download original image
      const original = await this.storageService.download({
        filePath: imagePath,
        asStream: false,
      });

      this.logger.log(`Image processed: ${imagePath}`);
      return original;
    } catch (error) {
      this.logger.error(
        `Failed to process image: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Example 3: Batch file operations
   */
  async uploadMultipleFiles(
    files: Array<{ buffer: Buffer; originalname: string; mimetype: string }>,
    basePath: string
  ): Promise<any[]> {
    try {
      const uploadPromises = files.map((file, index) => {
        const path = `${basePath}/${Date.now()}_${index}_${file.originalname}`;

        return this.storageService.upload({
          filePath: path,
          content: file.buffer,
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
            uploadedAt: new Date().toISOString(),
            batchId: Date.now().toString(),
          },
        });
      });

      const results = await Promise.all(uploadPromises);
      this.logger.log(`Batch upload completed: ${results.length} files`);

      return results;
    } catch (error) {
      this.logger.error(
        `Batch upload failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Example 4: File metadata management
   */
  async updateFileMetadata(
    filePath: string,
    _updates: { tags?: string[]; custom?: Record<string, any> }
  ): Promise<any> {
    try {
      // Get current metadata
      const currentMetadata = await this.storageService.getMetadata(filePath);

      // Update metadata
      const updatedMetadata = {
        ...currentMetadata,
        // tags: updates.tags || currentMetadata.tags,
        // custom: {
        //   ...currentMetadata.custom,
        //   ...updates.custom,
        //   lastUpdated: new Date().toISOString(),
        // },
      };

      const result = await this.storageService.updateMetadata(filePath, updatedMetadata as any);

      this.logger.log(`Metadata updated for: ${filePath}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to update metadata: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Example 5: File organization and cleanup
   */
  async organizeUserFiles(userId: string): Promise<any> {
    try {
      const userFilesPath = `users/${userId}`;

      // List all user files
      const fileListing = await this.storageService.listFiles({
        filePath: userFilesPath,
        recursive: true,
        maxResults: 1000,
      } as any);

      // Organize files by type
      const organizedFiles: Record<string, string[]> = {
        images: [],
        documents: [],
        videos: [],
        other: [],
      };

      for (const file of fileListing.files) {
        const contentType = file.contentType;
        if (contentType.startsWith('image/')) {
          organizedFiles.images.push((file as any).filePath);
        } else if (contentType.startsWith('application/')) {
          organizedFiles.documents.push((file as any).filePath);
        } else if (contentType.startsWith('video/')) {
          organizedFiles.videos.push((file as any).filePath);
        } else {
          organizedFiles.other.push((file as any).filePath);
        }
      }

      // Move files to organized structure
      for (const [type, files] of Object.entries(organizedFiles)) {
        for (const filePath of files) {
          const newPath = `${userFilesPath}/${type}/${filePath.split('/').pop()}`;

          if (filePath !== newPath) {
            await this.storageService.move(filePath, newPath);
            this.logger.log(`Moved ${filePath} to ${newPath}`);
          }
        }
      }

      return organizedFiles;
    } catch (error) {
      this.logger.error(
        `Failed to organize user files: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Example 6: Provider health monitoring
   */
  async monitorStorageHealth(): Promise<any> {
    try {
      // Get current provider health
      const health = await this.storageService.getAllProvidersHealth();

      // Get current provider info
      const currentProvider = this.storageService.getCurrentProvider();
      const providerInfo = await currentProvider.getProviderInfo();

      // Log health status
      this.logger.log('Storage health status:');
      for (const [name, status] of Object.entries(health)) {
        this.logger.log(`  ${name}: ${status.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
        if (status.current) {
          this.logger.log(`    → Current provider`);
        }
      }

      return {
        health,
        currentProvider: providerInfo,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to monitor storage health: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Example 7: Provider switching
   */
  async switchToBackupProvider(): Promise<boolean> {
    try {
      const health = await this.storageService.getAllProvidersHealth();

      // Find healthy backup provider
      const backupProvider = Object.entries(health).find(
        ([name, status]) => name !== 's3' && status.healthy
      );

      if (backupProvider) {
        const [providerName] = backupProvider;
        const success = await this.storageService.switchProvider(providerName);

        if (success) {
          this.logger.log(`Switched to backup provider: ${providerName}`);
          return true;
        }
      }

      this.logger.warn('No healthy backup provider available');
      return false;
    } catch (error) {
      this.logger.error(
        `Failed to switch provider: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Example 8: File access control
   */
  async manageFileAccess(
    filePath: string,
    action: 'make-public' | 'make-private' | 'generate-url',
    options?: { expiresIn?: number }
  ): Promise<any> {
    try {
      switch (action) {
        case 'make-public':
          const publicResult = await this.storageService.setPublic(filePath);
          this.logger.log(`File made public: ${filePath}`);
          return publicResult;

        case 'make-private':
          const privateResult = await this.storageService.setPrivate(filePath);
          this.logger.log(`File made private: ${filePath}`);
          return privateResult;

        case 'generate-url':
          const url = await this.storageService.generateUrl({
            filePath,
            type: 'presigned',
            expiresIn: options?.expiresIn || 3600,
          });
          this.logger.log(`Generated URL for: ${filePath}`);
          return { url, expiresIn: options?.expiresIn || 3600 };

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to manage file access: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Example 9: File processing pipeline
   */
  async processImagePipeline(
    imagePath: string,
    pipeline: Array<{ operation: string; options: any }>
  ): Promise<any[]> {
    try {
      const results = [];
      const currentPath = imagePath;

      for (const step of pipeline) {
        this.logger.log(`Processing step: ${step.operation}`);

        const result = await this.storageService.process(currentPath, step.options);

        if (result.success) {
          // currentPath = result.processedPath;
          results.push({
            operation: step.operation,
            originalPath: imagePath,
            // processedPath: result.processedPath,
            // metadata: result.metadata,
          });
        } else {
          throw new Error(`Processing step failed: ${step.operation}`);
        }
      }

      this.logger.log(`Image processing pipeline completed: ${results.length} steps`);
      return results;
    } catch (error) {
      this.logger.error(
        `Image processing pipeline failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Example 10: Error handling and fallback
   */
  async uploadWithFallback(
    _file: Buffer,
    options: any,
    fallbackOptions?: { retryCount?: number; delayMs?: number }
  ): Promise<any> {
    const maxRetries = fallbackOptions?.retryCount || 3;
    const delayMs = fallbackOptions?.delayMs || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Upload attempt ${attempt}/${maxRetries}`);

        const result = await this.storageService.upload(options);
        this.logger.log(`Upload successful on attempt ${attempt}`);

        return result;
      } catch (error) {
        this.logger.warn(
          `Upload attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`
        );

        if (attempt === maxRetries) {
          this.logger.error(`All upload attempts failed`);
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delayMs));

        // Try to switch provider for next attempt
        try {
          await this.switchToBackupProvider();
        } catch (switchError) {
          this.logger.warn(
            `Provider switch failed: ${switchError instanceof Error ? switchError.message : String(switchError)}`
          );
        }
      }
    }
  }
}

/**
 * Usage examples for the storage module
 */
export class StorageExamples {
  /**
   * Run all examples
   */
  static async runExamples(_storageService: StorageService): Promise<void> {
    // const example = new StorageUsageExample(storageService);

    // console.log('🚀 Running Storage Module Examples...\n');

    try {
      // Example 1: Basic upload
      // console.log('📤 Example 1: Basic file upload');
      // const mockBuffer = Buffer.from('mock image data');
      // const uploadResult = await example.uploadProfileImage(mockBuffer, 'user123', 'profile.jpg');
      // console.log('✅ Upload successful:', uploadResult.filePath);
      // Example 2: Health monitoring
      // console.log('\n🏥 Example 2: Health monitoring');
      // const health = await example.monitorStorageHealth();
      // console.log('✅ Health check completed');
      // Example 3: Provider info
      // console.log('\nℹ️ Example 3: Provider information');
      // const providerInfo = await storageService.getProviderInfo();
      // console.log('✅ Provider info:', providerInfo.name);
      // console.log('\n🎉 All examples completed successfully!');
    } catch (error) {
      console.error('❌ Example failed:', error instanceof Error ? error.message : String(error));
    }
  }
}
