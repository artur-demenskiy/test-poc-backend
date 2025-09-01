import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  FeatureFlagConfig,
  FeatureFlagContext,
  FeatureFlagResult,
  FeatureFlagType,
  TargetingRule,
} from './interfaces/feature-flag.interface';

/**
 * Feature flags service for managing and evaluating feature flags
 */
@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private featureFlags: Map<string, FeatureFlagConfig> = new Map();
  private lastUpdated: Date = new Date();

  /**
   * Initialize the service and load feature flags
   */
  async onModuleInit() {
    await this.loadFeatureFlags();
    this.logger.log('Feature flags service initialized');
  }

  /**
   * Load feature flags from configuration
   */
  private async loadFeatureFlags(): Promise<void> {
    try {
      // In a real implementation, this would load from a database or external service
      const defaultFlags: FeatureFlagConfig[] = [
        {
          key: 'new-user-dashboard',
          name: 'New User Dashboard',
          description: 'Enable the new user dashboard interface',
          enabled: false,
          type: FeatureFlagType.BOOLEAN,
          rolloutPercentage: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          key: 'advanced-analytics',
          name: 'Advanced Analytics',
          description: 'Enable advanced analytics features',
          enabled: true,
          type: FeatureFlagType.BOOLEAN,
          rolloutPercentage: 100,
          targeting: {
            userAttributes: {
              plan: 'premium',
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          key: 'api-rate-limit',
          name: 'API Rate Limit',
          description: 'API rate limiting configuration',
          enabled: true,
          type: FeatureFlagType.NUMBER,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      this.featureFlags.clear();
      defaultFlags.forEach(flag => {
        this.featureFlags.set(flag.key, flag);
      });

      this.lastUpdated = new Date();
      this.logger.log(`Loaded ${this.featureFlags.size} feature flags`);
    } catch (error) {
      this.logger.error('Failed to load feature flags', error);
    }
  }

  /**
   * Evaluate a feature flag for a given context
   */
  evaluate(key: string, context: FeatureFlagContext = {}): FeatureFlagResult {
    const flag = this.featureFlags.get(key);

    if (!flag) {
      return {
        enabled: false,
        reason: 'Feature flag not found',
        evaluatedAt: new Date(),
      };
    }

    // Check environment-specific override
    if (context.environment && flag.environments?.[context.environment] !== undefined) {
      return {
        enabled: flag.environments[context.environment],
        value: flag.environments[context.environment],
        reason: `Environment override for ${context.environment}`,
        evaluatedAt: new Date(),
      };
    }

    // Check targeting rules
    if (flag.targeting) {
      const targetingResult = this.evaluateTargeting(flag, context);
      if (targetingResult !== null) {
        return targetingResult;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const hash = this.hashContext(context);
      const percentage = hash % 100;

      if (percentage >= flag.rolloutPercentage) {
        return {
          enabled: false,
          reason: `Rollout percentage: ${percentage}% >= ${flag.rolloutPercentage}%`,
          evaluatedAt: new Date(),
        };
      }
    }

    return {
      enabled: flag.enabled,
      value: flag.enabled,
      reason: 'Default configuration',
      evaluatedAt: new Date(),
    };
  }

  /**
   * Check if a feature flag is enabled
   */
  isEnabled(key: string, context: FeatureFlagContext = {}): boolean {
    return this.evaluate(key, context).enabled;
  }

  /**
   * Get feature flag value
   */
  getValue(key: string, context: FeatureFlagContext = {}): any {
    const result = this.evaluate(key, context);
    return result.enabled ? result.value : null;
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): FeatureFlagConfig[] {
    return Array.from(this.featureFlags.values());
  }

  /**
   * Get feature flag by key
   */
  getFlag(key: string): FeatureFlagConfig | undefined {
    return this.featureFlags.get(key);
  }

  /**
   * Update feature flag configuration
   */
  updateFlag(key: string, updates: Partial<FeatureFlagConfig>): boolean {
    const existingFlag = this.featureFlags.get(key);
    if (!existingFlag) {
      return false;
    }

    const updatedFlag: FeatureFlagConfig = {
      ...existingFlag,
      ...updates,
      updatedAt: new Date(),
    };

    this.featureFlags.set(key, updatedFlag);
    this.logger.log(`Updated feature flag: ${key}`);
    return true;
  }

  /**
   * Add new feature flag
   */
  addFlag(flag: Omit<FeatureFlagConfig, 'createdAt' | 'updatedAt'>): boolean {
    if (this.featureFlags.has(flag.key)) {
      return false;
    }

    const newFlag: FeatureFlagConfig = {
      ...flag,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.featureFlags.set(flag.key, newFlag);
    this.logger.log(`Added new feature flag: ${flag.key}`);
    return true;
  }

  /**
   * Remove feature flag
   */
  removeFlag(key: string): boolean {
    const removed = this.featureFlags.delete(key);
    if (removed) {
      this.logger.log(`Removed feature flag: ${key}`);
    }
    return removed;
  }

  /**
   * Evaluate targeting rules
   */
  private evaluateTargeting(
    flag: FeatureFlagConfig,
    context: FeatureFlagContext
  ): FeatureFlagResult | null {
    if (!flag.targeting) {
      return null;
    }

    const { targeting } = flag;

    // Check user ID inclusion/exclusion
    if (context.userId) {
      if (targeting.excludedUserIds?.includes(context.userId)) {
        return {
          enabled: false,
          reason: 'User ID excluded',
          evaluatedAt: new Date(),
        };
      }

      if (targeting.userIds?.includes(context.userId)) {
        return {
          enabled: true,
          value: true,
          reason: 'User ID included',
          evaluatedAt: new Date(),
        };
      }
    }

    // Check IP address inclusion/exclusion
    if (context.ipAddress) {
      if (targeting.excludedIpAddresses?.includes(context.ipAddress)) {
        return {
          enabled: false,
          reason: 'IP address excluded',
          evaluatedAt: new Date(),
        };
      }

      if (targeting.ipAddresses?.includes(context.ipAddress)) {
        return {
          enabled: true,
          value: true,
          reason: 'IP address included',
          evaluatedAt: new Date(),
        };
      }
    }

    // Check user attributes
    if (context.userAttributes && targeting.userAttributes) {
      const matches = Object.entries(targeting.userAttributes).every(([key, value]) => {
        return context.userAttributes?.[key] === value;
      });

      if (matches) {
        return {
          enabled: true,
          value: true,
          reason: 'User attributes match',
          evaluatedAt: new Date(),
        };
      }
    }

    // Check custom rules
    if (targeting.customRules && context.customData) {
      for (const rule of targeting.customRules) {
        if (this.evaluateCustomRule(rule, context.customData)) {
          return {
            enabled: true,
            value: true,
            reason: `Custom rule matched: ${rule.id}`,
            evaluatedAt: new Date(),
          };
        }
      }
    }

    return null;
  }

  /**
   * Evaluate custom targeting rule
   */
  private evaluateCustomRule(rule: TargetingRule, customData: Record<string, any>): boolean {
    const value = customData[rule.condition];

    if (value === undefined) {
      return false;
    }

    switch (rule.operator) {
      case 'equals':
        return value === rule.value;
      case 'not_equals':
        return value !== rule.value;
      case 'contains':
        return String(value).includes(String(rule.value));
      case 'not_contains':
        return !String(value).includes(String(rule.value));
      case 'greater_than':
        return Number(value) > Number(rule.value);
      case 'less_than':
        return Number(value) < Number(rule.value);
      case 'regex':
        return new RegExp(rule.value).test(String(value));
      default:
        return false;
    }
  }

  /**
   * Generate hash from context for consistent rollout
   */
  private hashContext(context: FeatureFlagContext): number {
    const str = JSON.stringify(context);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Refresh feature flags from external source
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshFeatureFlags(): Promise<void> {
    try {
      await this.loadFeatureFlags();
      this.logger.log('Feature flags refreshed');
    } catch (error) {
      this.logger.error('Failed to refresh feature flags', error);
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalFlags: number;
    enabledFlags: number;
    lastUpdated: Date;
  } {
    const totalFlags = this.featureFlags.size;
    const enabledFlags = Array.from(this.featureFlags.values()).filter(flag => flag.enabled).length;

    return {
      totalFlags,
      enabledFlags,
      lastUpdated: this.lastUpdated,
    };
  }
}
