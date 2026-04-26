# Allternit Architecture Migration Plan

This document provides step-by-step instructions to migrate from the current architecture to the canonical enterprise architecture.

---

## Pre-Migration Analysis

### Current State Problems

1. **UI directly calls Kernel** (port 3004) - bypasses API and Gateway
2. **Kernel has business logic** - skills, workflows, capsules (should be in API)
3. **Multiple overlapping services** - 3+ gateways, 3+ registries
4. **No clear API contract** - UI uses hardcoded URLs
5. **No service mesh** - Services call HTTP instead of gRPC

### Target State

```
UI → Gateway (8013) → API (3000) → [Kernel|Registry|Memory|Policy]
```

---

## Phase 1: Create API Client Layer (Week 1)

### Step 1.1: Create API Client in UI Platform

**File**: `5-ui/allternit-platform/src/integration/api-client.ts` (NEW)

```typescript
/**
 * Allternit API Client
 * 
 * This is the ONLY way the UI should communicate with the backend.
 * All requests go through the Gateway (port 8013).
 */

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:8013';

function gatewayUrl(): string {
  return (window as any).__ALLTERNIT_GATEWAY_URL__ 
    || import.meta.env.VITE_ALLTERNIT_GATEWAY_URL 
    || DEFAULT_GATEWAY_URL;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface Session {
  id: string;
  profile_id: string;
  status: 'active' | 'paused' | 'completed';
  created_at: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
}

export class AllternitApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message);
    this.name = 'AllternitApiError';
  }
}

class AllternitApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = gatewayUrl();
    // Load token from storage
    this.token = localStorage.getItem('allternit_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('allternit_token', token);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      ...(options?.headers as Record<string, string> || {}),
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AllternitApiError(
        errorData.message || `HTTP ${response.status}`,
        response.status,
        errorData
      );
    }

    // Handle empty responses
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ==================== SESSIONS ====================

  async createSession(profileId: string): Promise<Session> {
    return this.request('POST', '/api/v1/sessions', { profile_id: profileId });
  }

  async listSessions(): Promise<{ sessions: Session[] }> {
    return this.request('GET', '/api/v1/sessions');
  }

  async getSession(sessionId: string): Promise<Session> {
    return this.request('GET', `/api/v1/sessions/${sessionId}`);
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    return this.request('POST', `/api/v1/sessions/${sessionId}/chat`, { message });
  }

  connectEventStream(sessionId: string): EventSource {
    const url = `${this.baseUrl}/api/v1/sessions/${sessionId}/events`;
    return new EventSource(url);
  }

  // ==================== SKILLS ====================

  async listSkills(): Promise<{ skills: Skill[] }> {
    return this.request('GET', '/api/v1/skills');
  }

  async getSkill(skillId: string): Promise<Skill> {
    return this.request('GET', `/api/v1/skills/${skillId}`);
  }

  async executeSkill<T = any>(skillId: string, input: unknown): Promise<T> {
    return this.request('POST', `/api/v1/skills/${skillId}/exec`, { input });
  }

  // ==================== WORKFLOWS ====================

  async listWorkflows(): Promise<{ workflows: any[] }> {
    return this.request('GET', '/api/v1/workflows');
  }

  async createWorkflow(definition: unknown): Promise<{ id: string }> {
    return this.request('POST', '/api/v1/workflows', { definition });
  }

  async runWorkflow(workflowId: string, input?: unknown): Promise<{ run_id: string }> {
    return this.request('POST', `/api/v1/workflows/${workflowId}/run`, { input });
  }

  // ==================== CAPSULES ====================

  async listCapsules(): Promise<{ capsules: any[] }> {
    return this.request('GET', '/api/v1/capsules');
  }

  async createCapsule(definition: unknown): Promise<{ id: string }> {
    return this.request('POST', '/api/v1/capsules', { definition });
  }

  async executeCapsule(capsuleId: string, input?: unknown): Promise<unknown> {
    return this.request('POST', `/api/v1/capsules/${capsuleId}/execute`, { input });
  }

  // ==================== HEALTH ====================

  async health(): Promise<{ status: string }> {
    return this.request('GET', '/health');
  }
}

// Singleton instance
export const api = new AllternitApiClient();

// React hook
import { useState, useEffect, useCallback } from 'react';

export function useApi() {
  return api;
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const { sessions } = await api.listSessions();
      setSessions(sessions);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const createSession = useCallback(async (profileId: string) => {
    const session = await api.createSession(profileId);
    setSessions(prev => [...prev, session]);
    return session;
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, error, createSession, refetch: fetchSessions };
}
```

### Step 1.2: Update Environment Variables

**File**: `6-apps/shell-ui/.env.development`

```bash
# OLD - Remove these:
# VITE_ALLTERNIT_KERNEL_URL=http://127.0.0.1:3004

# NEW - Use these:
VITE_ALLTERNIT_GATEWAY_URL=http://127.0.0.1:8013
VITE_ALLTERNIT_API_VERSION=v1
```

**File**: `6-apps/shell-ui/vite.config.ts`

```typescript
export default defineConfig({
  // ... existing config
  define: {
    // Remove or deprecate:
    // '__ALLTERNIT_KERNEL_URL__': JSON.stringify(process.env.VITE_ALLTERNIT_KERNEL_URL),
    
    // Add:
    '__ALLTERNIT_GATEWAY_URL__': JSON.stringify(process.env.VITE_ALLTERNIT_GATEWAY_URL || 'http://127.0.0.1:8013'),
  },
});
```

---

## Phase 2: Migrate UI Components (Week 1-2)

### Step 2.1: Update Shell App

**File**: `5-ui/allternit-platform/src/shell/ShellApp.tsx`

Replace direct kernel calls with API client:

```typescript
// OLD - Remove this:
// import { execFacade } from '../integration/execution/exec.facade';

// NEW - Use this:
import { api, useSessions } from '../integration/api-client';
```

### Step 2.2: Update Runner Components

**File**: `5-ui/allternit-platform/src/runner/runner.store.ts`

```typescript
// OLD:
import { execFacade } from '../integration/execution/exec.facade';

// NEW:
import { api } from '../integration/api-client';

// OLD usage:
const runId = await execFacade.startRun({ input: prompt, modelId });

// NEW usage:
const session = await api.createSession(modelId);
await api.sendMessage(session.id, prompt);
const eventSource = api.connectEventStream(session.id);
```

### Step 2.3: Deprecate Old Integration Files

Mark these files as deprecated:

**File**: `5-ui/allternit-platform/src/integration/execution/exec.facade.ts`

```typescript
/**
 * @deprecated Use api-client.ts instead. This file will be removed in v2.0.
 * The UI should not call the kernel directly. All requests must go through the Gateway.
 */
```

**File**: `5-ui/allternit-platform/src/integration/kernel/index.ts`

```typescript
/**
 * @deprecated Use api-client.ts instead. Kernel should only be accessed via API service.
 */
```

**File**: `6-apps/shell-ui/src/shims/runtime.ts`

```typescript
/**
 * @deprecated Runtime shim is no longer needed. Use api-client.ts instead.
 */
```

---

## Phase 3: Update Services.json (Week 2)

### Step 3.1: Simplify Service Definitions

**File**: `.allternit/services.json`

```json
{
  "version": "2026-02-06-enterprise",
  "hosts": {
    "internal": "127.0.0.1",
    "public": "0.0.0.0"
  },
  "ports": {
    "gateway": 8013,
    "api": 3000,
    "registry": 8080,
    "kernel": 3004,
    "memory": 3200,
    "policy": 3003,
    "shell_ui": 5177
  },
  "services": [
    {
      "id": "policy",
      "label": "Policy Service",
      "order": 10,
      "command": "cargo",
      "args": ["run", "--manifest-path", "domains/governance/rust/allternit-governor/Cargo.toml"],
      "env": { 
        "HOST": "${hosts.internal}",
        "PORT": "${ports.policy}" 
      }
    },
    {
      "id": "memory",
      "label": "Memory Service",
      "order": 20,
      "command": "cargo",
      "args": ["run", "--manifest-path", "services/memory/Cargo.toml"],
      "env": { 
        "HOST": "${hosts.internal}",
        "PORT": "${ports.memory}" 
      }
    },
    {
      "id": "registry",
      "label": "Registry Service",
      "order": 30,
      "command": "cargo",
      "args": ["run", "--manifest-path", "services/registry/Cargo.toml"],
      "env": { 
        "HOST": "${hosts.internal}",
        "PORT": "${ports.registry}" 
      }
    },
    {
      "id": "kernel",
      "label": "Kernel (Execution Only)",
      "order": 40,
      "command": "cargo",
      "args": ["run", "--manifest-path", "domains/kernel/allternit-engine/Cargo.toml"],
      "env": { 
        "HOST": "127.0.0.1",
        "PORT": "${ports.kernel}",
        "BIND_LOCAL_ONLY": "true"
      }
    },
    {
      "id": "api",
      "label": "Public API",
      "order": 50,
      "command": "cargo",
      "args": ["run", "--manifest-path", "6-apps/api/Cargo.toml"],
      "env": { 
        "HOST": "${hosts.internal}",
        "PORT": "${ports.api}",
        "KERNEL_URL": "http://127.0.0.1:${ports.kernel}",
        "REGISTRY_URL": "http://${hosts.internal}:${ports.registry}",
        "MEMORY_URL": "http://${hosts.internal}:${ports.memory}",
        "POLICY_URL": "http://${hosts.internal}:${ports.policy}"
      }
    },
    {
      "id": "gateway",
      "label": "API Gateway",
      "order": 60,
      "command": "python3",
      "args": ["services/gateway/src/main.py"],
      "env": { 
        "HOST": "${hosts.public}",
        "PORT": "${ports.gateway}",
        "API_URL": "http://${hosts.internal}:${ports.api}",
        "CORS_ORIGINS": "http://localhost:5177,http://127.0.0.1:5177"
      }
    },
    {
      "id": "shell-ui",
      "label": "Shell UI",
      "order": 70,
      "command": "pnpm",
      "args": ["-C", "6-apps/shell-ui", "dev"],
      "env": { 
        "VITE_ALLTERNIT_GATEWAY_URL": "http://${hosts.internal}:${ports.gateway}"
      }
    }
  ]
}
```

**Note**: Removed duplicate services (multiple gateways, multiple registries).

---

## Phase 4: Consolidate Gateway (Week 2-3)

### Step 4.1: Create Unified Gateway

**File**: `services/gateway/src/main.py` (NEW - simplified)

```python
#!/usr/bin/env python3
"""
Allternit API Gateway (Enterprise)

Single entry point for all external traffic.
Responsibilities:
- Authentication/Authorization
- Rate limiting
- Request routing
- CORS
- Request logging
"""

import os
import json
import logging
from typing import Optional
from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gateway")

# Configuration from environment
GATEWAY_PORT = int(os.environ.get("PORT", "8013"))
API_URL = os.environ.get("API_URL", "http://127.0.0.1:3000")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

app = FastAPI(title="Allternit Gateway", version="2.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HTTP client for proxying
http_client = httpx.AsyncClient(timeout=60.0)


class AuthenticationMiddleware:
    """Validate JWT tokens and add user context."""
    
    async def __call__(self, request: Request, call_next):
        # Skip auth for health checks
        if request.url.path == "/health":
            return await call_next(request)
        
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            # Allow anonymous for now, but mark as such
            request.state.user = None
            request.state.tenant_id = "anonymous"
        else:
            # TODO: Validate JWT
            request.state.user = {"id": "user-123"}  # Placeholder
            request.state.tenant_id = "tenant-123"
        
        return await call_next(request)


app.middleware("http")(AuthenticationMiddleware())


@app.get("/health")
async def health():
    """Gateway health check."""
    return {"status": "ok", "service": "gateway"}


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy(request: Request, path: str):
    """
    Proxy all requests to the API service.
    
    This is the main routing logic. In the future, this could:
    - Route /api/* to API service
    - Route /ws/* to WebSocket service
    - Route /webhook/* to Webhook service
    """
    
    # Build target URL
    target_url = f"{API_URL}/{path}"
    if request.query_params:
        target_url += f"?{request.query_params}"
    
    # Forward headers
    headers = dict(request.headers)
    headers.pop("host", None)  # Let httpx set the correct host
    
    # Add context headers
    if hasattr(request.state, "user") and request.state.user:
        headers["x-user-id"] = request.state.user.get("id", "anonymous")
    if hasattr(request.state, "tenant_id"):
        headers["x-tenant-id"] = request.state.tenant_id
    
    # Get request body
    body = await request.body()
    
    try:
        # Make request to backend
        response = await http_client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body,
        )
        
        # Handle streaming responses (SSE)
        if "text/event-stream" in response.headers.get("content-type", ""):
            return StreamingResponse(
                response.aiter_text(),
                status_code=response.status_code,
                headers=dict(response.headers),
            )
        
        # Return response
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers),
        )
        
    except httpx.ConnectError as e:
        logger.error(f"Backend connection error: {e}")
        raise HTTPException(status_code=503, detail="Backend service unavailable")
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        raise HTTPException(status_code=500, detail="Internal gateway error")


@app.on_event("shutdown")
async def shutdown():
    await http_client.aclose()


if __name__ == "__main__":
    logger.info(f"Starting Gateway on port {GATEWAY_PORT}")
    logger.info(f"Proxying to API at {API_URL}")
    uvicorn.run(app, host="0.0.0.0", port=GATEWAY_PORT)
```

### Step 4.2: Deprecate Old Gateways

Add deprecation notices to:
- `services/gateway/gateway-browser/`
- `services/gateway/gateway-stdio/`
- `services/gateway/a2a-gateway/`
- `services/gateway/agui-gateway/`
- `services/gateway/python-gateway/`

---

## Phase 5: API Service Integration (Week 3-4)

### Step 5.1: Add Service Clients to API

**File**: `6-apps/api/src/clients.rs` (NEW)

```rust
use std::sync::Arc;
use reqwest::Client;

/// Client for communicating with internal services
pub struct ServiceClients {
    pub kernel: KernelClient,
    pub registry: RegistryClient,
    pub memory: MemoryClient,
    pub policy: PolicyClient,
}

pub struct KernelClient {
    client: Client,
    base_url: String,
}

impl KernelClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.to_string(),
        }
    }
    
    pub async fn create_session(&self, profile_id: &str) -> anyhow::Result<Session> {
        let url = format!("{}/internal/v1/sessions", self.base_url);
        let response = self.client
            .post(&url)
            .json(&json!({ "profile_id": profile_id }))
            .send()
            .await?;
        
        Ok(response.json().await?)
    }
    
    // ... other methods
}

// Similar implementations for RegistryClient, MemoryClient, PolicyClient
```

### Step 5.2: Update API Routes to Use Clients

**File**: `6-apps/api/src/routes.rs`

Update handlers to call internal services instead of duplicating logic.

---

## Phase 6: Kernel Cleanup (Week 4)

### Step 6.1: Restrict Kernel to Internal Only

**File**: `domains/kernel/allternit-engine/src/main.rs` or `services/orchestration/kernel-service/src/main.rs`

```rust
#[tokio::main]
async fn main() {
    // ...
    
    let app = Router::new()
        // Internal routes only - no /api/*
        .route("/internal/v1/sessions", post(create_session))
        .route("/internal/v1/sessions/:id", get(get_session))
        .route("/internal/v1/sessions/:id/input", post(send_input))
        .route("/internal/v1/sessions/:id/events", get(stream_events))
        .route("/internal/v1/tools/:id/exec", post(execute_tool))
        // Health check (for internal monitoring)
        .route("/health", get(health));
    
    // Bind to localhost only - external traffic must go through API
    let addr = "127.0.0.1:3004".parse().unwrap();
    println!("Kernel binding to {} (internal only)", addr);
    
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
```

### Step 6.2: Remove Business Logic from Kernel

Move these routes from Kernel to API:
- `/v1/skills/*` → API
- `/v1/workflows/*` → API  
- `/v1/capsules/*` → API
- `/v1/agents/*` → API

Kernel keeps only:
- Session management
- Tool execution
- Sandbox management

---

## Phase 7: Testing & Validation (Week 5)

### Step 7.1: Integration Tests

**File**: `tests/integration/api_flow_test.rs`

```rust
#[tokio::test]
async fn test_full_flow() {
    // 1. Start services
    // 2. Create session via Gateway
    // 3. Send message
    // 4. Verify response
    // 5. Verify no direct kernel access needed
}
```

### Step 7.2: Architecture Validation Script

**File**: `scripts/validate-architecture.sh`

```bash
#!/bin/bash

# Verify UI doesn't call kernel directly
echo "Checking for direct kernel calls in UI..."
if grep -r "127.0.0.1:3004\|localhost:3004" 5-ui/ 6-apps/shell-ui/; then
    echo "ERROR: UI has direct kernel calls!"
    exit 1
fi

# Verify Gateway is the only public-facing service
echo "Checking service bindings..."
lsof -i :8013  # Gateway should be on all interfaces
lsof -i :3004  # Kernel should NOT be accessible externally
```

---

## Migration Timeline

| Week | Phase | Deliverable |
|------|-------|-------------|
| 1 | Phase 1 & 2 | API client, UI migration |
| 2 | Phase 3 & 4 | services.json, Gateway consolidation |
| 3 | Phase 5 | API service integration |
| 4 | Phase 6 | Kernel cleanup |
| 5 | Phase 7 | Testing, documentation |

---

## Rollback Plan

If issues arise:

1. **Keep old services running** during migration
2. **Feature flags** for new API client
3. **Revert strategy**: Switch back to direct kernel calls via environment variable

```typescript
// In api-client.ts
const USE_NEW_API = import.meta.env.VITE_USE_NEW_API !== 'false';

if (!USE_NEW_API) {
  // Fall back to old direct kernel calls
  return legacyKernelCall(...);
}
```

---

## Success Criteria

- [ ] UI only calls Gateway (port 8013)
- [ ] Kernel not accessible externally (localhost only)
- [ ] All business logic in API service
- [ ] Single Gateway service (others removed)
- [ ] Single Registry service (others removed)
- [ ] Integration tests pass
- [ ] Documentation updated
