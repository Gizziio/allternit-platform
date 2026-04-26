# Agent Workspace Backend Architecture

## The Core Concept

You have **TWO DEPLOYMENT TARGETS** for the same workspace API - like having a mobile app that works offline (WASM) or connects to a server (HTTP).

```
┌─────────────────────────────────────────────────────────────────┐
│                    Allternit PLATFORM (Browser)                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           WorkspaceAPI (Unified Interface)               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│          ┌──────────────────┴──────────────────┐              │
│          │                                     │              │
│    ┌─────▼─────┐                       ┌──────▼──────┐       │
│    │   WASM    │      OR               │    HTTP     │       │
│    │  Backend  │  (one or the other)   │   Backend   │       │
│    └─────┬─────┘                       └──────┬──────┘       │
│          │                                     │              │
│    ┌─────▼─────┐                       ┌──────▼──────┐       │
│    │In-Memory  │                       │allternit-  │       │
│    │Storage    │                       │api Server   │       │
│    │(Browser)  │                       │(External)   │       │
│    └───────────┘                       └─────────────┘       │
│                                                                │
│  Use Case: Offline/Single-user         Use Case: Team/Shared  │
│  Data: Local only                      Data: Persistent DB    │
│  Multi-user: No                        Multi-user: Yes        │
└─────────────────────────────────────────────────────────────────┘
```

## When to Use Each

### WASM Backend
**Use when:**
- Running in browser without a server
- Offline mode
- Single user only
- Quick prototyping
- Data can be lost on refresh (or you export/import)

**Characteristics:**
- Lives entirely in browser memory
- No network latency
- Data disappears on page refresh (unless you persist via export)
- Cannot share between users
- Cannot sync between devices

### HTTP Backend  
**Use when:**
- Connected to TUI/allternit-api server
- Team collaboration needed
- Data persistence required
- Multi-device sync
- Production deployments

**Characteristics:**
- Connects to external API server
- Persistent database storage
- Shared between users
- Real-time sync via WebSocket
- Requires server to be running

## Selection Logic (Auto-Discovery)

```typescript
// This function picks the RIGHT backend for the situation
async function createWorkspace(path: string) {
  
  // Try HTTP first (if server available)
  if (serverAvailable()) {
    return createHttpWorkspace(path);  // ✅ Use HTTP
  }
  
  // Fall back to WASM
  return createWasmWorkspace(path);     // ✅ Use WASM
}
```

**NOT racing - just picking the best available option!**

## No Race Conditions

Only **ONE** backend instance exists at a time per workspace:

```typescript
// ❌ WRONG - never do this
const http = await createHttpWorkspace(path);
const wasm = await createWasmWorkspace(path);
// Now you have TWO different data stores!

// ✅ CORRECT - pick one
const workspace = await createWorkspace(path, { 
  preferHttp: true  // or false for WASM
});
// Only ONE backend active
```

## Data Flow Examples

### Scenario 1: User in Electron App (HTTP)
```
User → Shell UI → HTTP Backend → allternit-api → SQLite DB
```
- Data persists across sessions
- Multiple users can access same workspace
- Server enforces policies

### Scenario 2: User in Static Web Page (WASM)
```
User → Shell UI → WASM Backend → Browser Memory
```
- Data lost on refresh
- Single user only
- Fast, no network calls
- User can export data to file

### Scenario 3: TUI Server as Brain Runtime
```
TUI (Rust) runs as server process
         ↓
   HTTP Backend
         ↓
   Shell UI (connects via HTTP)
```

The TUI provides the "Brain runtime" - the actual execution engine. Shell UI is just the visual interface.

## Integration Points

### TUI Server Integration
```typescript
// TUI server running on localhost:3010
const workspace = await createHttpWorkspace(
  '/path/to/workspace',
  'http://localhost:3010',
  { username: 'allternit', password: 'generated-key' }
);

// Now the TUI server:
// - Executes tools
// - Manages filesystem
// - Runs skills
// - Persists to database

// Shell UI just:
// - Displays data from TUI
// - Sends user commands to TUI
```

### Standalone Mode (WASM)
```typescript
// No server available
const workspace = await createWasmWorkspace('/path/to/workspace');

// Everything runs in browser:
// - Task management in memory
// - Policy checks in WASM
// - Skills registry local
// - No filesystem access (sandboxed)
```

## Key Insight

**WASM backend = Fallback when no server**
**HTTP backend = Full functionality with server**

They're not competing - they're complementary deployment options like:
- React app with API (HTTP) vs React app with localStorage (WASM)
- VS Code desktop (HTTP to extensions) vs VS Code web (WASM)
- Figma desktop vs Figma web

## Configuration

```typescript
// Force HTTP (requires server)
const workspace = await createWorkspace(path, { 
  preferHttp: true 
});
// Throws error if no server available

// Force WASM (local only)
const workspace = await createWorkspace(path, { 
  preferHttp: false 
});
// Never tries to connect to server

// Auto-select (default)
const workspace = await createWorkspace(path);
// HTTP if available, else WASM
```

## Production Recommendations

| Scenario | Backend | Reason |
|----------|---------|--------|
| Electron app with TUI | HTTP | Full persistence |
| Web deployment | HTTP | Shared workspaces |
| Offline PWA mode | WASM | Works without network |
| Static site demo | WASM | No server needed |
| CI/CD testing | WASM | Fast, isolated |

## Summary

**NOT two systems racing** - **two deployment options for the same system**:

1. **WASM**: Browser-only, ephemeral, fast, offline-capable
2. **HTTP**: Server-connected, persistent, shared, production-ready

The code picks the best one available for the user's situation.
