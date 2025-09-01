import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { FeatureFlag } from './feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from './feature-flags/guards/feature-flag.guard';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly _appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get hello message' })
  @ApiResponse({
    status: 200,
    description: 'Returns hello message',
    schema: {
      type: 'string',
      example: 'Hello World!',
    },
  })
  getHello(): string {
    return this._appService.getHello();
  }

  @Get('feature-demo')
  @UseGuards(FeatureFlagGuard)
  @FeatureFlag('new-user-dashboard')
  @ApiOperation({ summary: 'Demo endpoint protected by feature flag' })
  @ApiResponse({
    status: 200,
    description: 'Returns feature demo message',
    schema: {
      type: 'string',
      example: 'This endpoint is protected by feature flag!',
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Feature flag not enabled',
  })
  getFeatureDemo(): string {
    return 'This endpoint is protected by feature flag!';
  }
}
