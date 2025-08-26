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

import { Injectable } from '@nestjs/common';
import { Buffer } from 'buffer';
import { StorageService } from '../storage.service';

/**
 * Example usage of the simplified Storage Service
 */
@Injectable()
export class StorageUsageExample {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Example: Upload a file
   */
  async uploadExample(): Promise<void> {
    try {
      // Create a simple text file
      const content = Buffer.from('Hello, World! This is a test file.');
      const filePath = 'examples/test.txt';

      const result = await this.storageService.upload(content, filePath, {
        contentType: 'text/plain',
        metadata: { author: 'example', version: '1.0' },
        public: false,
      });

      if ((result as Record<string, unknown>).success) {
        console.log(`File uploaded successfully: ${(result as Record<string, unknown>).path}`);
        console.log(`File size: ${(result as Record<string, unknown>).size} bytes`);

        if ((result as Record<string, unknown>).url) {
          console.log(`File URL: ${(result as Record<string, unknown>).url}`);
        }
      } else {
        console.error(`Upload failed: ${(result as Record<string, unknown>).error}`);
      }
    } catch (error) {
      console.error(`Upload error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Example: Download a file
   */
  async downloadExample(): Promise<void> {
    try {
      const filePath = 'examples/test.txt';
      const result = await this.storageService.download(filePath);

      if ((result as Record<string, unknown>).success) {
        const metadata = (result as Record<string, unknown>).metadata as Record<string, unknown>;
        console.log(`File downloaded successfully: ${metadata.path}`);
        console.log(`File size: ${metadata.size} bytes`);
        console.log(`Content type: ${metadata.contentType}`);
        console.log(`Last modified: ${metadata.lastModified}`);

        // Process the content
        const content = (result as Record<string, unknown>).content;
        if (Buffer.isBuffer(content)) {
          console.log(`File content: ${content.toString()}`);
        }
      } else {
        console.error(`Download failed: ${(result as Record<string, unknown>).error}`);
      }
    } catch (error) {
      console.error(`Download error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Example: List files
   */
  async listFilesExample(): Promise<void> {
    try {
      const result = await this.storageService.listFiles('examples/', {
        recursive: true,
        limit: 10,
      });

      if ((result as Record<string, unknown>).success) {
        console.log('Files in examples directory:');
        ((result as Record<string, unknown>).files as Record<string, unknown>[]).forEach(
          (file: Record<string, unknown>) => {
            console.log(`- ${file.name} (${file.size} bytes, modified: ${file.lastModified})`);
          }
        );
      } else {
        console.error(`Failed to list files: ${(result as Record<string, unknown>).error}`);
      }
    } catch (error) {
      console.error(`List files error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Example: Get file metadata
   */
  async getMetadataExample(): Promise<void> {
    try {
      const filePath = 'examples/test.txt';
      const metadata = await this.storageService.getMetadata(filePath);

      console.log('File metadata:');
      console.log(`Path: ${(metadata as Record<string, unknown>).path}`);
      console.log(`Size: ${(metadata as Record<string, unknown>).size} bytes`);
      console.log(`Content type: ${(metadata as Record<string, unknown>).contentType}`);
      console.log(`Last modified: ${(metadata as Record<string, unknown>).lastModified}`);
      console.log(`Public: ${(metadata as Record<string, unknown>).public}`);
      console.log(`Custom metadata:`, (metadata as Record<string, unknown>).metadata);
    } catch (error) {
      console.error(
        `Get metadata error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Example: Generate URL
   */
  async generateUrlExample(): Promise<void> {
    try {
      const filePath = 'examples/test.txt';

      // Generate public URL
      const publicUrl = await this.storageService.getUrl(filePath, { public: true });
      console.log(`Public URL: ${publicUrl}`);

      // Generate presigned URL (expires in 1 hour)
      const presignedUrl = await this.storageService.getUrl(filePath, {
        public: false,
        expiresIn: 3600,
      });
      console.log(`Presigned URL: ${presignedUrl}`);
    } catch (error) {
      console.error(
        `Generate URL error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Example: Delete a file
   */
  async deleteFileExample(): Promise<void> {
    try {
      const filePath = 'examples/test.txt';
      const result = await this.storageService.delete(filePath);

      if ((result as Record<string, unknown>).success) {
        console.log(`File deleted successfully: ${(result as Record<string, unknown>).path}`);
      } else {
        console.error(`Deletion failed: ${(result as Record<string, unknown>).error}`);
      }
    } catch (error) {
      console.error(`Delete file error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Example: Check if file exists
   */
  async checkExistsExample(): Promise<void> {
    try {
      const filePath = 'examples/test.txt';
      const exists = await this.storageService.exists(filePath);

      if (exists) {
        console.log(`File ${filePath} exists`);
      } else {
        console.log(`File ${filePath} does not exist`);
      }
    } catch (error) {
      console.error(
        `Check exists error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Example: Switch storage provider
   */
  async switchProviderExample(): Promise<void> {
    try {
      // Get current providers
      const providers = this.storageService.getProviders();
      console.log('Available providers:');
      providers.forEach((provider, name) => {
        console.log(`- ${name}: ${provider.constructor.name}`);
      });

      // Switch to a different provider (if available)
      const availableProviders = Array.from(providers.keys());
      if (availableProviders.length > 1) {
        const newProvider = availableProviders.find(p => p !== 's3');
        if (newProvider) {
          await this.storageService.switchProvider(newProvider);
          console.log(`Switched to provider: ${newProvider}`);
        }
      }
    } catch (error) {
      console.error(
        `Switch provider error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Example: Health check
   */
  async healthCheckExample(): Promise<void> {
    try {
      const isHealthy = await this.storageService.isHealthy();

      if (isHealthy) {
        console.log('Storage service is healthy');
      } else {
        console.log('Storage service is not healthy');
      }
    } catch (error) {
      console.error(
        `Health check error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Run all examples
   */
  async runAllExamples(): Promise<void> {
    console.log('=== Storage Service Examples ===\n');

    await this.healthCheckExample();
    console.log('');

    await this.uploadExample();
    console.log('');

    await this.checkExistsExample();
    console.log('');

    await this.getMetadataExample();
    console.log('');

    await this.generateUrlExample();
    console.log('');

    await this.listFilesExample();
    console.log('');

    await this.downloadExample();
    console.log('');

    await this.deleteFileExample();
    console.log('');

    await this.switchProviderExample();
    console.log('');

    console.log('=== Examples completed ===');
  }
}
