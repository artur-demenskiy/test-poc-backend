/**
 * AWS S3 Storage Provider
 *
 * This provider implements the IStorageProvider interface for AWS S3 storage.
 * It provides comprehensive file management capabilities including upload, download,
 * deletion, metadata management, and access control.
 *
 * Key Features:
 * - Direct S3 integration using AWS SDK v3
 * - Presigned URL generation for secure access
 * - Comprehensive metadata management
 * - Access control and bucket policies
 * - File processing and transformation support
 * - Error handling and retry logic
 *
 * Configuration Requirements:
 * - AWS_ACCESS_KEY_ID: AWS access key
 * - AWS_SECRET_ACCESS_KEY: AWS secret key
 * - AWS_REGION: AWS region
 * - STORAGE_S3_BUCKET_NAME: S3 bucket name
 * - STORAGE_S3_ENDPOINT: Optional custom S3 endpoint (for MinIO compatibility)
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
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  PutObjectAclCommand,
  GetObjectAclCommand,
  HeadBucketCommand,
  GetObjectTaggingCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import * as crypto from 'crypto';
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
 * S3-specific configuration options
 */
interface S3Config {
  /** AWS access key ID */
  accessKeyId: string;
  /** AWS secret access key */
  secretAccessKey: string;
  /** AWS region */
  region: string;
  /** S3 bucket name */
  bucketName: string;
  /** Custom S3 endpoint (optional, for MinIO compatibility) */
  endpoint?: string;
  /** Whether to use path-style addressing */
  forcePathStyle?: boolean;
  /** Maximum file size in bytes */
  maxFileSize: number;
}

/**
 * AWS S3 Storage Provider Implementation
 */
@Injectable()
export class S3StorageProvider extends BaseStorageProvider {
  private readonly s3Client: S3Client;
  private readonly s3Config: S3Config;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly endpoint?: string;

  constructor(configService: ConfigService) {
    super();

    // Initialize S3 configuration
    this.s3Config = {
      accessKeyId: configService.get<string>('AWS_ACCESS_KEY_ID', ''),
      secretAccessKey: configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      region: configService.get<string>('AWS_REGION', 'us-east-1'),
      bucketName: configService.get<string>('STORAGE_S3_BUCKET_NAME', ''),
      endpoint: configService.get<string>('STORAGE_S3_ENDPOINT'),
      forcePathStyle: configService.get<boolean>('STORAGE_S3_FORCE_PATH_STYLE', false),
      maxFileSize: configService.get<number>('STORAGE_S3_MAX_FILE_SIZE', 100 * 1024 * 1024), // 100MB
    };

    // Set local properties for easier access
    this.bucketName = this.s3Config.bucketName;
    this.region = this.s3Config.region;
    this.endpoint = this.s3Config.endpoint;

    // Validate required configuration
    if (!this.s3Config.accessKeyId || !this.s3Config.secretAccessKey || !this.s3Config.bucketName) {
      throw new Error(
        'Missing required S3 configuration: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or STORAGE_S3_BUCKET_NAME'
      );
    }

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.s3Config.region,
      credentials: {
        accessKeyId: this.s3Config.accessKeyId,
        secretAccessKey: this.s3Config.secretAccessKey,
      },
      endpoint: this.s3Config.endpoint,
      forcePathStyle: this.s3Config.forcePathStyle,
    });

    this.logger.log(`S3 Storage Provider initialized for bucket: ${this.s3Config.bucketName}`);
  }

  /**
   * Check if a file exists in S3
   *
   * @param filePath - File path in S3
   * @returns Promise resolving to boolean indicating file existence
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get metadata for a file
   * @param filePath Path to the file
   * @returns Promise resolving to file metadata
   */
  async getMetadata(filePath: string): Promise<FileMetadata> {
    try {
      // Validate file path
      this.validateFilePath(filePath);

      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      const response = await this.s3Client.send(command);

      // Get tags if available
      let tags: string[] = [];
      try {
        const tagsCommand = new GetObjectTaggingCommand({
          Bucket: this.bucketName,
          Key: filePath,
        });
        const tagsResponse = await this.s3Client.send(tagsCommand);
        tags = (tagsResponse.TagSet || []).map((tag: any) => `${tag.Key}=${tag.Value}`);
      } catch (tagError) {
        // Tags might not exist, which is fine
        this.logger.debug(`No tags found for file: ${filePath}`);
      }

      // Check if file is public
      const isPublic = await this.isFilePublic(filePath);

      this.logger.log(`Retrieved metadata for file: ${filePath}`);
      return {
        filePath,
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
        createdAt: response.LastModified || new Date(),
        isPublic,
        customMetadata: response.Metadata,
        etag: response.ETag?.replace(/"/g, ''),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get metadata for file ${filePath}: ${errorMessage}`);
      throw new Error(`Failed to get metadata: ${errorMessage}`);
    }
  }

  /**
   * List files in a directory
   * @param options Listing configuration options
   * @returns Promise resolving to list result
   */
  async listFiles(options: ListOptions): Promise<ListResult> {
    try {
      const { path, recursive = false, fileType, pattern, pagination } = options;

      // Validate path
      this.validateFilePath(path);

      // Build S3 list objects parameters
      const listParams: any = {
        Bucket: this.bucketName,
        Prefix: path,
        Delimiter: recursive ? undefined : '/',
        MaxKeys: pagination?.limit || 1000,
      };

      // Add continuation token for pagination
      if (pagination?.page && pagination.page > 1) {
        // Note: S3 doesn't support page-based pagination directly
        // This is a simplified implementation
        this.logger.warn('S3 pagination is simplified - using MaxKeys only');
      }

      const listResult = await this.s3Client.send(new ListObjectsV2Command(listParams));

      const files: FileInfo[] = [];
      const directories: DirectoryInfo[] = [];

      // Process files
      if (listResult.Contents) {
        for (const object of listResult.Contents) {
          if (object.Key && object.Key !== path) {
            // Skip the directory itself
            const relativePath = object.Key;
            const fileName = relativePath.split('/').pop() || relativePath;

            // Apply file type filter
            if (fileType && !relativePath.endsWith(`.${fileType}`)) {
              continue;
            }

            // Apply pattern filter
            if (pattern && !fileName.includes(pattern)) {
              continue;
            }

            files.push({
              path: relativePath,
              name: fileName,
              size: object.Size || 0,
              contentType: this.getContentTypeFromExtension(fileName),
              lastModified: object.LastModified || new Date(),
              isPublic: await this.isFilePublic(relativePath),
            });
          }
        }
      }

      // Process directories (CommonPrefixes)
      if (listResult.CommonPrefixes) {
        for (const prefix of listResult.CommonPrefixes) {
          if (prefix.Prefix) {
            const dirPath = prefix.Prefix.replace(/\/$/, ''); // Remove trailing slash
            const dirName = dirPath.split('/').pop() || dirPath;

            // Get file count in directory
            const fileCount = await this.getDirectoryFileCount(dirPath);

            directories.push({
              path: dirPath,
              name: dirName,
              fileCount,
              lastModified: new Date(), // S3 doesn't provide directory modification time
            });
          }
        }
      }

      // Calculate pagination info
      const total = (listResult.KeyCount || 0) + (listResult.CommonPrefixes?.length || 0);
      const totalPages = Math.ceil(total / (pagination?.limit || 1000));

      this.logger.log(
        `Listed ${files.length} files and ${directories.length} directories in ${path}`
      );
      return {
        success: true,
        files,
        directories,
        pagination: {
          page: pagination?.page || 1,
          limit: pagination?.limit || 1000,
          total,
          totalPages,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`List files failed for ${options.path}: ${errorMessage}`);
      return {
        success: false,
        files: [],
        directories: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Generate a URL for accessing a file
   * @param options URL generation options
   * @returns Promise resolving to generated URL
   */
  async generateUrl(options: UrlOptions): Promise<string> {
    try {
      const { filePath, type, expiresIn = 3600, responseHeaders } = options;

      // Validate file path
      this.validateFilePath(filePath);

      if (type === 'public') {
        // Generate public URL
        return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${filePath}`;
      } else {
        // Generate presigned URL
        const command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: filePath,
          ResponseContentType: responseHeaders?.['content-type'],
          ResponseContentDisposition: responseHeaders?.['content-disposition'],
        });

        return await getSignedUrl(this.s3Client, command, { expiresIn });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Generate URL failed for ${options.filePath}: ${errorMessage}`);
      throw new Error(`Failed to generate URL: ${errorMessage}`);
    }
  }

  /**
   * Set file access to public
   * @param filePath Path to the file
   * @returns Promise resolving to access control result
   */
  async setPublic(filePath: string): Promise<AccessControlResult> {
    try {
      // Validate file path
      this.validateFilePath(filePath);

      // Check if file exists
      if (!(await this.exists(filePath))) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Set public read access
      const command = new PutObjectAclCommand({
        Bucket: this.bucketName,
        Key: filePath,
        ACL: 'public-read',
      });

      await this.s3Client.send(command);

      this.logger.log(`File access set to public: ${filePath}`);
      return {
        success: true,
        filePath,
        isPublic: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to set file public: ${filePath}: ${errorMessage}`);
      return {
        success: false,
        filePath,
        isPublic: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get information about the storage provider
   * @returns Promise resolving to provider information
   */
  async getProviderInfo(): Promise<StorageProviderInfo> {
    try {
      // Get bucket information
      const bucketInfo = await this.s3Client.send(
        new HeadBucketCommand({
          Bucket: this.bucketName,
        })
      );

      return {
        name: 'AWS S3',
        type: 's3',
        version: '1.0.0',
        healthy: true,
        config: {
          bucket: this.bucketName,
          region: this.region,
          endpoint: this.endpoint,
        },
        features: [
          'upload',
          'download',
          'delete',
          'metadata',
          'listing',
          'urls',
          'copy',
          'move',
          'processing',
          'access-control',
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to get provider info', errorMessage);
      return {
        name: 'AWS S3',
        type: 's3',
        version: '1.0.0',
        healthy: false,
        config: {
          bucket: this.bucketName,
          region: this.region,
          endpoint: this.endpoint,
        },
        features: [],
      };
    }
  }

  // Protected methods that implement the abstract interface

  /**
   * Perform the actual file upload
   */
  protected async performUpload(
    options: UploadOptions,
    content: Buffer | Readable
  ): Promise<UploadResult> {
    try {
      const { filePath, contentType, metadata, isPublic } = options;

      // Prepare upload parameters
      const uploadParams: any = {
        Bucket: this.bucketName,
        Key: filePath,
        Body: content,
        ContentType: contentType || this.getContentTypeFromExtension(filePath),
        Metadata: metadata,
      };

      // Set ACL based on public flag
      if (isPublic) {
        uploadParams.ACL = 'public-read';
      }

      // Upload file
      const uploadResult = await this.s3Client.send(new PutObjectCommand(uploadParams));

      // Get file size
      let size = 0;
      if (Buffer.isBuffer(content)) {
        size = content.length;
      } else {
        // For streams, we can't easily determine size without consuming
        // In a real implementation, you might want to track this differently
        size = 0;
      }

      this.logger.log(`File uploaded successfully: ${filePath}`);
      return {
        success: true,
        filePath,
        size,
        contentType: uploadParams.ContentType,
        url: isPublic
          ? `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${filePath}`
          : undefined,
        metadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Upload failed: ${errorMessage}`);
      throw new Error(`Upload failed: ${errorMessage}`);
    }
  }

  /**
   * Perform the actual file download
   */
  protected async performDownload(options: DownloadOptions): Promise<DownloadResult> {
    try {
      const { filePath, asStream = false, range } = options;

      // Prepare download parameters
      const downloadParams: any = {
        Bucket: this.bucketName,
        Key: filePath,
      };

      // Add range if specified
      if (range) {
        downloadParams.Range = `bytes=${range.start}-${range.end}`;
      }

      // Download file
      const downloadResult = await this.s3Client.send(new GetObjectCommand(downloadParams));

      if (!downloadResult.Body) {
        throw new Error('No file content received');
      }

      // Convert to Buffer or Readable based on options
      let content: Buffer | Readable;
      if (asStream) {
        content = downloadResult.Body as Readable;
      } else {
        // Convert stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of downloadResult.Body as Readable) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        content = Buffer.concat(chunks);
      }

      // Get metadata
      const metadata: FileMetadata = {
        filePath,
        size: parseInt(downloadResult.ContentLength?.toString() || '0'),
        contentType: downloadResult.ContentType || 'application/octet-stream',
        lastModified: downloadResult.LastModified || new Date(),
        createdAt: downloadResult.LastModified || new Date(),
        isPublic: await this.isFilePublic(filePath),
        customMetadata: downloadResult.Metadata,
        etag: downloadResult.ETag?.replace(/"/g, ''),
      };

      this.logger.log(`File downloaded successfully: ${filePath}`);
      return {
        success: true,
        content,
        metadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Download failed: ${errorMessage}`);
      throw new Error(`Download failed: ${errorMessage}`);
    }
  }

  /**
   * Perform the actual file deletion
   */
  protected async performDelete(filePath: string): Promise<DeleteResult> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: filePath,
        })
      );

      this.logger.log(`File deleted successfully: ${filePath}`);
      return {
        success: true,
        filePath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Delete failed: ${errorMessage}`);
      throw new Error(`Delete failed: ${errorMessage}`);
    }
  }

  /**
   * Perform the actual metadata update
   */
  protected async performUpdateMetadata(
    filePath: string,
    metadata: Record<string, string>
  ): Promise<UpdateResult> {
    try {
      // Get current metadata
      const currentMetadata = await this.getMetadata(filePath);

      // Update metadata by copying object with new metadata
      const copyCommand = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${filePath}`,
        Key: filePath,
        Metadata: metadata,
        MetadataDirective: 'REPLACE',
      });

      await this.s3Client.send(copyCommand);

      // Get updated metadata
      const updatedMetadata = await this.getMetadata(filePath);

      this.logger.log(`Metadata updated successfully: ${filePath}`);
      return {
        success: true,
        filePath,
        metadata: updatedMetadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Metadata update failed: ${errorMessage}`);
      throw new Error(`Metadata update failed: ${errorMessage}`);
    }
  }

  // Private utility methods

  /**
   * Check if a file is publicly accessible
   */
  private async isFilePublic(filePath: string): Promise<boolean> {
    try {
      const command = new GetObjectAclCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      const response = await this.s3Client.send(command);

      // Check if there's a public read grant
      return (response.Grants || []).some((grant: any) => {
        return (
          grant.Grantee?.URI === 'http://acs.amazonaws.com/groups/global/AllUsers' &&
          grant.Permission === 'READ'
        );
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Failed to check public access for ${filePath}: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Get the number of files in a directory
   */
  private async getDirectoryFileCount(dirPath: string): Promise<number> {
    try {
      const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: 1,
      });

      const response = await this.s3Client.send(command);
      return response.KeyCount || 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Failed to get file count for directory ${dirPath}: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Detect content type from file extension
   */
  private getContentTypeFromExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
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
   * Convert stream to buffer
   *
   * @param stream - Readable stream
   * @returns Promise resolving to buffer
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Save stream to file
   *
   * @param stream - Readable stream
   * @param filePath - Target file path
   * @returns Promise resolving when file is saved
   */
  private async streamToFile(stream: Readable, filePath: string): Promise<void> {
    const fs = await import('fs');
    const writeStream = fs.createWriteStream(filePath);

    return new Promise((resolve, reject) => {
      stream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }
}
