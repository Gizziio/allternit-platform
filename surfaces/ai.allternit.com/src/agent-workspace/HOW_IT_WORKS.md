# How Backend Selection Works (Automatic)

## The Short Answer

**YES, it switches automatically.** Here's the flow:

```
User calls createWorkspace()
         ↓
    [Auto-Discovery]
         ↓
    ┌─────────────────┐
    │ Is TUI running? │──YES──▶ Use HTTP (TUI)
    └─────────────────┘
         │ NO
         ▼
    ┌─────────────────┐
    │  Is in browser  │──YES──▶ Use WASM (browser)
    │  without server?│
    └─────────────────┘
         │ NO
         ▼
      Throw Error
```

## Detailed Detection Logic

### Step 1: Check Electron Sidecar (Desktop)

```typescript
// Running in Electron?
if (window.allternitSidecar) {
  // Ask Electron main process: "Is TUI running?"
  const status = await window.allternitSidecar.getStatus();
  
  if (status === 'running') {
    // ✅ Found TUI! Use HTTP backend
    return createHttpWorkspace(path, apiUrl, auth);
  }
}
```

**When this triggers:**
- ✅ Electron Shell app
- ✅ TUI spawned successfully
- ✅ Result: **Uses HTTP (TUI)**

### Step 2: Check Common Ports (Fallback)

```typescript
// Try common ports: 3010, 8080, 3000, etc.
for (const port of [3010, 8080, 3000, ...]) {
  const isHealthy = await checkHealth(`http://localhost:${port}`);
  if (isHealthy) {
    // ✅ Found TUI on a port! Use HTTP
    return createHttpWorkspace(path, `http://localhost:${port}`);
  }
}
```

**When this triggers:**
- ✅ TUI running manually (user started it)
- ✅ TUI on non-standard port
- ✅ Result: **Uses HTTP (TUI)**

### Step 3: Check Persisted Config

```typescript
// Check if we had a working server before
const config = await window.allternitSidecar?.getPersistedConfig();
if (config) {
  const isHealthy = await checkHealth(config.apiUrl);
  if (isHealthy) {
    // ✅ Previous server still running! Use HTTP
    return createHttpWorkspace(path, config.apiUrl);
  }
}
```

**When this triggers:**
- ✅ Reopening app after restart
- ✅ TUI still running from before
- ✅ Result: **Uses HTTP (TUI)**

### Step 4: Fall Back to WASM (Last Resort)

```typescript
// No TUI found anywhere
console.log('No HTTP server found, using WASM fallback');
return createWasmWorkspace(path);
```

**When this triggers:**
- ❌ TUI not running
- ❌ Not in Electron (pure browser)
- ✅ Result: **Uses WASM (browser)**

## Real-World Scenarios

### Scenario 1: Fresh Electron App Start
```
User opens Electron Shell
         ↓
Electron spawns TUI sidecar
         ↓
TUI starts on port 3010
         ↓
UI loads and calls createWorkspace()
         ↓
Discovery: "Is TUI running?" → YES (via sidecar)
         ↓
✅ Uses HTTP backend (TUI)
```

### Scenario 2: Electron App, TUI Crashed
```
User has Shell open
         ↓
TUI crashes (port 3010 now dead)
         ↓
User clicks "Refresh"
         ↓
UI calls createWorkspace()
         ↓
Discovery: "Is TUI running?" → NO
         ↓
Discovery: "Try ports?" → None respond
         ↓
✅ Falls back to WASM backend
         ↓
User sees "Offline Mode" indicator
```

### Scenario 3: Static Website
```
User visits https://shell.allternit.dev
         ↓
No Electron (window.allternitSidecar undefined)
         ↓
No TUI running (can't access localhost)
         ↓
Discovery: "Is TUI running?" → NO
         ↓
Discovery: "Try ports?" → None respond
         ↓
✅ Falls back to WASM backend
         ↓
Everything works in browser memory
```

### Scenario 4: Developer Mode
```
Developer runs TUI manually: cargo run -- serve
         ↓
TUI starts on port 3010
         ↓
Developer opens browser to localhost:5173
         ↓
UI calls createWorkspace()
         ↓
Discovery: "Try ports?" → Port 3010 responds!
         ↓
✅ Uses HTTP backend (TUI)
```

## How to Know Which Backend Is Active

### Option 1: Check the backend property
```typescript
const workspace = await createWorkspace('/path');

console.log(workspace.backend);
// "http"  → Using TUI (data persists)
// "wasm"  → Using WASM (data temporary)
```

### Option 2: Visual indicator in UI
```typescript
function BackendIndicator() {
  const { backend } = useWorkspace('/path');
  
  if (backend === 'wasm') {
    return <Badge color="yellow">Offline Mode</Badge>;
  }
  return <Badge color="green">Connected</Badge>;
}
```

### Option 3: Console logs
```
[Discovery] Attempting HTTP backend...
[Discovery] Found server via Electron sidecar: http://127.0.0.1:3010
[Workspace] Using HTTP backend: http://127.0.0.1:3010
```

## Can You Force a Specific Backend?

**YES!** Override auto-discovery:

### Force HTTP (fail if no server)
```typescript
const workspace = await createWorkspace('/path', {
  preferHttp: true,  // Only HTTP, no WASM fallback
});
// Throws error if TUI not found
```

### Force WASM (never try HTTP)
```typescript
const workspace = await createWorkspace('/path', {
  preferHttp: false,  // Only WASM
});
// Never tries to find TUI
```

### Manual server URL
```typescript
const workspace = await createWorkspace('/path', {
  serverUrl: 'http://localhost:3010',  // Skip discovery
  auth: { username: 'allternit', password: 'secret' },
});
```

## The Switching Logic (Code)

```typescript
// From index.ts - createWorkspace function

export async function createWorkspace(path: string, options = {}) {
  const { preferHttp = true, serverUrl, discoveryTimeout = 10000 } = options;

  // STRATEGY 1: Manual URL provided
  if (serverUrl) {
    return createHttpWorkspace(path, serverUrl, auth);
  }

  // STRATEGY 2: Try to discover HTTP server (if preferred)
  if (preferHttp) {
    const server = await discoverServer({ timeout: discoveryTimeout });
    
    if (server) {
      // ✅ FOUND TUI! Use HTTP
      return createHttpWorkspace(path, server.url, server.password);
    }
    
    console.log('[Workspace] No HTTP server found');
  }

  // STRATEGY 3: Fall back to WASM
  console.log('[Workspace] Using WASM backend');
  return createWasmWorkspace(path);
}
```

## Summary

| Situation | Backend Used | Data Persists? |
|-----------|-------------|----------------|
| Electron + TUI running | HTTP (TUI) | ✅ Yes (SQLite) |
| Electron + TUI crashed | WASM (fallback) | ❌ No (memory) |
| Static website | WASM | ❌ No (memory) |
| Browser + TUI manual | HTTP (TUI) | ✅ Yes (SQLite) |

**The system automatically picks the best available option.**

You don't need to think about it - just call `createWorkspace()` and it works!
