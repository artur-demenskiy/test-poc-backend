import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import {
  WebhookConfig,
  WebhookDelivery,
} from '../interfaces/integration.interface';

/**
 * DTO for creating webhook
 */
export class CreateWebhookDto {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  events: string[];
  headers?: Record<string, string>;
  auth?: any;
  retry?: any;
  active: boolean;
}

/**
 * DTO for updating webhook
 */
export class UpdateWebhookDto {
  name?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  events?: string[];
  headers?: Record<string, string>;
  auth?: any;
  retry?: any;
  active?: boolean;
}

/**
 * DTO for triggering webhook
 */
export class TriggerWebhookDto {
  event: string;
  payload: any;
}

/**
 * Webhook controller for managing webhook configurations and deliveries
 */
@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Get all webhook configurations
   */
  @Get()
  @ApiOperation({ summary: 'Get all webhook configurations' })
  @ApiResponse({ status: 200, description: 'List of webhook configurations' })
  getAllWebhooks(): WebhookConfig[] {
    return this.webhookService.getAllWebhooks();
  }

  /**
   * Get webhook configuration by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get webhook configuration by ID' })
  @ApiParam({ name: 'id', description: 'Webhook ID' })
  @ApiResponse({ status: 200, description: 'Webhook configuration' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  getWebhook(@Param('id') id: string): WebhookConfig | null {
    return this.webhookService.getWebhook(id);
  }

  /**
   * Create new webhook configuration
   */
  @Post()
  @ApiOperation({ summary: 'Create new webhook configuration' })
  @ApiResponse({ status: 201, description: 'Webhook created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook data' })
  async createWebhook(@Body() createDto: CreateWebhookDto): Promise<{ id: string; message: string }> {
    const id = await this.webhookService.createWebhook(createDto);
    return {
      id,
      message: 'Webhook created successfully',
    };
  }

  /**
   * Update webhook configuration
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update webhook configuration' })
  @ApiParam({ name: 'id', description: 'Webhook ID' })
  @ApiResponse({ status: 200, description: 'Webhook updated successfully' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async updateWebhook(
    @Param('id') id: string,
    @Body() updateDto: UpdateWebhookDto
  ): Promise<{ success: boolean; message: string }> {
    const success = await this.webhookService.updateWebhook(id, updateDto);
    return {
      success,
      message: success ? 'Webhook updated successfully' : 'Webhook not found',
    };
  }

  /**
   * Delete webhook configuration
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete webhook configuration' })
  @ApiParam({ name: 'id', description: 'Webhook ID' })
  @ApiResponse({ status: 200, description: 'Webhook deleted successfully' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async deleteWebhook(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    const success = await this.webhookService.deleteWebhook(id);
    return {
      success,
      message: success ? 'Webhook deleted successfully' : 'Webhook not found',
    };
  }

  /**
   * Trigger webhook manually
   */
  @Post(':id/trigger')
  @ApiOperation({ summary: 'Trigger webhook manually' })
  @ApiParam({ name: 'id', description: 'Webhook ID' })
  @ApiResponse({ status: 200, description: 'Webhook triggered successfully' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async triggerWebhook(
    @Param('id') id: string,
    @Body() triggerDto: TriggerWebhookDto
  ): Promise<{ success: boolean; message: string }> {
    const webhook = this.webhookService.getWebhook(id);
    if (!webhook) {
      return {
        success: false,
        message: 'Webhook not found',
      };
    }

    await this.webhookService.triggerWebhook(triggerDto.event, triggerDto.payload);
    return {
      success: true,
      message: 'Webhook triggered successfully',
    };
  }

  /**
   * Get webhook delivery history
   */
  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Get webhook delivery history' })
  @ApiParam({ name: 'id', description: 'Webhook ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of deliveries to return' })
  @ApiResponse({ status: 200, description: 'Webhook delivery history' })
  getDeliveryHistory(
    @Param('id') id: string,
    @Query('limit') limit?: number
  ): WebhookDelivery[] {
    return this.webhookService.getDeliveryHistory(id, limit ? Number(limit) : 100);
  }

  /**
   * Get all webhook deliveries
   */
  @Get('deliveries/all')
  @ApiOperation({ summary: 'Get all webhook deliveries' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of deliveries to return' })
  @ApiResponse({ status: 200, description: 'All webhook deliveries' })
  getAllDeliveries(@Query('limit') limit?: number): WebhookDelivery[] {
    return this.webhookService.getDeliveryHistory(undefined, limit ? Number(limit) : 100);
  }

  /**
   * Get webhook delivery statistics
   */
  @Get(':id/stats')
  @ApiOperation({ summary: 'Get webhook delivery statistics' })
  @ApiParam({ name: 'id', description: 'Webhook ID' })
  @ApiResponse({ status: 200, description: 'Webhook delivery statistics' })
  getDeliveryStats(@Param('id') id: string): {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    averageResponseTime: number;
  } {
    return this.webhookService.getDeliveryStats(id);
  }

  /**
   * Get overall webhook statistics
   */
  @Get('stats/overview')
  @ApiOperation({ summary: 'Get overall webhook statistics' })
  @ApiResponse({ status: 200, description: 'Overall webhook statistics' })
  getOverallStats(): {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    averageResponseTime: number;
  } {
    return this.webhookService.getDeliveryStats();
  }

  /**
   * Refresh webhook configurations
   */
  @Post('refresh')
  @ApiOperation({ summary: 'Manually refresh webhook configurations' })
  @ApiResponse({ status: 200, description: 'Webhook configurations refreshed successfully' })
  async refreshWebhooks(): Promise<{ success: boolean; message: string }> {
    try {
      await this.webhookService.refreshWebhooks();
      return {
        success: true,
        message: 'Webhook configurations refreshed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to refresh webhook configurations',
      };
    }
  }
}
