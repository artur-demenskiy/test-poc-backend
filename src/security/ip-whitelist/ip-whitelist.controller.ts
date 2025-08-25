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
import { IpWhitelistService, CreateIpWhitelistDto } from './ip-whitelist.service';
import { ApiKeyGuard, RequireApiKeyScope } from '../api-key/api-key.guard';

@ApiTags('IP Whitelist Management')
@Controller('security/ip-whitelist')
@UseGuards(ApiKeyGuard)
export class IpWhitelistController {
  constructor(private readonly ipWhitelistService: IpWhitelistService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireApiKeyScope('ip-whitelist', 'create')
  @ApiOperation({ summary: 'Add IP address to whitelist' })
  @ApiResponse({
    status: 201,
    description: 'IP address added to whitelist successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        ipAddress: { type: 'string' },
        cidrBlock: { type: 'string' },
        description: { type: 'string' },
        isActive: { type: 'boolean' },
        expiresAt: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async addToWhitelist(@Body() dto: CreateIpWhitelistDto) {
    return this.ipWhitelistService.createIpWhitelist(dto);
  }

  @Get()
  @RequireApiKeyScope('ip-whitelist', 'read')
  @ApiOperation({ summary: 'Get all whitelisted IP addresses' })
  @ApiResponse({
    status: 200,
    description: 'List of whitelisted IP addresses retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          ipAddress: { type: 'string' },
          cidrBlock: { type: 'string' },
          description: { type: 'string' },
          isActive: { type: 'boolean' },
          expiresAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getAllWhitelistedIps() {
    return this.ipWhitelistService.getAllEntries();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireApiKeyScope('ip-whitelist', 'delete')
  @ApiOperation({ summary: 'Remove IP address from whitelist' })
  @ApiResponse({
    status: 204,
    description: 'IP address removed from whitelist successfully',
  })
  async removeFromWhitelist(@Param('id', ParseIntPipe) id: number) {
    await this.ipWhitelistService.deleteEntry(id);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireApiKeyScope('ip-whitelist', 'update')
  @ApiOperation({ summary: 'Deactivate IP whitelist entry' })
  @ApiResponse({
    status: 204,
    description: 'IP whitelist entry deactivated successfully',
  })
  async deactivateEntry(@Param('id', ParseIntPipe) id: number) {
    await this.ipWhitelistService.deactivateEntry(id);
  }
}
