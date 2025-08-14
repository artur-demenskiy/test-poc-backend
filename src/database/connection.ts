import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * PostgreSQL connection pool
 */
const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'nestjs_boilerplate',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Drizzle ORM instance with PostgreSQL driver
 */
export const db = drizzle(pool, { schema });

/**
 * Get the underlying pool for direct access if needed
 */
export const getPool = () => pool;

/**
 * Close the database connection pool
 */
export const closePool = async () => {
  await pool.end();
};
