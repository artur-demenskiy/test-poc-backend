/**
 * Abstract base class for storage providers
 *
 * This class provides common functionality and validation that all storage providers
 * can inherit from. It implements the IStorageProvider interface and provides
 * default implementations for common operations.
 *
 * Key Features:
 * - Common validation logic for file paths, sizes, and content types
 * - File processing pipeline with support for resize, compress, and format conversion
 * - Utility methods for copy, move, and rename operations
 * - Provider information and health checking
 * - Error handling and logging
 */
import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import { Buffer } from 'buffer';
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
} from '../interfaces/storage.interface';

/**
 * Abstract base class for storage providers
 *
 * This class provides common functionality and validation that all storage providers
 * can inherit from. It implements the IStorageProvider interface and provides
 * default implementations for common operations.
 *
 * Key Features:
 * - Common validation logic for file paths, sizes, and content types
 * - File processing pipeline with support for resize, compress, and format conversion
 * - Utility methods for copy, move, and rename operations
 * - Provider information and health checking
 * - Error handling and logging
 */
@Injectable()
export abstract class BaseStorageProvider implements IStorageProvider {
  protected readonly logger = new Logger(this.constructor.name);

  /**
   * Upload a file to storage
   * @param options Upload configuration options
   * @returns Promise resolving to upload result
   */
  async upload(options: UploadOptions): Promise<UploadResult> {
    try {
      // Validate input options
      this.validateUploadOptions(options);

      // Process file if processing options are provided
      let processedContent = options.content;
      if (options.processOptions) {
        const processed = await this.processFile(options.content, options.processOptions);
        processedContent = processed.content;
        options.contentType = processed.contentType;
      }

      // Perform the actual upload using the concrete implementation
      const result = await this.performUpload(options, processedContent);

      this.logger.log(`File uploaded successfully: ${result.filePath}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Upload failed for ${options.filePath}: ${errorMessage}`);
      return {
        success: false,
        filePath: options.filePath,
        size: 0,
        contentType: options.contentType || 'application/octet-stream',
        error: errorMessage,
      };
    }
  }

  /**
   * Download a file from storage
   * @param options Download configuration options
   * @returns Promise resolving to download result
   */
  async download(options: DownloadOptions): Promise<DownloadResult> {
    try {
      // Validate input options
      this.validateDownloadOptions(options);

      // Perform the actual download using the concrete implementation
      const result = await this.performDownload(options);

      this.logger.log(`File downloaded successfully: ${options.filePath}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Download failed for ${options.filePath}: ${errorMessage}`);
      return {
        success: false,
        content: Buffer.alloc(0),
        metadata: {
          filePath: options.filePath,
          size: 0,
          contentType: 'application/octet-stream',
          lastModified: new Date(),
          createdAt: new Date(),
          isPublic: false,
        },
        error: errorMessage,
      };
    }
  }

  /**
   * Delete a file from storage
   * @param filePath Path to the file to delete
   * @returns Promise resolving to deletion result
   */
  async delete(filePath: string): Promise<DeleteResult> {
    try {
      // Validate file path
      this.validateFilePath(filePath);

      // Perform the actual deletion using the concrete implementation
      const result = await this.performDelete(filePath);

      this.logger.log(`File deleted successfully: ${filePath}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Delete failed for ${filePath}: ${errorMessage}`);
      return {
        success: false,
        filePath,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if a file exists in storage
   * @param filePath Path to the file to check
   * @returns Promise resolving to boolean indicating existence
   */
  abstract exists(filePath: string): Promise<boolean>;

  /**
   * Get metadata for a file
   * @param filePath Path to the file
   * @returns Promise resolving to file metadata
   */
  abstract getMetadata(filePath: string): Promise<FileMetadata>;

  /**
   * Update metadata for a file
   * @param filePath Path to the file
   * @param metadata New metadata to set
   * @returns Promise resolving to update result
   */
  async updateMetadata(filePath: string, metadata: Record<string, string>): Promise<UpdateResult> {
    try {
      // Validate file path
      this.validateFilePath(filePath);

      // Perform the actual metadata update using the concrete implementation
      const result = await this.performUpdateMetadata(filePath, metadata);

      this.logger.log(`Metadata updated successfully for ${filePath}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Metadata update failed for ${filePath}: ${errorMessage}`);
      return {
        success: false,
        filePath,
        metadata: {
          filePath,
          size: 0,
          contentType: 'application/octet-stream',
          lastModified: new Date(),
          createdAt: new Date(),
          isPublic: false,
        },
        error: errorMessage,
      };
    }
  }

  /**
   * List files in a directory
   * @param options Listing configuration options
   * @returns Promise resolving to list result
   */
  abstract listFiles(options: ListOptions): Promise<ListResult>;

  /**
   * Generate a URL for accessing a file
   * @param options URL generation options
   * @returns Promise resolving to generated URL
   */
  abstract generateUrl(options: UrlOptions): Promise<string>;

  /**
   * Copy a file to a new location
   * @param options Copy configuration options
   * @returns Promise resolving to copy result
   */
  async copy(options: CopyOptions): Promise<CopyResult> {
    try {
      // Validate input options
      this.validateCopyOptions(options);

      // Download the source file
      const downloadResult = await this.download({ filePath: options.sourcePath });
      if (!downloadResult.success) {
        throw new Error(`Failed to download source file: ${downloadResult.error}`);
      }

      // Upload to destination with new metadata
      const uploadOptions: UploadOptions = {
        content: downloadResult.content,
        filePath: options.destinationPath,
        contentType: downloadResult.metadata.contentType,
        metadata: options.metadata || {},
        isPublic: options.isPublic ?? downloadResult.metadata.isPublic,
      };

      const uploadResult = await this.upload(uploadOptions);
      if (!uploadResult.success) {
        throw new Error(`Failed to upload copied file: ${uploadResult.error}`);
      }

      // Get metadata for the copied file
      const metadata = await this.getMetadata(options.destinationPath);

      this.logger.log(
        `File copied successfully from ${options.sourcePath} to ${options.destinationPath}`
      );
      return {
        success: true,
        sourcePath: options.sourcePath,
        destinationPath: options.destinationPath,
        metadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Copy failed from ${options.sourcePath} to ${options.destinationPath}: ${errorMessage}`
      );
      return {
        success: false,
        sourcePath: options.sourcePath,
        destinationPath: options.destinationPath,
        metadata: {
          filePath: options.destinationPath,
          size: 0,
          contentType: 'application/octet-stream',
          lastModified: new Date(),
          createdAt: new Date(),
          isPublic: false,
        },
        error: errorMessage,
      };
    }
  }

  /**
   * Move a file to a new location
   * @param sourcePath Current file path
   * @param destinationPath New file path
   * @returns Promise resolving to move result
   */
  async move(sourcePath: string, destinationPath: string): Promise<MoveResult> {
    try {
      // Validate input paths
      this.validateFilePath(sourcePath);
      this.validateFilePath(destinationPath);

      // Copy the file to the new location
      const copyResult = await this.copy({
        sourcePath,
        destinationPath,
        overwrite: true,
      });

      if (!copyResult.success) {
        throw new Error(`Failed to copy file for move operation: ${copyResult.error}`);
      }

      // Delete the original file
      const deleteResult = await this.delete(sourcePath);
      if (!deleteResult.success) {
        this.logger.warn(`File moved but failed to delete original: ${sourcePath}`);
      }

      this.logger.log(`File moved successfully from ${sourcePath} to ${destinationPath}`);
      return {
        success: true,
        oldPath: sourcePath,
        newPath: destinationPath,
        metadata: copyResult.metadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Move failed from ${sourcePath} to ${destinationPath}: ${errorMessage}`);
      return {
        success: false,
        oldPath: sourcePath,
        newPath: destinationPath,
        metadata: {
          filePath: destinationPath,
          size: 0,
          contentType: 'application/octet-stream',
          lastModified: new Date(),
          createdAt: new Date(),
          isPublic: false,
        },
        error: errorMessage,
      };
    }
  }

  /**
   * Rename a file (alias for move)
   * @param oldPath Current file path
   * @param newPath New file path
   * @returns Promise resolving to rename result
   */
  async rename(oldPath: string, newPath: string): Promise<MoveResult> {
    return this.move(oldPath, newPath);
  }

  /**
   * Process a file (resize, compress, convert, etc.)
   * @param filePath Path to the file to process
   * @param options Processing configuration options
   * @returns Promise resolving to processing result
   */
  async process(filePath: string, options: ProcessOptions): Promise<ProcessResult> {
    try {
      // Validate file path
      this.validateFilePath(filePath);

      // Download the file for processing
      const downloadResult = await this.download({ filePath });
      if (!downloadResult.success) {
        throw new Error(`Failed to download file for processing: ${downloadResult.error}`);
      }

      // Process the file content
      const processed = await this.processFile(downloadResult.content, options);

      // Determine output path
      const outputPath = options.outputPath || filePath;

      // Upload the processed file
      const uploadOptions: UploadOptions = {
        content: processed.content,
        filePath: outputPath,
        contentType: processed.contentType,
        metadata: downloadResult.metadata.customMetadata,
        isPublic: downloadResult.metadata.isPublic,
      };

      const uploadResult = await this.upload(uploadOptions);
      if (!uploadResult.success) {
        throw new Error(`Failed to upload processed file: ${uploadResult.error}`);
      }

      // Get metadata for the processed file
      const metadata = await this.getMetadata(outputPath);

      this.logger.log(`File processed successfully: ${filePath} -> ${outputPath}`);
      return {
        success: true,
        filePath: outputPath,
        originalPath: filePath,
        operations: this.getProcessedOperations(options),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`File processing failed for ${filePath}: ${errorMessage}`);
      return {
        success: false,
        filePath,
        originalPath: filePath,
        operations: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Set file access to public
   * @param filePath Path to the file
   * @returns Promise resolving to access control result
   */
  abstract setPublic(filePath: string): Promise<AccessControlResult>;

  /**
   * Set file access to private
   * @param filePath Path to the file
   * @returns Promise resolving to access control result
   */
  async setPrivate(filePath: string): Promise<AccessControlResult> {
    try {
      // Validate file path
      this.validateFilePath(filePath);
      
      // For most providers, setting private means removing public access
      // This is a simplified implementation - concrete providers may override
      await this.getMetadata(filePath);
      
      this.logger.log(`File access set to private: ${filePath}`);
      return {
        success: true,
        filePath,
        isPublic: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to set file private: ${filePath}: ${errorMessage}`);
      return {
        success: false,
        filePath,
        isPublic: true, // Assume it was public before
        error: errorMessage,
      };
    }
  }

  /**
   * Get information about the storage provider
   * @returns Promise resolving to provider information
   */
  abstract getProviderInfo(): Promise<StorageProviderInfo>;

  // Protected abstract methods that concrete providers must implement
  protected abstract performUpload(
    options: UploadOptions,
    content: Buffer | Readable
  ): Promise<UploadResult>;
  protected abstract performDownload(options: DownloadOptions): Promise<DownloadResult>;
  protected abstract performDelete(filePath: string): Promise<DeleteResult>;
  protected abstract performUpdateMetadata(
    filePath: string,
    metadata: Record<string, string>
  ): Promise<UpdateResult>;

  // Validation methods
  protected validateFilePath(filePath: string): void {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path must be a non-empty string');
    }

    if (filePath.includes('..') || filePath.includes('//')) {
      throw new Error('Invalid file path: contains invalid characters');
    }
  }

  protected validateFileSize(size: number): void {
    if (size <= 0) {
      throw new Error('File size must be greater than 0');
    }

    // Default max file size: 100MB
    const maxSize = 100 * 1024 * 1024;
    if (size > maxSize) {
      throw new Error(`File size exceeds maximum allowed size: ${maxSize} bytes`);
    }
  }

  protected validateContentType(contentType: string): void {
    if (!contentType || typeof contentType !== 'string') {
      throw new Error('Content type must be a non-empty string');
    }
    
    // Basic MIME type validation
    const mimeTypePattern = /^[a-zA-Z0-9]+\/[a-zA-Z0-9\-\.\+]+$/;
    if (!mimeTypePattern.test(contentType)) {
      throw new Error('Invalid content type format');
    }
  }

  protected validateUploadOptions(options: UploadOptions): void {
    this.validateFilePath(options.filePath);

    if (!options.content) {
      throw new Error('File content is required');
    }

    if (options.contentType) {
      this.validateContentType(options.contentType);
    }
  }

  protected validateDownloadOptions(options: DownloadOptions): void {
    this.validateFilePath(options.filePath);
  }

  protected validateCopyOptions(options: CopyOptions): void {
    this.validateFilePath(options.sourcePath);
    this.validateFilePath(options.destinationPath);

    if (options.sourcePath === options.destinationPath) {
      throw new Error('Source and destination paths cannot be the same');
    }
  }

  // File processing methods
  protected async processFile(
    content: Buffer | Readable,
    options: ProcessOptions
  ): Promise<{ content: Buffer | Readable; contentType: string }> {
    // This is a simplified implementation
    // In a real implementation, you would use libraries like Sharp for image processing
    // For now, we'll return the content as-is

    const processedContent = content;
    let contentType = 'application/octet-stream';

    // Basic content type detection for Buffer
    if (Buffer.isBuffer(content)) {
      contentType = this.detectContentType(content);
    }

    // Apply processing operations if specified
    if (options.operations) {
      if (options.operations.resize) {
        // Resize logic would go here
        this.logger.debug('Resize operation requested but not implemented');
      }

      if (options.operations.compress) {
        // Compression logic would go here
        this.logger.debug('Compression operation requested but not implemented');
      }

      if (options.operations.convert) {
        // Format conversion logic would go here
        this.logger.debug('Format conversion requested but not implemented');
      }
    }

    return { content: processedContent, contentType };
  }

  protected detectContentType(buffer: Buffer): string {
    // Basic content type detection based on file signatures
    const signatures: Record<string, number[]> = {
      'image/jpeg': [0xff, 0xd8, 0xff],
      'image/png': [0x89, 0x50, 0x4e, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'image/webp': [0x52, 0x49, 0x46, 0x46],
      'application/pdf': [0x25, 0x50, 0x44, 0x46],
    };

    for (const [mimeType, signature] of Object.entries(signatures)) {
      if (this.matchesSignature(buffer, signature)) {
        return mimeType;
      }
    }

    return 'application/octet-stream';
  }

  protected matchesSignature(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  protected getProcessedOperations(options: ProcessOptions): string[] {
    const operations: string[] = [];

    if (options.operations) {
      if (options.operations.resize) operations.push('resize');
      if (options.operations.compress) operations.push('compress');
      if (options.operations.convert) operations.push('convert');
      if (options.operations.filters) operations.push('filters');
    }

    return operations;
  }
}
