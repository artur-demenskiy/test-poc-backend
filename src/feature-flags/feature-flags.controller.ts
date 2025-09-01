import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FeatureFlagsService } from './feature-flags.service';
import {
  FeatureFlagConfig,
  FeatureFlagContext,
  FeatureFlagResult,
  FeatureFlagType,
} from './interfaces/feature-flag.interface';

/**
 * DTO for creating feature flags
 */
export class CreateFeatureFlagDto {
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  type: FeatureFlagType;
  rolloutPercentage?: number;
  targeting?: any;
  metadata?: Record<string, any>;
}

/**
 * DTO for updating feature flags
 */
export class UpdateFeatureFlagDto {
  name?: string;
  description?: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  targeting?: any;
  metadata?: Record<string, any>;
}

/**
 * DTO for feature flag evaluation
 */
export class EvaluateFeatureFlagDto {
  context?: FeatureFlagContext;
}

/**
 * Feature flags controller for managing and evaluating feature flags
 */
@ApiTags('Feature Flags')
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  /**
   * Get all feature flags
   */
  @Get()
  @ApiOperation({ summary: 'Get all feature flags' })
  @ApiResponse({ status: 200, description: 'List of all feature flags' })
  getAllFlags(): FeatureFlagConfig[] {
    return this.featureFlagsService.getAllFlags();
  }

  /**
   * Get feature flag by key
   */
  @Get(':key')
  @ApiOperation({ summary: 'Get feature flag by key' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({ status: 200, description: 'Feature flag configuration' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  getFlag(@Param('key') key: string): FeatureFlagConfig | null {
    const flag = this.featureFlagsService.getFlag(key);
    return flag || null;
  }

  /**
   * Evaluate feature flag
   */
  @Post(':key/evaluate')
  @ApiOperation({ summary: 'Evaluate feature flag for given context' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({ status: 200, description: 'Feature flag evaluation result' })
  evaluateFlag(
    @Param('key') key: string,
    @Body() evaluateDto: EvaluateFeatureFlagDto
  ): FeatureFlagResult {
    return this.featureFlagsService.evaluate(key, evaluateDto.context);
  }

  /**
   * Check if feature flag is enabled
   */
  @Get(':key/enabled')
  @ApiOperation({ summary: 'Check if feature flag is enabled' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiQuery({ name: 'userId', required: false, description: 'User ID for context' })
  @ApiQuery({ name: 'ipAddress', required: false, description: 'IP address for context' })
  @ApiQuery({ name: 'environment', required: false, description: 'Environment for context' })
  @ApiResponse({ status: 200, description: 'Feature flag enabled status' })
  isEnabled(
    @Param('key') key: string,
    @Query('userId') userId?: string,
    @Query('ipAddress') ipAddress?: string,
    @Query('environment') environment?: string
  ): { enabled: boolean } {
    const context: FeatureFlagContext = {
      userId,
      ipAddress,
      environment,
    };

    const enabled = this.featureFlagsService.isEnabled(key, context);
    return { enabled };
  }

  /**
   * Get feature flag value
   */
  @Get(':key/value')
  @ApiOperation({ summary: 'Get feature flag value' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiQuery({ name: 'userId', required: false, description: 'User ID for context' })
  @ApiQuery({ name: 'ipAddress', required: false, description: 'IP address for context' })
  @ApiQuery({ name: 'environment', required: false, description: 'Environment for context' })
  @ApiResponse({ status: 200, description: 'Feature flag value' })
  getValue(
    @Param('key') key: string,
    @Query('userId') userId?: string,
    @Query('ipAddress') ipAddress?: string,
    @Query('environment') environment?: string
  ): { value: any } {
    const context: FeatureFlagContext = {
      userId,
      ipAddress,
      environment,
    };

    const value = this.featureFlagsService.getValue(key, context);
    return { value };
  }

  /**
   * Create new feature flag
   */
  @Post()
  @ApiOperation({ summary: 'Create new feature flag' })
  @ApiResponse({ status: 201, description: 'Feature flag created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid feature flag data' })
  @ApiResponse({ status: 409, description: 'Feature flag already exists' })
  createFlag(@Body() createDto: CreateFeatureFlagDto): { success: boolean; message: string } {
    const success = this.featureFlagsService.addFlag(createDto);
    return {
      success,
      message: success ? 'Feature flag created successfully' : 'Feature flag already exists',
    };
  }

  /**
   * Update feature flag
   */
  @Put(':key')
  @ApiOperation({ summary: 'Update feature flag' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({ status: 200, description: 'Feature flag updated successfully' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  updateFlag(
    @Param('key') key: string,
    @Body() updateDto: UpdateFeatureFlagDto
  ): { success: boolean; message: string } {
    const success = this.featureFlagsService.updateFlag(key, updateDto);
    return {
      success,
      message: success ? 'Feature flag updated successfully' : 'Feature flag not found',
    };
  }

  /**
   * Delete feature flag
   */
  @Delete(':key')
  @ApiOperation({ summary: 'Delete feature flag' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({ status: 200, description: 'Feature flag deleted successfully' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  deleteFlag(@Param('key') key: string): { success: boolean; message: string } {
    const success = this.featureFlagsService.removeFlag(key);
    return {
      success,
      message: success ? 'Feature flag deleted successfully' : 'Feature flag not found',
    };
  }

  /**
   * Get feature flags statistics
   */
  @Get('stats/overview')
  @ApiOperation({ summary: 'Get feature flags statistics' })
  @ApiResponse({ status: 200, description: 'Feature flags statistics' })
  getStats(): {
    totalFlags: number;
    enabledFlags: number;
    lastUpdated: Date;
  } {
    return this.featureFlagsService.getStats();
  }

  /**
   * Refresh feature flags
   */
  @Post('refresh')
  @ApiOperation({ summary: 'Manually refresh feature flags' })
  @ApiResponse({ status: 200, description: 'Feature flags refreshed successfully' })
  async refreshFlags(): Promise<{ success: boolean; message: string }> {
    try {
      await this.featureFlagsService.refreshFeatureFlags();
      return {
        success: true,
        message: 'Feature flags refreshed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to refresh feature flags',
      };
    }
  }
}
