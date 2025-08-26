/**
 * Storage Controller - HTTP API for storage operations
 * 
 * This controller provides RESTful endpoints for file management operations
 * including upload, download, deletion, metadata management, and provider
 * administration. It uses the unified StorageService for all operations.
 * 
 * Key Features:
 * - File upload with multipart form data
 * - File download with streaming support
 * - Metadata management and file listing
 * - Provider health monitoring and switching
 * - File processing and transformation
 * - Access control and URL generation
 * 
 * Supported Endpoints:
 * ├── File Operations: POST /upload, GET /download/:path, DELETE /files/:path
 * ├── Metadata: GET /files/:path/metadata, PUT /files/:path/metadata
 * ├── Listing: GET /files, GET /files/:path
 * ├── Processing: POST /files/:path/process
 * ├── Access Control: PUT /files/:path/public, PUT /files/:path/private
 * ├── URLs: GET /files/:path/url
 * ├── Copy/Move: POST /files/:path/copy, POST /files/:path/move
 * └── Provider Management: GET /providers, GET /providers/health, POST /providers/switch
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  Res,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import {
  UploadOptions,
  DownloadOptions,
  ProcessOptions,
  ListOptions,
  UrlOptions,
  CopyOptions,
} from './interfaces/storage.interface';

/**
 * File upload response DTO
 */
interface FileUploadResponse {
  success: boolean;
  path: string;
  publicUrl?: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
}

/**
 * File metadata response DTO
 */
interface FileMetadataResponse {
  path: string;
  name: string;
  size: number;
  contentType: string;
  hash?: string;
  custom?: Record<string, any>;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  public: boolean;
}

/**
 * File listing response DTO
 */
interface FileListingResponse {
  files: Array<{
    path: string;
    name: string;
    size: number;
    contentType: string;
    lastModified: Date;
    public: boolean;
  }>;
  directories: Array<{
    path: string;
    name: string;
    createdAt: Date;
    fileCount: number;
  }>;
  pagination?: {
    hasMore: boolean;
    totalCount: number;
  };
}

/**
 * Provider health response DTO
 */
interface ProviderHealthResponse {
  [providerName: string]: {
    healthy: boolean;
    primary: boolean;
    priority: number;
    lastHealthCheck: Date;
    current: boolean;
  };
}

/**
 * Storage Controller for HTTP API
 */
@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(private readonly storageService: StorageService) {}

  /**
   * Upload a file to storage
   * 
   * @param file - Uploaded file from multipart form data
   * @param path - File path in storage (from query parameter)
   * @param public - Whether the file should be public (from query parameter)
   * @param metadata - Additional metadata (from query parameter)
   * @param tags - File tags (from query parameter)
   * @returns File upload response
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload a file to storage',
    description: 'Upload a file with optional metadata and access control settings',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload',
        },
        path: {
          type: 'string',
          description: 'File path in storage (e.g., "uploads/images/profile.jpg")',
        },
        public: {
          type: 'boolean',
          description: 'Whether the file should be publicly accessible',
        },
        metadata: {
          type: 'string',
          description: 'Additional metadata as JSON string',
        },
        tags: {
          type: 'string',
          description: 'Comma-separated list of tags',
        },
      },
      required: ['file', 'path'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    type: FileUploadResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Storage operation failed',
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('path') path: string,
    @Query('public') public: string,
    @Query('metadata') metadata: string,
    @Query('tags') tags: string,
  ): Promise<FileUploadResponse> {
    try {
      if (!file) {
        throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
      }

      if (!path) {
        throw new HttpException('File path is required', HttpStatus.BAD_REQUEST);
      }

      // Parse query parameters
      const isPublic = public === 'true';
      const parsedMetadata = metadata ? JSON.parse(metadata) : {};
      const parsedTags = tags ? tags.split(',').map(tag => tag.trim()) : [];

      // Prepare upload options
      const uploadOptions: UploadOptions = {
        path,
        contentType: file.mimetype,
        metadata: parsedMetadata,
        public: isPublic,
        tags: parsedTags,
        overwrite: false,
      };

      // Upload file
      const result = await this.storageService.upload(file.buffer, uploadOptions);

      if (!result.success) {
        throw new HttpException(
          `Upload failed: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.log(`File uploaded successfully: ${path}`);

      return {
        success: true,
        path: result.path,
        publicUrl: result.publicUrl,
        size: result.size,
        contentType: result.contentType,
        uploadedAt: result.uploadedAt,
      };
    } catch (error) {
      this.logger.error(`File upload failed: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Upload failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Download a file from storage
   * 
   * @param path - File path in storage
   * @param format - Download format (buffer, stream, file)
   * @param process - Processing options as JSON string
   * @param res - Express response object
   */
  @Get('download/:path(*)')
  @ApiOperation({
    summary: 'Download a file from storage',
    description: 'Download a file with optional processing and format options',
  })
  @ApiResponse({
    status: 200,
    description: 'File downloaded successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'File not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Download operation failed',
  })
  async downloadFile(
    @Param('path') path: string,
    @Query('format') format: string,
    @Query('process') process: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // Check if file exists
      const exists = await this.storageService.exists(path);
      if (!exists) {
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      }

      // Parse processing options
      const processOptions = process ? JSON.parse(process) : undefined;

      // Prepare download options
      const downloadOptions: DownloadOptions = {
        format: (format as 'buffer' | 'stream' | 'file') || 'stream',
        process: processOptions,
        includeMetadata: true,
      };

      // Download file
      const result = await this.storageService.download(path, downloadOptions);

      // Set response headers
      res.set({
        'Content-Type': result.contentType,
        'Content-Length': result.size.toString(),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(result.metadata.name)}"`,
        'Last-Modified': result.metadata.updatedAt.toUTCString(),
        'ETag': result.metadata.hash || '',
      });

      // Send file data
      if (typeof result.data === 'string') {
        // File path - send file
        res.sendFile(result.data);
      } else if (Buffer.isBuffer(result.data)) {
        // Buffer - send buffer
        res.send(result.data);
      } else {
        // Stream - pipe stream
        result.data.pipe(res);
      }

      this.logger.log(`File downloaded successfully: ${path}`);
    } catch (error) {
      this.logger.error(`File download failed: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Download failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a file from storage
   * 
   * @param path - File path in storage
   * @returns Deletion result
   */
  @Delete('files/:path(*)')
  @ApiOperation({
    summary: 'Delete a file from storage',
    description: 'Permanently delete a file from storage',
  })
  @ApiResponse({
    status: 200,
    description: 'File deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'File not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Deletion operation failed',
  })
  async deleteFile(@Param('path') path: string): Promise<{ success: boolean }> {
    try {
      // Check if file exists
      const exists = await this.storageService.exists(path);
      if (!exists) {
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      }

      // Delete file
      const result = await this.storageService.delete(path);

      if (!result.success) {
        throw new HttpException(
          `Deletion failed: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.log(`File deleted successfully: ${path}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`File deletion failed: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Deletion failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get file metadata
   * 
   * @param path - File path in storage
   * @returns File metadata
   */
  @Get('files/:path(*)/metadata')
  @ApiOperation({
    summary: 'Get file metadata',
    description: 'Retrieve metadata for a specific file',
  })
  @ApiResponse({
    status: 200,
    description: 'File metadata retrieved successfully',
    type: FileMetadataResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'File not found',
  })
  async getFileMetadata(@Param('path') path: string): Promise<FileMetadataResponse> {
    try {
      const metadata = await this.storageService.getMetadata(path);
      return metadata;
    } catch (error) {
      this.logger.error(`Failed to get file metadata: ${error.message}`);
      throw new HttpException(
        `Failed to get metadata: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update file metadata
   * 
   * @param path - File path in storage
   * @param metadata - New metadata to apply
   * @returns Update result
   */
  @Put('files/:path(*)/metadata')
  @ApiOperation({
    summary: 'Update file metadata',
    description: 'Update metadata for a specific file',
  })
  @ApiResponse({
    status: 200,
    description: 'File metadata updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'File not found',
  })
  async updateFileMetadata(
    @Param('path') path: string,
    @Body() metadata: Partial<FileMetadataResponse>,
  ): Promise<{ success: boolean }> {
    try {
      const result = await this.storageService.updateMetadata(path, metadata);

      if (!result.success) {
        throw new HttpException(
          `Update failed: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to update file metadata: ${error.message}`);
      throw new HttpException(
        `Failed to update metadata: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List files in a directory
   * 
   * @param path - Directory path in storage
   * @param recursive - Whether to list recursively
   * @param maxResults - Maximum number of results
   * @param prefix - File prefix filter
   * @returns File listing
   */
  @Get('files/:path(*)')
  @ApiOperation({
    summary: 'List files in directory',
    description: 'List files and subdirectories in a storage directory',
  })
  @ApiResponse({
    status: 200,
    description: 'File listing retrieved successfully',
    type: FileListingResponse,
  })
  async listFiles(
    @Param('path') path: string,
    @Query('recursive') recursive: string,
    @Query('maxResults') maxResults: string,
    @Query('prefix') prefix: string,
  ): Promise<FileListingResponse> {
    try {
      const options: ListOptions = {
        recursive: recursive === 'true',
        maxResults: maxResults ? parseInt(maxResults) : undefined,
        prefix: prefix || undefined,
      };

      const result = await this.storageService.listFiles(path, options);
      return result;
    } catch (error) {
      this.logger.error(`Failed to list files: ${error.message}`);
      throw new HttpException(
        `Failed to list files: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Process a file (resize, compress, convert format)
   * 
   * @param path - File path in storage
   * @param processOptions - Processing options
   * @returns Processing result
   */
  @Post('files/:path(*)/process')
  @ApiOperation({
    summary: 'Process a file',
    description: 'Process a file with transformations like resize, compress, or format conversion',
  })
  @ApiResponse({
    status: 200,
    description: 'File processed successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'File not found',
  })
  async processFile(
    @Param('path') path: string,
    @Body() processOptions: ProcessOptions,
  ): Promise<{ success: boolean; processedPath: string }> {
    try {
      const result = await this.storageService.process(path, processOptions);

      if (!result.success) {
        throw new HttpException(
          `Processing failed: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        processedPath: result.processedPath,
      };
    } catch (error) {
      this.logger.error(`Failed to process file: ${error.message}`);
      throw new HttpException(
        `Failed to process file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Set file as public
   * 
   * @param path - File path in storage
   * @returns Access control result
   */
  @Put('files/:path(*)/public')
  @ApiOperation({
    summary: 'Make file public',
    description: 'Make a file publicly accessible',
  })
  @ApiResponse({
    status: 200,
    description: 'File access level updated successfully',
  })
  async setFilePublic(@Param('path') path: string): Promise<{ success: boolean }> {
    try {
      const result = await this.storageService.setPublic(path, true);

      if (!result.success) {
        throw new HttpException(
          `Failed to set file public: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to set file public: ${error.message}`);
      throw new HttpException(
        `Failed to set file public: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Set file as private
   * 
   * @param path - File path in storage
   * @returns Access control result
   */
  @Put('files/:path(*)/private')
  @ApiOperation({
    summary: 'Make file private',
    description: 'Make a file privately accessible',
  })
  @ApiResponse({
    status: 200,
    description: 'File access level updated successfully',
  })
  async setFilePrivate(@Param('path') path: string): Promise<{ success: boolean }> {
    try {
      const result = await this.storageService.setPublic(path, false);

      if (!result.success) {
        throw new HttpException(
          `Failed to set file private: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to set file private: ${error.message}`);
      throw new HttpException(
        `Failed to set file private: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Generate access URL for file
   * 
   * @param path - File path in storage
   * @param expiresIn - URL expiration time in seconds
   * @param public - Whether to generate public URL
   * @returns Access URL
   */
  @Get('files/:path(*)/url')
  @ApiOperation({
    summary: 'Generate access URL',
    description: 'Generate a URL for accessing a file (public or presigned)',
  })
  @ApiResponse({
    status: 200,
    description: 'Access URL generated successfully',
  })
  async generateFileUrl(
    @Param('path') path: string,
    @Query('expiresIn') expiresIn: string,
    @Query('public') public: string,
  ): Promise<{ url: string }> {
    try {
      const options: UrlOptions = {
        expiresIn: expiresIn ? parseInt(expiresIn) : undefined,
        public: public === 'true',
      };

      const url = await this.storageService.generateUrl(path, options);
      return { url };
    } catch (error) {
      this.logger.error(`Failed to generate URL: ${error.message}`);
      throw new HttpException(
        `Failed to generate URL: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Copy a file within storage
   * 
   * @param path - Source file path
   * @param copyOptions - Copy options including destination
   * @returns Copy result
   */
  @Post('files/:path(*)/copy')
  @ApiOperation({
    summary: 'Copy a file',
    description: 'Copy a file to a new location within storage',
  })
  @ApiResponse({
    status: 200,
    description: 'File copied successfully',
  })
  async copyFile(
    @Param('path') path: string,
    @Body() copyOptions: { destination: string; preserveMetadata?: boolean; overwrite?: boolean },
  ): Promise<{ success: boolean }> {
    try {
      if (!copyOptions.destination) {
        throw new HttpException('Destination path is required', HttpStatus.BAD_REQUEST);
      }

      const options: CopyOptions = {
        preserveMetadata: copyOptions.preserveMetadata,
        overwrite: copyOptions.overwrite,
      };

      const result = await this.storageService.copy(path, copyOptions.destination, options);

      if (!result.success) {
        throw new HttpException(
          `Copy failed: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to copy file: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Failed to copy file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Move a file within storage
   * 
   * @param path - Source file path
   * @param moveOptions - Move options including destination
   * @returns Move result
   */
  @Post('files/:path(*)/move')
  @ApiOperation({
    summary: 'Move a file',
    description: 'Move a file to a new location within storage',
  })
  @ApiResponse({
    status: 200,
    description: 'File moved successfully',
  })
  async moveFile(
    @Param('path') path: string,
    @Body() moveOptions: { destination: string },
  ): Promise<{ success: boolean }> {
    try {
      if (!moveOptions.destination) {
        throw new HttpException('Destination path is required', HttpStatus.BAD_REQUEST);
      }

      const result = await this.storageService.move(path, moveOptions.destination);

      if (!result.success) {
        throw new HttpException(
          `Move failed: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to move file: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Failed to move file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all available storage providers
   * 
   * @returns List of storage providers
   */
  @Get('providers')
  @ApiOperation({
    summary: 'Get storage providers',
    description: 'Get information about all available storage providers',
  })
  @ApiResponse({
    status: 200,
    description: 'Providers information retrieved successfully',
  })
  async getProviders(): Promise<{ providers: string[]; current: string }> {
    try {
      const allProviders = this.storageService.getAllProviders();
      const currentProvider = this.storageService.getCurrentProvider();
      
      const providerNames = allProviders.map(p => p.name);
      const currentProviderName = allProviders.find(p => p.instance === currentProvider)?.name || 'unknown';

      return {
        providers: providerNames,
        current: currentProviderName,
      };
    } catch (error) {
      this.logger.error(`Failed to get providers: ${error.message}`);
      throw new HttpException(
        `Failed to get providers: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get provider health status
   * 
   * @returns Provider health information
   */
  @Get('providers/health')
  @ApiOperation({
    summary: 'Get provider health',
    description: 'Get health status for all storage providers',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider health information retrieved successfully',
    type: ProviderHealthResponse,
  })
  async getProviderHealth(): Promise<ProviderHealthResponse> {
    try {
      return this.storageService.getProviderHealth();
    } catch (error) {
      this.logger.error(`Failed to get provider health: ${error.message}`);
      throw new HttpException(
        `Failed to get provider health: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Switch to a different storage provider
   * 
   * @param providerName - Name of the provider to switch to
   * @returns Switch result
   */
  @Post('providers/switch')
  @ApiOperation({
    summary: 'Switch storage provider',
    description: 'Switch to a different storage provider',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider switched successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid provider name or provider not healthy',
  })
  async switchProvider(@Body() body: { provider: string }): Promise<{ success: boolean; provider: string }> {
    try {
      if (!body.provider) {
        throw new HttpException('Provider name is required', HttpStatus.BAD_REQUEST);
      }

      const success = await this.storageService.switchProvider(body.provider);

      if (!success) {
        throw new HttpException(
          `Failed to switch to provider: ${body.provider}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return { success: true, provider: body.provider };
    } catch (error) {
      this.logger.error(`Failed to switch provider: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Failed to switch provider: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get current storage provider information
   * 
   * @returns Current provider information
   */
  @Get('providers/current')
  @ApiOperation({
    summary: 'Get current provider info',
    description: 'Get information about the currently active storage provider',
  })
  @ApiResponse({
    status: 200,
    description: 'Current provider information retrieved successfully',
  })
  async getCurrentProviderInfo(): Promise<any> {
    try {
      return this.storageService.getProviderInfo();
    } catch (error) {
      this.logger.error(`Failed to get current provider info: ${error.message}`);
      throw new HttpException(
        `Failed to get provider info: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 