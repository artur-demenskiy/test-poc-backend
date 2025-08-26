# Pluggable Storage Layer

A comprehensive, pluggable storage solution for NestJS applications that supports multiple storage backends with automatic provider selection, fallback mechanisms, and health monitoring.

## 🚀 Features

- **Multi-Provider Support**: AWS S3, Supabase Storage, Google Cloud Storage, MinIO
- **Automatic Provider Selection**: Primary provider with automatic fallback
- **Health Monitoring**: Continuous health checks and provider status monitoring
- **Unified API**: Single interface for all storage operations
- **File Processing**: Built-in image transformation and processing capabilities
- **Access Control**: Public/private file access with presigned URLs
- **Error Handling**: Comprehensive error handling with automatic retry
- **Provider Switching**: Runtime provider switching for high availability

## 📋 Supported Storage Providers

| Provider | Features | Use Case |
|----------|----------|----------|
| **AWS S3** | Presigned URLs, Access Control, Lifecycle Management | Cloud-native applications, Enterprise |
| **Supabase Storage** | Real-time, RLS, Built-in Processing | Modern web apps, Real-time features |
| **Google Cloud Storage** | Lifecycle Management, Versioning | Enterprise, Google Cloud ecosystem |
| **MinIO** | S3-compatible, Self-hosted | On-premise, Development, Testing |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Storage Controller                      │
│                    (HTTP API)                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    Storage Service                         │
│              (Provider Management)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼──────┐ ┌────▼────┐ ┌─────▼─────┐
│ S3 Provider  │ │Supabase │ │ GCS       │
│              │ │Provider │ │ Provider  │
└──────────────┘ └─────────┘ └───────────┘
```

## 🚀 Quick Start

### 1. Installation

```bash
npm install @nestjs/storage
# or
yarn add @nestjs/storage
```

### 2. Environment Configuration

```bash
# Storage Provider Selection
STORAGE_PROVIDER=s3

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
STORAGE_S3_BUCKET_NAME=my-bucket

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
STORAGE_SUPABASE_BUCKET_NAME=my-bucket

# Google Cloud Storage Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_PRIVATE_KEY=your-private-key
GOOGLE_CLOUD_CLIENT_EMAIL=your-client-email
STORAGE_GCS_BUCKET_NAME=my-bucket

# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
STORAGE_MINIO_BUCKET_NAME=my-bucket

# General Storage Configuration
STORAGE_MAX_FILE_SIZE=104857600
STORAGE_HEALTH_CHECK_INTERVAL_MS=30000
```

### 3. Module Integration

```typescript
import { Module } from '@nestjs/common';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [StorageModule],
  // ... other module configuration
})
export class AppModule {}
```

### 4. Basic Usage

```typescript
import { Injectable } from '@nestjs/common';
import { StorageService } from './storage/storage.service';

@Injectable()
export class FileService {
  constructor(private readonly storageService: StorageService) {}

  async uploadFile(file: Buffer, path: string) {
    const result = await this.storageService.upload(file, {
      path,
      contentType: 'image/jpeg',
      public: true,
      tags: ['profile', 'user'],
    });
    
    return result;
  }

  async downloadFile(path: string) {
    return await this.storageService.download(path, {
      format: 'buffer',
    });
  }

  async deleteFile(path: string) {
    return await this.storageService.delete(path);
  }
}
```

## 📚 API Reference

### Storage Service Methods

#### File Operations

```typescript
// Upload file
upload(file: Buffer | Stream | string, options: UploadOptions): Promise<UploadResult>

// Download file
download(path: string, options?: DownloadOptions): Promise<DownloadResult>

// Delete file
delete(path: string): Promise<DeleteResult>

// Check file existence
exists(path: string): Promise<boolean>
```

#### Metadata Management

```typescript
// Get file metadata
getMetadata(path: string): Promise<FileMetadata>

// Update file metadata
updateMetadata(path: string, metadata: Partial<FileMetadata>): Promise<UpdateResult>
```

#### File Listing

```typescript
// List files in directory
listFiles(directoryPath: string, options?: ListOptions): Promise<ListResult>
```

#### Access Control

```typescript
// Generate access URL
generateUrl(path: string, options?: UrlOptions): Promise<string>

// Set file public/private
setPublic(path: string, public: boolean): Promise<AccessControlResult>
```

#### File Processing

```typescript
// Process file (resize, compress, convert)
process(path: string, options: ProcessOptions): Promise<ProcessResult>
```

#### File Utilities

```typescript
// Copy file
copy(sourcePath: string, destinationPath: string, options?: CopyOptions): Promise<CopyResult>

// Move file
move(sourcePath: string, destinationPath: string): Promise<MoveResult>
```

### HTTP API Endpoints

#### File Operations

```http
# Upload file
POST /storage/upload
Content-Type: multipart/form-data

# Download file
GET /storage/download/:path

# Delete file
DELETE /storage/files/:path

# Get file metadata
GET /storage/files/:path/metadata

# Update file metadata
PUT /storage/files/:path/metadata

# List files
GET /storage/files/:path

# Process file
POST /storage/files/:path/process

# Set file public/private
PUT /storage/files/:path/public
PUT /storage/files/:path/private

# Generate access URL
GET /storage/files/:path/url

# Copy file
POST /storage/files/:path/copy

# Move file
POST /storage/files/:path/move
```

#### Provider Management

```http
# Get all providers
GET /storage/providers

# Get provider health
GET /storage/providers/health

# Switch provider
POST /storage/providers/switch

# Get current provider info
GET /storage/providers/current
```

## 🔧 Configuration Options

### Provider Configuration

```typescript
// Enable/disable specific providers
STORAGE_ENABLE_S3=true
STORAGE_ENABLE_SUPABASE=true
STORAGE_ENABLE_GCS=true
STORAGE_ENABLE_MINIO=true

// Provider-specific settings
STORAGE_S3_FORCE_PATH_STYLE=false
STORAGE_S3_ENDPOINT=  # For MinIO compatibility
STORAGE_GCS_REGION=us-central1
MINIO_USE_SSL=false
```

### File Processing Configuration

```typescript
// Supported file formats
STORAGE_SUPPORTED_FORMATS=jpeg,png,gif,webp,svg,pdf,txt,json

// Allowed MIME types
STORAGE_ALLOWED_MIME_TYPES=image/jpeg,image/png,application/pdf

// Maximum file size (in bytes)
STORAGE_MAX_FILE_SIZE=104857600  # 100MB
```

### Health Check Configuration

```typescript
// Health check interval (in milliseconds)
STORAGE_HEALTH_CHECK_INTERVAL_MS=30000  # 30 seconds
```

## 🎯 Use Cases

### 1. Image Upload and Processing

```typescript
// Upload image and create thumbnail
const uploadResult = await this.storageService.upload(imageBuffer, {
  path: 'uploads/images/profile.jpg',
  contentType: 'image/jpeg',
  public: true,
});

// Create thumbnail
const thumbnailResult = await this.storageService.process(uploadResult.path, {
  resize: { width: 300, height: 300, fit: 'cover' },
  compress: { quality: 80 },
  format: 'webp',
});
```

### 2. File Management with Metadata

```typescript
// Upload with custom metadata
await this.storageService.upload(fileBuffer, {
  path: 'documents/report.pdf',
  contentType: 'application/pdf',
  metadata: {
    author: 'John Doe',
    department: 'Engineering',
    version: '1.0',
  },
  tags: ['report', 'engineering', 'q1'],
});

// Update metadata
await this.storageService.updateMetadata('documents/report.pdf', {
  custom: { version: '1.1', reviewed: true },
  tags: ['report', 'engineering', 'q1', 'reviewed'],
});
```

### 3. Provider Fallback

```typescript
// Automatic fallback on provider failure
try {
  const result = await this.storageService.upload(file, options);
  return result;
} catch (error) {
  // Service automatically tries alternative providers
  // No additional code needed
  throw error;
}
```

### 4. Access Control

```typescript
// Generate presigned URL for private access
const privateUrl = await this.storageService.generateUrl('private/document.pdf', {
  expiresIn: 3600, // 1 hour
  public: false,
});

// Make file public
await this.storageService.setPublic('public/image.jpg', true);
const publicUrl = await this.storageService.generateUrl('public/image.jpg', {
  public: true,
});
```

## 🔒 Security Considerations

### 1. Access Control

- Use environment variables for sensitive credentials
- Implement proper IAM policies for cloud providers
- Use Row Level Security (RLS) with Supabase
- Configure bucket policies appropriately

### 2. File Validation

- Validate file types and sizes
- Implement virus scanning for uploaded files
- Use content-type validation
- Sanitize file names and paths

### 3. URL Security

- Set appropriate expiration times for presigned URLs
- Use HTTPS for all storage operations
- Implement proper CORS policies
- Monitor and log access patterns

## 🧪 Testing

### Unit Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### Integration Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { StorageModule } from './storage.module';

describe('StorageModule Integration', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [StorageModule],
    }).compile();
  });

  it('should initialize storage providers', () => {
    const storageService = module.get<StorageService>(StorageService);
    expect(storageService).toBeDefined();
  });
});
```

## 🚀 Performance Optimization

### 1. Streaming Operations

```typescript
// Use streaming for large files
const downloadStream = await this.storageService.download('large-file.zip', {
  format: 'stream',
});

// Pipe to response
downloadStream.pipe(res);
```

### 2. Batch Operations

```typescript
// Process multiple files in parallel
const uploadPromises = files.map(file => 
  this.storageService.upload(file.buffer, {
    path: `uploads/${file.originalname}`,
    contentType: file.mimetype,
  })
);

const results = await Promise.all(uploadPromises);
```

### 3. Caching

```typescript
// Cache frequently accessed metadata
const metadataCache = new Map();

async getFileMetadata(path: string) {
  if (metadataCache.has(path)) {
    return metadataCache.get(path);
  }
  
  const metadata = await this.storageService.getMetadata(path);
  metadataCache.set(path, metadata);
  return metadata;
}
```

## 🔍 Monitoring and Debugging

### 1. Health Checks

```typescript
// Get provider health status
const health = await this.storageService.getProviderHealth();

// Monitor provider status
setInterval(async () => {
  const health = await this.storageService.getProviderHealth();
  console.log('Storage health:', health);
}, 60000);
```

### 2. Logging

```typescript
// Enable debug logging
const logger = new Logger('StorageService');
logger.debug('Provider health check started');
logger.log('File uploaded successfully');
logger.warn('Provider fallback triggered');
logger.error('Storage operation failed');
```

### 3. Metrics

```typescript
// Track storage operations
const metrics = {
  uploads: 0,
  downloads: 0,
  errors: 0,
  providerSwitches: 0,
};

// Update metrics in service methods
async upload(file: Buffer, options: UploadOptions) {
  try {
    metrics.uploads++;
    return await this.currentProvider.upload(file, options);
  } catch (error) {
    metrics.errors++;
    throw error;
  }
}
```

## 🔄 Migration Guide

### From Single Provider to Multi-Provider

1. **Update Configuration**
   ```bash
   # Old configuration
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   
   # New configuration
   STORAGE_PROVIDER=s3
   STORAGE_ENABLE_S3=true
   STORAGE_ENABLE_SUPABASE=true
   ```

2. **Update Service Usage**
   ```typescript
   // Old usage
   const s3Service = new S3Service();
   await s3Service.upload(file, options);
   
   // New usage
   const storageService = new StorageService();
   await storageService.upload(file, options);
   ```

3. **Test Provider Switching**
   ```typescript
   // Test fallback mechanisms
   await storageService.switchProvider('supabase');
   const result = await storageService.upload(file, options);
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests and documentation
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [GitHub Wiki](https://github.com/your-repo/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)

## 🔗 Related Projects

- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [AWS SDK](https://aws.amazon.com/sdk-for-javascript/) - AWS JavaScript SDK
- [Supabase](https://supabase.com/) - Open source Firebase alternative
- [Google Cloud Storage](https://cloud.google.com/storage) - Object storage service
- [MinIO](https://min.io/) - High performance object storage 