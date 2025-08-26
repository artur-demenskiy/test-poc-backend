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
import { Buffer } from 'buffer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { StorageService } from './storage.service';
import {
  UploadOptions,
  DownloadOptions,
  ListOptions,
  UrlOptions,
  CopyOptions,
} from './interfaces/storage.interface';

// Removed unused interfaces

/**
 * Storage Controller for HTTP API
 */
@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        path: {
          type: 'string',
          description: 'File path in storage',
        },
        contentType: {
          type: 'string',
          description: 'MIME type of the file',
        },
        metadata: {
          type: 'string',
          description: 'Additional metadata as JSON string',
        },
        isPublic: {
          type: 'string',
          description: 'Whether the file should be public',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        filePath: { type: 'string' },
        size: { type: 'number' },
        contentType: { type: 'string' },
        uploadedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async uploadFile(
    @UploadedFile() file: any,
    @Body('path') path: string,
    @Body('contentType') contentType?: string,
    @Body('metadata') metadata?: string,
    @Body('isPublic') isPublic?: string
  ): Promise<any> {
    try {
      if (!file) {
        throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
      }

      if (!path) {
        throw new HttpException('File path is required', HttpStatus.BAD_REQUEST);
      }

      const uploadOptions: UploadOptions = {
        content: file.buffer,
        filePath: path,
        contentType: contentType || file.mimetype,
        metadata: metadata ? JSON.parse(metadata) : {},
        isPublic: isPublic === 'true',
      };

      const result = await this.storageService.upload(uploadOptions);

      if (!result.success) {
        throw new HttpException(`Upload failed: ${result.error}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        success: true,
        filePath: result.filePath,
        size: result.size,
        contentType: result.contentType,
        uploadedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `File upload failed: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Upload failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('download/:path(*)')
  @ApiOperation({ summary: 'Download a file' })
  @ApiParam({ name: 'path', description: 'File path in storage' })
  @ApiQuery({ name: 'format', enum: ['buffer', 'stream', 'file'], required: false })
  @ApiResponse({
    status: 200,
    description: 'File downloaded successfully',
  })
  async downloadFile(
    @Param('path') path: string,
    @Res() res: Response,
    @Query('format') format?: string
  ): Promise<void> {
    try {
      const downloadOptions: DownloadOptions = {
        filePath: path,
        asStream: format === 'stream',
      };

      const result = await this.storageService.download(downloadOptions);

      if (!result.success) {
        throw new HttpException(
          `Download failed: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // Set response headers
      res.set({
        'Content-Type': result.metadata.contentType,
        'Content-Length': result.metadata.size.toString(),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(path.split('/').pop() || path)}"`,
        'Last-Modified': result.metadata.lastModified.toUTCString(),
        ETag: result.metadata.etag || '',
      });

      // Send file content
      if (typeof result.content === 'string') {
        // File path - send file
        res.sendFile(result.content);
      } else if (Buffer.isBuffer(result.content)) {
        // Buffer - send buffer
        res.send(result.content);
      } else {
        // Stream - pipe stream
        result.content.pipe(res);
      }
    } catch (error) {
      this.logger.error(
        `File download failed: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Download failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':path(*)')
  @ApiOperation({ summary: 'Delete a file' })
  @ApiParam({ name: 'path', description: 'File path in storage' })
  @ApiResponse({
    status: 200,
    description: 'File deleted successfully',
  })
  async deleteFile(@Param('path') path: string): Promise<any> {
    try {
      const result = await this.storageService.delete(path);

      if (!result.success) {
        throw new HttpException(
          `Deletion failed: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      return {
        success: true,
        message: 'File deleted successfully',
        filePath: result.filePath,
      };
    } catch (error) {
      this.logger.error(
        `File deletion failed: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Deletion failed: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('metadata/:path(*)')
  @ApiOperation({ summary: 'Get file metadata' })
  @ApiParam({ name: 'path', description: 'File path in storage' })
  @ApiResponse({
    status: 200,
    description: 'File metadata retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        filePath: { type: 'string' },
        name: { type: 'string' },
        size: { type: 'number' },
        contentType: { type: 'string' },
        lastModified: { type: 'string', format: 'date-time' },
        isPublic: { type: 'boolean' },
      },
    },
  })
  async getFileMetadata(@Param('path') path: string): Promise<any> {
    try {
      const metadata = await this.storageService.getMetadata(path);

      return {
        filePath: metadata.filePath,
        name: metadata.filePath.split('/').pop() || metadata.filePath,
        size: metadata.size,
        contentType: metadata.contentType,
        lastModified: metadata.lastModified,
        isPublic: metadata.isPublic,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get file metadata: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        `Failed to get metadata: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put('metadata/:path(*)')
  @ApiOperation({ summary: 'Update file metadata' })
  @ApiParam({ name: 'path', description: 'File path in storage' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        metadata: {
          type: 'object',
          additionalProperties: { type: 'string' },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File metadata updated successfully',
  })
  async updateFileMetadata(@Param('path') path: string, @Body() metadata: any): Promise<any> {
    try {
      // Convert metadata to Record<string, string>
      const stringMetadata: Record<string, string> = {};
      for (const [key, value] of Object.entries(metadata)) {
        if (typeof value === 'string') {
          stringMetadata[key] = value;
        }
      }

      const result = await this.storageService.updateMetadata(path, stringMetadata);

      if (!result.success) {
        throw new HttpException(
          `Metadata update failed: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      return {
        success: true,
        message: 'File metadata updated successfully',
        filePath: result.filePath,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update file metadata: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to update metadata: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('list')
  @ApiOperation({ summary: 'List files in a directory' })
  @ApiQuery({ name: 'path', description: 'Directory path to list', required: false })
  @ApiQuery({
    name: 'recursive',
    description: 'Whether to include subdirectories',
    required: false,
  })
  @ApiQuery({ name: 'fileType', description: 'File type filter', required: false })
  @ApiQuery({ name: 'pattern', description: 'Search pattern', required: false })
  @ApiQuery({ name: 'page', description: 'Page number', required: false })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false })
  @ApiResponse({
    status: 200,
    description: 'Files listed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              name: { type: 'string' },
              size: { type: 'number' },
              contentType: { type: 'string' },
              lastModified: { type: 'string', format: 'date-time' },
              isPublic: { type: 'boolean' },
            },
          },
        },
        directories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              name: { type: 'string' },
              fileCount: { type: 'number' },
              lastModified: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  async listFiles(
    @Query('path') path: string = '/',
    @Query('recursive') recursive?: string,
    @Query('fileType') fileType?: string,
    @Query('pattern') pattern?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<any> {
    try {
      const options: ListOptions = {
        path,
        recursive: recursive === 'true',
        fileType,
        pattern,
        pagination:
          page && limit
            ? {
                page: parseInt(page),
                limit: parseInt(limit),
              }
            : undefined,
      };

      const result = await this.storageService.listFiles(options);

      if (!result.success) {
        throw new HttpException(
          `Failed to list files: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to list files: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to list files: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('process/:path(*)')
  @ApiOperation({ summary: 'Process a file' })
  @ApiParam({ name: 'path', description: 'File path in storage' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        operations: {
          type: 'object',
          properties: {
            resize: {
              type: 'object',
              properties: {
                width: { type: 'number' },
                height: { type: 'number' },
                fit: { type: 'string', enum: ['cover', 'contain', 'fill', 'inside', 'outside'] },
              },
            },
            compress: {
              type: 'object',
              properties: {
                quality: { type: 'number' },
                format: { type: 'string', enum: ['jpeg', 'png', 'webp', 'gif'] },
              },
            },
            convert: {
              type: 'object',
              properties: {
                format: { type: 'string' },
                options: { type: 'object' },
              },
            },
          },
        },
        outputPath: { type: 'string' },
        overwrite: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        filePath: { type: 'string' },
        originalPath: { type: 'string' },
        operations: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async processFile(@Param('path') path: string, @Body() processOptions: any): Promise<any> {
    try {
      const result = await this.storageService.process(path, processOptions);

      if (!result.success) {
        throw new HttpException(
          `File processing failed: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      return {
        success: true,
        filePath: result.filePath,
        originalPath: result.originalPath,
        operations: result.operations,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process file: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to process file: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('public/:path(*)')
  @ApiOperation({ summary: 'Set file access to public' })
  @ApiParam({ name: 'path', description: 'File path in storage' })
  @ApiResponse({
    status: 200,
    description: 'File access set to public successfully',
  })
  async setFilePublic(@Param('path') path: string): Promise<any> {
    try {
      const result = await this.storageService.setPublic(path);

      if (!result.success) {
        throw new HttpException(
          `Failed to set file public: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      return {
        success: true,
        message: 'File access set to public successfully',
        filePath: result.filePath,
        isPublic: result.isPublic,
      };
    } catch (error) {
      this.logger.error(
        `Failed to set file public: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to set file public: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('private/:path(*)')
  @ApiOperation({ summary: 'Set file access to private' })
  @ApiParam({ name: 'path', description: 'File path in storage' })
  @ApiResponse({
    status: 200,
    description: 'File access set to private successfully',
  })
  async setFilePrivate(@Param('path') path: string): Promise<any> {
    try {
      const result = await this.storageService.setPrivate(path);

      if (!result.success) {
        throw new HttpException(
          `Failed to set file private: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      return {
        success: true,
        message: 'File access set to private successfully',
        filePath: result.filePath,
        isPublic: result.isPublic,
      };
    } catch (error) {
      this.logger.error(
        `Failed to set file private: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to set file private: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('url/:path(*)')
  @ApiOperation({ summary: 'Generate URL for file access' })
  @ApiParam({ name: 'path', description: 'File path in storage' })
  @ApiQuery({
    name: 'type',
    enum: ['public', 'presigned'],
    description: 'URL type',
    required: false,
  })
  @ApiQuery({
    name: 'expiresIn',
    description: 'Expiration time in seconds (for presigned URLs)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async generateUrl(
    @Param('path') path: string,
    @Query('type') type: string = 'presigned',
    @Query('expiresIn') expiresIn?: string
  ): Promise<any> {
    try {
      const options: UrlOptions = {
        filePath: path,
        type: type as 'public' | 'presigned',
        expiresIn: expiresIn ? parseInt(expiresIn) : 3600,
      };

      const url = await this.storageService.generateUrl(options);

      return {
        url,
        expiresAt:
          type === 'presigned'
            ? new Date(Date.now() + (options.expiresIn || 3600) * 1000)
            : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate URL: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to generate URL: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('copy')
  @ApiOperation({ summary: 'Copy a file to a new location' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sourcePath: { type: 'string' },
        destinationPath: { type: 'string' },
        overwrite: { type: 'boolean' },
        metadata: { type: 'object' },
        isPublic: { type: 'boolean' },
      },
      required: ['sourcePath', 'destinationPath'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File copied successfully',
  })
  async copyFile(@Body() copyOptions: any): Promise<any> {
    try {
      const options: CopyOptions = {
        sourcePath: copyOptions.sourcePath,
        destinationPath: copyOptions.destinationPath,
        overwrite: copyOptions.overwrite,
        metadata: copyOptions.metadata,
        isPublic: copyOptions.isPublic,
      };

      const result = await this.storageService.copy(options);

      if (!result.success) {
        throw new HttpException(
          `Failed to copy file: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      return {
        success: true,
        message: 'File copied successfully',
        sourcePath: result.sourcePath,
        destinationPath: result.destinationPath,
      };
    } catch (error) {
      this.logger.error(
        `Failed to copy file: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to copy file: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('move')
  @ApiOperation({ summary: 'Move a file to a new location' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sourcePath: { type: 'string' },
        destinationPath: { type: 'string' },
      },
      required: ['sourcePath', 'destinationPath'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File moved successfully',
  })
  async moveFile(@Body() moveOptions: any): Promise<any> {
    try {
      const result = await this.storageService.move(
        moveOptions.sourcePath,
        moveOptions.destinationPath
      );

      if (!result.success) {
        throw new HttpException(
          `Failed to move file: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      return {
        success: true,
        message: 'File moved successfully',
        oldPath: result.oldPath,
        newPath: result.newPath,
      };
    } catch (error) {
      this.logger.error(
        `Failed to move file: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to move file: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('providers')
  @ApiOperation({ summary: 'Get all available storage providers' })
  @ApiResponse({
    status: 200,
    description: 'Providers retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        providers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              healthy: { type: 'boolean' },
            },
          },
        },
        currentProvider: { type: 'string' },
      },
    },
  })
  async getProviders(): Promise<any> {
    try {
      const allProviders = await this.storageService.getAllProvidersHealth();
      const providerNames = Array.from(allProviders.keys());
      const currentProvider =
        Array.from(allProviders.entries()).find(
          ([_, config]) => config.provider === this.storageService.getCurrentProvider()
        )?.[0] || 'unknown';

      return {
        providers: providerNames.map(name => {
          const config = allProviders.get(name);
          return {
            name,
            type: config?.type || 'unknown',
            healthy: config?.healthy || false,
          };
        }),
        currentProvider,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get providers: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        `Failed to get providers: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('providers/health')
  @ApiOperation({ summary: 'Get health status of all storage providers' })
  @ApiResponse({
    status: 200,
    description: 'Provider health status retrieved successfully',
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string' },
          healthy: { type: 'boolean' },
        },
      },
    },
  })
  async getProviderHealth(): Promise<any> {
    try {
      const healthMap = await this.storageService.getAllProvidersHealth();
      const healthObject: Record<string, any> = {};

      for (const [name, config] of healthMap) {
        healthObject[name] = {
          name: config.name,
          type: config.type,
          healthy: config.healthy,
        };
      }

      return healthObject;
    } catch (error) {
      this.logger.error(
        `Failed to get provider health: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        `Failed to get provider health: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('providers/switch/:name')
  @ApiOperation({ summary: 'Switch to a different storage provider' })
  @ApiParam({ name: 'name', description: 'Provider name to switch to' })
  @ApiResponse({
    status: 200,
    description: 'Provider switched successfully',
  })
  async switchProvider(@Param('name') name: string): Promise<any> {
    try {
      const result = await this.storageService.switchProvider(name);

      if (!result) {
        throw new HttpException(`Provider '${name}' not found`, HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: `Switched to provider: ${name}`,
        provider: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to switch provider: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to switch provider: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('providers/current')
  @ApiOperation({ summary: 'Get current storage provider information' })
  @ApiResponse({
    status: 200,
    description: 'Current provider information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        type: { type: 'string' },
        healthy: { type: 'boolean' },
        config: { type: 'object' },
        features: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async getCurrentProviderInfo(): Promise<any> {
    try {
      const provider = this.storageService.getCurrentProvider();
      const providerInfo = await provider.getProviderInfo();

      return {
        name: providerInfo.name,
        type: providerInfo.type,
        healthy: providerInfo.healthy,
        config: providerInfo.config,
        features: providerInfo.features,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get current provider info: ${error instanceof Error ? error.message : String(error)}`
      );

      throw new HttpException(
        `Failed to get provider info: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
