import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { db } from '../../database/connection';
import { apiKeys, type ApiKey } from './api-key.entity';
import { eq, and, isNull, gt, or } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export interface ApiKeyScope {
  resource: string;
  actions: string[];
}

export interface CreateApiKeyDto {
  name: string;
  scopes: ApiKeyScope[];
  expiresInDays?: number;
}

@Injectable()
export class ApiKeyService {
  /**
   * Generate a new API key
   */
  private generateApiKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Create a new API key
   */
  async createApiKey(dto: CreateApiKeyDto): Promise<Omit<ApiKey, 'key'>> {
    const key = this.generateApiKey();
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        name: dto.name,
        key: key,
        scopes: JSON.stringify(dto.scopes),
        expiresAt,
      })
      .returning({
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
   * Validate API key and return scopes
   */
  async validateApiKey(key: string): Promise<ApiKeyScope[]> {
    const apiKey = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.key, key),
          eq(apiKeys.isActive, true),
          or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, new Date()))
        )
      )
      .limit(1);

    if (!apiKey.length) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    // Update last used timestamp
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, apiKey[0].id));

    try {
      return JSON.parse(apiKey[0].scopes);
    } catch {
      throw new BadRequestException('Invalid API key scopes format');
    }
  }

  /**
   * Check if API key has required scope
   */
  async hasScope(key: string, resource: string, action: string): Promise<boolean> {
    try {
      const scopes = await this.validateApiKey(key);
      return scopes.some(scope => scope.resource === resource && scope.actions.includes(action));
    } catch {
      return false;
    }
  }

  /**
   * Deactivate API key
   */
  async deactivateApiKey(id: number): Promise<void> {
    await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, id));
  }

  /**
   * Get all API keys (without actual key values)
   */
  async getAllApiKeys(): Promise<Omit<ApiKey, 'key'>[]> {
    return db
      .select({
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
