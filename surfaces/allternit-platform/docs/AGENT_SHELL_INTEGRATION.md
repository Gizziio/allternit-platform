# Agent Shell Integration Guide

This document explains how the Shell UI integrates with the Agent Shell's server mode to provide full workspace functionality.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHELL UI (Browser)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Workspace   │  │    Brain     │  │    Policy    │          │
│  │   Browser    │  │    View      │  │  Dashboard   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Agent Workspace API Layer                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │    WASM     │  │    HTTP     │  │   Fallback      │   │  │
│  │  │   Client    │  │   Client    │  │   (Mock Data)   │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP API
                              │ (WebSocket for real-time)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 AGENT SHELL (Tauri Desktop)                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   CLI Sidecar Process                     │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              HTTP Server (opencode serve)            │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │  │  │
│  │  │  │ Workspace│ │  Brain   │ │  Policy  │ │ Skills  │ │  │  │
│  │  │  │   API    │ │   API    │ │   API    │ │   API   │ │  │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └─────────┘ │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ File System / Kernel
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Allternit AGENT WORKSPACE                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  BRAIN  │ │ MEMORY  │ │IDENTITY │ │  POLICY │ │  SKILL  │   │
│  │   .md   │ │   .md   │ │   .md   │ │   .md   │ │   .md   │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## How Server Mode Works

### 1. Tauri Spawns CLI Sidecar

When the Agent Shell desktop app starts:

```rust
// In agent-shell/src-tauri/src/server.rs
pub fn spawn_local_server(
    app: AppHandle,
    hostname: String,
    port: u32,
    password: String,
) -> (CommandChild, HealthCheck) {
    // Spawns: opencode serve --hostname {hostname} --port {port}
    let (child, exit) = cli::serve(&app, &hostname, port, &password);
    // Health check loop ensures server is ready
}
```

### 2. Server Health Check

The Shell UI can check if the server is running:

```typescript
// Check if local server is available
async function checkServerHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/global/health`);
    return response.ok;
  } catch {
    return false;
  }
}
```

### 3. API Authentication

All API requests use HTTP Basic Auth:

```typescript
const username = 'opencode';
const password = 'generated-password';

const headers = {
  'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
  'Content-Type': 'application/json',
};
```

## Integration Patterns

### Pattern 1: Auto-Discovery

The Shell UI automatically discovers the server:

```typescript
// 6-ui/allternit-platform/src/agent-workspace/discovery.ts

export async function discoverServer(): Promise<string | null> {
  // 1. Check if running in Tauri (desktop app)
  if (window.__TAURI__) {
    // Tauri provides the server URL via command
    const url = await invoke('get_saved_server_url');
    if (url && await checkHealth(url)) {
      return url;
    }
  }
  
  // 2. Check common local ports
  const ports = [8080, 8081, 3000, 3001];
  for (const port of ports) {
    const url = `http://localhost:${port}`;
    if (await checkHealth(url)) {
      return url;
    }
  }
  
  // 3. Fall back to WASM mode
  return null;
}
```

### Pattern 2: Backend Selection

The API layer automatically selects the best backend:

```typescript
// 6-ui/allternit-platform/src/agent-workspace/index.ts

export async function createWorkspace(
  path: string,
  options: { preferHttp?: boolean } = {}
): Promise<WorkspaceApi> {
  // Try HTTP first if preferred or available
  if (options.preferHttp !== false) {
    const serverUrl = await discoverServer();
    if (serverUrl) {
      return createHttpWorkspace(serverUrl, path);
    }
  }
  
  // Fall back to WASM
  return createWasmWorkspace(path);
}
```

### Pattern 3: Real-Time Updates

For live updates, use WebSocket connection:

```typescript
// 6-ui/allternit-platform/src/agent-workspace/websocket.ts

export class WorkspaceWebSocket {
  private ws: WebSocket;
  
  constructor(url: string, password: string) {
    this.ws = new WebSocket(`ws://${url}/ws`);
    
    this.ws.onopen = () => {
      // Authenticate
      this.ws.send(JSON.stringify({
        type: 'auth',
        token: btoa(`opencode:${password}`)
      }));
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
  }
  
  handleMessage(message: any) {
    switch (message.type) {
      case 'task_update':
        // Update task in BrainView
        break;
      case 'memory_append':
        // Append to memory log
        break;
      case 'policy_change':
        // Refresh policy dashboard
        break;
    }
  }
}
```

## API Endpoints

The CLI server exposes these endpoints for workspace operations:

### Workspace Management

```
GET    /workspace/info           # Get workspace metadata
POST   /workspace/boot           # Boot the workspace
POST   /workspace/sync           # Sync with kernel
```

### Brain (Task Graph)

```
GET    /brain/tasks              # List all tasks
POST   /brain/tasks              # Create new task
GET    /brain/tasks/:id          # Get task details
PUT    /brain/tasks/:id          # Update task
DELETE /brain/tasks/:id          # Delete task
GET    /brain/graph              # Get full task graph
```

### Memory

```
GET    /memory/entries           # List memory entries
POST   /memory/entries           # Create entry
GET    /memory/entries/:id       # Get entry
PUT    /memory/entries/:id       # Update entry
GET    /memory/search?q=query    # Search memories
```

### Policy

```
GET    /policy/rules             # List policy rules
POST   /policy/rules             # Add rule
PUT    /policy/rules/:id         # Update rule
DELETE /policy/rules/:id         # Remove rule
POST   /policy/check             # Check policy for action
```

### Skills

```
GET    /skills                   # List installed skills
GET    /skills/available         # List available skills
POST   /skills/:id/install       # Install skill
DELETE /skills/:id               # Uninstall skill
```

### Identity

```
GET    /identity                 # Get identity config
PUT    /identity                 # Update identity
GET    /identity/soul            # Get soul config
PUT    /identity/soul            # Update soul
```

## Implementation Example

### React Hook with Server Support

```typescript
// useWorkspace.ts
import { useState, useEffect } from 'react';
import { createWorkspace, Backend } from '../agent-workspace';

export function useWorkspace(path: string) {
  const [api, setApi] = useState<WorkspaceApi | null>(null);
  const [backend, setBackend] = useState<Backend>(Backend.WASM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        
        // Try to create workspace with auto-discovery
        const workspace = await createWorkspace(path, {
          preferHttp: true
        });
        
        setApi(workspace);
        setBackend(workspace.backend);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [path]);

  return { api, backend, loading, error };
}
```

### Component Usage

```tsx
// WorkspacePage.tsx
import { useWorkspace } from './hooks/useWorkspace';
import { WorkspaceBrowser } from './components/workspace';

export function WorkspacePage() {
  const { api, backend, loading, error } = useWorkspace('/path/to/workspace');

  if (loading) return <Loading />;
  if (error) return <Error message={error.message} />;
  if (!api) return <NoWorkspace />;

  return (
    <div>
      <ConnectionBadge backend={backend} />
      <WorkspaceBrowser api={api} />
    </div>
  );
}
```

## Security Considerations

### 1. Localhost Only

The CLI server binds to localhost by default, preventing external access:

```rust
// CLI server configuration
let hostname = "127.0.0.1";  // Only accept local connections
let port = 8080;
```

### 2. Authentication

All requests require authentication:

```rust
// In CLI server middleware
async fn auth_middleware(req: Request) -> Result<Response> {
    let auth = req.headers()
        .get("Authorization")
        .ok_or(Error::Unauthorized)?;
    
    verify_basic_auth(auth, &expected_password)?;
    
    next(req).await
}
```

### 3. Policy Enforcement

Even with server access, all operations are validated against policy:

```rust
// Before executing any tool
let decision = policy_engine.check_tool(&tool_id, &args)?;
match decision {
    PolicyDecision::Allow => execute_tool(),
    PolicyDecision::RequireApproval(_) => request_approval(),
    PolicyDecision::Deny(_) => Err(Error::Denied),
}
```

## Troubleshooting

### Server Not Found

1. Check if CLI is installed: `opencode --version`
2. Try manual start: `opencode serve --port 8080`
3. Check firewall settings (should allow localhost)

### Authentication Failed

1. Clear stored credentials in Tauri store
2. Restart the desktop app to generate new password
3. Check `~/.config/opencode/config.json` for server settings

### CORS Issues

The CLI server includes CORS headers for localhost:

```rust
// In CLI server
app.layer(CorsLayer::new()
    .allow_origin(["http://localhost:*".parse().unwrap()])
    .allow_methods(Any)
    .allow_headers(Any)
);
```

## Future Enhancements

### 1. Remote Server Support

Allow connecting to remote agents:

```typescript
const api = await createWorkspace('ssh://remote-host/workspace', {
  backend: Backend.SSH
});
```

### 2. WebRTC P2P

Direct browser-to-agent communication:

```typescript
const api = await createWorkspace('webrtc://peer-id/workspace', {
  backend: Backend.WebRTC
});
```

### 3. Kernel Integration

Direct kernel API access:

```typescript
const api = await createWorkspace('kernel://ledger/workspace', {
  backend: Backend.Kernel
});
```
