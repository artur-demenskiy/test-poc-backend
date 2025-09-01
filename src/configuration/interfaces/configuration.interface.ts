/**
 * Configuration entry interface
 */
export interface ConfigurationEntry {
  /** Unique key for the configuration */
  key: string;
  /** Configuration value */
  value: any;
  /** Configuration type */
  type: ConfigurationType;
  /** Description of the configuration */
  description?: string;
  /** Environment where this configuration applies */
  environment?: string;
  /** Whether the configuration is sensitive */
  sensitive?: boolean;
  /** Default value */
  defaultValue?: any;
  /** Validation rules */
  validation?: ConfigurationValidation;
  /** Metadata */
  metadata?: Record<string, any>;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Version number */
  version: number;
}

/**
 * Configuration types
 */
export enum ConfigurationType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
  ARRAY = 'array',
  OBJECT = 'object',
}

/**
 * Configuration validation rules
 */
export interface ConfigurationValidation {
  /** Required field */
  required?: boolean;
  /** Minimum value (for numbers) */
  min?: number;
  /** Maximum value (for numbers) */
  max?: number;
  /** Minimum length (for strings/arrays) */
  minLength?: number;
  /** Maximum length (for strings/arrays) */
  maxLength?: number;
  /** Regular expression pattern (for strings) */
  pattern?: string;
  /** Allowed values */
  enum?: any[];
  /** Custom validation function */
  customValidator?: (value: any) => boolean | string;
}

/**
 * Configuration update request
 */
export interface ConfigurationUpdateRequest {
  /** Configuration key */
  key: string;
  /** New value */
  value: any;
  /** Environment (optional) */
  environment?: string;
  /** Update reason */
  reason?: string;
  /** User who made the update */
  updatedBy?: string;
}

/**
 * Configuration history entry
 */
export interface ConfigurationHistory {
  /** History entry ID */
  id: string;
  /** Configuration key */
  key: string;
  /** Previous value */
  previousValue: any;
  /** New value */
  newValue: any;
  /** Environment */
  environment?: string;
  /** Update reason */
  reason?: string;
  /** User who made the update */
  updatedBy?: string;
  /** Update timestamp */
  updatedAt: Date;
  /** Version number */
  version: number;
}

/**
 * Configuration search filters
 */
export interface ConfigurationFilters {
  /** Environment filter */
  environment?: string;
  /** Type filter */
  type?: ConfigurationType;
  /** Sensitive filter */
  sensitive?: boolean;
  /** Search term */
  search?: string;
  /** Pagination offset */
  offset?: number;
  /** Pagination limit */
  limit?: number;
}

/**
 * Configuration response with pagination
 */
export interface ConfigurationResponse {
  /** Configuration entries */
  entries: ConfigurationEntry[];
  /** Total count */
  total: number;
  /** Current page offset */
  offset: number;
  /** Current page limit */
  limit: number;
  /** Has next page */
  hasNext: boolean;
  /** Has previous page */
  hasPrevious: boolean;
}
