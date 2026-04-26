# Allternit Platform Development Environment

A complete development environment for working on the Allternit platform. This devcontainer template provides everything you need to develop, test, and debug the full Allternit stack.

## Features

### Languages & Runtimes
- **Node.js 20 LTS** with pnpm, yarn, and TypeScript
- **Go 1.22** with air (live reload), golangci-lint, delve debugger
- **Rust 1.75+** with cargo-watch, cargo-expand, sqlx-cli

### Infrastructure Services
- **PostgreSQL 16** - Primary database with pgvector support
- **Redis 7** - Caching and session storage
- **MinIO** - S3-compatible object storage
- **Mailpit** - Email testing and debugging
- **ChromaDB** - Vector database for AI embeddings
- **LocalStack** - AWS services emulation
- **Temporal** - Workflow orchestration
- **NATS** - Message streaming platform

### Development Tools
- Docker-in-Docker support
- Kubernetes tools (kubectl, helm, k9s)
- Protocol Buffers compiler
- Task runner (Taskfile)
- Pre-configured VS Code extensions

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24.0+
- [VS Code](https://code.visualstudio.com/) with [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- At least 8GB RAM (16GB recommended)
- At least 50GB free disk space

### Getting Started

1. **Open in VS Code**
   ```bash
   code /path/to/allternit
   ```

2. **Reopen in Container**
   - Press `F1` or `Cmd/Ctrl+Shift+P`
   - Type "Dev Containers: Reopen in Container"
   - Select "Allternit Platform Development"

3. **Wait for Setup**
   - The container will build (first time takes ~5-10 minutes)
   - Dependencies will be installed automatically
   - Services will start when ready

4. **Access the Platform**
   - UI: http://localhost:3000
   - API: http://localhost:8080
   - MinIO Console: http://localhost:9001

### Manual Setup (without VS Code)

```bash
# Build and start the environment
docker compose up -d

# Enter the development container
docker compose exec allternit-dev bash

# Run setup script
./scripts/setup-dev.sh

# Start all services
./scripts/start-services.sh
```

## Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Platform UI | http://localhost:3000 | - |
| API Gateway | http://localhost:8080 | - |
| MinIO Console | http://localhost:9001 | minioadmin / minio-admin-password |
| Mailpit UI | http://localhost:8025 | - |
| Temporal UI | http://localhost:8088 | - |
| ChromaDB | http://localhost:8000 | - |
| LocalStack | http://localhost:4566 | - |
| PostgreSQL | localhost:5432 | postgres / allternit-dev-password |
| Redis | localhost:6379 | allternit-redis-password |

## Project Structure

```
allternit/
├── 1-kernel/                   # Backend services
│   ├── allternit-cloud/             # Go - API Gateway
│   ├── allternit-kernel/            # Go - Core services
│   └── allternit-infrastructure/    # Rust - Infrastructure layer
├── 6-ui/                       # Frontend
│   └── allternit-platform/          # Next.js/React application
├── 7-apps/                     # Application shells
│   └── shell/
├── 8-agents/                   # Agent definitions
├── docker-compose.yml          # Service orchestration
└── scripts/                    # Helper scripts
    ├── setup-dev.sh           # Initial setup
    └── start-services.sh      # Start development services
```

## Common Commands

### Development Workflow

```bash
# Start all services
./scripts/start-services.sh

# Stop all services
Ctrl+C in the terminal running start-services.sh

# Restart a specific service
docker compose restart <service-name>

# View service logs
docker compose logs -f <service-name>

# Access database
psql $DATABASE_URL

# Access Redis
redis-cli -u $REDIS_URL
```

### Working with the UI

```bash
cd 6-ui/allternit-platform

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format
```

### Working with Go Services

```bash
cd 1-kernel/allternit-kernel

# Install dependencies
go mod tidy

# Run with hot reload
air

# Run tests
go test ./...

# Run linter
golangci-lint run

# Build binary
go build -o bin/allternit-kernel
```

### Working with Rust Services

```bash
cd 1-kernel/allternit-infrastructure

# Build
cargo build

# Run with hot reload
cargo watch -x run

# Run tests
cargo test

# Run linter
cargo clippy

# Format code
cargo fmt
```

## Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT signing
- `OPENAI_API_KEY` - For AI features (optional)
- `ANTHROPIC_API_KEY` - For Claude integration (optional)

## Database Migrations

### Go (Goose)

```bash
cd 1-kernel/allternit-infrastructure/migrations

# Create new migration
goose create add_users_table sql

# Run migrations
goose up

# Rollback
goose down

# Check status
goose status
```

### Rust (SQLx)

```bash
cd 1-kernel/allternit-kernel

# Create migration
sqlx migrate add create_users_table

# Run migrations
sqlx migrate run

# Revert
sqlx migrate revert
```

### TypeScript (Prisma)

```bash
cd 6-ui/allternit-platform

# Generate migration
pnpm prisma migrate dev --name add_users

# Deploy migrations
pnpm prisma migrate deploy

# Generate client
pnpm prisma generate

# Open studio
pnpm prisma studio
```

## Testing

### Run All Tests

```bash
# Go tests
cd 1-kernel && go test ./...

# Rust tests
cd 1-kernel/allternit-infrastructure && cargo test

# UI tests
cd 6-ui/allternit-platform && pnpm test
```

### Integration Tests

```bash
# Start test environment
docker compose -f docker-compose.test.yml up -d

# Run integration tests
./scripts/test-integration.sh
```

## Debugging

### VS Code Debugging

Pre-configured launch configurations are available for:
- Go services
- Rust services
- Node.js/TypeScript

Press `F5` to start debugging.

### Port Forwarding

All service ports are automatically forwarded when using VS Code Dev Containers:

- 3000 - Platform UI
- 8080 - API Gateway
- 5432 - PostgreSQL
- 6379 - Redis
- 9000/9001 - MinIO
- 8025 - Mailpit

### Logs

```bash
# View all logs
docker compose logs -f

# View specific service
docker compose logs -f allternit-dev
docker compose logs -f postgres
docker compose logs -f redis

# View last 100 lines
docker compose logs --tail=100
```

## Troubleshooting

### Container Won't Start

```bash
# Rebuild the container
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Database Connection Issues

```bash
# Reset database
docker compose down -v  # Removes volumes
docker compose up -d postgres

# Check PostgreSQL logs
docker compose logs postgres
```

### Port Conflicts

If ports are already in use, modify `docker-compose.yml` or use `.env` to change port mappings:

```env
# .env
PLATFORM_UI_PORT=3001
API_GATEWAY_PORT=8082
```

### Permission Issues

```bash
# Fix ownership
sudo chown -R $(id -u):$(id -g) .

# Fix node_modules permissions
sudo chown -R $(id -u):$(id -g) 6-ui/allternit-platform/node_modules
```

### Hot Reload Not Working

- **Go (Air)**: Check `.air.toml` exists and `air` is running
- **Rust**: Ensure `cargo-watch` is installed: `cargo install cargo-watch`
- **Node.js**: Verify `pnpm dev` is running and watching files

## VS Code Extensions

The following extensions are automatically installed:

### Go
- golang.Go - Language support
- Pre-configured gopls, delve, golangci-lint

### Rust
- rust-lang.rust-analyzer - Language server
- serayuzgur.crates - Crate management
- tamasfe.even-better-toml - TOML support

### TypeScript/React
- esbenp.prettier-vscode - Code formatting
- dbaeumer.vscode-eslint - Linting
- bradlc.vscode-tailwindcss - Tailwind CSS
- dsznajder.es7-react-js-snippets - Code snippets

### Infrastructure
- ms-azuretools.vscode-docker - Docker management
- ms-kubernetes-tools.vscode-kubernetes-tools - K8s support
- redhat.vscode-yaml - YAML support

### General
- eamodio.gitlens - Git enhancement
- github.copilot - AI coding assistant
- streetsidesoftware.code-spell-checker - Spell checking

## Customization

### Adding Services

Edit `docker-compose.yml` to add new services:

```yaml
  my-service:
    image: my-service:latest
    ports:
      - "8080:8080"
    networks:
      - allternit-dev-network
```

### Custom Dockerfile

Modify `Dockerfile` to add custom tools:

```dockerfile
# Add custom tool
RUN apt-get update && apt-get install -y my-tool
```

### Task Runner

Create `Taskfile.yml` for common tasks:

```yaml
version: '3'

tasks:
  build:
    cmds:
      - echo "Building..."
      - cd 6-ui/allternit-platform && pnpm build
      - cd 1-kernel/allternit-kernel && go build
  
  test:
    cmds:
      - task: test:go
      - task: test:rust
      - task: test:ui
  
  test:go:
    dir: 1-kernel
    cmds:
      - go test ./...
```

Run with: `task build` or `task test`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `./scripts/test-all.sh`
5. Submit a pull request

## Resources

- [Allternit Documentation](https://docs.allternit.io)
- [Go Documentation](https://golang.org/doc)
- [Rust Documentation](https://doc.rust-lang.org)
- [Next.js Documentation](https://nextjs.org/docs)
- [Temporal Documentation](https://docs.temporal.io)
- [NATS Documentation](https://docs.nats.io)

## Support

- GitHub Issues: https://github.com/allternit-platform/allternit/issues
- Discord: https://discord.gg/allternit-platform
- Email: dev@allternit.io

## License

MIT License - see LICENSE file for details
