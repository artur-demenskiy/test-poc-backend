import { pgTable, serial, text, timestamp, varchar, boolean } from 'drizzle-orm/pg-core';

/**
 * Example table - can be removed or modified as needed
 * This is just a placeholder to demonstrate Drizzle ORM setup
 */
export const exampleTable = pgTable('examples', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * API Keys table for secure API access and authentication
 *
 * This table stores API keys with scope-based permissions:
 * - Each key has a unique 64-character hexadecimal value
 * - Scopes define what resources and actions the key can access
 * - Keys can be deactivated without deletion for audit purposes
 * - Expiration dates provide automatic access revocation
 * - Usage tracking enables monitoring and security analysis
 *
 * Security Features:
 * - Unique key constraints prevent duplicate keys
 * - Active/inactive status for immediate revocation
 * - Expiration-based automatic access control
 * - Last used tracking for security monitoring
 * - Audit trail with creation and update timestamps
 *
 * Scope Format:
 * - Stored as JSON string for flexibility
 * - Example: [{"resource": "users", "actions": ["read", "write"]}]
 * - Supports fine-grained permission control
 */
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(), // Unique identifier
  name: varchar('name', { length: 255 }).notNull(), // Human-readable name
  key: varchar('key', { length: 64 }).notNull().unique(), // 64-char hex API key
  scopes: text('scopes').notNull(), // JSON string of allowed scopes
  isActive: boolean('is_active').default(true).notNull(), // Active status flag
  expiresAt: timestamp('expires_at'), // Optional expiration date
  lastUsedAt: timestamp('last_used_at'), // Last usage timestamp
  createdAt: timestamp('created_at').defaultNow().notNull(), // Creation timestamp
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // Last update timestamp
});

/**
 * IP Whitelist table for network-level access control
 *
 * This table manages IP address access permissions:
 * - Individual IP addresses can be whitelisted
 * - CIDR blocks support network range permissions
 * - Expiration dates provide time-based access control
 * - Active/inactive status enables immediate revocation
 * - Description field for administrative purposes
 *
 * Security Features:
 * - IPv6 support with 45-character address storage
 * - CIDR block validation for network ranges
 * - Expiration-based automatic access revocation
 * - Active status for immediate control
 * - Audit trail with timestamps
 *
 * IP Address Support:
 * - IPv4: Standard 4-octet format (e.g., 192.168.1.1)
 * - IPv6: Full IPv6 format (e.g., 2001:db8::1)
 * - CIDR: Network ranges (e.g., 192.168.1.0/24)
 */
export const ipWhitelist = pgTable('ip_whitelist', {
  id: serial('id').primaryKey(), // Unique identifier
  name: varchar('name', { length: 255 }).notNull(), // Human-readable name
  ipAddress: varchar('ip_address', { length: 45 }).notNull(), // IPv6 support (max 45 chars)
  cidrBlock: varchar('cidr_block', { length: 18 }), // CIDR block (e.g., "192.168.1.0/24")
  description: text('description'), // Optional description
  isActive: boolean('is_active').default(true).notNull(), // Active status flag
  expiresAt: timestamp('expires_at'), // Optional expiration date
  createdAt: timestamp('created_at').defaultNow().notNull(), // Creation timestamp
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // Last update timestamp
});

/**
 * Export all tables for Drizzle Kit
 *
 * This object contains all table definitions for:
 * - Database migrations
 * - Schema introspection
 * - Type generation
 * - Development tools
 */
export const schema = {
  exampleTable, // Example/demo table
  apiKeys, // API key management table
  ipWhitelist, // IP address whitelist table
};
