# Configuration Guide

This document describes how to configure the NestJS application using environment variables.

## Environment Variables

The application uses the following environment variables:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | number | `3000` | Application port (1-65535) |
| `NODE_ENV` | string | `development` | Environment (`development`, `production`, `test`) |
| `LOG_LEVEL` | string | `info` | Log level (`error`, `warn`, `info`, `debug`, `verbose`) |

## Setup

### 1. Create Environment File

Create a `.env` file in the root directory:

```bash
# Application Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Add your custom environment variables below
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname
# REDIS_URL=redis://localhost:6379
# JWT_SECRET=your-secret-key
```

### 2. Environment File Priority

The application loads environment files in the following order:
1. `.env.local` (highest priority)
2. `.env`
3. System environment variables

### 3. Validation

All environment variables are validated using Zod schema:
- Invalid values will prevent the application from starting
- Missing variables will use default values
- Type conversion is automatic (e.g., PORT string → number)

## Usage in Code

### Injecting Configuration Service

```typescript
import { Injectable } from '@nestjs/common';
import { AppConfigService } from './config/config.service';

@Injectable()
export class MyService {
  constructor(private readonly config: AppConfigService) {}

  getPort(): number {
    return this.config.port;
  }

  isProduction(): boolean {
    return this.config.isProduction;
  }

  getLogLevel(): string {
    return this.config.logLevel;
  }
}
```

### Direct Access

```typescript
// Get specific value with type inference
const port = this.config.get('PORT');
const customValue = this.config.get('CUSTOM_VAR', 'default');

// Environment checks
if (this.config.isDevelopment) {
  // Development-specific logic
}
```

## Configuration Features

- **Type Safety**: Full TypeScript support with inferred types
- **Validation**: Runtime validation using Zod schemas
- **Defaults**: Sensible defaults for all variables
- **Caching**: Environment variables are cached for performance
- **Expansion**: Support for variable expansion (e.g., `${{ '{' }}VAR{{ '}' }}`)
- **Global**: Configuration is available application-wide

## Testing

Configuration is tested with comprehensive unit tests:

```bash
# Run all tests
pnpm test

# Run only configuration tests
pnpm test src/config/
```

## Production Considerations

- Set `NODE_ENV=production` for production deployments
- Use system environment variables instead of `.env` files in production
- Ensure all required variables are set before deployment
- Monitor configuration validation errors in logs 