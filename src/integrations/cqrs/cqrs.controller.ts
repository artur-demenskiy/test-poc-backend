import { Controller, Get, Post, Body, Param, Query as QueryParam } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CqrsService } from './cqrs.service';
import {
  Command,
  Query,
  Event,
  Projection,
  EventStoreStats,
  ProjectionStats,
} from '../interfaces/cqrs.interface';

export class ExecuteCommandDto {
  /** Command type */
  type: string;
  /** Command data */
  data: any;
  /** Command metadata */
  metadata?: Record<string, any>;
  /** User ID */
  userId?: string;
  /** Correlation ID */
  correlationId?: string;
  /** Causation ID */
  causationId?: string;
}

export class ExecuteQueryDto {
  /** Query type */
  type: string;
  /** Query parameters */
  params: any;
  /** Query metadata */
  metadata?: Record<string, any>;
  /** User ID */
  userId?: string;
  /** Correlation ID */
  correlationId?: string;
}

export class PublishEventDto {
  /** Event type */
  type: string;
  /** Aggregate ID */
  aggregateId: string;
  /** Aggregate type */
  aggregateType: string;
  /** Event data */
  data: any;
  /** Event metadata */
  metadata?: Record<string, any>;
  /** Correlation ID */
  correlationId?: string;
  /** Causation ID */
  causationId?: string;
}

export class CreateProjectionDto {
  /** Projection name */
  name: string;
  /** Projection type */
  type: string;
  /** Projection state */
  state: any;
  /** Event types to handle */
  eventTypes: string[];
  /** Whether projection is active */
  active: boolean;
}

@ApiTags('CQRS')
@Controller('cqrs')
export class CqrsController {
  constructor(private readonly cqrsService: CqrsService) {}

  @Post('commands')
  @ApiOperation({ summary: 'Execute a command' })
  @ApiResponse({ status: 200, description: 'Command executed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid command' })
  async executeCommand(@Body() commandDto: ExecuteCommandDto): Promise<{ result: any; commandId: string }> {
    const command: Command = {
      id: `cmd_${Date.now()}_${Math.random()}`,
      type: commandDto.type,
      data: commandDto.data,
      metadata: commandDto.metadata,
      timestamp: new Date(),
      userId: commandDto.userId,
      correlationId: commandDto.correlationId,
      causationId: commandDto.causationId,
    };

    const result = await this.cqrsService.executeCommand(command);
    return {
      result,
      commandId: command.id,
    };
  }

  @Post('queries')
  @ApiOperation({ summary: 'Execute a query' })
  @ApiResponse({ status: 200, description: 'Query executed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid query' })
  async executeQuery(@Body() queryDto: ExecuteQueryDto): Promise<{ result: any; queryId: string }> {
    const query: Query = {
      id: `qry_${Date.now()}_${Math.random()}`,
      type: queryDto.type,
      params: queryDto.params,
      metadata: queryDto.metadata,
      timestamp: new Date(),
      userId: queryDto.userId,
      correlationId: queryDto.correlationId,
    };

    const result = await this.cqrsService.executeQuery(query);
    return {
      result,
      queryId: query.id,
    };
  }

  @Post('events')
  @ApiOperation({ summary: 'Publish an event' })
  @ApiResponse({ status: 200, description: 'Event published successfully' })
  @ApiResponse({ status: 400, description: 'Invalid event' })
  async publishEvent(@Body() eventDto: PublishEventDto): Promise<{ message: string; eventId: string }> {
    const event: Event = {
      id: `evt_${Date.now()}_${Math.random()}`,
      type: eventDto.type,
      aggregateId: eventDto.aggregateId,
      aggregateType: eventDto.aggregateType,
      version: 1, // Would need to get from event store
      data: eventDto.data,
      metadata: eventDto.metadata,
      timestamp: new Date(),
      sequenceNumber: 1, // Would be assigned by event store
      correlationId: eventDto.correlationId,
      causationId: eventDto.causationId,
    };

    await this.cqrsService.publishEvent(event);
    return {
      message: 'Event published successfully',
      eventId: event.id,
    };
  }

  @Post('projections')
  @ApiOperation({ summary: 'Create a projection' })
  @ApiResponse({ status: 201, description: 'Projection created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid projection' })
  async createProjection(@Body() projectionDto: CreateProjectionDto): Promise<{ id: string; message: string }> {
    const projection: Projection = {
      id: `proj_${Date.now()}_${Math.random()}`,
      name: projectionDto.name,
      type: projectionDto.type,
      state: projectionDto.state,
      version: 1,
      active: projectionDto.active,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const id = await this.cqrsService.createProjection(projection);
    return {
      id,
      message: 'Projection created successfully',
    };
  }

  @Get('projections')
  @ApiOperation({ summary: 'List all projections' })
  @ApiResponse({ status: 200, description: 'Projections retrieved' })
  async listProjections(): Promise<Projection[]> {
    return this.cqrsService.listProjections();
  }

  @Get('projections/:id')
  @ApiOperation({ summary: 'Get projection by ID' })
  @ApiParam({ name: 'id', description: 'Projection ID' })
  @ApiResponse({ status: 200, description: 'Projection retrieved' })
  @ApiResponse({ status: 404, description: 'Projection not found' })
  async getProjection(@Param('id') id: string): Promise<Projection> {
    const projection = this.cqrsService.getProjection(id);
    if (!projection) {
      throw new Error(`Projection not found: ${id}`);
    }
    return projection;
  }

  @Get('stats/event-store')
  @ApiOperation({ summary: 'Get event store statistics' })
  @ApiResponse({ status: 200, description: 'Event store statistics retrieved' })
  async getEventStoreStats(): Promise<EventStoreStats> {
    return await this.cqrsService.getEventStoreStats();
  }

  @Get('stats/projections')
  @ApiOperation({ summary: 'Get projection statistics' })
  @ApiResponse({ status: 200, description: 'Projection statistics retrieved' })
  async getProjectionStats(): Promise<ProjectionStats> {
    return await this.cqrsService.getProjectionStats();
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get CQRS system overview' })
  @ApiResponse({ status: 200, description: 'System overview retrieved' })
  getSystemOverview(): {
    totalCommands: number;
    totalQueries: number;
    totalEvents: number;
    totalProjections: number;
    activeProjections: number;
    eventStoreSize: number;
  } {
    return this.cqrsService.getSystemOverview();
  }

  @Get('events')
  @ApiOperation({ summary: 'Get events by criteria' })
  @ApiQuery({ name: 'type', required: false, description: 'Event type filter' })
  @ApiQuery({ name: 'aggregateType', required: false, description: 'Aggregate type filter' })
  @ApiQuery({ name: 'aggregateId', required: false, description: 'Aggregate ID filter' })
  @ApiQuery({ name: 'fromDate', required: false, description: 'From date filter' })
  @ApiQuery({ name: 'toDate', required: false, description: 'To date filter' })
  @ApiResponse({ status: 200, description: 'Events retrieved' })
  async getEvents(
    @QueryParam('type') _type?: string,
    @QueryParam('aggregateType') _aggregateType?: string,
    @QueryParam('aggregateId') _aggregateId?: string,
    @QueryParam('fromDate') _fromDate?: string,
    @QueryParam('toDate') _toDate?: string,
  ): Promise<Event[]> {
    // This would need to be implemented in the service
    // For now, return empty array
    return [];
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Event retrieved' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEvent(@Param('id') _id: string): Promise<Event> {
    // This would need to be implemented in the service
    throw new Error('Not implemented');
  }
}
