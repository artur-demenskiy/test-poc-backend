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

@ApiTags('API Key Management')
@Controller('security/api-keys')
@UseGuards(ApiKeyGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

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
