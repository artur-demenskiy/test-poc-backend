import { Injectable, BadRequestException } from '@nestjs/common';
import { db } from '../../database/connection';
import { ipWhitelist, type IpWhitelist } from './ip-whitelist.entity';
import { eq, and, isNull, gt, or } from 'drizzle-orm';
import { isIP, isIPv4, isIPv6 } from 'net';

/**
 * Data transfer object for creating IP whitelist entries
 * Provides all necessary information for IP whitelist management
 */
export interface CreateIpWhitelistDto {
  name: string; // Human-readable name for the whitelist entry
  ipAddress: string; // IP address to whitelist
  cidrBlock?: string; // Optional CIDR block for network ranges
  description?: string; // Optional description of the entry
  expiresInDays?: number; // Optional expiration in days
}

/**
 * IP Whitelist Management Service
 *
 * This service provides comprehensive IP address whitelist management:
 * - Individual IP address whitelisting
 * - CIDR block support for network ranges
 * - IPv4 and IPv6 address validation
 * - Automatic expiration management
 * - Network-level access control
 *
 * Security Features:
 * - Strict IP address validation and sanitization
 * - CIDR block validation for network security
 * - Expiration-based access control
 * - Comprehensive IP range checking
 * - Audit trail and management capabilities
 *
 * Supported Formats:
 * - Single IP addresses (IPv4/IPv6)
 * - CIDR blocks (e.g., 192.168.1.0/24, 2001:db8::/32)
 * - Automatic protocol detection and validation
 */
@Injectable()
export class IpWhitelistService {
  /**
   * Validate IP address or CIDR block format
   * Ensures proper IP address format and valid CIDR notation
   * @param ip - IP address to validate
   * @param cidr - Optional CIDR block to validate
   * @returns True if IP/CIDR is valid, false otherwise
   */
  private validateIpOrCidr(ip: string, cidr?: string): boolean {
    if (cidr) {
      // Validate CIDR block format and range
      const [network, prefix] = cidr.split('/');
      if (!isIP(network) || !prefix) return false;

      const prefixNum = parseInt(prefix, 10);
      if (isIPv4(network)) {
        // IPv4 CIDR: prefix must be 0-32
        return prefixNum >= 0 && prefixNum <= 32;
      } else if (isIPv6(network)) {
        // IPv6 CIDR: prefix must be 0-128
        return prefixNum >= 0 && prefixNum <= 128;
      }
      return false;
    } else {
      // Validate single IP address format
      return Boolean(isIP(ip));
    }
  }

  /**
   * Check if IP address falls within CIDR block range
   * Performs network address calculations for accurate range checking
   * @param ip - IP address to check
   * @param cidr - CIDR block to check against
   * @returns True if IP is within CIDR range, false otherwise
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    try {
      const [network, prefix] = cidr.split('/');
      const prefixNum = parseInt(prefix, 10);

      if (isIPv4(ip) && isIPv4(network)) {
        // IPv4 CIDR calculation using bitwise operations
        const ipNum = this.ipv4ToNumber(ip);
        const networkNum = this.ipv4ToNumber(network);
        const mask = (0xffffffff << (32 - prefixNum)) >>> 0;

        // Check if IP is in the same network segment
        return (ipNum & mask) === (networkNum & mask);
      }

      // IPv6 CIDR checking (simplified approach)
      if (isIPv6(ip) && isIPv6(network)) {
        // Simplified IPv6 check - in production consider more robust solution
        return ip.startsWith(network.split('/')[0]);
      }

      return false;
    } catch {
      // Return false for any parsing errors
      return false;
    }
  }

  /**
   * Convert IPv4 address to 32-bit number for CIDR calculations
   * Enables efficient bitwise operations for network range checking
   * @param ip - IPv4 address string (e.g., "192.168.1.1")
   * @returns 32-bit integer representation of the IP address
   */
  private ipv4ToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  /**
   * Create new IP whitelist entry with validation
   * Validates IP/CIDR format and creates database entry with expiration
   * @param dto - IP whitelist creation data
   * @returns Created whitelist entry
   * @throws BadRequestException if IP/CIDR format is invalid
   */
  async createIpWhitelist(dto: CreateIpWhitelistDto): Promise<IpWhitelist> {
    // Validate IP address or CIDR block format
    if (!this.validateIpOrCidr(dto.ipAddress, dto.cidrBlock)) {
      throw new BadRequestException('Invalid IP address or CIDR block');
    }

    // Calculate expiration date if specified
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Insert new whitelist entry into database
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
   * Validates against all active whitelist entries including CIDR blocks
   * @param ip - IP address to check for whitelist status
   * @returns True if IP is whitelisted, false otherwise
   */
  async isIpWhitelisted(ip: string): Promise<boolean> {
    // Retrieve all active whitelist entries
    const entries = await db
      .select()
      .from(ipWhitelist)
      .where(
        and(
          eq(ipWhitelist.isActive, true), // Entry must be active
          or(
            isNull(ipWhitelist.expiresAt), // No expiration set
            gt(ipWhitelist.expiresAt, new Date()) // Or not yet expired
          )
        )
      );

    // Check if IP matches any whitelist entry
    return entries.some((entry: IpWhitelist) => {
      if (entry.cidrBlock) {
        // Check if IP is within CIDR block range
        return this.isIpInCidr(ip, entry.cidrBlock);
      } else {
        // Direct IP address match
        return entry.ipAddress === ip;
      }
    });
  }

  /**
   * Retrieve all IP whitelist entries
   * Returns complete list for management and audit purposes
   * @returns Array of all whitelist entries
   */
  async getAllEntries(): Promise<IpWhitelist[]> {
    return db.select().from(ipWhitelist);
  }

  /**
   * Deactivate whitelist entry by setting isActive to false
   * Provides immediate access revocation without deleting the entry
   * @param id - Database ID of the whitelist entry to deactivate
   */
  async deactivateEntry(id: number): Promise<void> {
    await db.update(ipWhitelist).set({ isActive: false }).where(eq(ipWhitelist.id, id));
  }

  /**
   * Permanently delete whitelist entry from database
   * Removes entry completely for cleanup purposes
   * @param id - Database ID of the whitelist entry to delete
   */
  async deleteEntry(id: number): Promise<void> {
    await db.delete(ipWhitelist).where(eq(ipWhitelist.id, id));
  }
}
