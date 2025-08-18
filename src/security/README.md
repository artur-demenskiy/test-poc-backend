# Advanced Security Module

Этот модуль предоставляет комплексную систему безопасности для NestJS приложений, включая API Key Management, IP Whitelist, Request Signing и XSS Protection.

## 🚀 Возможности

### 1. API Key Management
- **Генерация и управление API ключами** с различными уровнями доступа
- **Scope-based авторизация** для точного контроля над ресурсами
- **Автоматическое истечение** ключей с настраиваемым временем жизни
- **Отслеживание использования** ключей

### 2. IP Whitelist
- **Контроль доступа по IP адресам** с поддержкой CIDR блоков
- **IPv4 и IPv6 поддержка** для современных сетевых конфигураций
- **Временные ограничения** для временного доступа
- **Гибкая настройка** для различных сетевых сценариев

### 3. Request Signing
- **HMAC-SHA256 подпись** для обеспечения целостности запросов
- **Timestamp validation** для предотвращения replay атак
- **Nonce поддержка** для уникальности каждого запроса
- **Timing-safe comparison** для предотвращения timing атак

### 4. XSS Protection
- **Автоматическая санитизация** HTML и текстового контента
- **Удаление опасных тегов** и атрибутов
- **Валидация URL** для предотвращения injection атак
- **Middleware интеграция** для автоматической защиты

## 📋 Установка и настройка

### 1. Добавьте переменные окружения

```env
# Request Signing
REQUEST_SIGNING_SECRET=your-super-secret-key-here

# Database (уже настроено в основном проекте)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

### 2. Модуль автоматически подключается к SecurityModule

```typescript
// src/security/security.module.ts
@Global()
@Module({
  // ... конфигурация
})
export class SecurityModule {}
```

## 🔧 Использование

### API Key Management

#### Создание API ключа
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

#### Защита endpoint'а с API ключом
```typescript
import { RequireApiKeyScope } from './security/api-key/api-key.guard';

@Controller('users')
export class UsersController {
  @Get()
  @RequireApiKeyScope('users', 'read')
  async getUsers() {
    // Доступ только с API ключом, имеющим scope 'users:read'
    return this.usersService.findAll();
  }
}
```

### IP Whitelist

#### Добавление IP в whitelist
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

#### Защита endpoint'а по IP
```typescript
import { IpWhitelistGuard } from './security/ip-whitelist/ip-whitelist.guard';

@Controller('admin')
export class AdminController {
  @Get('sensitive-data')
  @UseGuards(IpWhitelistGuard)
  async getSensitiveData() {
    // Доступ только с whitelisted IP адресов
    return this.adminService.getSensitiveData();
  }
}
```

### Request Signing

#### Подпись запроса на клиенте
```typescript
// Клиентский код (JavaScript/TypeScript)
const method = 'POST';
const path = '/api/secure-endpoint';
const body = JSON.stringify({ data: 'sensitive' });
const timestamp = Math.floor(Date.now() / 1000).toString();
const nonce = Math.random().toString(36).substring(2, 15);

// Генерация подписи (HMAC-SHA256)
const payload = `${method}\n${path}\n${body}\n${timestamp}\n${nonce}`;
const signature = crypto
  .createHmac('sha256', 'your-secret-key')
  .update(payload)
  .digest('hex');

// Отправка запроса
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

#### Защита endpoint'а с подписью
```typescript
import { RequireSignature } from './security/request-signing/request-signing.guard';

@Controller('api')
export class ApiController {
  @Post('secure-endpoint')
  @RequireSignature()
  async secureEndpoint(@Body() data: any) {
    // Доступ только с правильно подписанными запросами
    return { message: 'Request verified successfully' };
  }
}
```

### XSS Protection

#### Автоматическая защита через middleware
```typescript
// Middleware автоматически подключается в SecurityModule
// Все входящие запросы автоматически санитизируются
```

#### Ручная санитизация
```typescript
import { XssProtectionService } from './security/xss-protection/xss-protection.service';

@Injectable()
export class YourService {
  constructor(private readonly xssProtectionService: XssProtectionService) {}

  async processUserInput(userInput: string) {
    // Санитизация HTML
    const sanitizedHtml = this.xssProtectionService.sanitizeHtml(userInput, {
      allowedTags: ['b', 'i', 'em', 'strong'],
      stripEmpty: true
    });

    // Санитизация текста
    const sanitizedText = this.xssProtectionService.sanitizeText(userInput);

    // Проверка на опасный контент
    if (this.xssProtectionService.isPotentiallyDangerous(userInput)) {
      console.warn('Potentially dangerous content detected');
    }

    return { sanitizedHtml, sanitizedText };
  }
}
```

## 🛡️ Комбинированная защита

### Endpoint с полной защитой
```typescript
@Post('super-secure')
@UseGuards(ApiKeyGuard, IpWhitelistGuard)
@RequireApiKeyScope('admin', 'full-access')
@RequireSignature()
async superSecureEndpoint(@Body() data: any) {
  // Этот endpoint защищен:
  // 1. API Key с правильным scope
  // 2. IP адрес в whitelist
  // 3. Правильно подписанный запрос
  // 4. Автоматическая XSS защита через middleware
  
  return { message: 'Maximum security achieved!' };
}
```

## 📊 API Endpoints

### Security Management
- `POST /security/api-keys` - Создание API ключа
- `GET /security/api-keys` - Получение списка API ключей
- `DELETE /security/api-keys/:id` - Деактивация API ключа

### IP Whitelist
- `POST /security/ip-whitelist` - Добавление IP в whitelist
- `GET /security/ip-whitelist` - Получение списка whitelisted IP
- `DELETE /security/ip-whitelist/:id` - Удаление IP из whitelist
- `POST /security/ip-whitelist/:id/deactivate` - Деактивация IP записи

## 🔒 Безопасность

### Лучшие практики
1. **Используйте сильные секретные ключи** для request signing
2. **Регулярно ротируйте API ключи** для критических операций
3. **Ограничивайте scope'ы** API ключей минимально необходимыми правами
4. **Мониторьте использование** API ключей и IP адресов
5. **Логируйте все попытки доступа** для аудита

### Мониторинг
- Все попытки доступа логируются
- XSS попытки автоматически детектируются
- Неудачные попытки аутентификации отслеживаются
- IP адреса проверяются на каждом защищенном запросе

## 🚨 Troubleshooting

### Частые проблемы

1. **API Key не работает**
   - Проверьте правильность ключа
   - Убедитесь, что ключ активен и не истек
   - Проверьте scope'ы ключа

2. **IP заблокирован**
   - Проверьте IP адрес в whitelist
   - Убедитесь, что запись активна и не истекла
   - Проверьте CIDR блоки для сетевых диапазонов

3. **Request signature не проходит**
   - Проверьте правильность секретного ключа
   - Убедитесь, что timestamp не истек
   - Проверьте уникальность nonce

4. **XSS защита слишком строгая**
   - Настройте allowedTags и allowedAttributes
   - Используйте custom sanitization options

## 📚 Дополнительные ресурсы

- [NestJS Guards Documentation](https://docs.nestjs.com/guards)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [OWASP XSS Prevention](https://owasp.org/www-project-cheat-sheets/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [HMAC Security](https://en.wikipedia.org/wiki/HMAC) 