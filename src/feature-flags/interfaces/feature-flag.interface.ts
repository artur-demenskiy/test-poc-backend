/**
 * Feature flag configuration interface
 */
export interface FeatureFlagConfig {
  /** Unique identifier for the feature flag */
  key: string;
  /** Human-readable name */
  name: string;
  /** Description of what this feature flag controls */
  description?: string;
  /** Whether the feature is enabled by default */
  enabled: boolean;
  /** Environment-specific overrides */
  environments?: Record<string, boolean>;
  /** User-specific targeting rules */
  targeting?: FeatureFlagTargeting;
  /** Rollout percentage (0-100) */
  rolloutPercentage?: number;
  /** Feature flag type */
  type: FeatureFlagType;
  /** Metadata for additional configuration */
  metadata?: Record<string, any>;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Feature flag targeting configuration
 */
export interface FeatureFlagTargeting {
  /** User IDs to include */
  userIds?: string[];
  /** User IDs to exclude */
  excludedUserIds?: string[];
  /** User attributes to match */
  userAttributes?: Record<string, any>;
  /** IP addresses to include */
  ipAddresses?: string[];
  /** IP addresses to exclude */
  excludedIpAddresses?: string[];
  /** Custom targeting rules */
  customRules?: TargetingRule[];
}

/**
 * Custom targeting rule
 */
export interface TargetingRule {
  /** Rule identifier */
  id: string;
  /** Rule condition */
  condition: string;
  /** Rule value */
  value: any;
  /** Rule operator */
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'greater_than'
    | 'less_than'
    | 'regex';
}

/**
 * Feature flag types
 */
export enum FeatureFlagType {
  BOOLEAN = 'boolean',
  STRING = 'string',
  NUMBER = 'number',
  JSON = 'json',
}

/**
 * Feature flag evaluation context
 */
export interface FeatureFlagContext {
  /** User ID */
  userId?: string;
  /** User attributes */
  userAttributes?: Record<string, any>;
  /** IP address */
  ipAddress?: string;
  /** Environment */
  environment?: string;
  /** Custom context data */
  customData?: Record<string, any>;
}

/**
 * Feature flag evaluation result
 */
export interface FeatureFlagResult {
  /** Whether the feature is enabled */
  enabled: boolean;
  /** Feature flag value */
  value?: any;
  /** Reason for the evaluation result */
  reason: string;
  /** Variant if applicable */
  variant?: string;
  /** Evaluation timestamp */
  evaluatedAt: Date;
}
