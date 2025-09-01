import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SecretsService } from './secrets.service';
import {
  SecretType,
  SecretAccessRequest,
  SecretRotationRequest,
  SecretFilters,
  SecretResponse,
  SecretAccessLog,
  RotationPolicy,
  AccessControl,
} from './interfaces/secret.interface';

/**
 * DTO for creating secret
 */
export class CreateSecretDto {
  key: string;
  value: string;
  type: SecretType;
  description?: string;
  environment?: string;
  tags?: string[];
  expiresAt?: Date;
  rotationPolicy?: RotationPolicy;
  accessControl?: AccessControl;
  metadata?: Record<string, any>;
}

/**
 * DTO for updating secret
 */
export class UpdateSecretDto {
  value: string;
  description?: string;
  tags?: string[];
  expiresAt?: Date;
  rotationPolicy?: RotationPolicy;
  accessControl?: AccessControl;
  metadata?: Record<string, any>;
  environment?: string;
}

/**
 * DTO for secret access request
 */
export class SecretAccessDto {
  key: string;
  environment?: string;
  requestedBy?: string;
  requestedByService?: string;
  ipAddress?: string;
  reason?: string;
}

/**
 * DTO for secret rotation request
 */
export class SecretRotationDto {
  key: string;
  environment?: string;
  newValue: string;
  reason?: string;
  rotatedBy?: string;
  force?: boolean;
}

/**
 * Secrets controller for managing application secrets
 */
@ApiTags('Secrets')
@Controller('secrets')
export class SecretsController {
  constructor(private readonly secretsService: SecretsService) {}

  /**
   * Get secret value by key
   */
  @Post('access')
  @ApiOperation({ summary: 'Get secret value by key' })
  @ApiResponse({ status: 200, description: 'Secret value retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Secret not found' })
  async getSecret(
    @Body() accessDto: SecretAccessDto
  ): Promise<{ value: string } | { error: string }> {
    const request: SecretAccessRequest = {
      key: accessDto.key,
      environment: accessDto.environment,
      requestedBy: accessDto.requestedBy,
      requestedByService: accessDto.requestedByService,
      ipAddress: accessDto.ipAddress,
      reason: accessDto.reason,
    };

    return this.secretsService.getSecret(request);
  }

  /**
   * Get secret metadata by key (without value)
   */
  @Get(':key')
  @ApiOperation({ summary: 'Get secret metadata by key' })
  @ApiParam({ name: 'key', description: 'Secret key' })
  @ApiQuery({ name: 'environment', required: false, description: 'Environment name' })
  @ApiResponse({ status: 200, description: 'Secret metadata' })
  @ApiResponse({ status: 404, description: 'Secret not found' })
  getSecretMetadata(@Param('key') key: string, @Query('environment') environment?: string): any {
    const secret = this.secretsService.getSecretEntry(key, environment);
    if (!secret) {
      return null;
    }

    // Return metadata without encrypted value
    const { encryptedValue: _encryptedValue, ...metadata } = secret;
    return metadata;
  }

  /**
   * Get all secrets with optional filtering (without values)
   */
  @Get()
  @ApiOperation({ summary: 'Get all secrets with optional filtering' })
  @ApiQuery({ name: 'environment', required: false, description: 'Environment filter' })
  @ApiQuery({ name: 'type', required: false, description: 'Type filter' })
  @ApiQuery({ name: 'tags', required: false, description: 'Tag filter (comma-separated)' })
  @ApiQuery({ name: 'expired', required: false, description: 'Expired filter' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiQuery({ name: 'offset', required: false, description: 'Pagination offset' })
  @ApiQuery({ name: 'limit', required: false, description: 'Pagination limit' })
  @ApiResponse({ status: 200, description: 'List of secrets' })
  getAllSecrets(
    @Query('environment') environment?: string,
    @Query('type') type?: SecretType,
    @Query('tags') tags?: string,
    @Query('expired') expired?: boolean,
    @Query('search') search?: string,
    @Query('offset') offset?: number,
    @Query('limit') limit?: number
  ): SecretResponse {
    const filters: SecretFilters = {
      environment,
      type,
      tags: tags ? tags.split(',') : undefined,
      expired,
      search,
      offset: offset ? Number(offset) : undefined,
      limit: limit ? Number(limit) : undefined,
    };

    return this.secretsService.getAllSecrets(filters);
  }

  /**
   * Create new secret
   */
  @Post()
  @ApiOperation({ summary: 'Create new secret' })
  @ApiResponse({ status: 201, description: 'Secret created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid secret data' })
  @ApiResponse({ status: 409, description: 'Secret already exists' })
  async createSecret(
    @Body() createDto: CreateSecretDto
  ): Promise<{ success: boolean; message: string }> {
    const success = await this.secretsService.createSecret(
      createDto.key,
      createDto.value,
      createDto.type,
      {
        description: createDto.description,
        environment: createDto.environment,
        tags: createDto.tags,
        expiresAt: createDto.expiresAt,
        rotationPolicy: createDto.rotationPolicy,
        accessControl: createDto.accessControl,
        metadata: createDto.metadata,
      }
    );

    return {
      success,
      message: success ? 'Secret created successfully' : 'Secret already exists',
    };
  }

  /**
   * Update secret
   */
  @Put(':key')
  @ApiOperation({ summary: 'Update secret' })
  @ApiParam({ name: 'key', description: 'Secret key' })
  @ApiResponse({ status: 200, description: 'Secret updated successfully' })
  @ApiResponse({ status: 404, description: 'Secret not found' })
  async updateSecret(
    @Param('key') key: string,
    @Body() updateDto: UpdateSecretDto
  ): Promise<{ success: boolean; message: string }> {
    const success = await this.secretsService.updateSecret(
      key,
      updateDto.value,
      updateDto.environment,
      'system'
    );

    return {
      success,
      message: success ? 'Secret updated successfully' : 'Secret not found',
    };
  }

  /**
   * Rotate secret
   */
  @Post(':key/rotate')
  @ApiOperation({ summary: 'Rotate secret' })
  @ApiParam({ name: 'key', description: 'Secret key' })
  @ApiResponse({ status: 200, description: 'Secret rotated successfully' })
  @ApiResponse({ status: 404, description: 'Secret not found' })
  async rotateSecret(
    @Param('key') key: string,
    @Body() rotationDto: SecretRotationDto
  ): Promise<{ success: boolean; message: string }> {
    const request: SecretRotationRequest = {
      key,
      environment: rotationDto.environment,
      newValue: rotationDto.newValue,
      reason: rotationDto.reason,
      rotatedBy: rotationDto.rotatedBy,
      force: rotationDto.force,
    };

    const success = await this.secretsService.rotateSecret(request);

    return {
      success,
      message: success ? 'Secret rotated successfully' : 'Secret not found or rotation not needed',
    };
  }

  /**
   * Delete secret
   */
  @Delete(':key')
  @ApiOperation({ summary: 'Delete secret' })
  @ApiParam({ name: 'key', description: 'Secret key' })
  @ApiQuery({ name: 'environment', required: false, description: 'Environment name' })
  @ApiResponse({ status: 200, description: 'Secret deleted successfully' })
  @ApiResponse({ status: 404, description: 'Secret not found' })
  async deleteSecret(
    @Param('key') key: string,
    @Query('environment') environment?: string
  ): Promise<{ success: boolean; message: string }> {
    const success = await this.secretsService.deleteSecret(key, environment);

    return {
      success,
      message: success ? 'Secret deleted successfully' : 'Secret not found',
    };
  }

  /**
   * Get secret access logs
   */
  @Get(':key/access-logs')
  @ApiOperation({ summary: 'Get secret access logs' })
  @ApiParam({ name: 'key', description: 'Secret key' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of log entries to return' })
  @ApiResponse({ status: 200, description: 'Secret access logs' })
  getSecretAccessLogs(
    @Param('key') key: string,
    @Query('limit') limit?: number
  ): SecretAccessLog[] {
    return this.secretsService.getAccessLogs(key, limit ? Number(limit) : 100);
  }

  /**
   * Get all access logs
   */
  @Get('access-logs/all')
  @ApiOperation({ summary: 'Get all secret access logs' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of log entries to return' })
  @ApiResponse({ status: 200, description: 'All secret access logs' })
  getAllAccessLogs(@Query('limit') limit?: number): SecretAccessLog[] {
    return this.secretsService.getAccessLogs(undefined, limit ? Number(limit) : 100);
  }

  /**
   * Get secrets statistics
   */
  @Get('stats/overview')
  @ApiOperation({ summary: 'Get secrets statistics' })
  @ApiResponse({ status: 200, description: 'Secrets statistics' })
  getSecretsStats(): {
    totalSecrets: number;
    environments: string[];
    types: SecretType[];
    lastUpdated: Date;
  } {
    return this.secretsService.getStats();
  }

  /**
   * Refresh secrets
   */
  @Post('refresh')
  @ApiOperation({ summary: 'Manually refresh secrets' })
  @ApiResponse({ status: 200, description: 'Secrets refreshed successfully' })
  async refreshSecrets(): Promise<{ success: boolean; message: string }> {
    try {
      await this.secretsService.refreshSecrets();
      return {
        success: true,
        message: 'Secrets refreshed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to refresh secrets',
      };
    }
  }
}
