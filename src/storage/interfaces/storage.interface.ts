import { Readable } from 'stream';
import { Buffer } from 'buffer';

/**
 * Core Storage Interface for Pluggable Storage Layer
 *
 * This interface defines the contract that all storage providers must implement.
 * It provides a unified API for file operations across different storage backends.
 */
export interface IStorageProvider {
  /**
   * Upload a file to storage
   * @param options Upload configuration options
   * @returns Promise resolving to upload result with file information
   */
  upload(options: UploadOptions): Promise<UploadResult>;

  /**
   * Download a file from storage
   * @param options Download configuration options
   * @returns Promise resolving to download result with file content
   */
  download(options: DownloadOptions): Promise<DownloadResult>;

  /**
   * Delete a file from storage
   * @param filePath Path to the file to delete
   * @returns Promise resolving to deletion result
   */
  delete(filePath: string): Promise<DeleteResult>;

  /**
   * Check if a file exists in storage
   * @param filePath Path to the file to check
   * @returns Promise resolving to boolean indicating existence
   */
  exists(filePath: string): Promise<boolean>;

  /**
   * Get metadata for a file
   * @param filePath Path to the file
   * @returns Promise resolving to file metadata
   */
  getMetadata(filePath: string): Promise<FileMetadata>;

  /**
   * Update metadata for a file
   * @param filePath Path to the file
   * @param metadata New metadata to set
   * @returns Promise resolving to update result
   */
  updateMetadata(filePath: string, metadata: Record<string, string>): Promise<UpdateResult>;

  /**
   * List files in a directory
   * @param options Listing configuration options
   * @returns Promise resolving to list result with file information
   */
  listFiles(options: ListOptions): Promise<ListResult>;

  /**
   * Generate a URL for accessing a file
   * @param options URL generation options
   * @returns Promise resolving to generated URL
   */
  generateUrl(options: UrlOptions): Promise<string>;

  /**
   * Copy a file to a new location
   * @param options Copy configuration options
   * @returns Promise resolving to copy result
   */
  copy(options: CopyOptions): Promise<CopyResult>;

  /**
   * Move a file to a new location
   * @param sourcePath Current file path
   * @param destinationPath New file path
   * @returns Promise resolving to move result
   */
  move(sourcePath: string, destinationPath: string): Promise<MoveResult>;

  /**
   * Rename a file (alias for move)
   * @param oldPath Current file path
   * @param newPath New file path
   * @returns Promise resolving to rename result
   */
  rename(oldPath: string, newPath: string): Promise<MoveResult>;

  /**
   * Process a file (resize, compress, convert, etc.)
   * @param filePath Path to the file to process
   * @param options Processing configuration options
   * @returns Promise resolving to processing result
   */
  process(filePath: string, options: ProcessOptions): Promise<ProcessResult>;

  /**
   * Set file access to public
   * @param filePath Path to the file
   * @returns Promise resolving to access control result
   */
  setPublic(filePath: string): Promise<AccessControlResult>;

  /**
   * Set file access to private
   * @param filePath Path to the file
   * @returns Promise resolving to access control result
   */
  setPrivate(filePath: string): Promise<AccessControlResult>;

  /**
   * Get information about the storage provider
   * @returns Promise resolving to provider information
   */
  getProviderInfo(): Promise<StorageProviderInfo>;
}

/**
 * Upload configuration options
 */
export interface UploadOptions {
  /** File content as Buffer or Readable stream */
  content: Buffer | Readable;
  /** File path in storage (e.g., 'uploads/image.jpg') */
  filePath: string;
  /** MIME type of the file */
  contentType?: string;
  /** Additional metadata to store with the file */
  metadata?: Record<string, string>;
  /** Whether the file should be publicly accessible */
  isPublic?: boolean;
  /** Access control settings */
  accessControl?: {
    /** Whether the file is public */
    isPublic: boolean;
    /** Custom permissions */
    permissions?: string[];
  };
  /** File processing options to apply during upload */
  processOptions?: ProcessOptions;
}

/**
 * Upload result containing file information
 */
export interface UploadResult {
  /** Whether the upload was successful */
  success: boolean;
  /** Path where the file was stored */
  filePath: string;
  /** File size in bytes */
  size: number;
  /** MIME type of the file */
  contentType: string;
  /** URL to access the file (if available) */
  url?: string;
  /** Additional metadata */
  metadata?: Record<string, string>;
  /** Error message if upload failed */
  error?: string;
}

/**
 * Download configuration options
 */
export interface DownloadOptions {
  /** Path to the file to download */
  filePath: string;
  /** Whether to return as stream or buffer */
  asStream?: boolean;
  /** Specific byte range to download */
  range?: {
    start: number;
    end: number;
  };
}

/**
 * Download result containing file content
 */
export interface DownloadResult {
  /** Whether the download was successful */
  success: boolean;
  /** File content as Buffer or Readable stream */
  content: Buffer | Readable;
  /** File metadata */
  metadata: FileMetadata;
  /** Error message if download failed */
  error?: string;
}

/**
 * Delete operation result
 */
export interface DeleteResult {
  /** Whether the deletion was successful */
  success: boolean;
  /** Path of the deleted file */
  filePath: string;
  /** Error message if deletion failed */
  error?: string;
}

/**
 * File metadata information
 */
export interface FileMetadata {
  /** File path */
  filePath: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  contentType: string;
  /** Last modified timestamp */
  lastModified: Date;
  /** Creation timestamp */
  createdAt: Date;
  /** Whether the file is public */
  isPublic: boolean;
  /** Custom metadata */
  customMetadata?: Record<string, string>;
  /** ETag for caching */
  etag?: string;
}

/**
 * Update operation result
 */
export interface UpdateResult {
  /** Whether the update was successful */
  success: boolean;
  /** Path of the updated file */
  filePath: string;
  /** Updated metadata */
  metadata: FileMetadata;
  /** Error message if update failed */
  error?: string;
}

/**
 * File listing result
 */
export interface ListResult {
  /** Whether the listing was successful */
  success: boolean;
  /** List of files */
  files: FileInfo[];
  /** List of directories */
  directories: DirectoryInfo[];
  /** Pagination information */
  pagination?: {
    /** Current page */
    page: number;
    /** Items per page */
    limit: number;
    /** Total items */
    total: number;
    /** Total pages */
    totalPages: number;
  };
  /** Error message if listing failed */
  error?: string;
}

/**
 * File information for listing
 */
export interface FileInfo {
  /** File path */
  path: string;
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  contentType: string;
  /** Last modified timestamp */
  lastModified: Date;
  /** Whether the file is public */
  isPublic: boolean;
}

/**
 * Directory information for listing
 */
export interface DirectoryInfo {
  /** Directory path */
  path: string;
  /** Directory name */
  name: string;
  /** Number of files in directory */
  fileCount: number;
  /** Last modified timestamp */
  lastModified: Date;
}

/**
 * File listing options
 */
export interface ListOptions {
  /** Directory path to list */
  path: string;
  /** Whether to include subdirectories */
  recursive?: boolean;
  /** File type filter */
  fileType?: string;
  /** Search pattern */
  pattern?: string;
  /** Pagination options */
  pagination?: {
    /** Page number (1-based) */
    page: number;
    /** Items per page */
    limit: number;
  };
}

/**
 * URL generation options
 */
export interface UrlOptions {
  /** File path */
  filePath: string;
  /** URL type */
  type: 'public' | 'presigned';
  /** Expiration time for presigned URLs (in seconds) */
  expiresIn?: number;
  /** Response headers to include */
  responseHeaders?: Record<string, string>;
}

/**
 * Access control operation result
 */
export interface AccessControlResult {
  /** Whether the operation was successful */
  success: boolean;
  /** File path */
  filePath: string;
  /** New access status */
  isPublic: boolean;
  /** Error message if operation failed */
  error?: string;
}

/**
 * Storage provider information
 */
export interface StorageProviderInfo {
  /** Provider name */
  name: string;
  /** Provider type */
  type: 's3' | 'supabase' | 'gcs' | 'minio' | 'local';
  /** Provider version */
  version: string;
  /** Whether the provider is healthy */
  healthy: boolean;
  /** Provider-specific configuration */
  config: Record<string, unknown>;
  /** Supported features */
  features: string[];
}

/**
 * File processing options
 */
export interface ProcessOptions {
  /** Processing operations to perform */
  operations: {
    /** Resize image to specific dimensions */
    resize?: {
      width?: number;
      height?: number;
      fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    };
    /** Compress file */
    compress?: {
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp' | 'gif';
    };
    /** Convert to different format */
    convert?: {
      format: string;
      options?: Record<string, unknown>;
    };
    /** Apply filters or transformations */
    filters?: Array<{
      name: string;
      options?: Record<string, unknown>;
    }>;
  };
  /** Output file path (if different from input) */
  outputPath?: string;
  /** Whether to overwrite existing file */
  overwrite?: boolean;
  /** Additional processing options */
  options?: Record<string, unknown>;
}

/**
 * File processing result
 */
export interface ProcessResult {
  /** Whether the processing was successful */
  success: boolean;
  /** Path to the processed file */
  filePath: string;
  /** Original file path */
  originalPath: string;
  /** Processing operations applied */
  operations: string[];
  /** Error message if processing failed */
  error?: string;
}

/**
 * File copy options
 */
export interface CopyOptions {
  /** Source file path */
  sourcePath: string;
  /** Destination file path */
  destinationPath: string;
  /** Whether to overwrite existing file */
  overwrite?: boolean;
  /** Additional metadata for the copy */
  metadata?: Record<string, string>;
  /** Whether the copy should be public */
  isPublic?: boolean;
  /** Processing options for the copy */
  processOptions?: ProcessOptions;
}

/**
 * File copy result
 */
export interface CopyResult {
  /** Whether the copy was successful */
  success: boolean;
  /** Source file path */
  sourcePath: string;
  /** Destination file path */
  destinationPath: string;
  /** Copied file metadata */
  metadata: FileMetadata;
  /** Error message if copy failed */
  error?: string;
}

/**
 * File move result
 */
export interface MoveResult {
  /** Whether the move was successful */
  success: boolean;
  /** Original file path */
  oldPath: string;
  /** New file path */
  newPath: string;
  /** Moved file metadata */
  metadata: FileMetadata;
  /** Error message if move failed */
  error?: string;
}
