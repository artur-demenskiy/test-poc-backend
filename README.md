# 🚀 NestJS Application

A clean and minimal NestJS application template.

## ✨ Features

- **Clean Architecture** - Minimal structure with clear separation of concerns
- **RESTful API** - Basic "Hello World" endpoint
- **Testing** - Unit and E2E tests with Jest
- **TypeScript** - Full TypeScript support
- **Code Quality** - ESLint and Prettier configuration

## 🏗️ Project Structure

```
src/
├── app.module.ts          # Main application module
├── app.controller.ts      # HTTP controller
├── app.service.ts         # Business logic service
├── main.ts               # Application entry point
└── app.controller.spec.ts # Unit tests
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
