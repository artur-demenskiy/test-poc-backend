/**
 * Google Cloud Storage Provider - Stub implementation
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { Buffer } from 'buffer';
import { BaseStorageProvider } from '../base/base-storage.provider';
import {
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
 * Google Cloud Storage Provider - Stub implementation
 */
@Injectable()
export class GCSStorageProvider extends BaseStorageProvider {
  constructor(_configService: ConfigService) {
    super();
  }

  async exists(_path: string): Promise<boolean> {
    return false;
  }

  async getMetadata(_path: string): Promise<FileMetadata> {
    throw new Error('GCS provider not implemented');
  }

  async getUrl(_path: string, _options?: UrlOptions): Promise<string> {
    throw new Error('GCS provider not implemented');
  }

  async listFiles(_path: string, _options?: ListOptions): Promise<ListResult> {
    return {
      success: false,
      files: [],
      error: 'GCS provider not implemented',
    };
  }

  async isHealthy(): Promise<boolean> {
    return false;
  }

  protected async performUpload(
    _file: Buffer | Readable,
    _path: string,
    _options?: UploadOptions
  ): Promise<UploadResult> {
    throw new Error('GCS provider not implemented');
  }

  protected async performDownload(_path: string): Promise<DownloadResult> {
    throw new Error('GCS provider not implemented');
  }

  protected async performDelete(_path: string): Promise<DeleteResult> {
    throw new Error('GCS provider not implemented');
  }
}
