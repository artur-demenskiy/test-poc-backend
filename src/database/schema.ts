import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

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
 * Export all tables for Drizzle Kit
 */
export const schema = {
  exampleTable,
}; 