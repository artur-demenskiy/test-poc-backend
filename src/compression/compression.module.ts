import { Module, Global } from '@nestjs/common';
import { CompressionService } from './compression.service';

/**
 * Global Compression Module for response optimization
 *
 * This module provides HTTP response compression capabilities:
 * - Automatic response compression for improved performance
 * - Configurable compression levels and algorithms
 * - Bandwidth optimization for network requests
 * - Support for multiple compression formats (gzip, deflate)
 *
 * Features:
 * - Automatic compression based on content type
 * - Configurable compression thresholds
 * - Memory-efficient streaming compression
 * - Client capability detection and adaptation
 *
 * Global Scope:
 * - Automatically applied to all HTTP responses
 * - Provides application-wide compression capabilities
 * - Improves overall application performance and user experience
 */
@Global()
@Module({
  providers: [
    CompressionService, // Core compression service
  ],
  exports: [
    CompressionService, // Export for use in other modules
  ],
})
export class CompressionModule {}
