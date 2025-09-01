import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import {
  SecretEntry,
  SecretType,
  SecretAccessRequest,
  SecretAccessLog,
  SecretRotationRequest,
  SecretFilters,
  SecretResponse,
  RotationPolicy,
  AccessControl,
} from './interfaces/secret.interface';

/**
 * Secrets service for managing application secrets with encryption
 */
@Injectable()
export class SecretsService implements OnModuleInit {
  private readonly logger = new Logger(SecretsService.name);
  private secrets: Map<string, SecretEntry> = new Map();
  private accessLogs: SecretAccessLog[] = [];
  private encryptionKey: string;
  private lastUpdated: Date = new Date();

  /**
   * Initialize the service and load secrets
   */
  async onModuleInit() {
    // In production, this should come from a secure key management system
    this.encryptionKey = process.env.SECRETS_ENCRYPTION_KEY || this.generateEncryptionKey();
    await this.loadSecrets();
    this.logger.log('Secrets service initialized');
  }

  /**
   * Load secrets from external source
   */
  private async loadSecrets(): Promise<void> {
    try {
      // In a real implementation, this would load from a secure database or external service
      const defaultSecrets: Omit<SecretEntry, 'encryptedValue'>[] = [
        {
          key: 'database.password',
          type: SecretType.PASSWORD,
          description: 'Database password',
          environment: 'all',
          tags: ['database', 'infrastructure'],
          rotationPolicy: {
            enabled: true,
            intervalDays: 90,
            autoRotate: false,
            notifyBeforeExpiration: 7,
            method: 'manual',
          },
          accessControl: {
            allowedServices: ['database-service', 'migration-service'],
          },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
        {
          key: 'api.jwt.secret',
          type: SecretType.ENCRYPTION_KEY,
          description: 'JWT signing secret',
          environment: 'all',
          tags: ['api', 'authentication'],
          rotationPolicy: {
            enabled: true,
            intervalDays: 180,
            autoRotate: false,
            notifyBeforeExpiration: 14,
            method: 'manual',
          },
          accessControl: {
            allowedServices: ['auth-service', 'api-gateway'],
          },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
        {
          key: 'external.api.key',
          type: SecretType.API_KEY,
          description: 'External API key',
          environment: 'production',
          tags: ['external', 'api'],
          rotationPolicy: {
            enabled: false,
          },
          accessControl: {
            allowedServices: ['external-service'],
          },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
      ];

      this.secrets.clear();
      for (const secret of defaultSecrets) {
        // Encrypt a placeholder value for demo purposes
        const encryptedValue = this.encrypt('PLACEHOLDER_VALUE');
        const secretEntry: SecretEntry = {
          ...secret,
          encryptedValue,
        };
        this.secrets.set(secret.key, secretEntry);
      }

      this.lastUpdated = new Date();
      this.logger.log(`Loaded ${this.secrets.size} secrets`);
    } catch (error) {
      this.logger.error('Failed to load secrets', error);
    }
  }

  /**
   * Get secret value by key
   */
  async getSecret(request: SecretAccessRequest): Promise<{ value: string } | { error: string }> {
    try {
      const secret = this.getSecretEntry(request.key, request.environment);

      if (!secret) {
        this.logAccess(request, 'denied', 'Secret not found');
        return { error: 'Secret not found' };
      }

      // Check access control
      const accessResult = this.checkAccess(secret, request);
      if (!accessResult.allowed) {
        this.logAccess(request, 'denied', accessResult.reason);
        return { error: accessResult.reason };
      }

      // Check expiration
      if (secret.expiresAt && secret.expiresAt < new Date()) {
        this.logAccess(request, 'denied', 'Secret has expired');
        return { error: 'Secret has expired' };
      }

      // Decrypt and return value
      const decryptedValue = this.decrypt(secret.encryptedValue);
      this.logAccess(request, 'success');

      return { value: decryptedValue };
    } catch (error) {
      this.logger.error(`Failed to get secret ${request.key}`, error);
      this.logAccess(request, 'error', (error as Error).message);
      return { error: 'Failed to retrieve secret' };
    }
  }

  /**
   * Get secret entry by key
   */
  getSecretEntry(key: string, environment?: string): SecretEntry | null {
    // Try environment-specific secret first
    if (environment) {
      const envKey = `${key}:${environment}`;
      const envSecret = this.secrets.get(envKey);
      if (envSecret) {
        return envSecret;
      }
    }

    // Fall back to global secret
    return this.secrets.get(key) || null;
  }

  /**
   * Get all secrets with optional filtering (without encrypted values)
   */
  getAllSecrets(filters: SecretFilters = {}): SecretResponse {
    let secrets = Array.from(this.secrets.values());

    // Apply filters
    if (filters.environment) {
      secrets = secrets.filter(
        secret => secret.environment === filters.environment || secret.environment === 'all'
      );
    }

    if (filters.type) {
      secrets = secrets.filter(secret => secret.type === filters.type);
    }

    if (filters.tags && filters.tags.length > 0) {
      secrets = secrets.filter(
        secret => secret.tags && filters.tags?.some(tag => secret.tags?.includes(tag))
      );
    }

    if (filters.expired !== undefined) {
      const now = new Date();
      secrets = secrets.filter(secret => {
        if (!secret.expiresAt) return !filters.expired;
        return filters.expired ? secret.expiresAt < now : secret.expiresAt >= now;
      });
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      secrets = secrets.filter(
        secret =>
          secret.key.toLowerCase().includes(searchTerm) ||
          secret.description?.toLowerCase().includes(searchTerm)
      );
    }

    // Remove encrypted values for security
    const publicSecrets = secrets.map(secret => {
      const { encryptedValue: _encryptedValue, ...publicSecret } = secret;
      return publicSecret;
    });

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    const total = publicSecrets.length;
    const paginatedSecrets = publicSecrets.slice(offset, offset + limit);

    return {
      secrets: paginatedSecrets,
      total,
      offset,
      limit,
      hasNext: offset + limit < total,
      hasPrevious: offset > 0,
    };
  }

  /**
   * Create new secret
   */
  async createSecret(
    key: string,
    value: string,
    type: SecretType,
    options: {
      description?: string;
      environment?: string;
      tags?: string[];
      expiresAt?: Date;
      rotationPolicy?: RotationPolicy;
      accessControl?: AccessControl;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<boolean> {
    try {
      const secretKey = options.environment ? `${key}:${options.environment}` : key;

      if (this.secrets.has(secretKey)) {
        return false;
      }

      const encryptedValue = this.encrypt(value);
      const secret: SecretEntry = {
        key: secretKey,
        encryptedValue,
        type,
        description: options.description,
        environment: options.environment || 'all',
        tags: options.tags || [],
        expiresAt: options.expiresAt,
        rotationPolicy: options.rotationPolicy || { enabled: false },
        accessControl: options.accessControl,
        metadata: options.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      this.secrets.set(secretKey, secret);
      this.logger.log(`Secret created: ${secretKey}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to create secret ${key}`, error);
      return false;
    }
  }

  /**
   * Update secret value
   */
  async updateSecret(
    key: string,
    newValue: string,
    environment?: string,
    _updatedBy?: string
  ): Promise<boolean> {
    try {
      const secretKey = environment ? `${key}:${environment}` : key;
      const existingSecret = this.secrets.get(secretKey);

      if (!existingSecret) {
        return false;
      }

      const encryptedValue = this.encrypt(newValue);
      const updatedSecret: SecretEntry = {
        ...existingSecret,
        encryptedValue,
        updatedAt: new Date(),
        version: existingSecret.version + 1,
      };

      this.secrets.set(secretKey, updatedSecret);
      this.logger.log(`Secret updated: ${secretKey}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update secret ${key}`, error);
      return false;
    }
  }

  /**
   * Rotate secret
   */
  async rotateSecret(request: SecretRotationRequest): Promise<boolean> {
    try {
      const secretKey = request.environment ? `${request.key}:${request.environment}` : request.key;
      const existingSecret = this.secrets.get(secretKey);

      if (!existingSecret) {
        return false;
      }

      // Check if rotation is needed
      if (!request.force && existingSecret.rotationPolicy?.enabled) {
        const lastRotated = existingSecret.lastRotatedAt || existingSecret.createdAt;
        const rotationInterval = existingSecret.rotationPolicy.intervalDays || 90;
        const nextRotation = new Date(
          lastRotated.getTime() + rotationInterval * 24 * 60 * 60 * 1000
        );

        if (new Date() < nextRotation) {
          this.logger.warn(`Secret ${secretKey} is not due for rotation yet`);
          return false;
        }
      }

      const encryptedValue = this.encrypt(request.newValue);
      const rotatedSecret: SecretEntry = {
        ...existingSecret,
        encryptedValue,
        lastRotatedAt: new Date(),
        updatedAt: new Date(),
        version: existingSecret.version + 1,
      };

      this.secrets.set(secretKey, rotatedSecret);
      this.logger.log(`Secret rotated: ${secretKey}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to rotate secret ${request.key}`, error);
      return false;
    }
  }

  /**
   * Delete secret
   */
  async deleteSecret(key: string, environment?: string): Promise<boolean> {
    try {
      const secretKey = environment ? `${key}:${environment}` : key;
      const removed = this.secrets.delete(secretKey);

      if (removed) {
        this.logger.log(`Secret deleted: ${secretKey}`);
      }

      return removed;
    } catch (error) {
      this.logger.error(`Failed to delete secret ${key}`, error);
      return false;
    }
  }

  /**
   * Get secret access logs
   */
  getAccessLogs(key?: string, limit: number = 100): SecretAccessLog[] {
    let logs = this.accessLogs;

    if (key) {
      logs = logs.filter(log => log.key === key);
    }

    return logs.sort((a, b) => b.accessedAt.getTime() - a.accessedAt.getTime()).slice(0, limit);
  }

  /**
   * Check access control for secret
   */
  private checkAccess(
    secret: SecretEntry,
    request: SecretAccessRequest
  ): { allowed: boolean; reason?: string } {
    if (!secret.accessControl) {
      return { allowed: true };
    }

    const { accessControl } = secret;

    // Check service access
    if (accessControl.allowedServices && request.requestedByService) {
      if (!accessControl.allowedServices.includes(request.requestedByService)) {
        return { allowed: false, reason: 'Service not authorized' };
      }
    }

    // Check user access
    if (accessControl.allowedUsers && request.requestedBy) {
      if (!accessControl.allowedUsers.includes(request.requestedBy)) {
        return { allowed: false, reason: 'User not authorized' };
      }
    }

    // Check IP restrictions
    if (accessControl.ipRestrictions && request.ipAddress) {
      if (!accessControl.ipRestrictions.includes(request.ipAddress)) {
        return { allowed: false, reason: 'IP address not authorized' };
      }
    }

    // Check time restrictions
    if (accessControl.timeRestrictions && accessControl.timeRestrictions.length > 0) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const time = now.toTimeString().slice(0, 5); // HH:MM format

      const isAllowedTime = accessControl.timeRestrictions.some(restriction => {
        if (restriction.dayOfWeek !== dayOfWeek) return false;
        return time >= restriction.startTime && time <= restriction.endTime;
      });

      if (!isAllowedTime) {
        return { allowed: false, reason: 'Access not allowed at this time' };
      }
    }

    return { allowed: true };
  }

  /**
   * Log secret access
   */
  private logAccess(
    request: SecretAccessRequest,
    result: 'success' | 'denied' | 'error',
    errorMessage?: string
  ): void {
    const log: SecretAccessLog = {
      id: this.generateId(),
      key: request.key,
      environment: request.environment,
      accessedBy: request.requestedBy,
      accessedByService: request.requestedByService,
      ipAddress: request.ipAddress,
      reason: request.reason,
      accessedAt: new Date(),
      result,
      errorMessage,
    };

    this.accessLogs.push(log);

    // Keep only last 10000 entries to prevent memory issues
    if (this.accessLogs.length > 10000) {
      this.accessLogs = this.accessLogs.slice(-10000);
    }
  }

  /**
   * Encrypt value
   */
  private encrypt(value: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt value
   */
  private decrypt(encryptedValue: string): string {
    const parts = encryptedValue.split(':');
    const encrypted = parts[1];
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Generate encryption key
   */
  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Check for secrets that need rotation
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkRotationNeeded(): Promise<void> {
    try {
      const now = new Date();
      const secretsNeedingRotation: string[] = [];

      for (const [key, secret] of this.secrets.entries()) {
        if (secret.rotationPolicy?.enabled && secret.rotationPolicy.intervalDays) {
          const lastRotated = secret.lastRotatedAt || secret.createdAt;
          const rotationInterval = secret.rotationPolicy.intervalDays;
          const nextRotation = new Date(
            lastRotated.getTime() + rotationInterval * 24 * 60 * 60 * 1000
          );

          if (now >= nextRotation) {
            secretsNeedingRotation.push(key);
          }
        }
      }

      if (secretsNeedingRotation.length > 0) {
        this.logger.warn(`Secrets needing rotation: ${secretsNeedingRotation.join(', ')}`);
      }
    } catch (error) {
      this.logger.error('Failed to check rotation needed', error);
    }
  }

  /**
   * Refresh secrets from external source
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshSecrets(): Promise<void> {
    try {
      await this.loadSecrets();
      this.logger.log('Secrets refreshed');
    } catch (error) {
      this.logger.error('Failed to refresh secrets', error);
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalSecrets: number;
    environments: string[];
    types: SecretType[];
    lastUpdated: Date;
  } {
    const totalSecrets = this.secrets.size;
    const environments = Array.from(
      new Set(
        Array.from(this.secrets.values())
          .map(secret => secret.environment)
          .filter(env => env !== 'all')
      )
    );
    const types = Array.from(new Set(Array.from(this.secrets.values()).map(secret => secret.type)));

    return {
      totalSecrets,
      environments,
      types,
      lastUpdated: this.lastUpdated,
    };
  }
}
