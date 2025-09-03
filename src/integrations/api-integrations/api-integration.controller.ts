import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ApiIntegrationService } from './api-integration.service';
import {
  ApiIntegrationConfig,
  ApiAuthConfig,
  ApiRateLimitConfig,
} from '../interfaces/integration.interface';

/**
 * DTO for creating API integration
 */
export class CreateApiIntegrationDto {
  name: string;
  provider: string;
  baseUrl: string;
  version?: string;
  auth: ApiAuthConfig;
  rateLimit?: ApiRateLimitConfig;
  timeout: number;
  active: boolean;
}

/**
 * DTO for updating API integration
 */
export class UpdateApiIntegrationDto {
  name?: string;
  provider?: string;
  baseUrl?: string;
  version?: string;
  auth?: ApiAuthConfig;
  rateLimit?: ApiRateLimitConfig;
  timeout?: number;
  active?: boolean;
}

/**
 * DTO for testing API integration
 */
export class TestApiIntegrationDto {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  data?: any;
  headers?: Record<string, string>;
}

/**
 * DTO for OAuth2 authorization
 */
export class OAuth2AuthDto {
  state?: string;
  scope?: string[];
}

/**
 * DTO for OAuth2 code exchange
 */
export class OAuth2ExchangeDto {
  code: string;
  state?: string;
}

/**
 * API integration controller for managing third-party API integrations
 */
@ApiTags('API Integrations')
@Controller('api-integrations')
export class ApiIntegrationController {
  constructor(private readonly apiIntegrationService: ApiIntegrationService) {}

  /**
   * Get all API integrations
   */
  @Get()
  @ApiOperation({ summary: 'Get all API integrations' })
  @ApiResponse({ status: 200, description: 'List of API integrations' })
  getAllIntegrations(): ApiIntegrationConfig[] {
    return this.apiIntegrationService.getAllIntegrations();
  }

  /**
   * Get API integration by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get API integration by ID' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'API integration configuration' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  getIntegration(@Param('id') id: string): ApiIntegrationConfig | null {
    return this.apiIntegrationService.getIntegration(id);
  }

  /**
   * Create new API integration
   */
  @Post()
  @ApiOperation({ summary: 'Create new API integration' })
  @ApiResponse({ status: 201, description: 'Integration created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid integration data' })
  async createIntegration(@Body() createDto: CreateApiIntegrationDto): Promise<{ id: string; message: string }> {
    const id = await this.apiIntegrationService.createIntegration(createDto);
    return {
      id,
      message: 'API integration created successfully',
    };
  }

  /**
   * Update API integration
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update API integration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'Integration updated successfully' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async updateIntegration(
    @Param('id') id: string,
    @Body() updateDto: UpdateApiIntegrationDto
  ): Promise<{ message: string }> {
    await this.apiIntegrationService.updateIntegration(id, updateDto);
    return { message: 'API integration updated successfully' };
  }

  /**
   * Delete API integration
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete API integration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'Integration deleted successfully' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async deleteIntegration(@Param('id') id: string): Promise<{ message: string }> {
    await this.apiIntegrationService.deleteIntegration(id);
    return { message: 'API integration deleted successfully' };
  }

  /**
   * Test API integration
   */
  @Post(':id/test')
  @ApiOperation({ summary: 'Test API integration connectivity' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'Test completed successfully' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async testIntegration(
    @Param('id') id: string,
    @Body() testDto: TestApiIntegrationDto
  ): Promise<{ success: boolean; response?: any; error?: string }> {
    try {
      const response = await this.apiIntegrationService.makeRequest(
        id,
        testDto.method,
        testDto.endpoint,
        testDto.data,
        testDto.headers
      );
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get OAuth2 authorization URL
   */
  @Get(':id/oauth2/auth-url')
  @ApiOperation({ summary: 'Get OAuth2 authorization URL' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiQuery({ name: 'state', required: false, description: 'OAuth2 state parameter' })
  @ApiResponse({ status: 200, description: 'OAuth2 authorization URL' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  getOAuth2AuthUrl(
    @Param('id') id: string,
    @Query('state') state?: string
  ): { authUrl: string } {
    const authUrl = this.apiIntegrationService.getOAuth2AuthUrl(id, state);
    return { authUrl };
  }

  /**
   * Exchange OAuth2 code for token
   */
  @Post(':id/oauth2/exchange')
  @ApiOperation({ summary: 'Exchange OAuth2 code for access token' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'OAuth2 tokens received' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async exchangeOAuth2Code(
    @Param('id') id: string,
    @Body() exchangeDto: OAuth2ExchangeDto
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    const tokens = await this.apiIntegrationService.exchangeOAuth2Code(id, exchangeDto.code);
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
  }

  /**
   * Get rate limit status
   */
  @Get(':id/rate-limit')
  @ApiOperation({ summary: 'Get rate limit status for integration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'Rate limit status' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  getRateLimitStatus(@Param('id') id: string): {
    current: number;
    limit: number;
    resetTime: number;
    remaining: number;
  } | null {
    const status = this.apiIntegrationService.getRateLimitStatus(id);
    if (!status) return null;
    
    return {
      current: status.count,
      limit: status.limit,
      resetTime: status.resetTime.getTime(),
      remaining: status.limit - status.count,
    };
  }

  /**
   * Refresh integration configurations
   */
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh all integration configurations' })
  @ApiResponse({ status: 200, description: 'Configurations refreshed successfully' })
  async refreshIntegrations(): Promise<{ message: string; count: number }> {
    await this.apiIntegrationService.refreshIntegrations();
    const integrations = this.apiIntegrationService.getAllIntegrations();
    return {
      message: 'Integration configurations refreshed successfully',
      count: integrations.length,
    };
  }

  /**
   * Get integration health status
   */
  @Get(':id/health')
  @ApiOperation({ summary: 'Get integration health status' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'Health status' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async getHealthStatus(@Param('id') id: string): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime?: number;
    error?: string;
    lastChecked: Date;
  }> {
    const integration = this.apiIntegrationService.getIntegration(id);
    if (!integration) {
      return {
        status: 'unhealthy',
        error: 'Integration not found',
        lastChecked: new Date(),
      };
    }

    if (!integration.active) {
      return {
        status: 'degraded',
        error: 'Integration is inactive',
        lastChecked: new Date(),
      };
    }

    try {
      const startTime = Date.now();
      await this.apiIntegrationService.makeRequest(id, 'GET', '/health');
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date(),
      };
    }
  }
}
