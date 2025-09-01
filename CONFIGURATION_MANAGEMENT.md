# Configuration Management System

This document describes the comprehensive configuration management system implemented in the NestJS boilerplate, including feature flags, dynamic configuration, and secret management.

## 🚀 Features

### 1. Feature Flags System
- **Dynamic feature toggles** for enabling/disabling features without code deployment
- **User targeting** with custom rules and attributes
- **Rollout percentage** for gradual feature rollouts
- **Environment-specific** overrides
- **Real-time evaluation** with context-aware decisions
- **Guard integration** for protecting routes based on feature flags

### 2. Dynamic Configuration Management
- **Runtime configuration updates** without application restart
- **Environment-specific** configurations
- **Configuration validation** with custom rules
- **Version history** and audit trail
- **Bulk operations** for managing multiple configurations
- **Type-safe** configuration access

### 3. Secret Management
- **Encrypted storage** of sensitive data
- **Access control** with user/service-based permissions
- **Rotation policies** for automatic secret rotation
- **Expiration management** with notifications
- **Audit logging** for all secret access
- **IP and time-based** access restrictions

## 📁 Project Structure

```
src/
├── feature-flags/
│   ├── interfaces/
│   │   └── feature-flag.interface.ts
│   ├── decorators/
│   │   └── feature-flag.decorator.ts
│   ├── guards/
│   │   └── feature-flag.guard.ts
│   ├── feature-flags.service.ts
│   ├── feature-flags.controller.ts
│   └── feature-flags.module.ts
├── configuration/
│   ├── interfaces/
│   │   └── configuration.interface.ts
│   ├── configuration.service.ts
│   ├── configuration.controller.ts
│   └── configuration.module.ts
└── secrets/
    ├── interfaces/
    │   └── secret.interface.ts
    ├── secrets.service.ts
    ├── secrets.controller.ts
    └── secrets.module.ts
```

## 🔧 API Endpoints

### Feature Flags

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/feature-flags` | Get all feature flags |
| GET | `/feature-flags/:key` | Get feature flag by key |
| POST | `/feature-flags/:key/evaluate` | Evaluate feature flag |
| GET | `/feature-flags/:key/enabled` | Check if feature flag is enabled |
| GET | `/feature-flags/:key/value` | Get feature flag value |
| POST | `/feature-flags` | Create new feature flag |
| PUT | `/feature-flags/:key` | Update feature flag |
| DELETE | `/feature-flags/:key` | Delete feature flag |
| GET | `/feature-flags/stats/overview` | Get feature flags statistics |
| POST | `/feature-flags/refresh` | Refresh feature flags |

### Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/configuration` | Get all configurations |
| GET | `/configuration/:key` | Get configuration value |
| GET | `/configuration/:key/details` | Get configuration details |
| POST | `/configuration` | Create new configuration |
| PUT | `/configuration/:key` | Update configuration |
| DELETE | `/configuration/:key` | Delete configuration |
| GET | `/configuration/:key/history` | Get configuration history |
| GET | `/configuration/stats/overview` | Get configuration statistics |
| POST | `/configuration/refresh` | Refresh configurations |
| POST | `/configuration/bulk-update` | Bulk update configurations |

### Secrets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/secrets` | Get all secrets (metadata only) |
| GET | `/secrets/:key` | Get secret metadata |
| POST | `/secrets/access` | Get secret value |
| POST | `/secrets` | Create new secret |
| PUT | `/secrets/:key` | Update secret |
| POST | `/secrets/:key/rotate` | Rotate secret |
| DELETE | `/secrets/:key` | Delete secret |
| GET | `/secrets/:key/access-logs` | Get secret access logs |
| GET | `/secrets/stats/overview` | Get secrets statistics |
| POST | `/secrets/refresh` | Refresh secrets |

## 💡 Usage Examples

### Feature Flags

#### Using Feature Flag Guard

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { FeatureFlag } from './feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from './feature-flags/guards/feature-flag.guard';

@Controller('api')
export class ApiController {
  @Get('new-feature')
  @UseGuards(FeatureFlagGuard)
  @FeatureFlag('new-feature-flag')
  getNewFeature() {
    return { message: 'New feature is enabled!' };
  }
}
```

#### Using Feature Flags Service

```typescript
import { Injectable } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags/feature-flags.service';

@Injectable()
export class MyService {
  constructor(private readonly featureFlags: FeatureFlagsService) {}

  async processData() {
    const isEnabled = this.featureFlags.isEnabled('advanced-processing', {
      userId: 'user123',
      environment: 'production'
    });

    if (isEnabled) {
      return this.advancedProcessing();
    }
    
    return this.basicProcessing();
  }
}
```

### Configuration Management

#### Using Configuration Service

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigurationService } from './configuration/configuration.service';

@Injectable()
export class MyService {
  constructor(private readonly config: ConfigurationService) {}

  async getApiSettings() {
    const rateLimit = this.config.get<number>('api.rateLimit');
    const cacheTtl = this.config.get<number>('cache.ttl');
    
    return {
      rateLimit: rateLimit || 1000,
      cacheTtl: cacheTtl || 3600
    };
  }
}
```

### Secret Management

#### Using Secrets Service

```typescript
import { Injectable } from '@nestjs/common';
import { SecretsService } from './secrets/secrets.service';

@Injectable()
export class DatabaseService {
  constructor(private readonly secrets: SecretsService) {}

  async getDatabaseConfig() {
    const result = await this.secrets.getSecret({
      key: 'database.password',
      requestedByService: 'database-service',
      reason: 'Database connection'
    });

    if ('error' in result) {
      throw new Error(`Failed to get database password: ${result.error}`);
    }

    return {
      password: result.value,
      // ... other config
    };
  }
}
```

## 🔒 Security Features

### Feature Flags Security
- **Context-aware evaluation** with user and environment validation
- **IP-based restrictions** for feature access
- **Rate limiting** on feature flag evaluation endpoints
- **Audit logging** for all feature flag changes

### Configuration Security
- **Validation rules** for all configuration values
- **Environment isolation** to prevent cross-environment access
- **Version control** with rollback capabilities
- **Access logging** for configuration changes

### Secret Management Security
- **AES-256 encryption** for all stored secrets
- **Access control lists** with user/service permissions
- **IP restrictions** and time-based access controls
- **Automatic rotation** with configurable policies
- **Comprehensive audit logging** for all secret access

## 🚀 Getting Started

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```env
# Secrets encryption key (generate a secure random key)
SECRETS_ENCRYPTION_KEY=your-32-character-encryption-key

# Feature flags refresh interval (optional)
FEATURE_FLAGS_REFRESH_INTERVAL=300000

# Configuration refresh interval (optional)
CONFIGURATION_REFRESH_INTERVAL=300000
```

### 2. Basic Usage

The system is automatically initialized when the application starts. You can immediately start using the services:

```typescript
// In your service
constructor(
  private readonly featureFlags: FeatureFlagsService,
  private readonly config: ConfigurationService,
  private readonly secrets: SecretsService
) {}
```

### 3. API Documentation

Once the application is running, visit:
- **Swagger UI**: `http://localhost:3000/docs`
- **Feature Flags API**: `http://localhost:3000/feature-flags`
- **Configuration API**: `http://localhost:3000/configuration`
- **Secrets API**: `http://localhost:3000/secrets`

## 🔄 Scheduled Tasks

The system includes several scheduled tasks:

- **Feature Flags Refresh**: Every 5 minutes
- **Configuration Refresh**: Every 5 minutes
- **Secret Rotation Check**: Daily at midnight
- **Secrets Refresh**: Every 5 minutes

## 📊 Monitoring

### Metrics Available
- **Feature flag evaluation counts** by flag and result
- **Configuration access patterns** and update frequency
- **Secret access logs** with success/failure rates
- **System performance** metrics for all services

### Health Checks
- **Feature flags service health**
- **Configuration service health**
- **Secrets service health**
- **Encryption/decryption performance**

## 🛠️ Customization

### Adding Custom Feature Flag Types

```typescript
// Extend the FeatureFlagType enum
export enum FeatureFlagType {
  BOOLEAN = 'boolean',
  STRING = 'string',
  NUMBER = 'number',
  JSON = 'json',
  CUSTOM_TYPE = 'custom_type', // Add your custom type
}
```

### Custom Configuration Validators

```typescript
const customValidation: ConfigurationValidation = {
  customValidator: (value) => {
    // Your custom validation logic
    return value.startsWith('custom-') || 'Value must start with "custom-"';
  }
};
```

### Custom Secret Types

```typescript
// Extend the SecretType enum
export enum SecretType {
  API_KEY = 'api_key',
  PASSWORD = 'password',
  CUSTOM_SECRET = 'custom_secret', // Add your custom type
}
```

## 🔧 Troubleshooting

### Common Issues

1. **Feature flag not working**: Check if the flag is enabled and targeting rules are correct
2. **Configuration not updating**: Verify the configuration key and environment
3. **Secret access denied**: Check access control rules and IP restrictions
4. **Encryption errors**: Ensure the encryption key is properly set

### Debug Mode

Enable debug logging by setting the log level to `debug` in your environment:

```env
LOG_LEVEL=debug
```

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Feature Flags Best Practices](https://martinfowler.com/articles/feature-toggles.html)
- [Configuration Management Patterns](https://12factor.net/config)
- [Secret Management Security](https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure)

## 🤝 Contributing

When contributing to the configuration management system:

1. Follow the existing code patterns and interfaces
2. Add comprehensive tests for new functionality
3. Update documentation for any API changes
4. Ensure security best practices are followed
5. Add appropriate logging and monitoring

## 📄 License

This configuration management system is part of the NestJS boilerplate and follows the same MIT license.
