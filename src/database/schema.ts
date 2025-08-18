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
 * API Keys table for secure API access
 */
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  key: varchar('key', { length: 64 }).notNull().unique(),
  scopes: text('scopes').notNull(), // JSON string of allowed scopes
  isActive: boolean('is_active').default(true).notNull(),
  expiresAt: timestamp('expires_at'),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * IP Whitelist table for controlling access by IP addresses
 */
export const ipWhitelist = pgTable('ip_whitelist', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(), // IPv6 support
  cidrBlock: varchar('cidr_block', { length: 18 }), // e.g., "192.168.1.0/24"
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Export all tables for Drizzle Kit
 */
export const schema = {
  exampleTable,
  apiKeys,
  ipWhitelist,
};
