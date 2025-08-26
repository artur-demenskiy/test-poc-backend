/**
 * Base Storage Provider - Abstract base class for all storage providers
 */
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { Buffer } from 'buffer';
import {
  IStorageProvider,
  UploadOptions,
  UploadResult,
  DownloadResult,
  DeleteResult,
  FileMetadata,
  ListResult,
  UrlOptions,
  ListOptions,
} from '../interfaces/storage.interface';

/**
 * Base Storage Provider - Abstract base class for all storage providers
 */
@Injectable()
export abstract class BaseStorageProvider implements IStorageProvider {
  /**
   * Upload a file to storage
   */
  async upload(
    file: Buffer | Readable,
    path: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    try {
      return await this.performUpload(file, path, options);
    } catch (error) {
      return {
        success: false,
        path,
        size: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Download a file from storage
   */
  async download(path: string): Promise<DownloadResult> {
    try {
      return await this.performDownload(path);
    } catch (error) {
      return {
        success: false,
        content: Buffer.alloc(0),
        metadata: {
          path,
          size: 0,
          contentType: 'application/octet-stream',
          lastModified: new Date(),
          public: false,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete a file from storage
   */
  async delete(path: string): Promise<DeleteResult> {
    try {
      return await this.performDelete(path);
    } catch (error) {
      return {
        success: false,
        path,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if a file exists
   */
  abstract exists(path: string): Promise<boolean>;

  /**
   * Get file metadata
   */
  abstract getMetadata(path: string): Promise<FileMetadata>;

  /**
   * Generate a URL for file access
   */
  abstract getUrl(path: string, options?: UrlOptions): Promise<string>;

  /**
   * List files in a directory
   */
  abstract listFiles(path: string, options?: ListOptions): Promise<ListResult>;

  /**
   * Get provider health status
   */
  abstract isHealthy(): Promise<boolean>;

  // Protected methods for subclasses to implement

  /**
   * Perform the actual upload operation
   */
  protected abstract performUpload(
    file: Buffer | Readable,
    path: string,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Perform the actual download operation
   */
  protected abstract performDownload(path: string): Promise<DownloadResult>;

  /**
   * Perform the actual delete operation
   */
  protected abstract performDelete(path: string): Promise<DeleteResult>;

  /**
   * Get content type from file extension
   */
  protected getContentTypeFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
      txt: 'text/plain',
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      xml: 'application/xml',
      zip: 'application/zip',
      tar: 'application/x-tar',
      gz: 'application/gzip',
    };

    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Get file size from Buffer or Readable
   */
  protected getFileSize(file: Buffer | Readable): number {
    if (Buffer.isBuffer(file)) {
      return file.length;
    }
    return 0; // For streams, we can't determine size without reading
  }
}
