import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { db } from '../../database/connection';
import { apiKeys, type ApiKey } from './api-key.entity';
import { eq, and, isNull, gt, or } from 'drizzle-orm';
import { randomBytes } from 'crypto';

/**
 * API key scope definition for fine-grained access control
 * Defines which resources and actions an API key can access
 */
export interface ApiKeyScope {
  resource: string; // Resource identifier (e.g., 'users', 'posts')
  actions: string[]; // Allowed actions (e.g., ['read', 'write', 'delete'])
}

/**
 * Data transfer object for creating new API keys
 * Provides all necessary information for API key generation
 */
export interface CreateApiKeyDto {
  name: string; // Human-readable name for the API key
  scopes: ApiKeyScope[]; // Access permissions for the key
  expiresInDays?: number; // Optional expiration in days
}

/**
 * API Key Management Service
 *
 * This service provides comprehensive API key management capabilities:
 * - Secure API key generation using cryptographically strong random bytes
 * - Scope-based access control with resource and action permissions
 * - Automatic expiration management and validation
 * - Usage tracking and monitoring
 * - Secure key storage and retrieval
 *
 * Security Features:
 * - 32-byte random key generation (256-bit entropy)
 * - Scope-based access control for fine-grained permissions
 * - Automatic expiration and validation
 * - Usage tracking for audit purposes
 * - Secure key storage without plaintext exposure
 */
@Injectable()
export class ApiKeyService {
  /**
   * Generate cryptographically secure API key
   * Creates a 32-byte random hex string for maximum security
   * @returns 64-character hexadecimal API key
   */
  private generateApiKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Create a new API key with specified permissions and expiration
   * Generates secure key, stores in database, and returns key metadata
   * @param dto - API key creation data including scopes and expiration
   * @returns API key metadata without the actual key value
   */
  async createApiKey(dto: CreateApiKeyDto): Promise<Omit<ApiKey, 'key'>> {
    // Generate cryptographically secure API key
    const key = this.generateApiKey();

    // Calculate expiration date if specified
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Insert new API key into database
    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        name: dto.name,
        key: key, // Store the generated key
        scopes: JSON.stringify(dto.scopes), // Serialize scopes as JSON
        expiresAt, // Set expiration if provided
      })
      .returning({
        // Return all fields except the actual key for security
        id: apiKeys.id,
        name: apiKeys.name,
        scopes: apiKeys.scopes,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
        updatedAt: apiKeys.updatedAt,
      });

    return apiKey;
  }

  /**
   * Validate API key and return associated scopes
   * Checks key validity, expiration, and returns permission scopes
   * @param key - API key to validate
   * @returns Array of permission scopes for the valid key
   * @throws UnauthorizedException if key is invalid or expired
   */
  async validateApiKey(key: string): Promise<ApiKeyScope[]> {
    // Query database for valid API key
    const apiKey = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.key, key), // Key must match
          eq(apiKeys.isActive, true), // Key must be active
          or(
            isNull(apiKeys.expiresAt), // No expiration set
            gt(apiKeys.expiresAt, new Date()) // Or not yet expired
          )
        )
      )
      .limit(1);

    if (!apiKey.length) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    // Update last used timestamp for audit trail
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, apiKey[0].id));

    // Parse and return scopes from JSON storage
    try {
      return JSON.parse(apiKey[0].scopes);
    } catch {
      throw new BadRequestException('Invalid API key scopes format');
    }
  }

  /**
   * Check if API key has required permission scope
   * Validates key and checks if it has access to specific resource and action
   * @param key - API key to check
   * @param resource - Resource identifier to check access for
   * @param action - Action to check permission for
   * @returns True if key has required permission, false otherwise
   */
  async hasScope(key: string, resource: string, action: string): Promise<boolean> {
    try {
      // Validate API key and get scopes
      const scopes = await this.validateApiKey(key);

      // Check if any scope grants access to the requested resource and action
      return scopes.some(scope => scope.resource === resource && scope.actions.includes(action));
    } catch {
      // Return false for any validation errors
      return false;
    }
  }

  /**
   * Deactivate API key by setting isActive to false
   * Provides immediate access revocation without deleting the key
   * @param id - Database ID of the API key to deactivate
   */
  async deactivateApiKey(id: number): Promise<void> {
    await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, id));
  }

  /**
   * Retrieve all API keys without exposing actual key values
   * Returns key metadata for management and audit purposes
   * @returns Array of API key metadata (excluding actual keys)
   */
  async getAllApiKeys(): Promise<Omit<ApiKey, 'key'>[]> {
    return db
      .select({
        // Select all fields except the actual key for security
        id: apiKeys.id,
        name: apiKeys.name,
        scopes: apiKeys.scopes,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
        updatedAt: apiKeys.updatedAt,
      })
      .from(apiKeys);
  }
}
