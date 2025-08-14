import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Migration runner for Drizzle ORM
 * This script can be run with: pnpm db:migrate
 */
async function main() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'nestjs_boilerplate',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  });

  const db = drizzle(pool);

  try {
    console.log('🚀 Starting database migration...');
    
    // Run migrations from the migrations folder
    await migrate(db, { migrationsFolder: './src/database/migrations' });
    
    console.log('✅ Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
} 