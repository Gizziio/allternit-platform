# Web Deployment Options Explained

## The Core Question

**"Can I deploy the Shell UI as a static website using WASM?"**

**Answer: YES, but with limitations.**

## What Works the Same

| Feature | TUI (HTTP) | WASM (Browser) |
|---------|-----------|----------------|
| Create tasks | ✅ | ✅ |
| Update tasks | ✅ | ✅ |
| List tasks | ✅ | ✅ |
| Memory entries | ✅ | ✅ |
| Skills registry | ✅ | ✅ |
| Identity | ✅ | ✅ |
| Policy checks | ✅ | ✅ |
| Checkpoints | ✅ | ✅ |

**The CODE is the same. The STORAGE is different.**

## The Critical Difference: Data Persistence

### TUI Backend (HTTP)
```
User creates task
       ↓
HTTP request to localhost:3010
       ↓
TUI saves to SQLite database
       ↓
Data persists forever
```

### WASM Backend (Browser)
```
User creates task
       ↓
WASM function call (in browser memory)
       ↓
Stored in JavaScript memory/IndexedDB
       ↓
**Data lost on page refresh** (unless exported)
```

## Deployment Scenarios

### Scenario A: Static Website (WASM Only)
```
Hosting: GitHub Pages, Vercel, Netlify
Backend: WASM (no server needed)
Data: Lost on refresh
Use case: Demos, prototypes, offline PWA
```

**How it works:**
- User visits `https://shell.allternit.dev`
- Browser downloads WASM module
- Everything runs in browser
- User creates tasks → stored in browser memory
- User refreshes page → tasks GONE
- User can export data to JSON file

### Scenario B: Web + TUI Server (HTTP)
```
Hosting: Your server with TUI running
Backend: TUI HTTP server
Data: Persistent (SQLite)
Use case: Production web app, team sharing
```

**How it works:**
- User visits `https://shell.allternit.dev`
- Web app connects to `wss://api.allternit.dev` (TUI server)
- Everything stored on server
- Data persists across sessions
- Multiple users can collaborate

### Scenario C: Electron Desktop (HTTP to local TUI)
```
Hosting: Electron app on user's machine
Backend: Local TUI process (sidecar)
Data: Persistent (local SQLite)
Use case: Desktop app, what you're building
```

## The Data Sync Problem

**Question:** "If I use WASM on web and TUI on desktop, do they sync?"

**Answer:** NO. They are separate.

```
Desktop (Electron + TUI)
├── Task: "Fix bug #123" ✅ (in SQLite)
└── Task: "Write docs" ✅ (in SQLite)

Web (WASM in browser)
├── Task: "Test feature" ✅ (in browser memory)
└── (different database!)

These do NOT sync automatically!
```

## Making Them Sync (Optional)

If you want web + desktop to share data, options:

### Option 1: Web connects to TUI server
```typescript
// On web, connect to user's TUI server
const workspace = await createHttpWorkspace(
  '/path',
  'https://user-tui-server.allternit.dev',  // User's TUI
  auth
);
```
- Pros: Same data everywhere
- Cons: User must run TUI server somewhere

### Option 2: Cloud-hosted TUI
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Desktop   │────▶│   Cloud TUI  │◀────│    Web      │
│  (Electron) │     │   Server     │     │  (Browser)  │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                    ┌───────┴───────┐
                    │  PostgreSQL   │
                    │  (Shared DB)  │
                    └───────────────┘
```
- Pros: Sync across devices
- Cons: Requires cloud infrastructure

### Option 3: Export/Import
```typescript
// WASM workspace
const data = await workspace.exportData();
// Save to file or cloud storage (Dropbox, etc.)

// Later, on TUI
await workspace.importData(data);
```
- Pros: Simple, user controls data
- Cons: Manual sync

## Summary Table

| Deployment | Backend | Persistence | Multi-user | Best For |
|-----------|---------|-------------|------------|----------|
| Desktop (Electron) | Local TUI | ✅ SQLite | ❌ Single user | Production app |
| Web (WASM) | Browser | ❌ Memory only | ❌ Single user | Demos, offline PWA |
| Web + TUI | Remote TUI | ✅ SQLite | ✅ Yes | Team collaboration |
| Cloud | Cloud TUI | ✅ PostgreSQL | ✅ Yes | SaaS product |

## Bottom Line

**YES**, you can deploy as static website with WASM - it does the same operations.

**BUT**, data is separate from desktop TUI.

**For your Electron app:** Use local TUI (HTTP), not WASM.

**For a web demo:** Use WASM, but warn users data doesn't persist.

**For production web:** Host a TUI server that web connects to.

Does this clarify?
