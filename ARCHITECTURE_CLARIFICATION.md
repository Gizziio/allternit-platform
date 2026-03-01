# Architecture Clarification: WASM vs HTTP

## The Core Question

**"If the Electron Shell spawns the TUI as a sidecar, why do we need WASM at all?"**

## The Honest Answer

You're right to question this. Here's the breakdown:

### What Each Component Actually Is

| Component | What It Is | Primary Use Case |
|-----------|-----------|------------------|
| **TUI (`a2r` binary)** | Full Rust CLI tool with HTTP server | Desktop app, production, team sharing |
| **WASM (`a2r-agent-workspace`) | Rust crate compiled to WebAssembly | Browser-only, demos, testing |
| **Shell (Electron)** | GUI frontend | Visual interface, window management |

### Original Intent

The WASM was created for **BROWSER DEPLOYMENTS** - not for Electron:

```
USE CASE 1: Static Web Site
┌─────────────────────────────────────┐
│  Browser (no Electron)              │
│  ┌─────────────────────────────┐   │
│  │  Shell UI (static HTML)     │   │
│  │  ┌───────────────────────┐  │   │
│  │  │  WASM Backend         │  │   │
│  │  │  (runs in browser)    │  │   │
│  │  └───────────────────────┘  │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘

USE CASE 2: Electron App (what we're building)
┌─────────────────────────────────────┐
│  Electron Shell                     │
│  ┌─────────────────────────────┐   │
│  │  Shell UI                   │   │
│  │  ┌───────────────────────┐  │   │
│  │  │  HTTP Client          │  │   │
│  │  └───────────────────────┘  │   │
│  └─────────────────────────────┘   │
│              │                      │
│              ▼ (HTTP/localhost)     │
│  ┌─────────────────────────────┐   │
│  │  TUI Sidecar Process        │   │
│  │  (spawns automatically)     │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### For YOUR Shell (Electron), You Have Two Options:

#### Option A: HTTP-Only (Simpler, Recommended)
```typescript
// Shell ALWAYS spawns TUI, ALWAYS uses HTTP
const workspace = await createHttpWorkspace(
  path,
  'http://localhost:3010',
  auth
);

// If TUI not running, show error or auto-restart
```

**Pros:**
- Single backend to maintain
- Full persistence (SQLite via TUI)
- Real multi-user support
- Simpler mental model

**Cons:**
- Requires TUI process running
- Can't work if TUI crashes

#### Option B: HTTP + WASM Fallback (What I Implemented)
```typescript
// Try HTTP first, fall back to WASM
const workspace = await createWorkspace(path, { preferHttp: true });
// HTTP if available, WASM if not
```

**Pros:**
- Graceful degradation
- Can work offline (WASM mode)
- Browser deployable (WASM)

**Cons:**
- Two backends to maintain
- Data sync issues (WASM data ≠ TUI data)
- More complex

## The Real Question: Do You Need WASM?

### If Your Answer Is YES to Any:
- ❓ "I want a static website version" → YES, need WASM
- ❓ "I want offline mode in Electron" → YES, need WASM
- ❓ "I want to deploy to web (not desktop)" → YES, need WASM

### If Your Answer Is:
- ✅ "Electron app only, always has TUI" → NO, don't need WASM

## My Recommendation

**For the Electron Shell you're building:**

**REMOVE the WASM fallback complexity.**

The Shell should:
1. Spawn TUI as sidecar (on startup)
2. Use HTTP client exclusively
3. If TUI dies, restart it (don't fall back to WASM)
4. Show "Server Error" if TUI can't start

### Why?

1. **Data Integrity**: WASM data and TUI data are SEPARATE. Falling back to WASM means the user sees DIFFERENT tasks/memory.

2. **Confusion**: User sees tasks in "offline mode" (WASM), then TUI starts and tasks disappear (different database).

3. **Maintenance**: Two backends = twice the bugs.

## Simplified Architecture (What You Actually Want)

```
┌──────────────────────────────────────────────────────┐
│                    ELECTRON SHELL                    │
│  ┌──────────────────────────────────────────────┐   │
│  │               RENDERER PROCESS               │   │
│  │  ┌────────────────────────────────────────┐  │   │
│  │  │           Shell UI (React)             │  │   │
│  │  │  ┌──────────────────────────────────┐  │  │   │
│  │  │  │      Agent Workspace API         │  │  │   │
│  │  │  │  ┌────────────────────────────┐  │  │  │   │
│  │  │  │  │      HTTP Client ONLY      │  │  │  │   │
│  │  │  │  │  (no WASM fallback)        │  │  │  │   │
│  │  │  │  └────────────────────────────┘  │  │  │   │
│  │  │  └──────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
│                         │                            │
│                         │ IPC                        │
│                         ▼                            │
│  ┌──────────────────────────────────────────────┐   │
│  │                 MAIN PROCESS                 │   │
│  │  ┌────────────────────────────────────────┐  │   │
│  │  │         Sidecar Integration            │  │   │
│  │  │  ┌──────────────────────────────────┐  │  │   │
│  │  │  │    Spawns a2rchitech-api         │  │  │   │
│  │  │  │    (port discovery, auth)        │  │  │   │
│  │  │  └──────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
                          │
                          │ HTTP / localhost
                          ▼
┌──────────────────────────────────────────────────────┐
│              a2rchitech-api (TUI)                   │
│  ┌──────────────────────────────────────────────┐   │
│  │  • SQLite Database                           │   │
│  │  • Task Graph Management                     │   │
│  │  • Policy Enforcement                        │   │
│  │  • Skills Registry                           │   │
│  │  • Memory Storage                            │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

## What To Do

### If You Want HTTP-Only (Simpler):
1. Remove WASM fallback from `createWorkspace()`
2. Always use `createHttpWorkspace()`
3. Keep WASM package for browser deployments (separate concern)
4. Shell always spawns TUI before loading UI

### If You Want to Keep Both:
1. Keep current implementation
2. BUT understand WASM = demo mode only
3. Don't expect data persistence in WASM mode
4. Show "Offline Mode" indicator when using WASM

## Bottom Line

**WASM was created for browser deployments, not for Electron.**

For your Electron Shell, you can:
- ✅ Use HTTP-only (simpler, recommended)
- ✅ Keep both (more complex, but enables web version)
- ❌ Use WASM-only (loses persistence, not recommended)

**Which do you want?** I can refactor to HTTP-only if that's cleaner for your use case.
