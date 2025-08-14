# Security Guide

This document describes the security features implemented in the NestJS application.

## Security Features

### 1. Helmet - Security Headers

The application uses Helmet middleware to set various HTTP headers that help protect against well-known web vulnerabilities.

**Headers Applied:**
- `Content-Security-Policy`: Restricts resource loading to trusted sources
- `X-Content-Type-Options`: Prevents MIME type sniffing
- `X-Frame-Options`: Prevents clickjacking attacks
- `X-XSS-Protection`: Basic XSS protection
- `Strict-Transport-Security`: Enforces HTTPS
- `Referrer-Policy`: Controls referrer information
- `Cross-Origin-Opener-Policy`: Isolates browsing context
- `Cross-Origin-Resource-Policy`: Controls cross-origin resource access

**CSP Configuration:**
```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: [`'self'`],
    styleSrc: [`'self'`, `'unsafe-inline'`],
    scriptSrc: [`'self'`, `'unsafe-inline'`],
    imgSrc: [`'self'`, 'data:', 'https:'],
    fontSrc: [`'self'`, 'https:', 'data:'],
    connectSrc: [`'self'`],
    frameSrc: [`'self'`],
    objectSrc: [`'none'`],
    upgradeInsecureRequests: [],
  },
}
```

### 2. CORS (Cross-Origin Resource Sharing)

CORS is configured to control which origins can access the API.

**Configuration:**
- **Origins**: Configurable via `ALLOWED_ORIGINS` environment variable
- **Methods**: GET, POST, PUT, PATCH, DELETE, OPTIONS
- **Headers**: Content-Type, Authorization, X-Requested-With
- **Credentials**: Enabled for authenticated requests
- **Max Age**: 24 hours

**Default Origins:**
- `http://localhost:3000`
- `http://localhost:3001`

**Custom Origins:**
Set `ALLOWED_ORIGINS=https://example.com,https://app.com` in your environment.

### 3. Rate Limiting

Rate limiting protects against abuse and DDoS attacks using multiple time windows.

**Rate Limit Tiers:**
- **Short**: 10 requests per 1 second
- **Medium**: 50 requests per 10 seconds  
- **Long**: 100 requests per 60 seconds

**Headers Returned:**
- `X-RateLimit-Limit-{tier}`: Maximum requests allowed
- `X-RateLimit-Remaining-{tier}`: Remaining requests
- `X-RateLimit-Reset-{tier}`: Time until reset (seconds)

**Error Response:**
```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later."
}
```

### 4. Validation Pipe

Global validation ensures all incoming data is properly validated and sanitized.

**Configuration:**
```typescript
new ValidationPipe({
  whitelist: true,        // Strip non-whitelisted properties
  transform: true,        // Transform payloads to objects
  forbidNonWhitelisted: false, // Don't reject non-whitelisted
})
```

**Features:**
- Automatic DTO validation
- Type transformation
- Property whitelisting
- XSS protection through input sanitization

### 5. Proxy Support

The application is configured to work behind reverse proxies (nginx, load balancers, etc.).

**Trust Proxy:**
```typescript
app.set('trust proxy', true);
```

**IP Extraction:**
- Automatically detects forwarded IPs from `X-Forwarded-For` header
- Falls back to direct connection IP
- Ensures accurate rate limiting behind proxies

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:3000,http://localhost:3001` |

## Security Best Practices

### 1. Production Deployment

- Set `NODE_ENV=production`
- Use HTTPS only
- Configure proper `ALLOWED_ORIGINS`
- Monitor rate limiting logs
- Regular security updates

### 2. CORS Configuration

- Restrict origins to only necessary domains
- Avoid using `*` for production
- Consider using environment-specific origins

### 3. Rate Limiting

- Monitor rate limit headers
- Adjust limits based on application needs
- Consider using Redis for distributed rate limiting

### 4. Headers

- Helmet headers are automatically applied
- Customize CSP if needed for your application
- Test security headers with security scanners

## Testing Security

### 1. Security Headers

```bash
curl -I http://localhost:3000/health/healthz
```

Verify presence of security headers like:
- `Content-Security-Policy`
- `X-Content-Type-Options`
- `X-Frame-Options`

### 2. Rate Limiting

```bash
# Test rate limiting
for i in {1..15}; do 
  curl -s -w "%{http_code}\n" http://localhost:3000/health/healthz
done
```

Expected: First 10 requests return 200, subsequent return 429.

### 3. CORS

```bash
# Test CORS preflight
curl -H "Origin: http://example.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://localhost:3000/health/healthz
```

## Security Monitoring

### 1. Logs

Monitor application logs for:
- Rate limit violations
- CORS rejections
- Validation errors
- Security header issues

### 2. Metrics

Track security-related metrics:
- Rate limit hits per IP
- CORS preflight requests
- Validation failures
- Security header responses

## Additional Security Considerations

### 1. Input Validation

- All endpoints use DTO validation
- Automatic type conversion and sanitization
- XSS protection through input filtering

### 2. Error Handling

- Generic error messages in production
- No sensitive information in error responses
- Proper HTTP status codes

### 3. Dependencies

- Regular security audits with `pnpm audit`
- Keep dependencies updated
- Monitor security advisories

## Security Headers Reference

| Header | Purpose | Value |
|--------|---------|-------|
| `Content-Security-Policy` | Resource loading restrictions | Custom policy |
| `X-Content-Type-Options` | MIME type sniffing protection | `nosniff` |
| `X-Frame-Options` | Clickjacking protection | `SAMEORIGIN` |
| `X-XSS-Protection` | Basic XSS protection | `0` |
| `Strict-Transport-Security` | HTTPS enforcement | `max-age=15552000` |
| `Referrer-Policy` | Referrer control | `no-referrer` |
| `Cross-Origin-Opener-Policy` | Context isolation | `same-origin` |
| `Cross-Origin-Resource-Policy` | Resource access control | `same-origin` | 