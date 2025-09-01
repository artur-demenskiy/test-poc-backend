import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ConfigurationService } from './configuration.service';
import {
  ConfigurationEntry,
  ConfigurationUpdateRequest,
  ConfigurationFilters,
  ConfigurationResponse,
  ConfigurationHistory,
} from './interfaces/configuration.interface';

/**
 * DTO for creating configuration
 */
export class CreateConfigurationDto {
  key: string;
  value: any;
  type?: string;
  description?: string;
  environment?: string;
  sensitive?: boolean;
  validation?: any;
  metadata?: Record<string, any>;
}

/**
 * DTO for updating configuration
 */
export class UpdateConfigurationDto {
  value: any;
  description?: string;
  sensitive?: boolean;
  validation?: any;
  metadata?: Record<string, any>;
  environment?: string;
  updatedBy?: string;
  reason?: string;
}

/**
 * DTO for configuration update request
 */
export class ConfigurationUpdateDto {
  value: any;
  environment?: string;
  reason?: string;
  updatedBy?: string;
}

/**
 * Configuration controller for managing dynamic application configuration
 */
@ApiTags('Configuration')
@Controller('configuration')
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  /**
   * Get configuration value by key
   */
  @Get(':key')
  @ApiOperation({ summary: 'Get configuration value by key' })
  @ApiParam({ name: 'key', description: 'Configuration key' })
  @ApiQuery({ name: 'environment', required: false, description: 'Environment name' })
  @ApiResponse({ status: 200, description: 'Configuration value' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  getConfiguration(
    @Param('key') key: string,
    @Query('environment') environment?: string
  ): { value: any } | null {
    const value = this.configurationService.get(key, environment);
    return value !== null ? { value } : null;
  }

  /**
   * Get configuration entry by key
   */
  @Get(':key/details')
  @ApiOperation({ summary: 'Get configuration entry details by key' })
  @ApiParam({ name: 'key', description: 'Configuration key' })
  @ApiQuery({ name: 'environment', required: false, description: 'Environment name' })
  @ApiResponse({ status: 200, description: 'Configuration entry' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  getConfigurationDetails(
    @Param('key') key: string,
    @Query('environment') environment?: string
  ): ConfigurationEntry | null {
    return this.configurationService.getConfiguration(key, environment);
  }

  /**
   * Get all configurations with optional filtering
   */
  @Get()
  @ApiOperation({ summary: 'Get all configurations with optional filtering' })
  @ApiQuery({ name: 'environment', required: false, description: 'Environment filter' })
  @ApiQuery({ name: 'type', required: false, description: 'Type filter' })
  @ApiQuery({ name: 'sensitive', required: false, description: 'Sensitive filter' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiQuery({ name: 'offset', required: false, description: 'Pagination offset' })
  @ApiQuery({ name: 'limit', required: false, description: 'Pagination limit' })
  @ApiResponse({ status: 200, description: 'List of configurations' })
  getAllConfigurations(
    @Query('environment') environment?: string,
    @Query('type') type?: string,
    @Query('sensitive') sensitive?: boolean,
    @Query('search') search?: string,
    @Query('offset') offset?: number,
    @Query('limit') limit?: number
  ): ConfigurationResponse {
    const filters: ConfigurationFilters = {
      environment,
      type: type as any,
      sensitive,
      search,
      offset: offset ? Number(offset) : undefined,
      limit: limit ? Number(limit) : undefined,
    };

    return this.configurationService.getAll(filters);
  }

  /**
   * Create new configuration
   */
  @Post()
  @ApiOperation({ summary: 'Create new configuration' })
  @ApiResponse({ status: 201, description: 'Configuration created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid configuration data' })
  @ApiResponse({ status: 409, description: 'Configuration already exists' })
  async createConfiguration(
    @Body() createDto: CreateConfigurationDto
  ): Promise<{ success: boolean; message: string }> {
    const success = await this.configurationService.set(
      createDto.key,
      createDto.value,
      createDto.environment,
      'system',
      'Configuration created'
    );

    return {
      success,
      message: success ? 'Configuration created successfully' : 'Configuration already exists',
    };
  }

  /**
   * Update configuration
   */
  @Put(':key')
  @ApiOperation({ summary: 'Update configuration' })
  @ApiParam({ name: 'key', description: 'Configuration key' })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  async updateConfiguration(
    @Param('key') key: string,
    @Body() updateDto: UpdateConfigurationDto
  ): Promise<{ success: boolean; message: string }> {
    const success = await this.configurationService.set(
      key,
      updateDto.value,
      updateDto.environment,
      updateDto.updatedBy,
      updateDto.reason
    );

    return {
      success,
      message: success ? 'Configuration updated successfully' : 'Configuration not found',
    };
  }

  /**
   * Delete configuration
   */
  @Delete(':key')
  @ApiOperation({ summary: 'Delete configuration' })
  @ApiParam({ name: 'key', description: 'Configuration key' })
  @ApiQuery({ name: 'environment', required: false, description: 'Environment name' })
  @ApiResponse({ status: 200, description: 'Configuration deleted successfully' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  async deleteConfiguration(
    @Param('key') key: string,
    @Query('environment') environment?: string
  ): Promise<{ success: boolean; message: string }> {
    const success = await this.configurationService.delete(key, environment, 'system');

    return {
      success,
      message: success ? 'Configuration deleted successfully' : 'Configuration not found',
    };
  }

  /**
   * Get configuration history
   */
  @Get(':key/history')
  @ApiOperation({ summary: 'Get configuration history' })
  @ApiParam({ name: 'key', description: 'Configuration key' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of history entries to return' })
  @ApiResponse({ status: 200, description: 'Configuration history' })
  getConfigurationHistory(
    @Param('key') key: string,
    @Query('limit') limit?: number
  ): ConfigurationHistory[] {
    return this.configurationService.getHistory(key, limit ? Number(limit) : 50);
  }

  /**
   * Get all configuration history
   */
  @Get('history/all')
  @ApiOperation({ summary: 'Get all configuration history' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of history entries to return' })
  @ApiResponse({ status: 200, description: 'All configuration history' })
  getAllConfigurationHistory(@Query('limit') limit?: number): ConfigurationHistory[] {
    return this.configurationService.getHistory(undefined, limit ? Number(limit) : 50);
  }

  /**
   * Get configuration statistics
   */
  @Get('stats/overview')
  @ApiOperation({ summary: 'Get configuration statistics' })
  @ApiResponse({ status: 200, description: 'Configuration statistics' })
  getConfigurationStats(): {
    totalConfigurations: number;
    environments: string[];
    lastUpdated: Date;
  } {
    return this.configurationService.getStats();
  }

  /**
   * Refresh configurations
   */
  @Post('refresh')
  @ApiOperation({ summary: 'Manually refresh configurations' })
  @ApiResponse({ status: 200, description: 'Configurations refreshed successfully' })
  async refreshConfigurations(): Promise<{ success: boolean; message: string }> {
    try {
      await this.configurationService.refreshConfigurations();
      return {
        success: true,
        message: 'Configurations refreshed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to refresh configurations',
      };
    }
  }

  /**
   * Bulk update configurations
   */
  @Post('bulk-update')
  @ApiOperation({ summary: 'Bulk update multiple configurations' })
  @ApiResponse({ status: 200, description: 'Bulk update completed' })
  async bulkUpdateConfigurations(@Body() updates: ConfigurationUpdateRequest[]): Promise<{
    success: boolean;
    results: Array<{ key: string; success: boolean; message: string }>;
  }> {
    const results = [];

    for (const update of updates) {
      const success = await this.configurationService.set(
        update.key,
        update.value,
        update.environment,
        update.updatedBy,
        update.reason
      );

      results.push({
        key: update.key,
        success,
        message: success ? 'Updated successfully' : 'Update failed',
      });
    }

    const allSuccessful = results.every(result => result.success);

    return {
      success: allSuccessful,
      results,
    };
  }
}
