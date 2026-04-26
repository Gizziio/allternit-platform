# Allternit Services Registry

Complete registry of all services in the Allternit platform with their ports, dependencies, and status.

## Core Services

| Service | Port | Language | Purpose | Status |
|---------|------|----------|---------|--------|
| API | 3000 | TypeScript/Node | Main API gateway | Active |
| Kernel | 3004 | Rust | Core intent processing | Active |
| Intent Graph Kernel | 3005 | Rust | Persistent graph storage | In Dev |
| Capsule Runtime | 3006 | Rust | Sandboxed execution | In Dev |
| Presentation Kernel | 3007 | Rust | UI mediation | In Dev |
| Pattern Recognizer | 3008 | Rust | Pattern matching | In Dev |
| Memory | 3009 | Python | Vector/memory store | Active |
| **Allternit Operator** | **3010** | **Python** | **Automation/Browser/Vision** | **Active** |
| Router | 3108 | TypeScript | Request routing | Active |

## Allternit Operator (Port 3010)

Unified automation service providing browser control, desktop automation, vision, and parallel execution.

### Capabilities
- **Browser Automation** (browser-use): Full agent with LLM reasoning
- **Fast Browser** (playwright): Headless control
- **Computer Use** (computer-use): Vision-based desktop interactions
- **Desktop Control**: Native OS automation via Allternit Vision
- **Vision**: Screenshot analysis and action proposals
- **Parallel Execution**: Multi-variant code generation

### Endpoints
```
GET  /health                           # Service health
GET  /v1/browser/health               # Browser service health
POST /v1/browser/search               # Web search (DuckDuckGo)
POST /v1/browser/retrieve             # URL content extraction
POST /v1/browser/tasks                # Create browser task
POST /v1/browser/tasks/{id}/execute   # Execute browser task
POST /v1/vision/propose               # Get vision action proposals
POST /v1/sessions/{id}/desktop/execute # Desktop automation
POST /v1/parallel/runs                # Create parallel run
GET  /v1/parallel/runs/{id}/status    # Run status
```

### Environment Variables
```bash
ALLTERNIT_OPERATOR_PORT=3010
ALLTERNIT_OPERATOR_API_KEY=your-secret-key
OPENAI_API_KEY=sk-...  # For LLM capabilities
```

### Dependencies
- Python 3.10+
- browser-use 0.1.40
- playwright 1.49.0
- langchain-openai
- Chromium (via playwright install)

### UI Integration
- **Status Component**: `src/components/AllternitOperatorStatus.tsx`
- **Hook**: `src/lib/services/useAllternitOperatorStatus.ts`
- **Tools**: `browser-web-search.ts`, `browser-retrieve-url.ts`, `retrieve-url.ts`

## Gateway Configuration

The gateway routes requests to backend services. Configuration in:
- `/services/gateway/gateway-service/profiles/dev.json`

### Current Routing
```json
{
  "kernel": { "host": "127.0.0.1", "port": 3004 },
  "router": { "host": "127.0.0.1", "port": 3108 },
  "memory": { "host": "127.0.0.1", "port": 3009 }
}
```

**Note**: Allternit Operator is currently called directly from UI tools, not through the gateway.

## Docker Compose

Services defined in `/docker-compose.yml`:
- intent-graph-kernel (3005)
- capsule-runtime (3006)
- presentation-kernel (3007)
- pattern-recognizer (3008)
- api (3000)
- voice-service (8001)
- webvm-service (8002)

**Allternit Operator** needs to be added to docker-compose for containerized deployment.

## Port Allocation Summary

| Port Range | Purpose |
|------------|---------|
| 3000-3004 | Core API & Kernel |
| 3005-3009 | Rust Services (IGK, Capsule, Presentation, Pattern, Memory) |
| 3010-3019 | Python Services (Allternit Operator, etc.) |
| 3100-3199 | Gateway & Routing |
| 8000-8999 | Specialized Services (Voice, WebVM) |

## Health Check Commands

```bash
# Allternit Operator
curl http://localhost:3010/health

# Browser service
curl http://localhost:3010/v1/browser/health

# API
curl http://localhost:3000/health

# Kernel
curl http://localhost:3004/health
```

## Integration Status

| Component | Backend API | UI Status | Notes |
|-----------|-------------|-----------|-------|
| Allternit Operator | ✅ Port 3010 | ✅ Status indicator | Direct calls from UI tools |
| Browser Use | ✅ /v1/browser/* | ✅ Shows in status | DuckDuckGo search, URL retrieval |
| Desktop | ✅ /v1/sessions/*/desktop | ✅ Shows in status | Allternit Vision integration |
| Vision | ✅ /v1/vision/propose | ✅ Shows in status | Screenshot analysis |
| Parallel | ✅ /v1/parallel/* | ✅ Shows in status | Multi-variant execution |

## Migration Notes

- **Superconductor** (port 3310) has been deprecated and moved to `.deprecated-superconductor/`
- All functionality migrated to **Allternit Operator** (port 3010)
- UI tools updated to use `ALLTERNIT_OPERATOR_URL` environment variable
- Port changed from 3008→3009→3010 to avoid conflicts with Pattern Recognizer and Memory services
