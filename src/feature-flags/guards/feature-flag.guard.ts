import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from '../feature-flags.service';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';
import { FeatureFlagContext } from '../interfaces/feature-flag.interface';

/**
 * Feature flag guard for protecting routes based on feature flags
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagsService: FeatureFlagsService
  ) {}

  /**
   * Check if the route can be activated based on feature flag
   */
  canActivate(context: ExecutionContext): boolean {
    const featureFlagMetadata = this.reflector.getAllAndOverride<{
      flagKey: string;
      context?: FeatureFlagContext;
    }>(FEATURE_FLAG_KEY, [context.getHandler(), context.getClass()]);

    if (!featureFlagMetadata) {
      return true; // No feature flag requirement
    }

    const { flagKey, context: flagContext } = featureFlagMetadata;

    // Build context from request
    const request = context.switchToHttp().getRequest();
    const evaluationContext: FeatureFlagContext = {
      ...flagContext,
      userId: request.user?.id || request.headers['x-user-id'],
      ipAddress: request.ip || request.connection.remoteAddress,
      environment: process.env.NODE_ENV,
      customData: {
        ...flagContext?.customData,
        userAgent: request.headers['user-agent'],
        referer: request.headers['referer'],
      },
    };

    const isEnabled = this.featureFlagsService.isEnabled(flagKey, evaluationContext);

    if (!isEnabled) {
      throw new ForbiddenException(`Feature flag '${flagKey}' is not enabled`);
    }

    return true;
  }
}
