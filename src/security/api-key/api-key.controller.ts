import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyService, CreateApiKeyDto } from './api-key.service';
import { ApiKeyGuard, RequireApiKeyScope } from './api-key.guard';

/**
 * API Key Management Controller
 *
 * This controller provides RESTful endpoints for managing API keys:
 * - Create new API keys with scope-based permissions
 * - Retrieve existing API keys for management
 * - Deactivate API keys for security control
 *
 * Security Features:
 * - All endpoints protected by ApiKeyGuard
 * - Scope-based access control for each operation
 * - Comprehensive API documentation with Swagger
 * - Proper HTTP status codes and responses
 *
 * Access Control:
 * - Create: Requires 'api-keys:create' scope
 * - Read: Requires 'api-keys:read' scope
 * - Delete: Requires 'api-keys:delete' scope
 */
@ApiTags('API Key Management')
@Controller('security/api-keys')
@UseGuards(ApiKeyGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * Create new API key with specified permissions
   * Generates cryptographically secure key and stores with scopes
   *
   * @param dto - API key creation data including name, scopes, and expiration
   * @returns Created API key metadata (excluding actual key value)
   *
   * Security: Requires 'api-keys:create' scope
   * Response: 201 Created with key metadata
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireApiKeyScope('api-keys', 'create')
  @ApiOperation({ summary: 'Create new API key' })
  @ApiResponse({
    status: 201,
    description: 'API key created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        scopes: { type: 'string' },
        isActive: { type: 'boolean' },
        expiresAt: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async createApiKey(@Body() dto: CreateApiKeyDto) {
    return this.apiKeyService.createApiKey(dto);
  }

  /**
   * Retrieve all API keys for management purposes
   * Returns key metadata without exposing actual key values
   *
   * @returns Array of API key metadata objects
   *
   * Security: Requires 'api-keys:read' scope
   * Response: 200 OK with array of key metadata
   * Note: Actual key values are never returned for security
   */
  @Get()
  @RequireApiKeyScope('api-keys', 'read')
  @ApiOperation({ summary: 'Get all API keys' })
  @ApiResponse({
    status: 200,
    description: 'List of API keys retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          scopes: { type: 'string' },
          isActive: { type: 'boolean' },
          expiresAt: { type: 'string', format: 'date-time' },
          lastUsedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getAllApiKeys() {
    return this.apiKeyService.getAllApiKeys();
  }

  /**
   * Deactivate API key by setting isActive to false
   * Provides immediate access revocation without permanent deletion
   *
   * @param id - Database ID of the API key to deactivate
   *
   * Security: Requires 'api-keys:delete' scope
   * Response: 204 No Content on successful deactivation
   * Note: Key is deactivated but not deleted for audit purposes
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireApiKeyScope('api-keys', 'delete')
  @ApiOperation({ summary: 'Deactivate API key' })
  @ApiResponse({
    status: 204,
    description: 'API key deactivated successfully',
  })
  async deactivateApiKey(@Param('id', ParseIntPipe) id: number) {
    await this.apiKeyService.deactivateApiKey(id);
  }
}
