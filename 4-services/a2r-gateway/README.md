# A2R Gateway v1

**Transport-agnostic API Gateway for A2R Platform**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/a2rchitech/gateway)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Overview

A2R Gateway is a **pluggable, transport-multiplexed gateway** that exposes a stable contract while supporting multiple transports:

- **stdio** - JSON-RPC 2.0 over stdin/stdout (MCP-compatible)
- **HTTP** - REST + SSE streaming (MCP-compatible streamable HTTP)

## Quick Start

### Installation

```bash
npm install
```

### Run in stdio Mode (Local/Embedded)

```bash
# Development
npm run dev

# Production
npm start
```

### Run in HTTP Mode (Web/Enterprise)

```bash
# Development
npm run dev:http

# Production
npm start:http

# Custom port
npm start:http -- --port 8080
```

### Verify Installation

```bash
# Verify stdio transport
node scripts/verify-stdio.js

# Verify HTTP transport
node scripts/verify-http.js
```

## Usage Examples

### stdio Transport

```bash
# Send health check request
echo '{"jsonrpc":"2.0","method":"health/check","params":{},"id":"1"}' | \
  npm start --silent

# Create session
echo '{"jsonrpc":"2.0","method":"session/create","params":{"profile_id":"p1"},"id":"2"}' | \
  npm start --silent
```

### HTTP Transport

```bash
# Health check
curl http://localhost:3210/health

# Create session
curl -X POST http://localhost:3210/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"profile_id":"p1","capsules":["browser"]}'

# SSE events
curl http://localhost:3210/v1/events
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      A2R Gateway Core                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Routing   │  │  Event Bus  │  │   Session   │             │
│  │   Engine    │  │   (SSE)     │  │    Store    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
           │                                    │
           ▼                                    ▼
┌─────────────────────┐            ┌─────────────────────┐
│  stdio Transport    │            │  HTTP Transport     │
│  (JSON-RPC 2.0)     │            │  (REST + Stream)    │
└─────────────────────┘            └─────────────────────┘
```

## API Reference

### System Operations

| Operation | stdio Method | HTTP Endpoint |
|-----------|--------------|---------------|
| Health Check | `health/check` | `GET /health` |
| Discovery | `discovery/get` | `GET /v1/discovery` |

### Session Operations

| Operation | stdio Method | HTTP Endpoint |
|-----------|--------------|---------------|
| Create Session | `session/create` | `POST /v1/sessions` |
| List Sessions | `session/list` | `GET /v1/sessions` |
| Get Session | `session/get` | `GET /v1/sessions/:id` |
| Update Session | `session/update` | `PATCH /v1/sessions/:id` |
| Delete Session | `session/delete` | `DELETE /v1/sessions/:id` |

### Chat Operations

| Operation | stdio Method | HTTP Endpoint |
|-----------|--------------|---------------|
| Chat Completions | `chat/completions` | `POST /v1/chat/completions` |

## Testing

```bash
# Run all tests
npm test

# Run stdio tests
npm run test:stdio

# Run HTTP tests
npm run test:http

# Run smoke tests
npm test -- tests/smoke.test.ts
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `A2R_API_URL` | API service URL | `http://127.0.0.1:3000` |
| `A2R_KERNEL_URL` | Kernel service URL | `http://127.0.0.1:3004` |
| `A2R_VOICE_URL` | Voice service URL | `http://127.0.0.1:8001` |
| `A2R_OPERATOR_URL` | Operator service URL | `http://127.0.0.1:3010` |
| `A2R_RAILS_URL` | Rails service URL | `http://127.0.0.1:3011` |
| `A2R_HTTP_PORT` | HTTP port | `3210` |
| `A2R_HTTP_HOST` | HTTP host | `0.0.0.0` |
| `A2R_CORS_ORIGINS` | CORS allowed origins | `http://localhost:*` |
| `LOG_LEVEL` | Logging level | `info` |

## Protocol Specification

See [spec/Networking.md](../spec/Networking.md) for the complete protocol v1 specification.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Version:** 1.0.0  
**Maintainer:** A2R Platform Team
