# NestJS Boilerplate

Production-ready NestJS boilerplate with TypeScript, featuring comprehensive configuration, logging, validation, testing, Docker support, CI/CD pipeline, and database layer with Drizzle ORM.

## 🚀 Features

- **Framework**: NestJS ^10 with TypeScript strict mode
- **Package Manager**: pnpm with lockfile
- **Configuration**: Environment-based with Zod validation
- **Security**: Helmet, CORS, Rate limiting, Proxy support
- **Health Checks**: Kubernetes-ready liveness/readiness probes
- **Testing**: Jest unit tests + Supertest e2e tests
- **Code Quality**: ESLint, Prettier, Husky, lint-staged
- **Documentation**: Swagger API docs at `/docs`
- **Docker**: Multi-stage builds with non-root user
- **CI/CD**: GitHub Actions with quality gates
- **Database Layer**: Drizzle ORM with PostgreSQL

## 📋 Requirements

- **Node.js**: 20+ (LTS)
- **Package Manager**: pnpm 8.15.0+
- **OS**: Linux, macOS, Windows (WSL)

## 🛠️ Installation

```bash
# Clone repository
git clone <your-repo-url>
cd todo-nestjs-app

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env
```

## ⚙️ Configuration

Create `.env` file based on `.env.example`:

```env
# Application
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/nestjs_boilerplate
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_NAME=nestjs_boilerplate
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## 🚀 Running Locally

```bash
# Development mode
pnpm start:dev

# Production mode
pnpm start:prod

# Debug mode
pnpm start:debug
```

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

## 🧪 Testing

```bash
# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:cov

# E2E tests
pnpm test:e2e

# All tests with coverage
pnpm test:cov
```

## 🔍 Code Quality

```bash
# Lint and fix
pnpm lint

# Check linting
pnpm lint:check

# Format code
pnpm format

# Check formatting
pnpm format:check

# Full quality check
pnpm quality
```

## 📚 API Documentation

Once the application is running, visit:

- **Swagger UI**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health/healthz
- **Readiness Check**: http://localhost:3000/health/readiness

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

## 🚀 CI/CD Pipeline

The project includes GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on:

- **Pull Requests**: All branches
- **Push**: `staging` and `main` branches

**Pipeline Steps:**
1. Setup Node.js (20, 22)
2. Install dependencies with pnpm cache
3. Lint check
4. Format check
5. Unit tests
6. Build application
7. Upload coverage reports

## 🐳 Docker Features

- **Multi-stage builds**: Optimized for production
- **Non-root user**: Security best practices
- **Health checks**: Built-in health monitoring
- **Signal handling**: Proper graceful shutdown
- **Environment support**: Development and production configs

## 🔒 Security Features

- **Helmet**: Security headers
- **CORS**: Configurable cross-origin requests
- **Rate Limiting**: Express rate limiting with proxy support
- **Validation**: Global validation pipe with whitelist
- **Non-root user**: Docker security

## 📊 Health Monitoring

- **Liveness Probe**: `/health/healthz` for Kubernetes
- **Readiness Probe**: `/health/readiness` for load balancers
- **Health Checks**: Built-in Docker health checks

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the [NestJS documentation](https://docs.nestjs.com/)
- Review the [TypeScript documentation](https://www.typescriptlang.org/docs/)
- Check the [DATABASE.md](DATABASE.md) for database setup

Built with ❤️ using [NestJS](https://nestjs.com/)
