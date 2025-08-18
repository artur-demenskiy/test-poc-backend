# Advanced Security Module

This module provides a comprehensive security system for NestJS applications, including API Key Management, IP Whitelist, Request Signing, and XSS Protection.

## 🚀 Features

### 1. API Key Management
- **Generate and manage API keys** with different access levels
- **Scope-based authorization** for precise resource control
- **Automatic expiration** with configurable lifetime
- **Usage tracking** for keys

### 2. IP Whitelist
- **Access control by IP addresses** with CIDR block support
- **IPv4 and IPv6 support** for modern network configurations
- **Temporal restrictions** for temporary access
- **Flexible configuration** for various network scenarios

### 3. Request Signing
- **HMAC-SHA256 signature** for request integrity
- **Timestamp validation** to prevent replay attacks
- **Nonce support** for request uniqueness
- **Timing-safe comparison** to prevent timing attacks

### 4. XSS Protection
- **Automatic sanitization** of HTML and text content
- **Removal of dangerous tags** and attributes
- **URL validation** to prevent injection attacks
- **Middleware integration** for automatic protection

## 📋 Installation and Setup

### 1. Add environment variables

```env
# Request Signing
REQUEST_SIGNING_SECRET=your-super-secret-key-here

# Database (already configured in main project)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

### 2. Module automatically connects to SecurityModule

```typescript
// src/security/security.module.ts
@Global()
@Module({
  // ... configuration
})
export class SecurityModule {}
```

## 🔧 Usage

### API Key Management

#### Creating API Key
```typescript
import { ApiKeyService } from './security/api-key/api-key.service';

@Injectable()
export class YourService {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async createApiKey() {
    const apiKey = await this.apiKeyService.createApiKey({
      name: 'My API Key',
      scopes: [
        { resource: 'users', actions: ['read', 'write'] },
        { resource: 'posts', actions: ['read'] }
      ],
      expiresInDays: 30
    });
    
    return apiKey;
  }
}
```

#### Protecting endpoint with API key
```typescript
import { RequireApiKeyScope } from './security/api-key/api-key.guard';

@Controller('users')
export class UsersController {
  @Get()
  @RequireApiKeyScope('users', 'read')
  async getUsers() {
    // Access only with API key having scope 'users:read'
    return this.usersService.findAll();
  }
}
```

### IP Whitelist

#### Adding IP to whitelist
```typescript
import { IpWhitelistService } from './security/ip-whitelist/ip-whitelist.service';

@Injectable()
export class YourService {
  constructor(private readonly ipWhitelistService: IpWhitelistService) {}

  async addIpToWhitelist() {
    await this.ipWhitelistService.createIpWhitelist({
      name: 'Office Network',
      ipAddress: '192.168.1.0',
      cidrBlock: '192.168.1.0/24',
      description: 'Office network range',
      expiresInDays: 365
    });
  }
}
```

#### Protecting endpoint by IP
```typescript
import { IpWhitelistGuard } from './security/ip-whitelist/ip-whitelist.guard';

@Controller('admin')
export class AdminController {
  @Get('sensitive-data')
  @UseGuards(IpWhitelistGuard)
  async getSensitiveData() {
    // Access only from whitelisted IP addresses
    return this.adminService.getSensitiveData();
  }
}
```

### Request Signing

#### Signing request on client
```typescript
// Client code (JavaScript/TypeScript)
const method = 'POST';
const path = '/api/secure-endpoint';
const body = JSON.stringify({ data: 'sensitive' });
const timestamp = Math.floor(Date.now() / 1000).toString();
const nonce = Math.random().toString(36).substring(2, 15);

// Generate signature (HMAC-SHA256)
const payload = `${method}\n${path}\n${body}\n${timestamp}\n${nonce}`;
const signature = crypto
  .createHmac('sha256', 'your-secret-key')
  .update(payload)
  .digest('hex');

// Send request
fetch('/api/secure-endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Signature': signature,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
  },
  body: body
});
```

#### Protecting endpoint with signature
```typescript
import { RequireSignature } from './security/request-signing/request-signing.guard';

@Controller('api')
export class ApiController {
  @Post('secure-endpoint')
  @RequireSignature()
  async secureEndpoint(@Body() data: any) {
    // Access only with properly signed requests
    return { message: 'Request verified successfully' };
  }
}
```

### XSS Protection

#### Automatic protection through middleware
```typescript
// Middleware automatically connects in SecurityModule
// All incoming requests are automatically sanitized
```

#### Manual sanitization
```typescript
import { XssProtectionService } from './security/xss-protection/xss-protection.service';

@Injectable()
export class YourService {
  constructor(private readonly xssProtectionService: XssProtectionService) {}

  async processUserInput(userInput: string) {
    // HTML sanitization
    const sanitizedHtml = this.xssProtectionService.sanitizeHtml(userInput, {
      allowedTags: ['b', 'i', 'em', 'strong'],
      stripEmpty: true
    });

    // Text sanitization
    const sanitizedText = this.xssProtectionService.sanitizeText(userInput);

    // Check for dangerous content
    if (this.xssProtectionService.isPotentiallyDangerous(userInput)) {
      console.warn('Potentially dangerous content detected');
    }

    return { sanitizedHtml, sanitizedText };
  }
}
```

## 🛡️ Combined Protection

### Endpoint with full protection
```typescript
@Post('super-secure')
@UseGuards(ApiKeyGuard, IpWhitelistGuard)
@RequireApiKeyScope('admin', 'full-access')
@RequireSignature()
async superSecureEndpoint(@Body() data: any) {
  // This endpoint is protected by:
  // 1. API Key with correct scope
  // 2. IP address in whitelist
  // 3. Properly signed request
  // 4. Automatic XSS protection through middleware
  
  return { message: 'Maximum security achieved!' };
}
```

## 📊 API Endpoints

### Security Management
- `POST /security/api-keys` - Create API key
- `GET /security/api-keys` - Get list of API keys
- `DELETE /security/api-keys/:id` - Deactivate API key

### IP Whitelist
- `POST /security/ip-whitelist` - Add IP to whitelist
- `GET /security/ip-whitelist` - Get list of whitelisted IPs
- `DELETE /security/ip-whitelist/:id` - Remove IP from whitelist
- `POST /security/ip-whitelist/:id/deactivate` - Deactivate IP entry

## 🔒 Security

### Best practices
1. **Use strong secret keys** for request signing
2. **Regularly rotate API keys** for critical operations
3. **Limit API key scopes** to minimally necessary permissions
4. **Monitor usage** of API keys and IP addresses
5. **Log all access attempts** for audit

### Monitoring
- All access attempts are logged
- XSS attempts are automatically detected
- Failed authentication attempts are tracked
- IP addresses are checked on each protected request

## 🚨 Troubleshooting

### Common issues

1. **API Key not working**
   - Check key correctness
   - Ensure key is active and not expired
   - Verify key scopes

2. **IP blocked**
   - Check IP address in whitelist
   - Ensure entry is active and not expired
   - Check CIDR blocks for network ranges

3. **Request signature not passing**
   - Check secret key correctness
   - Ensure timestamp hasn't expired
   - Verify nonce uniqueness

4. **XSS protection too strict**
   - Configure allowedTags and allowedAttributes
   - Use custom sanitization options

## 📚 Additional Resources

- [NestJS Guards Documentation](https://docs.nestjs.com/guards)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [OWASP XSS Prevention](https://owasp.org/www-project-cheat-sheets/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [HMAC Security](https://en.wikipedia.org/wiki/HMAC) 