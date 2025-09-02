# Integrations and ETL System

This document describes the comprehensive integrations and ETL system implemented in the NestJS boilerplate, including webhooks, API integrations, ETL pipelines, message queues, event sourcing, and CQRS patterns.

## 🚀 Features

### 1. Webhook System
- **Dynamic webhook configurations** for event-driven integrations
- **Multiple authentication methods** (Basic, Bearer, HMAC, Custom)
- **Retry mechanisms** with exponential backoff
- **Delivery tracking** and audit logging
- **Event-based triggering** with payload customization
- **Rate limiting** and error handling

### 2. API Integrations
- **Third-party API management** (Stripe, GitHub, Slack, etc.)
- **Multiple authentication types** (API Key, Bearer, OAuth2, Basic)
- **Rate limiting** with distributed support
- **Request/response interceptors** for logging and monitoring
- **OAuth2 flow** support with authorization URLs
- **Health checks** and connectivity testing

### 3. ETL Pipelines (Planned)
- **Data extraction** from multiple sources
- **Transformation** with mapping and filtering
- **Loading** to various destinations
- **Scheduled execution** with cron expressions
- **Error handling** and notification systems
- **Incremental loading** support

### 4. Message Queues (Planned)
- **Multiple queue providers** (RabbitMQ, Redis, Kafka, SQS)
- **Producer/consumer patterns**
- **Dead letter queues** for failed messages
- **Message persistence** and durability
- **Queue monitoring** and metrics

### 5. Event Sourcing (Planned)
- **Event store** with versioning
- **Event serialization** (JSON, Avro, Protobuf)
- **Snapshot management** for performance
- **Event replay** capabilities
- **Aggregate reconstruction**

### 6. CQRS Pattern (Planned)
- **Command/Query separation**
- **Event-driven architecture**
- **Read/write model separation**
- **Event handlers** and projections
- **Consistency patterns**

## 📁 Project Structure

```
src/integrations/
├── interfaces/
│   └── integration.interface.ts
├── webhooks/
│   ├── webhook.service.ts
│   ├── webhook.controller.ts
│   └── webhook.module.ts
├── api-integrations/
│   ├── api-integration.service.ts
│   ├── api-integration.controller.ts
│   └── api-integration.module.ts
├── etl/
│   ├── etl.service.ts
│   ├── etl.controller.ts
│   └── etl.module.ts
├── message-queues/
│   ├── message-queue.service.ts
│   ├── message-queue.controller.ts
│   └── message-queue.module.ts
├── event-sourcing/
│   ├── event-store.service.ts
│   ├── event-sourcing.controller.ts
│   └── event-sourcing.module.ts
├── cqrs/
│   ├── command-bus.service.ts
│   ├── query-bus.service.ts
│   └── cqrs.module.ts
├── monitoring/
│   ├── integration-monitor.service.ts
│   └── integration-monitor.controller.ts
└── integrations.module.ts
```

## 🔧 API Endpoints

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/webhooks` | Get all webhook configurations |
| GET | `/webhooks/:id` | Get webhook configuration by ID |
| POST | `/webhooks` | Create new webhook configuration |
| PUT | `/webhooks/:id` | Update webhook configuration |
| DELETE | `/webhooks/:id` | Delete webhook configuration |
| POST | `/webhooks/:id/trigger` | Trigger webhook manually |
| GET | `/webhooks/:id/deliveries` | Get webhook delivery history |
| GET | `/webhooks/deliveries/all` | Get all webhook deliveries |
| GET | `/webhooks/:id/stats` | Get webhook delivery statistics |
| GET | `/webhooks/stats/overview` | Get overall webhook statistics |
| POST | `/webhooks/refresh` | Refresh webhook configurations |

### API Integrations (Planned)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api-integrations` | Get all API integrations |
| GET | `/api-integrations/:id` | Get API integration by ID |
| POST | `/api-integrations` | Create new API integration |
| PUT | `/api-integrations/:id` | Update API integration |
| DELETE | `/api-integrations/:id` | Delete API integration |
| POST | `/api-integrations/:id/test` | Test API integration |
| GET | `/api-integrations/:id/oauth2/auth-url` | Get OAuth2 authorization URL |
| POST | `/api-integrations/:id/oauth2/exchange` | Exchange OAuth2 code for token |
| GET | `/api-integrations/:id/rate-limit` | Get rate limit status |

## 💡 Usage Examples

### Webhooks

#### Creating a Webhook

```typescript
import { WebhookService } from './integrations/webhooks/webhook.service';

@Injectable()
export class MyService {
  constructor(private readonly webhookService: WebhookService) {}

  async createUserWebhook() {
    const webhookId = await this.webhookService.createWebhook({
      name: 'User Registration Webhook',
      url: 'https://api.example.com/webhooks/user-registration',
      method: 'POST',
      events: ['user.created', 'user.updated'],
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'nestjs-boilerplate',
      },
      auth: {
        type: 'bearer',
        token: 'webhook-secret-token',
      },
      retry: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        multiplier: 2,
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
      },
      active: true,
    });

    return webhookId;
  }
}
```

#### Triggering Webhooks

```typescript
import { WebhookService } from './integrations/webhooks/webhook.service';

@Injectable()
export class UserService {
  constructor(private readonly webhookService: WebhookService) {}

  async createUser(userData: any) {
    // Create user logic here...

    // Trigger webhook for user creation
    await this.webhookService.triggerWebhook('user.created', {
      userId: user.id,
      email: user.email,
      createdAt: user.createdAt,
    });

    return user;
  }
}
```

### API Integrations

#### Making API Requests

```typescript
import { ApiIntegrationService } from './integrations/api-integrations/api-integration.service';

@Injectable()
export class PaymentService {
  constructor(private readonly apiIntegrationService: ApiIntegrationService) {}

  async createStripePayment(paymentData: any) {
    try {
      const response = await this.apiIntegrationService.makeRequest(
        'stripe',
        'POST',
        '/payment_intents',
        {
          amount: paymentData.amount,
          currency: paymentData.currency,
          payment_method_types: ['card'],
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Stripe payment failed: ${error.message}`);
    }
  }
}
```

#### OAuth2 Integration

```typescript
import { ApiIntegrationService } from './integrations/api-integrations/api-integration.service';

@Injectable()
export class OAuthService {
  constructor(private readonly apiIntegrationService: ApiIntegrationService) {}

  async getGitHubAuthUrl(state?: string) {
    return this.apiIntegrationService.getOAuth2AuthUrl('github', state);
  }

  async exchangeGitHubCode(code: string) {
    const tokens = await this.apiIntegrationService.exchangeOAuth2Code('github', code);
    return tokens;
  }
}
```

## 🔒 Security Features

### Webhook Security
- **HMAC signature verification** for payload integrity
- **Authentication headers** (Basic, Bearer, Custom)
- **Rate limiting** on webhook endpoints
- **Retry mechanisms** with exponential backoff
- **Audit logging** for all webhook activities

### API Integration Security
- **Secure credential storage** (encrypted)
- **OAuth2 flow** with state parameter validation
- **Rate limiting** per integration
- **Request signing** for sensitive APIs
- **Token refresh** mechanisms

## 🚀 Getting Started

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```env
# Webhook configuration
WEBHOOK_RETRY_MAX_ATTEMPTS=3
WEBHOOK_RETRY_INITIAL_DELAY=1000
WEBHOOK_RETRY_MAX_DELAY=10000

# API Integration configuration
API_INTEGRATION_TIMEOUT=30000
API_INTEGRATION_RATE_LIMIT_ENABLED=true

# Message Queue configuration (for future use)
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest
```

### 2. Basic Usage

The system is automatically initialized when the application starts. You can immediately start using the services:

```typescript
// In your service
constructor(
  private readonly webhookService: WebhookService,
  private readonly apiIntegrationService: ApiIntegrationService,
) {}
```

### 3. API Documentation

Once the application is running, visit:
- **Swagger UI**: `http://localhost:3000/docs`
- **Webhooks API**: `http://localhost:3000/webhooks`
- **API Integrations API**: `http://localhost:3000/api-integrations` (planned)

## 🔄 Scheduled Tasks

The system includes several scheduled tasks:

- **Webhook Configuration Refresh**: Every 5 minutes
- **Webhook Delivery Cleanup**: Daily at midnight
- **API Integration Refresh**: Every 5 minutes
- **Rate Limit Counter Reset**: Every minute

## 📊 Monitoring

### Metrics Available
- **Webhook delivery success/failure rates**
- **API integration response times**
- **Rate limit usage** per integration
- **Error rates** and failure patterns
- **Throughput metrics** for all integrations

### Health Checks
- **Webhook service health**
- **API integration connectivity**
- **Message queue connectivity** (planned)
- **Event store health** (planned)

## 🛠️ Customization

### Adding Custom Webhook Providers

```typescript
// Extend the webhook service for custom providers
export class CustomWebhookService extends WebhookService {
  async deliverToCustomProvider(webhook: WebhookConfig, event: string, payload: any) {
    // Custom delivery logic
  }
}
```

### Adding Custom API Integrations

```typescript
// Create custom API integration
const customIntegration: ApiIntegrationConfig = {
  id: 'custom-api',
  name: 'Custom API Integration',
  provider: 'custom',
  baseUrl: 'https://api.custom.com',
  auth: {
    type: 'custom',
    customHeaders: {
      'X-Custom-Auth': 'custom-token',
    },
  },
  timeout: 30000,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

## 🔧 Troubleshooting

### Common Issues

1. **Webhook delivery failures**: Check authentication and retry configuration
2. **API rate limiting**: Monitor rate limit status and adjust limits
3. **OAuth2 flow issues**: Verify redirect URIs and scopes
4. **Connection timeouts**: Check network connectivity and timeout settings

### Debug Mode

Enable debug logging by setting the log level to `debug` in your environment:

```env
LOG_LEVEL=debug
```

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Webhook Best Practices](https://webhooks.fyi/)
- [API Integration Patterns](https://martinfowler.com/articles/integration-patterns.html)
- [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)

## 🤝 Contributing

When contributing to the integrations system:

1. Follow the existing code patterns and interfaces
2. Add comprehensive tests for new functionality
3. Update documentation for any API changes
4. Ensure security best practices are followed
5. Add appropriate logging and monitoring

## 📄 License

This integrations system is part of the NestJS boilerplate and follows the same MIT license.
