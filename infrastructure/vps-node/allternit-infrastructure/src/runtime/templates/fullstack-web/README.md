# Full Stack Web Template

A production-ready full-stack web application template built with **Next.js 14**, **TypeScript**, **PostgreSQL**, **Prisma ORM**, and **Redis**.

## 🚀 Features

- **Next.js 14** with App Router and Server Components
- **TypeScript 5.3** for type safety
- **PostgreSQL 16** for data persistence
- **Prisma ORM** with migrations and type-safe queries
- **Redis** for sessions, caching, and rate limiting
- **NextAuth.js** with multiple authentication providers (GitHub, Google, Credentials)
- **Tailwind CSS** + **shadcn/ui** for beautiful, accessible UI components
- **React Query** + **Zustand** for state management
- **Vitest** + **Playwright** for comprehensive testing
- **Docker** + **Docker Compose** for consistent development environment
- **GitHub Actions** CI/CD pipeline ready

## 📁 Project Structure

```
.
├── .devcontainer/         # VS Code Dev Container config
├── app-examples/          # Starter code examples
│   ├── api/              # API route examples
│   ├── auth/             # Authentication pages & routes
│   ├── db/               # Database query helpers
│   ├── ui/               # UI components, hooks, providers
│   └── types/            # TypeScript type definitions
├── config/               # Template configurations
│   ├── package.json.template
│   └── prisma/
│       └── schema.prisma.template
├── scripts/              # Initialization scripts
│   ├── init-project.sh
│   └── init-db.sql
├── .env.example          # Environment variables template
├── docker-compose.yml    # Docker services configuration
├── Dockerfile            # Application container definition
├── template.json         # Template metadata
└── README.md            # This file
```

## 🛠️ Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- VS Code with Dev Containers extension (recommended)

### Quick Start

1. **Using Docker Compose:**
   ```bash
   docker-compose up -d
   ```

2. **Access the application:**
   - Web App: http://localhost:3000
   - Prisma Studio: http://localhost:5555
   - Mailpit (Email): http://localhost:8025
   - pgAdmin: http://localhost:5050

3. **Initialize the project:**
   ```bash
   docker-compose exec nextjs bash scripts/init-project.sh
   ```

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myapp"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# OAuth Providers (optional)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Redis
REDIS_URL="redis://localhost:6379"

# Email
EMAIL_SERVER="smtp://localhost:1025"
EMAIL_FROM="noreply@localhost"
```

## 📦 Services

| Service | Port | Description |
|---------|------|-------------|
| Next.js App | 3000 | Main application server |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache and session store |
| Prisma Studio | 5555 | Database GUI |
| Mailpit | 8025 | Email testing UI |
| pgAdmin | 5050 | Database management (optional) |

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Run e2e tests with UI
npm run test:e2e:ui
```

## 📚 Database Commands

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate:dev

# Open Prisma Studio
npm run db:studio

# Reset database
npm run db:reset

# Seed database
npm run db:seed
```

## 🔐 Authentication

The template includes a complete authentication system:

- **OAuth**: GitHub and Google login
- **Credentials**: Email/password with bcrypt hashing
- **Session Management**: JWT-based sessions stored in Redis
- **Protected Routes**: Middleware-based route protection
- **Role-based Access**: User, Admin, and Moderator roles

### Setup OAuth Providers

1. Create OAuth apps on GitHub/Google
2. Add credentials to `.env.local`
3. Configure callback URLs

## 🎨 UI Components

The template includes pre-built shadcn/ui components:

- Button, Card, Input, Label
- Dialog, Dropdown, Select
- Toast notifications
- Theme toggle (dark/light mode)

## 📝 Project Initialization Script

The `init-project.sh` script automatically:

1. Checks Node.js version (18+ required)
2. Creates `package.json` if missing
3. Installs dependencies
4. Sets up environment files
5. Configures Prisma
6. Runs database migrations
7. Seeds initial data
8. Creates TypeScript and Tailwind configs
9. Generates starter components

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f nextjs

# Run commands in container
docker-compose exec nextjs bash

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Rebuild containers
docker-compose up -d --build
```

## 🔄 CI/CD

The template includes GitHub Actions workflow examples for:

- Running tests on PR
- Linting and type checking
- Building and deploying

See `.github/workflows/` for examples.

## 📖 Code Examples

### Authentication

```typescript
// app-examples/auth/ - Complete auth setup
// - NextAuth configuration
// - Sign in / Sign up pages
// - Protected route middleware
```

### API Routes

```typescript
// app-examples/api/ - REST API examples
// - CRUD operations with Prisma
// - Authentication middleware
// - Error handling
```

### Database Queries

```typescript
// app-examples/db/ - Query helpers
// - User queries
// - Post queries
// - Dashboard stats
```

### UI Components

```typescript
// app-examples/ui/ - Component library
// - shadcn/ui components
// - Custom hooks
// - Theme providers
```

## 🛡️ Security Features

- Helmet.js for security headers
- CSRF protection
- Rate limiting with Redis
- Secure session handling
- Input validation with Zod
- SQL injection protection (Prisma)

## 🌐 Deployment

### Docker Deployment

```bash
# Production build
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Vercel Deployment

1. Connect your GitHub repository
2. Add environment variables in Vercel dashboard
3. Deploy

## 📝 License

MIT License - feel free to use this template for your projects.

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines first.

## 📧 Support

For issues and questions:
- Create an issue in the repository
- Check the documentation
- Review the example code in `app-examples/`

---

**Built with ❤️ by Allternit Infrastructure**
