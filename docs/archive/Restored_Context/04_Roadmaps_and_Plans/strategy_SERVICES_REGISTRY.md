# allternit Services Registry

Complete registry of all services in the allternit platform with ports, dependencies, and startup commands.

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Shell UI     │  │ Allternit Platform │  │ A2UI         │  │ CLI          │    │
│  │ Port 5177    │  │ Port 3000    │  │ Port 5175    │  │ -            │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
└─────────┼────────────────┼────────────────┼────────────────┼──────────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GATEWAY LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Allternit Gateway                                                          │   │
│  │ Port 8013                                                            │   │
│  │ • Authentication (JWT/API Keys)                                      │   │
│  │ • Rate Limiting (120 req/min)                                        │   │
│  │ • CORS Handling                                                      │   │
│  │ • Request Logging                                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SERVICE LAYER                                     │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │ API Service        │  │ Kernel Service     │  │ Allternit Operator       │    │
│  │ Port 3000          │  │ Port 3004          │  │ Port 3008          │    │
│  │ (Rust/Axum)        │  │ (Rust)             │  │ (Python/FastAPI)   │    │
│  │                    │  │                    │  │ • Browser-Use      │    │
│  │ • Business Logic   │  │ • Tool Execution   │  │ • Computer-Use     │    │
│  │ • Orchestration    │  │ • Brain Sessions   │  │ • Desktop-Use      │    │
│  │ • Validation       │  │ • Sandboxes        │  │ • Parallel Exec    │    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │ Registry Service   │  │ Memory Service     │  │ Voice Service      │    │
│  │ Port 8080          │  │ Port 3200          │  │ Port 3006          │    │
│  │                    │  │                    │  │                    │    │
│  │ • Agent Registry   │  │ • Context Memory   │  │ • TTS/STT          │    │
│  │ • Skill Registry   │  │ • Persistence      │  │ • Voice Cloning    │    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │ Browser Gateway    │  │ Browser Runtime    │  │ Capsule Runtime    │    │
│  │ Port 3108          │  │ Port 8003          │  │ Port 3007          │    │
│  │ (Rust/Axum)        │  │ (TypeScript)       │  │ (TypeScript)       │    │
│  │                    │  │                    │  │                    │    │
│  │ • WebSocket        │  │ • Playwright       │  │ • Capsule Mgmt     │    │
│  │ • Browser Events   │  │ • Screenshot       │  │ • Isolation        │    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │ SQLite (Dev)       │  │ PostgreSQL (Prod)  │  │ Redis              │    │
│  │ File-based         │  │ Primary Database   │  │ Caching/Queues     │    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Service Details

### 1. Shell UI
- **Port**: 5177
- **Type**: Vite + React
- **Purpose**: Main user interface
- **Start**: `cd 6-apps/shell-ui && pnpm dev`
- **Dependencies**: Gateway (8013)

### 2. Allternit Platform
- **Port**: 3000
- **Type**: Next.js + TypeScript
- **Purpose**: Chat platform with AI elements
- **Start**: `cd 5-ui/allternit-platform && pnpm dev`
- **Dependencies**: Gateway (8013), Database

### 3. Allternit Gateway
- **Port**: 8013
- **Type**: Python/FastAPI
- **Purpose**: API gateway with auth/rate limiting
- **Start**: `python -m gateway.main`
- **Dependencies**: All backend services

### 4. API Service
- **Port**: 3000
- **Type**: Rust/Axum
- **Purpose**: Business logic, orchestration
- **Start**: `cargo run -p allternit-api`
- **Dependencies**: Kernel (3004), Database

### 5. Kernel Service
- **Port**: 3004
- **Type**: Rust
- **Purpose**: Tool execution, brain sessions
- **Start**: `cargo run -p kernel-service`
- **Dependencies**: Registry (8080), Memory (3200)

### 6. Allternit Operator ⭐
- **Port**: 3008
- **Type**: Python/FastAPI
- **Purpose**: Browser/Computer/Desktop automation + Parallel execution
- **Start**: `cd services/allternit-operator && python -m uvicorn src.main:app --port 3008`
- **Dependencies**: None (self-contained)
- **Capabilities**:
  - Browser-Use (Chromium + CDP)
  - Computer-Use (Vision)
  - Desktop-Use (UI-TARS)
  - Parallel Execution

### 7. Registry Service
- **Port**: 8080
- **Type**: Rust
- **Purpose**: Agent/skill registry
- **Start**: `cargo run -p registry-service`
- **Dependencies**: None

### 8. Memory Service
- **Port**: 3200
- **Type**: Rust
- **Purpose**: Context persistence
- **Start**: `cargo run -p memory-service`
- **Dependencies**: Redis

### 9. Voice Service
- **Port**: 3006
- **Type**: Python/FastAPI
- **Purpose**: TTS/STT, voice cloning
- **Start**: `cd services/ai/voice-service && python src/main.py`
- **Dependencies**: None

### 10. Browser Gateway
- **Port**: 3108
- **Type**: Rust/Axum
- **Purpose**: Browser WebSocket gateway
- **Start**: `cargo run -p gateway-browser`
- **Dependencies**: Browser Runtime (8003)

### 11. Browser Runtime
- **Port**: 8003
- **Type**: TypeScript/Node
- **Purpose**: Playwright browser control
- **Start**: `cd services/runtime/browser-runtime && pnpm dev`
- **Dependencies**: None

### 12. Capsule Runtime
- **Port**: 3007
- **Type**: TypeScript/Node
- **Purpose**: Capsule isolation/management
- **Start**: `cd services/runtime/capsule-runtime && pnpm dev`
- **Dependencies**: None

## Port Allocation

| Port | Service | Status |
|------|---------|--------|
| 3000 | API Service / Allternit Platform | Active |
| 3004 | Kernel Service | Active |
| 3006 | Voice Service | Active |
| 3007 | Capsule Runtime | Active |
| 3008 | Allternit Operator ⭐ | Active |
| 3200 | Memory Service | Active |
| 5175 | A2UI | Active |
| 5177 | Shell UI | Active |
| 8013 | Allternit Gateway | Active |
| 8080 | Registry Service | Active |
| 3108 | Browser Gateway | Active |
| 8003 | Browser Runtime | Active |

## Environment Variables

Create a `.env` file in project root:

```bash
# Core Services
ALLTERNIT_GATEWAY_URL=http://127.0.0.1:8013
ALLTERNIT_API_URL=http://127.0.0.1:3000
ALLTERNIT_KERNEL_URL=http://127.0.0.1:3004
ALLTERNIT_OPERATOR_URL=http://127.0.0.1:3008

# Allternit Operator
ALLTERNIT_OPERATOR_API_KEY=allternit-operator-secret
ALLTERNIT_OPERATOR_PORT=3008

# AI Keys
OPENAI_API_KEY=sk-...
ALLTERNIT_VISION_INFERENCE_KEY=sk-...
ALLTERNIT_VISION_INFERENCE_BASE=https://api.openrouter.ai/v1

# Database
DATABASE_URL=sqlite://./data/dev.db
# DATABASE_URL=postgresql://user:pass@localhost/allternit

# Feature Flags
VITE_ENABLE_DEBUG_LOGS=true
```

## Startup Script

Create `start-services.sh`:

```bash
#!/bin/bash

echo "Starting allternit Services..."

# Start backend services
cd /Users/macbook/Desktop/allternit-workspace/allternit

echo "Starting Registry (8080)..."
cargo run -p registry-service &

echo "Starting Memory (3200)..."
cargo run -p memory-service &

echo "Starting Kernel (3004)..."
cargo run -p kernel-service &

echo "Starting Allternit Operator (3008)..."
cd services/allternit-operator
python -m uvicorn src.main:app --port 3008 &
cd ../..

echo "Starting API (3000)..."
cargo run -p allternit-api &

echo "Starting Gateway (8013)..."
python -m gateway.main &

echo "Starting Browser Runtime (8003)..."
cd services/runtime/browser-runtime
pnpm dev &
cd ../../..

echo "Starting Shell UI (5177)..."
cd 6-apps/shell-ui
pnpm dev &

echo "All services started!"
echo ""
echo "Services:"
echo "  Shell UI:      http://localhost:5177"
echo "  Allternit Platform:  http://localhost:3000"
echo "  Gateway:       http://localhost:8013"
echo "  Allternit Operator:  http://localhost:3008"
echo "  API:           http://localhost:3000"
echo "  Kernel:        http://localhost:3004"
```

## Health Check Commands

```bash
# Check all services
for port in 3000 3004 3008 3200 8013 8080; do
  echo -n "Port $port: "
  curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health || echo "DOWN"
done
```

## Dependencies Graph

```
Shell UI
  └── Gateway (8013)
      ├── API (3000)
      │   ├── Kernel (3004)
      │   │   ├── Registry (8080)
      │   │   └── Memory (3200)
      │   └── Database
      └── Allternit Operator (3008)
          └── (Self-contained)
```

## Migration Notes

- **Superconductor** → Merged into Allternit Operator (Port 3008)
- **No external API keys** required for browser search/retrieval
- **Browser-Use** now runs locally via Allternit Operator
