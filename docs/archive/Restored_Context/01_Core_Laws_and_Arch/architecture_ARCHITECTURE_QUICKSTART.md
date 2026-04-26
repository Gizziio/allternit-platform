# allternit Architecture Quickstart

Quick reference for developers working with the canonical enterprise architecture.

---

## Service Architecture (Simplified)

```
┌─────────────┐      ┌─────────────┐      ┌─────────────────────────────────────┐
│   UI        │─────▶│   Gateway   │─────▶│   API Service                       │
│  (5177)     │      │   (8013)    │      │   (3000)                            │
└─────────────┘      └─────────────┘      │  ┌─────────┐ ┌─────────┐ ┌────────┐ │
                                          │  │  Kernel │ │ Registry│ │ Memory │ │
                                          │  │ (3004)  │ │ (8080)  │ │ (3200) │ │
                                          │  └─────────┘ └─────────┘ └────────┘ │
                                          └─────────────────────────────────────┘
```

**Ports:**
- `5177` - Shell UI (Vite dev server)
- `8013` - Gateway (public entry point)
- `3000` - API Service (business logic)
- `3004` - Kernel (execution only - internal)
- `8080` - Registry (definitions - internal)
- `3200` - Memory (state - internal)
- `3003` - Policy (auth - internal)

---

## Quick Commands

### Start All Services
```bash
# Using the platform orchestrator (RECOMMENDED)
cargo run -p allternit-platform

# Or start individually:
cargo run -p kernel          # Port 3004
cargo run -p api             # Port 3000  
python3 services/gateway/src/main.py  # Port 8013
pnpm -C 6-apps/shell-ui dev  # Port 5177
```

### Check Service Status
```bash
# Gateway
curl http://localhost:8013/health

# API
curl http://localhost:3000/health

# Kernel (internal only - should NOT be accessible externally)
curl http://127.0.0.1:3004/health
```

### View Logs
```bash
# All services
tail -f .logs/*.log

# Specific service
tail -f .logs/api.log
tail -f .logs/gateway.log
```

---

## Making API Calls (From UI)

### The Right Way ✅
```typescript
import { api } from '@allternit/platform';

// Create a session
const session = await api.createSession('claude-code');

// Send a message
await api.sendMessage(session.id, 'Hello, world!');

// Connect to event stream
const eventSource = api.connectEventStream(session.id);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

### The Wrong Way ❌
```typescript
// DON'T DO THIS - Direct kernel call
fetch('http://127.0.0.1:3004/v1/sessions', {...});

// DON'T DO THIS - Bypassing gateway
fetch('http://127.0.0.1:3000/api/v1/sessions', {...});
```

---

## Service Responsibilities

### Gateway (8013)
**You should NOT:**
- Add business logic here
- Call database directly
- Execute tools

**You SHOULD:**
- Validate JWT tokens
- Rate limit requests
- Route to appropriate service
- Log requests

### API Service (3000)
**You should NOT:**
- Execute tools directly (call Kernel)
- Store state directly (call Memory)
- Check authZ directly (call Policy)

**You SHOULD:**
- Validate request schemas
- Orchestrate multi-service operations
- Handle business logic
- Format responses

### Kernel (3004) - INTERNAL ONLY
**You should NOT:**
- Expose to external clients
- Handle user authentication
- Store session state
- Execute workflows

**You SHOULD:**
- Execute tools
- Manage brain sessions
- Run sandboxes
- Spawn processes

---

## Environment Variables

### UI (.env.development)
```bash
# OLD - Don't use these anymore:
# VITE_ALLTERNIT_KERNEL_URL=http://127.0.0.1:3004

# NEW - Use these:
VITE_ALLTERNIT_GATEWAY_URL=http://127.0.0.1:8013
VITE_ALLTERNIT_API_VERSION=v1
```

### Gateway
```bash
PORT=8013
HOST=0.0.0.0
API_URL=http://127.0.0.1:3000
CORS_ORIGINS=http://localhost:5177,http://127.0.0.1:5177
```

### API Service
```bash
PORT=3000
KERNEL_URL=http://127.0.0.1:3004
REGISTRY_URL=http://127.0.0.1:8080
MEMORY_URL=http://127.0.0.1:3200
POLICY_URL=http://127.0.0.1:3003
```

---

## Common Tasks

### Add a New API Endpoint

1. **Add to API Service** (`6-apps/api/src/routes.rs`):
```rust
async fn my_new_handler() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

// In router:
.route("/api/v1/my-feature", get(my_new_handler))
```

2. **Add to UI Client** (`5-ui/allternit-platform/src/integration/api-client.ts`):
```typescript
async myNewMethod(): Promise<MyResponse> {
  return this.get('/api/v1/my-feature');
}
```

3. **Use in UI**:
```typescript
import { api } from '@allternit/platform';
const result = await api.myNewMethod();
```

### Add a New Service

1. Create service in appropriate layer (`services/my-service/`)
2. Add to `.allternit/services.json`
3. Add client in API service if needed
4. Update API routes to use new service

### Debug a Request

```bash
# 1. Check Gateway is receiving request
tail -f .logs/gateway.log

# 2. Check Gateway is forwarding to API
tail -f .logs/api.log

# 3. Check API is calling internal services
tail -f .logs/kernel.log
```

---

## Troubleshooting

### UI can't connect to backend
```bash
# Check Gateway is running
curl http://localhost:8013/health

# Check API is running
curl http://localhost:3000/health

# Check UI env var is set
echo $VITE_ALLTERNIT_GATEWAY_URL  # Should be http://localhost:8013
```

### Kernel returning 404
```bash
# Kernel routes changed to /internal/*
# OLD: GET /v1/sessions
# NEW: GET /internal/v1/sessions

# UI should NEVER call kernel directly!
# Use api-client.ts instead
```

### "Backend unavailable" error
```bash
# Check services are running
lsof -i :3000  # API
lsof -i :3004  # Kernel
lsof -i :8013  # Gateway

# Restart services
cargo run -p allternit-platform
```

---

## Testing

### Run Integration Tests
```bash
# Test full flow
cargo test -p api integration

# Test specific service
cargo test -p kernel
```

### Manual API Test
```bash
# Create session
curl -X POST http://localhost:8013/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"profile_id": "claude-code"}'

# List skills
curl http://localhost:8013/api/v1/skills
```

---

## Architecture Decision Records

### Why Gateway → API → Services?

1. **Security**: Single entry point for auth, rate limiting, SSL
2. **Scalability**: Each layer can scale independently
3. **Maintainability**: Clear separation of concerns
4. **Testability**: Each service can be tested in isolation
5. **Enterprise Standards**: Follows API Gateway pattern

### Why not UI → Kernel directly?

1. **Security Risk**: Kernel has powerful capabilities
2. **No AuthZ**: Kernel shouldn't handle user permissions
3. **Tight Coupling**: UI would depend on kernel internals
4. **No Audit Trail**: Can't log/validate requests
5. **Can't Scale**: No load balancing or caching

---

## Migration from Old Architecture

### If you have code using direct kernel calls:

```typescript
// OLD CODE
import { execFacade } from '@allternit/platform';
const session = await execFacade.startRun({ input: 'hello' });

// NEW CODE
import { api } from '@allternit/platform';
const session = await api.createSession('claude-code');
await api.sendMessage(session.id, 'hello');
const events = api.connectEventStream(session.id);
```

### If you have hardcoded URLs:

```typescript
// OLD CODE
fetch('http://127.0.0.1:3004/v1/skills');

// NEW CODE
import { api } from '@allternit/platform';
api.listSkills();
```

---

## Further Reading

- `ARCHITECTURE_ENTERPRISE.md` - Full architecture documentation
- `MIGRATION_PLAN.md` - Step-by-step migration guide
- `FILE_INVENTORY.md` - File status and actions
