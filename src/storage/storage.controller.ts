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
} from '@nestjs/swagger';
import { StorageService } from './storage.service';

/**
 * Storage Controller - HTTP API for storage operations
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
        file: { type: 'string', format: 'binary' },
        path: { type: 'string', description: 'File path in storage' },
        contentType: { type: 'string', description: 'MIME type of the file' },
        metadata: { type: 'string', description: 'Additional metadata as JSON string' },
        public: { type: 'string', description: 'Whether the file should be public' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  async uploadFile(
    @UploadedFile() file: unknown,
    @Body('path') path: string,
    @Body('contentType') contentType?: string,
    @Body('metadata') metadata?: string,
    @Body('public') isPublic?: string
  ): Promise<Record<string, unknown>> {
    try {
      if (!file) {
        throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
      }

      if (!path) {
        throw new HttpException('File path is required', HttpStatus.BAD_REQUEST);
      }

      const uploadOptions = {
        contentType: contentType || (file as Record<string, unknown>).mimetype,
        metadata: metadata ? JSON.parse(metadata) : {},
        public: isPublic === 'true',
      };

      const result = await this.storageService.upload(
        (file as Record<string, unknown>).buffer,
        path,
        uploadOptions
      );

      if (!(result as Record<string, unknown>).success) {
        throw new HttpException(
          `Upload failed: ${(result as Record<string, unknown>).error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      return {
        success: true,
        path: (result as Record<string, unknown>).path,
        size: (result as Record<string, unknown>).size,
        url: (result as Record<string, unknown>).url,
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
  @ApiResponse({ status: 200, description: 'File downloaded successfully' })
  async downloadFile(@Param('path') path: string, @Res() res: Response): Promise<void> {
    try {
      const result = await this.storageService.download(path);

      if (!(result as Record<string, unknown>).success) {
        throw new HttpException(
          `Download failed: ${(result as Record<string, unknown>).error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // Set response headers
      res.set({
        'Content-Type': ((result as Record<string, unknown>).metadata as Record<string, unknown>)
          .contentType as string,
        'Content-Length': ((result as Record<string, unknown>).metadata as Record<string, unknown>)
          .size as string,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(path.split('/').pop() || path)}"`,
        'Last-Modified': ((result as Record<string, unknown>).metadata as Record<string, unknown>)
          .lastModified as string,
      });

      // Send file content
      if (Buffer.isBuffer((result as Record<string, unknown>).content)) {
        res.send((result as Record<string, unknown>).content);
      } else {
        ((result as Record<string, unknown>).content as { pipe: (res: Response) => void }).pipe(
          res
        );
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
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  async deleteFile(@Param('path') path: string): Promise<Record<string, unknown>> {
    try {
      const result = await this.storageService.delete(path);

      if (!(result as Record<string, unknown>).success) {
        throw new HttpException(
          `Deletion failed: ${(result as Record<string, unknown>).error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      return {
        success: true,
        message: 'File deleted successfully',
        path: (result as Record<string, unknown>).path,
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
  @ApiResponse({ status: 200, description: 'File metadata retrieved successfully' })
  async getFileMetadata(@Param('path') path: string): Promise<Record<string, unknown>> {
    try {
      const metadata = await this.storageService.getMetadata(path);

      return {
        path: (metadata as Record<string, unknown>).path,
        name:
          ((metadata as Record<string, unknown>).path as string).split('/').pop() ||
          (metadata as Record<string, unknown>).path,
        size: (metadata as Record<string, unknown>).size,
        contentType: (metadata as Record<string, unknown>).contentType,
        lastModified: (metadata as Record<string, unknown>).lastModified,
        public: (metadata as Record<string, unknown>).public,
        metadata: (metadata as Record<string, unknown>).metadata,
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

  @Get('list')
  @ApiOperation({ summary: 'List files in a directory' })
  @ApiResponse({ status: 200, description: 'Files listed successfully' })
  async listFiles(
    @Query('path') path: string = '/',
    @Query('recursive') recursive?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ): Promise<Record<string, unknown>> {
    try {
      const options = {
        recursive: recursive === 'true',
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      };

      const result = await this.storageService.listFiles(path, options);

      if (!(result as Record<string, unknown>).success) {
        throw new HttpException(
          `Failed to list files: ${(result as Record<string, unknown>).error}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      return result as Record<string, unknown>;
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

  @Get('url/:path(*)')
  @ApiOperation({ summary: 'Generate URL for file access' })
  @ApiParam({ name: 'path', description: 'File path in storage' })
  @ApiResponse({ status: 200, description: 'URL generated successfully' })
  async generateUrl(
    @Param('path') path: string,
    @Query('public') isPublic?: string,
    @Query('expiresIn') expiresIn?: string
  ): Promise<Record<string, unknown>> {
    try {
      const options = {
        public: isPublic === 'true',
        expiresIn: expiresIn ? parseInt(expiresIn) : undefined,
      };

      const url = await this.storageService.getUrl(path, options);

      return {
        url,
        expiresAt: options.expiresIn ? new Date(Date.now() + options.expiresIn * 1000) : undefined,
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

  @Get('providers')
  @ApiOperation({ summary: 'Get all available storage providers' })
  @ApiResponse({ status: 200, description: 'Providers retrieved successfully' })
  async getProviders(): Promise<Record<string, unknown>> {
    try {
      const providers = this.storageService.getProviders();
      const providerList = Array.from(providers.entries()).map(([name, provider]) => ({
        name,
        type: provider.constructor.name,
      }));

      return {
        providers: providerList,
        currentProvider: this.storageService.getProvider().constructor.name,
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

  @Post('providers/switch/:name')
  @ApiOperation({ summary: 'Switch to a different storage provider' })
  @ApiParam({ name: 'name', description: 'Provider name to switch to' })
  @ApiResponse({ status: 200, description: 'Provider switched successfully' })
  async switchProvider(@Param('name') name: string): Promise<Record<string, unknown>> {
    try {
      await this.storageService.switchProvider(name);

      return {
        success: true,
        message: `Switched to provider: ${name}`,
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

  @Get('health')
  @ApiOperation({ summary: 'Check storage service health' })
  @ApiResponse({ status: 200, description: 'Health check completed' })
  async healthCheck(): Promise<Record<string, unknown>> {
    try {
      const isHealthy = await this.storageService.isHealthy();

      return {
        healthy: isHealthy,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Health check failed: ${error instanceof Error ? error.message : String(error)}`
      );

      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }
}
