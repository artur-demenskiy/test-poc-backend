import { Readable } from 'stream';
import { Buffer } from 'buffer';

/**
 * Core Storage Interface - Simplified and focused
 */
export interface IStorageProvider {
  /**
   * Upload a file to storage
   */
  upload(file: Buffer | Readable, path: string, options?: UploadOptions): Promise<UploadResult>;

  /**
   * Download a file from storage
   */
  download(path: string): Promise<DownloadResult>;

  /**
   * Delete a file from storage
   */
  delete(path: string): Promise<DeleteResult>;

  /**
   * Check if a file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file metadata
   */
  getMetadata(path: string): Promise<FileMetadata>;

  /**
   * Generate a URL for file access
   */
  getUrl(path: string, options?: UrlOptions): Promise<string>;

  /**
   * List files in a directory
   */
  listFiles(path: string, options?: ListOptions): Promise<ListResult>;

  /**
   * Get provider health status
   */
  isHealthy(): Promise<boolean>;
}

/**
 * Upload options
 */
export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  public?: boolean;
}

/**
 * Upload result
 */
export interface UploadResult {
  success: boolean;
  path: string;
  size: number;
  url?: string;
  error?: string;
}

/**
 * Download result
 */
export interface DownloadResult {
  success: boolean;
  content: Buffer | Readable;
  metadata: FileMetadata;
  error?: string;
}

/**
 * Delete result
 */
export interface DeleteResult {
  success: boolean;
  path: string;
  error?: string;
}

/**
 * File metadata
 */
export interface FileMetadata {
  path: string;
  size: number;
  contentType: string;
  lastModified: Date;
  public: boolean;
  metadata?: Record<string, string>;
}

/**
 * URL options
 */
export interface UrlOptions {
  expiresIn?: number; // seconds
  public?: boolean;
}

/**
 * List options
 */
export interface ListOptions {
  recursive?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * List result
 */
export interface ListResult {
  success: boolean;
  files: FileInfo[];
  error?: string;
}

/**
 * File info for listing
 */
export interface FileInfo {
  path: string;
  name: string;
  size: number;
  lastModified: Date;
}
