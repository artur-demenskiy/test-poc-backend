/**
 * Secret entry interface
 */
export interface SecretEntry {
  /** Unique key for the secret */
  key: string;
  /** Encrypted secret value */
  encryptedValue: string;
  /** Secret type */
  type: SecretType;
  /** Description of the secret */
  description?: string;
  /** Environment where this secret applies */
  environment?: string;
  /** Secret tags for categorization */
  tags?: string[];
  /** Expiration date (optional) */
  expiresAt?: Date;
  /** Rotation policy */
  rotationPolicy?: RotationPolicy;
  /** Access control list */
  accessControl?: AccessControl;
  /** Metadata */
  metadata?: Record<string, any>;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Last rotation timestamp */
  lastRotatedAt?: Date;
  /** Version number */
  version: number;
}

/**
 * Secret types
 */
export enum SecretType {
  API_KEY = 'api_key',
  PASSWORD = 'password',
  TOKEN = 'token',
  CERTIFICATE = 'certificate',
  PRIVATE_KEY = 'private_key',
  DATABASE_URL = 'database_url',
  ENCRYPTION_KEY = 'encryption_key',
  WEBHOOK_SECRET = 'webhook_secret',
  OAUTH_SECRET = 'oauth_secret',
  CUSTOM = 'custom',
}

/**
 * Rotation policy configuration
 */
export interface RotationPolicy {
  /** Whether rotation is enabled */
  enabled: boolean;
  /** Rotation interval in days */
  intervalDays?: number;
  /** Auto-rotation enabled */
  autoRotate?: boolean;
  /** Notification before expiration */
  notifyBeforeExpiration?: number; // days
  /** Rotation method */
  method?: 'manual' | 'automatic' | 'scheduled';
}

/**
 * Access control configuration
 */
export interface AccessControl {
  /** Allowed users */
  allowedUsers?: string[];
  /** Allowed roles */
  allowedRoles?: string[];
  /** Allowed services */
  allowedServices?: string[];
  /** IP restrictions */
  ipRestrictions?: string[];
  /** Time-based access restrictions */
  timeRestrictions?: TimeRestriction[];
}

/**
 * Time-based access restriction
 */
export interface TimeRestriction {
  /** Day of week (0-6, Sunday = 0) */
  dayOfWeek: number;
  /** Start time (HH:MM format) */
  startTime: string;
  /** End time (HH:MM format) */
  endTime: string;
  /** Timezone */
  timezone?: string;
}

/**
 * Secret access request
 */
export interface SecretAccessRequest {
  /** Secret key */
  key: string;
  /** Environment */
  environment?: string;
  /** Requesting user */
  requestedBy?: string;
  /** Requesting service */
  requestedByService?: string;
  /** IP address */
  ipAddress?: string;
  /** Access reason */
  reason?: string;
}

/**
 * Secret access log entry
 */
export interface SecretAccessLog {
  /** Log entry ID */
  id: string;
  /** Secret key */
  key: string;
  /** Environment */
  environment?: string;
  /** Accessing user */
  accessedBy?: string;
  /** Accessing service */
  accessedByService?: string;
  /** IP address */
  ipAddress?: string;
  /** Access reason */
  reason?: string;
  /** Access timestamp */
  accessedAt: Date;
  /** Access result */
  result: 'success' | 'denied' | 'error';
  /** Error message if access failed */
  errorMessage?: string;
}

/**
 * Secret rotation request
 */
export interface SecretRotationRequest {
  /** Secret key */
  key: string;
  /** Environment */
  environment?: string;
  /** New secret value */
  newValue: string;
  /** Rotation reason */
  reason?: string;
  /** Rotated by */
  rotatedBy?: string;
  /** Force rotation (ignore expiration) */
  force?: boolean;
}

/**
 * Secret search filters
 */
export interface SecretFilters {
  /** Environment filter */
  environment?: string;
  /** Type filter */
  type?: SecretType;
  /** Tag filter */
  tags?: string[];
  /** Expired filter */
  expired?: boolean;
  /** Search term */
  search?: string;
  /** Pagination offset */
  offset?: number;
  /** Pagination limit */
  limit?: number;
}

/**
 * Secret response with pagination
 */
export interface SecretResponse {
  /** Secret entries (without encrypted values) */
  secrets: Omit<SecretEntry, 'encryptedValue'>[];
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
