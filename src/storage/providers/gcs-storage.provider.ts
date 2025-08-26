/**
 * Google Cloud Storage Provider
 *
 * This provider implements the IStorageProvider interface for Google Cloud Storage.
 * It provides comprehensive file management capabilities including upload, download,
 * deletion, metadata management, and access control using Google Cloud Storage API.
 *
 * Key Features:
 * - Direct GCS integration using Google Cloud Storage client
 * - Signed URL generation for secure access
 * - Comprehensive metadata management
 * - Access control and bucket policies
 * - File processing and transformation support
 * - Error handling and retry logic
 *
 * Configuration Requirements:
 * - GOOGLE_CLOUD_PROJECT_ID: Google Cloud project ID
 * - GOOGLE_CLOUD_PRIVATE_KEY: Google Cloud private key (JSON format)
 * - GOOGLE_CLOUD_CLIENT_EMAIL: Google Cloud client email
 * - STORAGE_GCS_BUCKET_NAME: GCS bucket name
 * - STORAGE_GCS_REGION: GCS bucket region
 *
 * Supported Operations:
 * ├── File Management: upload, download, delete, exists
 * ├── Metadata: getMetadata, updateMetadata, listFiles
 * ├── Access Control: generateUrl, setPublic, setPrivate
 * ├── Processing: resize, compress, convert format
 * └── Utilities: copy, move, rename
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage, Bucket, File } from '@google-cloud/storage';
import { Readable } from 'stream';
import * as path from 'path';
import { BaseStorageProvider } from '../base/base-storage.provider';
import {
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
  FileInfo,
  DirectoryInfo,
  ListOptions,
  UrlOptions,
} from '../interfaces/storage.interface';

/**
 * GCS-specific configuration options
 */
interface GCSConfig {
  /** Google Cloud project ID */
  projectId: string;
  /** Google Cloud private key */
  privateKey: string;
  /** Google Cloud client email */
  clientEmail: string;
  /** GCS bucket name */
  bucketName: string;
  /** GCS bucket region */
  region: string;
  /** Maximum file size in bytes */
  maxFileSize: number;
}

/**
 * Google Cloud Storage Provider Implementation
 */
@Injectable()
export class GCSStorageProvider extends BaseStorageProvider {
  private readonly storage: Storage;
  private readonly bucket: Bucket;
  private readonly gcsConfig: GCSConfig;

  constructor(configService: ConfigService) {
    super(configService);

    // Initialize GCS configuration
    this.gcsConfig = {
      projectId: this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID', ''),
      privateKey: this.configService.get<string>('GOOGLE_CLOUD_PRIVATE_KEY', ''),
      clientEmail: this.configService.get<string>('GOOGLE_CLOUD_CLIENT_EMAIL', ''),
      bucketName: this.configService.get<string>('STORAGE_GCS_BUCKET_NAME', this.bucketName),
      region: this.configService.get<string>('STORAGE_GCS_REGION', 'us-central1'),
      maxFileSize: this.maxFileSize,
    };

    // Validate required configuration
    if (!this.gcsConfig.projectId || !this.gcsConfig.privateKey || !this.gcsConfig.clientEmail) {
      throw new Error('Google Cloud credentials are required for GCS storage provider');
    }

    // Parse private key (remove newlines and quotes)
    const privateKey = this.gcsConfig.privateKey.replace(/\\n/g, '\n').replace(/"/g, '');

    // Initialize GCS client
    this.storage = new Storage({
      projectId: this.gcsConfig.projectId,
      credentials: {
        private_key: privateKey,
        client_email: this.gcsConfig.clientEmail,
      },
    });

    // Get bucket reference
    this.bucket = this.storage.bucket(this.gcsConfig.bucketName);

    this.logger.log(`GCS Storage Provider initialized for bucket: ${this.gcsConfig.bucketName}`);
  }

  /**
   * Check if a file exists in GCS
   *
   * @param filePath - File path in GCS
   * @returns Promise resolving to boolean indicating file existence
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      const file = this.bucket.file(filePath);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      this.logger.warn(`Failed to check file existence for ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get file metadata from GCS
   *
   * @param filePath - File path in GCS
   * @returns Promise resolving to file metadata
   */
  async getMetadata(filePath: string): Promise<FileMetadata> {
    try {
      const file = this.bucket.file(filePath);
      const [metadata] = await file.getMetadata();

      return {
        path: filePath,
        name: path.basename(filePath),
        size: parseInt(metadata.size) || 0,
        contentType: metadata.contentType || 'application/octet-stream',
        hash: metadata.md5Hash,
        custom: metadata.metadata || {},
        tags: metadata.metadata?.tags ? metadata.metadata.tags.split(',') : [],
        createdAt: metadata.timeCreated ? new Date(metadata.timeCreated) : new Date(),
        updatedAt: metadata.updated ? new Date(metadata.updated) : new Date(),
        lastAccessedAt: metadata.timeCreated ? new Date(metadata.timeCreated) : new Date(),
        public: await this.isFilePublic(filePath),
      };
    } catch (error) {
      this.logger.error(`Failed to get metadata for file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * List files in a GCS directory
   *
   * @param directoryPath - Directory path in GCS
   * @param options - Listing options
   * @returns Promise resolving to list result
   */
  async listFiles(directoryPath: string, options: ListOptions = {}): Promise<ListResult> {
    try {
      const prefix = directoryPath.endsWith('/') ? directoryPath : `${directoryPath}/`;

      const [files] = await this.bucket.getFiles({
        prefix,
        delimiter: options.delimiter || '/',
        maxResults: options.maxResults || 1000,
        pageToken: options.pageToken,
      });

      const [directories] = await this.bucket.getFiles({
        prefix,
        delimiter: '/',
        maxResults: options.maxResults || 1000,
        pageToken: options.pageToken,
      });

      const fileList: FileInfo[] = files
        .filter(file => file.name !== prefix) // Exclude the directory itself
        .map(file => ({
          path: file.name,
          name: path.basename(file.name),
          size: parseInt(file.metadata.size) || 0,
          contentType: file.metadata.contentType || 'application/octet-stream',
          lastModified: file.metadata.updated ? new Date(file.metadata.updated) : new Date(),
          public: false, // Will be updated below
        }));

      const directoryList: DirectoryInfo[] = directories
        .filter(file => file.name.endsWith('/') && file.name !== prefix)
        .map(file => ({
          path: file.name,
          name: path.basename(file.name.slice(0, -1)),
          createdAt: file.metadata.timeCreated ? new Date(file.metadata.timeCreated) : new Date(),
          fileCount: 0, // Will be updated below
        }));

      // Update public status for files
      for (const file of fileList) {
        file.public = await this.isFilePublic(file.path);
      }

      // Get file counts for directories
      for (const dir of directoryList) {
        dir.fileCount = await this.getDirectoryFileCount(dir.path);
      }

      return {
        files: fileList,
        directories: directoryList,
        pagination: {
          hasMore: files.length === (options.maxResults || 1000),
          totalCount: fileList.length + directoryList.length,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to list files in directory ${directoryPath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a signed URL for file access
   *
   * @param filePath - File path in GCS
   * @param options - URL generation options
   * @returns Promise resolving to signed URL
   */
  async generateUrl(filePath: string, options: UrlOptions = {}): Promise<string> {
    try {
      const file = this.bucket.file(filePath);

      if (options.public) {
        // Return public URL if file is public
        return `https://storage.googleapis.com/${this.gcsConfig.bucketName}/${filePath}`;
      }

      // Generate signed URL for private access
      const expiresIn = options.expiresIn || 3600; // Default 1 hour

      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
        responseDisposition: options.responseDisposition,
        responseType: this.getContentTypeFromKey(filePath),
        ...options.responseHeaders,
      });

      return url;
    } catch (error) {
      this.logger.error(`Failed to generate URL for file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Set file access level (public/private)
   *
   * @param filePath - File path in GCS
   * @param public - Whether the file should be publicly accessible
   * @returns Promise resolving to access control result
   */
  async setPublic(filePath: string, public: boolean): Promise<AccessControlResult> {
    try {
      const file = this.bucket.file(filePath);

      if (public) {
        // Make file public
        await file.makePublic();
      } else {
        // Make file private
        await file.makePrivate();
      }

      this.logger.log(`File access level updated: ${filePath} -> ${public ? 'public' : 'private'}`);

      return {
        success: true,
        path: filePath,
        public,
        updatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to update file access level for ${filePath}: ${error.message}`);
      return {
        success: false,
        path: filePath,
        public,
        updatedAt: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Get storage provider information
   *
   * @returns Object containing provider details and capabilities
   */
  getProviderInfo(): StorageProviderInfo {
    return {
      name: 'Google Cloud Storage',
      version: '1.0.0',
      capabilities: [
        'upload',
        'download',
        'delete',
        'metadata',
        'listing',
        'signed-urls',
        'access-control',
        'copy',
        'move',
        'processing',
        'versioning',
        'lifecycle',
      ],
      supportsPublicUrls: true,
      supportsProcessing: true,
      maxFileSize: this.gcsConfig.maxFileSize,
      supportedFormats: this.supportedFormats,
    };
  }

  // Protected methods implementation

  /**
   * Perform the actual file upload to GCS
   *
   * @param fileData - File data to upload
   * @param options - Upload options
   * @returns Promise resolving to upload result
   */
  protected async performUpload(
    fileData: Buffer | NodeJS.ReadableStream | string,
    options: UploadOptions
  ): Promise<UploadResult> {
    try {
      let uploadStream: NodeJS.ReadableStream;
      let fileSize: number;

      // Prepare file data
      if (typeof fileData === 'string') {
        // File path - create read stream
        const fs = await import('fs');
        uploadStream = fs.createReadStream(fileData);
        const stats = fs.statSync(fileData);
        fileSize = stats.size;
      } else if (Buffer.isBuffer(fileData)) {
        // Buffer - create stream
        const { Readable } = await import('stream');
        uploadStream = new Readable();
        uploadStream.push(fileData);
        uploadStream.push(null);
        fileSize = fileData.length;
      } else {
        // Stream
        uploadStream = fileData;
        fileSize = 0; // Will be calculated during upload
      }

      // Prepare upload options
      const uploadOptions: any = {
        metadata: {
          contentType: options.contentType || this.getContentTypeFromKey(options.path),
          metadata: options.metadata || {},
        },
        resumable: false,
      };

      // Add tags if specified
      if (options.tags && options.tags.length > 0) {
        uploadOptions.metadata.metadata.tags = options.tags.join(',');
      }

      // Perform upload
      const file = this.bucket.file(options.path);
      await new Promise<void>((resolve, reject) => {
        uploadStream
          .pipe(file.createWriteStream(uploadOptions))
          .on('error', reject)
          .on('finish', resolve);
      });

      // Get uploaded file metadata
      const [metadata] = await file.getMetadata();

      // Generate public URL if file is public
      let publicUrl: string | undefined;
      if (options.public) {
        publicUrl = `https://storage.googleapis.com/${this.gcsConfig.bucketName}/${options.path}`;
      }

      return {
        success: true,
        path: options.path,
        publicUrl,
        size: fileSize,
        contentType: options.contentType || this.getContentTypeFromKey(options.path),
        metadata: {
          path: options.path,
          name: path.basename(options.path),
          size: fileSize,
          contentType: options.contentType || this.getContentTypeFromKey(options.path),
          hash: metadata.md5Hash,
          custom: options.metadata || {},
          tags: options.tags || [],
          createdAt: new Date(),
          updatedAt: new Date(),
          public: options.public || false,
        },
        uploadedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`GCS upload failed for path ${options.path}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform the actual file download from GCS
   *
   * @param filePath - File path in GCS
   * @param options - Download options
   * @returns Promise resolving to download result
   */
  protected async performDownload(
    filePath: string,
    options: DownloadOptions = {}
  ): Promise<DownloadResult> {
    try {
      const file = this.bucket.file(filePath);
      const [metadata] = await file.getMetadata();

      let downloadData: Buffer | NodeJS.ReadableStream | string;

      if (options.format === 'buffer') {
        // Download as buffer
        const [buffer] = await file.download();
        downloadData = buffer;
      } else if (options.format === 'file') {
        // Save to temporary file
        const tempPath = `/tmp/${path.basename(filePath)}`;
        await file.download({ destination: tempPath });
        downloadData = tempPath;
      } else {
        // Return as stream
        downloadData = file.createReadStream();
      }

      return {
        data: downloadData,
        metadata: await this.getMetadata(filePath),
        contentType: metadata.contentType || 'application/octet-stream',
        size: parseInt(metadata.size) || 0,
        lastModified: metadata.updated ? new Date(metadata.updated) : new Date(),
      };
    } catch (error) {
      this.logger.error(`GCS download failed for path ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform the actual file deletion from GCS
   *
   * @param filePath - File path in GCS
   * @returns Promise resolving to deletion result
   */
  protected async performDelete(filePath: string): Promise<DeleteResult> {
    try {
      const file = this.bucket.file(filePath);
      await file.delete();

      return {
        success: true,
        path: filePath,
        deletedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`GCS deletion failed for path ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform the actual metadata update in GCS
   *
   * @param filePath - File path in GCS
   * @param metadata - Updated metadata
   * @returns Promise resolving to update result
   */
  protected async performUpdateMetadata(
    filePath: string,
    metadata: FileMetadata
  ): Promise<UpdateResult> {
    try {
      const file = this.bucket.file(filePath);

      // Update metadata
      await file.setMetadata({
        metadata: {
          ...metadata.custom,
          tags: metadata.tags?.join(','),
        },
      });

      return {
        success: true,
        path: filePath,
        metadata,
        updatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`GCS metadata update failed for path ${filePath}: ${error.message}`);
      throw error;
    }
  }

  // Private utility methods

  /**
   * Check if a file is publicly accessible
   *
   * @param filePath - File path in GCS
   * @returns Promise resolving to boolean indicating public access
   */
  private async isFilePublic(filePath: string): Promise<boolean> {
    try {
      const file = this.bucket.file(filePath);
      const [acl] = await file.acl.get();

      // Check if there's a public read grant
      return acl.some(entry => entry.entity === 'allUsers' && entry.role === 'READER');
    } catch (error) {
      this.logger.warn(`Failed to check public access for file ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get content type from file key
   *
   * @param key - GCS object key
   * @returns Content type string
   */
  private getContentTypeFromKey(key: string): string {
    const ext = path.extname(key).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Get file count in directory
   *
   * @param directoryPath - Directory path
   * @returns Promise resolving to file count
   */
  private async getDirectoryFileCount(directoryPath: string): Promise<number> {
    try {
      const prefix = directoryPath.endsWith('/') ? directoryPath : `${directoryPath}/`;

      const [files] = await this.bucket.getFiles({
        prefix,
        maxResults: 1,
      });

      return files.length;
    } catch (error) {
      this.logger.warn(`Failed to get file count for directory ${directoryPath}: ${error.message}`);
      return 0;
    }
  }
}
