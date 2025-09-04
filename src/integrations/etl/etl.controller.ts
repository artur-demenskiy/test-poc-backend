import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { EtlService, EtlExecutionResult } from './etl.service';
import {
  EtlPipelineConfig,
  EtlSourceConfig,
  EtlTransformConfig,
  EtlDestinationConfig,
  EtlScheduleConfig,
  EtlErrorHandlingConfig,
} from '../interfaces/integration.interface';

/**
 * DTO for creating ETL pipeline
 */
export class CreateEtlPipelineDto {
  name: string;
  description?: string;
  source: EtlSourceConfig;
  transform: EtlTransformConfig;
  destination: EtlDestinationConfig;
  schedule?: EtlScheduleConfig;
  errorHandling: EtlErrorHandlingConfig;
  active: boolean;
}

/**
 * DTO for updating ETL pipeline
 */
export class UpdateEtlPipelineDto {
  name?: string;
  description?: string;
  source?: EtlSourceConfig;
  transform?: EtlTransformConfig;
  destination?: EtlDestinationConfig;
  schedule?: EtlScheduleConfig;
  errorHandling?: EtlErrorHandlingConfig;
  active?: boolean;
}

/**
 * DTO for executing ETL pipeline
 */
export class ExecuteEtlPipelineDto {
  force?: boolean;
  incremental?: boolean;
  dryRun?: boolean;
}

/**
 * ETL controller for managing ETL pipelines and executions
 */
@ApiTags('ETL Pipelines')
@Controller('etl')
export class EtlController {
  constructor(private readonly etlService: EtlService) {}

  /**
   * Get all ETL pipeline configurations
   */
  @Get('pipelines')
  @ApiOperation({ summary: 'Get all ETL pipeline configurations' })
  @ApiResponse({ status: 200, description: 'List of ETL pipeline configurations' })
  getAllPipelines(): EtlPipelineConfig[] {
    return this.etlService.getAllPipelines();
  }

  /**
   * Get ETL pipeline configuration by ID
   */
  @Get('pipelines/:id')
  @ApiOperation({ summary: 'Get ETL pipeline configuration by ID' })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({ status: 200, description: 'ETL pipeline configuration' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  getPipeline(@Param('id') id: string): EtlPipelineConfig | null {
    return this.etlService.getPipeline(id);
  }

  /**
   * Create new ETL pipeline configuration
   */
  @Post('pipelines')
  @ApiOperation({ summary: 'Create new ETL pipeline configuration' })
  @ApiResponse({ status: 201, description: 'Pipeline created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid pipeline data' })
  async createPipeline(@Body() createDto: CreateEtlPipelineDto): Promise<{ id: string; message: string }> {
    const id = await this.etlService.createPipeline(createDto);
    return {
      id,
      message: 'ETL pipeline created successfully',
    };
  }

  /**
   * Update ETL pipeline configuration
   */
  @Put('pipelines/:id')
  @ApiOperation({ summary: 'Update ETL pipeline configuration' })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({ status: 200, description: 'Pipeline updated successfully' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async updatePipeline(
    @Param('id') id: string,
    @Body() updateDto: UpdateEtlPipelineDto
  ): Promise<{ message: string }> {
    await this.etlService.updatePipeline(id, updateDto);
    return { message: 'ETL pipeline updated successfully' };
  }

  /**
   * Delete ETL pipeline configuration
   */
  @Delete('pipelines/:id')
  @ApiOperation({ summary: 'Delete ETL pipeline configuration' })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({ status: 200, description: 'Pipeline deleted successfully' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async deletePipeline(@Param('id') id: string): Promise<{ message: string }> {
    await this.etlService.deletePipeline(id);
    return { message: 'ETL pipeline deleted successfully' };
  }

  /**
   * Execute ETL pipeline
   */
  @Post('pipelines/:id/execute')
  @ApiOperation({ summary: 'Execute ETL pipeline' })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({ status: 200, description: 'Pipeline execution started' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async executePipeline(
    @Param('id') id: string,
    @Body() executeDto: ExecuteEtlPipelineDto
  ): Promise<EtlExecutionResult> {
    return await this.etlService.executePipeline(id, executeDto);
  }

  /**
   * Get ETL pipeline execution history
   */
  @Get('pipelines/:id/executions')
  @ApiOperation({ summary: 'Get ETL pipeline execution history' })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({ status: 200, description: 'Pipeline execution history' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  getPipelineExecutions(@Param('id') id: string): EtlExecutionResult[] {
    return this.etlService.getExecutionHistory(id);
  }

  /**
   * Get all ETL execution history
   */
  @Get('executions')
  @ApiOperation({ summary: 'Get all ETL execution history' })
  @ApiResponse({ status: 200, description: 'All ETL execution history' })
  getAllExecutions(): EtlExecutionResult[] {
    return this.etlService.getExecutionHistory();
  }

  /**
   * Get ETL pipeline statistics
   */
  @Get('pipelines/:id/stats')
  @ApiOperation({ summary: 'Get ETL pipeline statistics' })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({ status: 200, description: 'Pipeline statistics' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  getPipelineStats(@Param('id') id: string): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    totalRecordsProcessed: number;
    totalRecordsFailed: number;
  } {
    return this.etlService.getPipelineStats(id);
  }

  /**
   * Get ETL execution by ID
   */
  @Get('executions/:executionId')
  @ApiOperation({ summary: 'Get ETL execution by ID' })
  @ApiParam({ name: 'executionId', description: 'Execution ID' })
  @ApiResponse({ status: 200, description: 'ETL execution details' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  getExecution(@Param('executionId') executionId: string): EtlExecutionResult | null {
    const executions = this.etlService.getExecutionHistory();
    return executions.find(exec => exec.executionId === executionId) || null;
  }

  /**
   * Test ETL pipeline (dry run)
   */
  @Post('pipelines/:id/test')
  @ApiOperation({ summary: 'Test ETL pipeline with dry run' })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({ status: 200, description: 'Dry run completed' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async testPipeline(@Param('id') id: string): Promise<EtlExecutionResult> {
    return await this.etlService.executePipeline(id, { dryRun: true });
  }

  /**
   * Get ETL pipeline health status
   */
  @Get('pipelines/:id/health')
  @ApiOperation({ summary: 'Get ETL pipeline health status' })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({ status: 200, description: 'Pipeline health status' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async getPipelineHealth(@Param('id') id: string): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastExecution?: EtlExecutionResult;
    errorRate: number;
    averageDuration: number;
    lastChecked: Date;
  }> {
    const pipeline = this.etlService.getPipeline(id);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${id}`);
    }

    const stats = this.etlService.getPipelineStats(id);
    const executions = this.etlService.getExecutionHistory(id);
    const lastExecution = executions.length > 0 ? executions[executions.length - 1] : undefined;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let errorRate = 0;

    if (stats.totalExecutions > 0) {
      errorRate = (stats.failedExecutions / stats.totalExecutions) * 100;
      
      if (errorRate > 20) {
        status = 'unhealthy';
      } else if (errorRate > 5) {
        status = 'degraded';
      }
    }

    return {
      status,
      lastExecution,
      errorRate,
      averageDuration: stats.averageDuration,
      lastChecked: new Date(),
    };
  }

  /**
   * Refresh ETL pipeline configurations
   */
  @Post('pipelines/refresh')
  @ApiOperation({ summary: 'Refresh all ETL pipeline configurations' })
  @ApiResponse({ status: 200, description: 'Configurations refreshed successfully' })
  async refreshPipelines(): Promise<{ message: string; count: number }> {
    await this.etlService.refreshPipelines();
    const pipelines = this.etlService.getAllPipelines();
    return {
      message: 'ETL pipeline configurations refreshed successfully',
      count: pipelines.length,
    };
  }

  /**
   * Get ETL system overview
   */
  @Get('overview')
  @ApiOperation({ summary: 'Get ETL system overview' })
  @ApiResponse({ status: 200, description: 'ETL system overview' })
  getSystemOverview(): {
    totalPipelines: number;
    activePipelines: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    lastExecutionTime: Date | null;
  } {
    const pipelines = this.etlService.getAllPipelines();
    const executions = this.etlService.getExecutionHistory();
    
    const activePipelines = pipelines.filter(p => p.active).length;
    const successfulExecutions = executions.filter(e => e.status === 'success').length;
    const failedExecutions = executions.filter(e => e.status === 'failed').length;
    const totalExecutionTime = executions.reduce((sum, e) => sum + e.duration, 0);
    const averageExecutionTime = executions.length > 0 ? totalExecutionTime / executions.length : 0;
    const lastExecutionTime = executions.length > 0 ? executions[executions.length - 1].startTime : null;

    return {
      totalPipelines: pipelines.length,
      activePipelines,
      totalExecutions: executions.length,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      lastExecutionTime,
    };
  }
}
