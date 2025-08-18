import { Injectable, BadRequestException } from '@nestjs/common';
import { db } from '../../database/connection';
import { ipWhitelist, type IpWhitelist } from './ip-whitelist.entity';
import { eq, and, isNull, gt, or } from 'drizzle-orm';
import { isIP, isIPv4, isIPv6 } from 'net';

export interface CreateIpWhitelistDto {
  name: string;
  ipAddress: string;
  cidrBlock?: string;
  description?: string;
  expiresInDays?: number;
}

@Injectable()
export class IpWhitelistService {
  /**
   * Validate IP address or CIDR block
   */
  private validateIpOrCidr(ip: string, cidr?: string): boolean {
    if (cidr) {
      // Validate CIDR block
      const [network, prefix] = cidr.split('/');
      if (!isIP(network) || !prefix) return false;

      const prefixNum = parseInt(prefix, 10);
      if (isIPv4(network)) {
        return prefixNum >= 0 && prefixNum <= 32;
      } else if (isIPv6(network)) {
        return prefixNum >= 0 && prefixNum <= 128;
      }
      return false;
    } else {
      // Validate single IP address
      return Boolean(isIP(ip));
    }
  }

  /**
   * Check if IP is in CIDR block
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    try {
      const [network, prefix] = cidr.split('/');
      const prefixNum = parseInt(prefix, 10);

      if (isIPv4(ip) && isIPv4(network)) {
        const ipNum = this.ipv4ToNumber(ip);
        const networkNum = this.ipv4ToNumber(network);
        const mask = (0xffffffff << (32 - prefixNum)) >>> 0;

        return (ipNum & mask) === (networkNum & mask);
      }

      // For IPv6, we'll use a simpler approach
      if (isIPv6(ip) && isIPv6(network)) {
        // This is a simplified check - in production you might want a more robust solution
        return ip.startsWith(network.split('/')[0]);
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Convert IPv4 to number for CIDR calculations
   */
  private ipv4ToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  /**
   * Create new IP whitelist entry
   */
  async createIpWhitelist(dto: CreateIpWhitelistDto): Promise<IpWhitelist> {
    if (!this.validateIpOrCidr(dto.ipAddress, dto.cidrBlock)) {
      throw new BadRequestException('Invalid IP address or CIDR block');
    }

    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const [entry] = await db
      .insert(ipWhitelist)
      .values({
        name: dto.name,
        ipAddress: dto.ipAddress,
        cidrBlock: dto.cidrBlock,
        description: dto.description,
        expiresAt,
      })
      .returning();

    return entry;
  }

  /**
   * Check if IP address is whitelisted
   */
  async isIpWhitelisted(ip: string): Promise<boolean> {
    const entries = await db
      .select()
      .from(ipWhitelist)
      .where(
        and(
          eq(ipWhitelist.isActive, true),
          or(isNull(ipWhitelist.expiresAt), gt(ipWhitelist.expiresAt, new Date()))
        )
      );

    return entries.some((entry: IpWhitelist) => {
      if (entry.cidrBlock) {
        return this.isIpInCidr(ip, entry.cidrBlock);
      } else {
        return entry.ipAddress === ip;
      }
    });
  }

  /**
   * Get all whitelist entries
   */
  async getAllEntries(): Promise<IpWhitelist[]> {
    return db.select().from(ipWhitelist);
  }

  /**
   * Deactivate whitelist entry
   */
  async deactivateEntry(id: number): Promise<void> {
    await db.update(ipWhitelist).set({ isActive: false }).where(eq(ipWhitelist.id, id));
  }

  /**
   * Delete whitelist entry
   */
  async deleteEntry(id: number): Promise<void> {
    await db.delete(ipWhitelist).where(eq(ipWhitelist.id, id));
  }
}
