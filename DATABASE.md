# Database Setup Guide

This document describes how to set up and use the database layer in the NestJS Boilerplate.

## 🗄️ Database Configuration

The project uses **Drizzle ORM** with **PostgreSQL** for database operations.

### Environment Variables

Add these variables to your `.env` file:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/nestjs_boilerplate
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_NAME=nestjs_boilerplate
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
```

## 🚀 Quick Start

### 1. Start PostgreSQL Database

```bash
# Start PostgreSQL with Docker Compose
docker-compose -f docker-compose.db.yml up -d

# Or start only PostgreSQL
docker-compose -f docker-compose.db.yml up postgres -d
```

### 2. Generate Migrations

```bash
# Generate migration files based on schema changes
pnpm db:generate
```

### 3. Run Migrations

```bash
# Apply migrations to the database
pnpm db:migrate
```

### 4. View Database (Optional)

```bash
# Access pgAdmin at http://localhost:8080
# Email: admin@example.com
# Password: admin

# Or use Drizzle Studio
pnpm db:studio
```

## 📚 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm db:generate` | Generate migration files |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:push` | Push schema changes directly |

## 🏗️ Project Structure

```
src/database/
├── connection.ts           # Database connection setup
├── database.module.ts      # NestJS database module
├── database.health.ts      # Health check indicator
├── migrate.ts              # Migration runner
├── schema.ts               # Database schema definition
└── migrations/             # Generated migration files
    ├── 0000_curly_corsair.sql
    └── meta/
        ├── 0000_snapshot.json
        └── _journal.json
```

## 🔧 Database Health Checks

The database health indicator is integrated with NestJS Terminus:

- **Liveness Probe**: `/health/healthz` - Basic application health
- **Readiness Probe**: `/health/readiness` - Application readiness (DB optional)

The database health check won't break readiness if the database is not configured.

## 🐳 Docker Setup

### PostgreSQL Container

- **Image**: `postgres:16-alpine`
- **Port**: `5433` (mapped from container's 5432)
- **Database**: `nestjs_boilerplate`
- **User**: `postgres`
- **Password**: `postgres`

### pgAdmin Container (Optional)

- **Image**: `dpage/pgadmin4:latest`
- **Port**: `8080`
- **Email**: `admin@example.com`
- **Password**: `admin`

## 📝 Schema Management

### Adding New Tables

1. Define your table in `src/database/schema.ts`
2. Generate migrations: `pnpm db:generate`
3. Apply migrations: `pnpm db:migrate`

### Example Schema

```typescript
import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

## 🔍 Troubleshooting

### Connection Issues

1. **Check PostgreSQL is running**:
   ```bash
   docker-compose -f docker-compose.db.yml ps
   ```

2. **Check environment variables**:
   ```bash
   cat .env | grep DATABASE
   ```

3. **Test connection manually**:
   ```bash
   psql -h localhost -U postgres -d nestjs_boilerplate -p 5433
   ```

### Migration Issues

1. **Reset database**:
   ```bash
   docker-compose -f docker-compose.db.yml down -v
   docker-compose -f docker-compose.db.yml up -d
   ```

2. **Check migration files**:
   ```bash
   ls -la src/database/migrations/
   ```

## 🚫 Important Notes

- **No tables are created by default** - This is intentional
- **Database is optional** - App works without DB configuration
- **Health checks are resilient** - Won't break if DB is down
- **Migrations are manual** - Run `pnpm db:migrate` after schema changes
- **Port 5433** - Used to avoid conflicts with local PostgreSQL

## 🔗 Useful Links

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [NestJS Terminus Health Checks](https://docs.nestjs.com/recipes/terminus) 