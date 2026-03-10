# A2R Infrastructure API

Complete backend API server for the A2R infrastructure system. Handles VPS connections, cloud deployments, environment provisioning, and SSH key management.

## Technology Stack

- **Node.js** + **TypeScript** - Runtime and language
- **Fastify** - High-performance HTTP server
- **PostgreSQL** - Primary database
- **Redis** - Caching and pub/sub for real-time events
- **WebSocket** - Real-time communication

## Features

- 🔌 **VPS Connection Management** - SSH connections with password or key authentication
- ☁️ **Cloud Deployments** - Automated provisioning on Hetzner, DigitalOcean, AWS
- 🐳 **Environment Provisioning** - Docker-based environment deployment
- 🔐 **SSH Key Management** - Generate, import, and distribute SSH keys
- 📡 **Real-time Events** - WebSocket support for deployment progress
- 📊 **Health Monitoring** - Comprehensive health checks and metrics

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# At minimum, set DATABASE_URL and REDIS_URL

# Run database migrations
npm run migrate:up

# Start development server
npm run dev

# Or build and start production server
npm run build
npm start
```

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/a2r_infrastructure

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-32-char-encryption-key

# Cloud Providers (optional)
HETZNER_API_KEY=your-hetzner-key
DIGITALOCEAN_API_KEY=your-do-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
```

## API Endpoints

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check with database and Redis status |
| GET | `/status` | Server status and metrics |
| GET | `/documentation` | Swagger API documentation |

### VPS Connections

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/vps` | List all VPS connections |
| GET | `/api/v1/vps/:id` | Get VPS by ID |
| POST | `/api/v1/vps` | Create new VPS connection |
| PATCH | `/api/v1/vps/:id` | Update VPS connection |
| DELETE | `/api/v1/vps/:id` | Delete VPS connection |
| POST | `/api/v1/vps/:id/test` | Test SSH connection |
| POST | `/api/v1/vps/:id/exec` | Execute command on VPS |
| POST | `/api/v1/vps/:id/install` | Install A2R node |
| GET | `/api/v1/vps/:id/history` | Get connection history |

### Cloud Deployments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/cloud/providers` | List available providers |
| GET | `/api/v1/cloud/providers/:provider` | Get provider info |
| POST | `/api/v1/cloud/estimate` | Get pricing estimate |
| GET | `/api/v1/cloud/deployments` | List deployments |
| POST | `/api/v1/cloud/deployments` | Create deployment |
| GET | `/api/v1/cloud/deployments/:id` | Get deployment status |
| POST | `/api/v1/cloud/deployments/:id/sync` | Sync with provider |
| DELETE | `/api/v1/cloud/deployments/:id` | Cancel/delete deployment |
| GET | `/api/v1/cloud/deployments/:id/events` | Get deployment events |
| WS | `/api/v1/cloud/deployments/:id/events` | Real-time deployment events |

### Environments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/environments/templates` | List templates |
| GET | `/api/v1/environments/templates/:id` | Get template |
| GET | `/api/v1/environments` | List environments |
| POST | `/api/v1/environments` | Provision environment |
| GET | `/api/v1/environments/:id` | Get environment status |
| PATCH | `/api/v1/environments/:id` | Update environment |
| GET | `/api/v1/environments/:id/logs` | Get container logs |
| GET | `/api/v1/environments/:id/events` | Get events |
| DELETE | `/api/v1/environments/:id` | Destroy environment |
| WS | `/api/v1/environments/:id/events` | Real-time events |

### SSH Keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/ssh-keys` | List SSH keys |
| GET | `/api/v1/ssh-keys/:id` | Get SSH key |
| POST | `/api/v1/ssh-keys/generate` | Generate new key |
| POST | `/api/v1/ssh-keys/import` | Import existing key |
| PATCH | `/api/v1/ssh-keys/:id` | Update SSH key |
| DELETE | `/api/v1/ssh-keys/:id` | Delete SSH key |
| POST | `/api/v1/ssh-keys/:id/distribute` | Distribute to VPS |
| GET | `/api/v1/ssh-keys/:id/distributions` | Get distributions |

## WebSocket

Connect to `ws://localhost:3000/ws` for real-time updates.

### Subscribe to events:
```json
{
  "type": "subscribe",
  "channel": "deployment:<id>:events"
}
```

Or use shorthand:
```json
{
  "type": "deployment:subscribe",
  "id": "<deployment-id>"
}
```

## Scripts

```bash
# Development
npm run dev              # Start with hot reload

# Build
npm run build            # Compile TypeScript

# Production
npm start                # Run compiled code

# Database
npm run migrate:up       # Run pending migrations
npm run migrate:down     # Rollback last migration
npm run migrate          # Show migration status
npm run migrate:create   # Create new migration

# Code quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues

# Testing
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
```

## Project Structure

```
src/
├── config/
│   ├── database.ts      # PostgreSQL connection
│   ├── redis.ts         # Redis connection
│   └── index.ts         # Configuration
├── models/
│   ├── VPSConnection.ts
│   ├── Deployment.ts
│   ├── Environment.ts
│   └── SSHKey.ts
├── providers/
│   ├── BaseProvider.ts
│   ├── HetznerProvider.ts
│   ├── DigitalOceanProvider.ts
│   └── AWSProvider.ts
├── routes/
│   ├── vps.ts
│   ├── cloud.ts
│   ├── environments.ts
│   ├── ssh-keys.ts
│   └── index.ts
├── services/
│   ├── VPSService.ts
│   ├── CloudProviderService.ts
│   ├── EnvironmentService.ts
│   ├── SSHKeyService.ts
│   └── WebSocketService.ts
├── utils/
│   ├── ssh.ts
│   ├── docker.ts
│   ├── errors.ts
│   └── logger.ts
├── server.ts
└── index.ts
```

## License

MIT
