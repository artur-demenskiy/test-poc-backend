import { pgTable, serial, varchar, timestamp, boolean, text } from 'drizzle-orm/pg-core';

/**
 * IP Whitelist entity for controlling access by IP addresses
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

export type IpWhitelist = typeof ipWhitelist.$inferSelect;
export type NewIpWhitelist = typeof ipWhitelist.$inferInsert;
