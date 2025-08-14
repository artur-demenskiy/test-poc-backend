# 🚀 NestJS Application

A clean and minimal NestJS application template.

## 🚀 Features

- **NestJS 10+** with TypeScript strict mode
- **Configuration Management** with environment validation
- **Security Middleware** (Helmet, CORS, Rate Limiting)
- **Comprehensive Logging** with Winston and request tracking
- **Health Checks** for Kubernetes and load balancers
- **API Documentation** with Swagger
- **Database Layer** with Drizzle ORM and PostgreSQL
- **Testing** with Jest and Supertest
- **Code Quality** with ESLint, Prettier, and Husky
- **Docker Support** with multi-stage builds
- **CI/CD Pipeline** with GitHub Actions

## 🏗️ Project Structure

```
src/
├── config/           # Configuration management
├── database/         # Database layer (Drizzle ORM)
├── health/           # Health check endpoints
├── security/         # Security middleware & guards
├── app.controller.ts # Main application controller
├── app.service.ts    # Main application service
├── app.module.ts     # Root application module
└── main.ts          # Application entry point
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run start:dev

# Run tests
npm test

# Run E2E tests
npm run test:e2e
```

## 📋 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Returns "Hello World!" |

### Example Usage

```bash
# Test the endpoint
curl http://localhost:3000
# Response: Hello World!
```

## 🧪 Testing

The project includes basic testing setup:

- **Unit Tests** - Test individual components
- **E2E Tests** - Test the complete application

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Generate coverage report
npm run test:cov
```

## 🛠️ Development

### Available Scripts

- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build the application
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Code Quality

- **ESLint** - Code linting and style enforcement
- **Prettier** - Code formatting
- **TypeScript** - Strict type checking

## 🔧 Configuration

The application uses minimal configuration by default:

- **Port** - 3000 (configurable via PORT environment variable)
- **Framework** - Express.js (default NestJS platform)
- **Testing** - Jest with TypeScript support

## 🚀 Deployment

### Build for Production

```bash
npm run build
npm run start:prod
```

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

## 🎯 Next Steps

This is a minimal template. Consider adding:

- **New Modules** - Create additional feature modules
- **Database Integration** - Add TypeORM, Prisma, or MongoDB
- **Authentication** - Implement JWT, Passport, or Auth0
- **Validation** - Add class-validator and DTOs
- **API Documentation** - Integrate Swagger/OpenAPI
- **Logging** - Add Winston or Pino
- **Environment Configuration** - Use ConfigService and .env files

## 📄 License

This project is licensed under the MIT License.

---

Built with ❤️ using [NestJS](https://nestjs.com/)

## 🐳 Docker

### Development

```bash
# Build and run with hot reload
pnpm docker:compose:dev

# Or manually
pnpm docker:build
pnpm docker:run
```

### Production

```bash
# Build and run production image
pnpm docker:compose:prod

# Or manually
pnpm docker:build:prod
pnpm docker:run:prod
```

### Database

```bash
# Start PostgreSQL database
docker-compose -f docker-compose.db.yml up -d

# Start with pgAdmin (optional)
docker-compose -f docker-compose.db.yml up -d
```

### Docker Commands

```bash
# Build images
pnpm docker:build          # Development build
pnpm docker:build:prod     # Production build

# Run containers
pnpm docker:run            # Development container
pnpm docker:run:prod       # Production container

# Docker Compose
pnpm docker:compose:dev    # Development stack
pnpm docker:compose:prod   # Production stack
pnpm docker:compose:down   # Stop all containers
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm start` | Start application |
| `pnpm start:dev` | Start in development mode |
| `pnpm start:prod` | Start in production mode |
| `pnpm build` | Build application |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run e2e tests |
| `pnpm lint` | Lint and fix code |
| `pnpm format` | Format code with Prettier |
| `pnpm quality` | Full quality check |
| `pnpm docker:compose:dev` | Start development Docker stack |
| `pnpm db:generate` | Generate database migrations |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:push` | Push schema changes directly |
