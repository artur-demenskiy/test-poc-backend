import { SetMetadata } from '@nestjs/common';
import { FeatureFlagContext } from '../interfaces/feature-flag.interface';

/**
 * Feature flag metadata key
 */
export const FEATURE_FLAG_KEY = 'featureFlag';

/**
 * Feature flag decorator for enabling/disabling endpoints based on feature flags
 */
export const FeatureFlag = (flagKey: string, context?: FeatureFlagContext) =>
  SetMetadata(FEATURE_FLAG_KEY, { flagKey, context });
