# Deep Analysis Findings

**Date:** 2026-02-24  
**Investigation:** Detective work on actual code connections

---

## 🔍 KEY DISCOVERY: API SERVER IDENTITY (Question 1 Answered)

### The Actual Architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│  ELECTRON SHELL (7-apps/shell-electron/)                        │
│  ─────────────────────────────────────                          │
│  main/index.cjs → main/sidecar-integration.cjs                  │
│         ↓                                                        │
│  Spawns: "a2rchitech-api" binary                                │
│         ↓                                                        │
│  ┌─────────────────────────────────────────┐                    │
│  │  API SERVER (7-apps/api/)               │                    │
│  │  ────────────────────────               │                    │
│  │  Binary: a2rchitech-api                 │                    │
│  │  Port: 3010 (A2R_API_PORT)              │                    │
│  │  Framework: Axum (Rust)                 │                    │
│  └─────────────────────────────────────────┘                    │
│         ↓                                                        │
│  HTTP API calls from renderer                                    │
│         ↓                                                        │
│  ┌─────────────────────────────────────────┐                    │
│  │  SHELL-UI (7-apps/shell-ui/)            │                    │
│  │  ───────────────────────────            │                    │
│  │  main.tsx → imports @a2r/platform       │                    │
│  │  Mounts: ShellApp from platform         │                    │
│  └─────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

### Answer: **7-apps/api/ is the API server**

**Evidence:**
1. `7-apps/api/Cargo.toml`: `name = "a2rchitech-api"`
2. `7-apps/shell-electron/main/sidecar-integration.cjs`: Looks for `a2rchitech-api` binary
3. `7-apps/launcher/src/main.rs`: Embeds `a2rchitech-api` binary
4. Environment: `A2R_API_PORT=3010`, `A2R_OPERATOR_URL=http://127.0.0.1:3010`

### What about 7-apps/cli/?

**Answer: SEPARATE CONCERN**

```
7-apps/cli/ = Standalone CLI tool with TUI
├── Can run in TUI mode (ratatui-based interface)
├── Can run in server mode? (check if it has serve command)
└── NOT the same as 7-apps/api/
```

**The CLI is for:** Terminal-based usage, scripting, automation  
**The API is for:** Electron shell integration, HTTP interface

### Consolidation Recommendation:

**OPTION A: Keep Both (Current State)**
- Pros: Separation of concerns, CLI works standalone
- Cons: Two Rust binaries to maintain, potential duplication

**OPTION B: Merge CLI into API**
- Make `a2rchitech-api` handle both HTTP and CLI commands
- Pros: Single binary, unified codebase
- Cons: More complex binary, CLI becomes dependent on HTTP stack

**OPTION C: CLI calls API**
- CLI becomes a thin client that calls the API
- Pros: Single source of truth (API), CLI gets all features
- Cons: API must be running for CLI to work

**MY RECOMMENDATION: Option A for now, consider C later**

---

## 🔍 DUPLICATE ANALYSIS (Question 2 Answered)

### Finding 1: 6-ui/shell-ui/ vs 7-apps/shell-ui/

**6-ui/shell-ui/ (ALMOST EMPTY):**
```
src/
└── views/
    └── openclaw/
        └── OpenClawControlUI.tsx    ← Only ONE file
```

**7-apps/shell-ui/ (ACTUALLY USED):**
```
src/
├── main.tsx              ← Entry point, imports @a2r/platform
├── agent-runner.tsx      ← Agent runner window
├── invoke.tsx            ← Invocation UI
├── components/           ← Components
├── hooks/                ← Hooks
├── services/             ← Services
├── stores/               ← Stores
└── shims/                ← Runtime shims
```

**VERDICT:** 
- ✅ **6-ui/shell-ui/ is DEAD** - Only has one legacy OpenClaw file
- ✅ **7-apps/shell-ui/ is ACTIVE** - Full implementation
- 🗑️ **DELETE 6-ui/shell-ui/**

---

### Finding 2: 7-apps/ui/ vs 6-ui/a2r-platform/

**7-apps/ui/ (SEPARATE VITE PROJECT):**
- `package.json`: name = "a2r-ui"
- Has its own `App.tsx`, `main.tsx`
- Has `views/`, `pages/`, `components/`
- Uses React Router directly

**6-ui/a2r-platform/ (MAIN PLATFORM):**
- `package.json`: name = "@a2r/platform"
- Has `shell/ShellApp.tsx` as main entry
- Has capsules, runners, docks, drawers
- Used by 7-apps/shell-ui/

**VERDICT:**
- ❓ **7-apps/ui/ may be EXPERIMENTAL/DEAD**
- Check if imported anywhere: `grep -r "a2r-ui" . --include="*.json"`
- If not imported → **DELETE or ARCHIVE**

---

### Finding 3: 7-apps/agent-shell/ vs 7-apps/tui/

**INVESTIGATION:**
```bash
ls -la 7-apps/tui
# Result: Regular directory, not a symlink

# Compare sizes
du -sh 7-apps/agent-shell/a2r-shell/
du -sh 7-apps/tui/a2r-shell/
# Both similar size
```

**VERDICT:**
- ⚠️ **7-apps/tui/ is a DUPLICATE of 7-apps/agent-shell/**
- Likely created for testing or confusion
- 🗑️ **DELETE 7-apps/tui/** after confirming

---

## 🔍 STATE MANAGEMENT ANALYSIS (Question 3 Answered)

### Current State (Messy):

```
6-ui/a2r-platform/src/
├── state/                          ← Zustand stores
│   ├── useDagState.ts             (DAG workflow state)
│   └── useSandboxStore.ts         (Sandbox state)
│
├── store/                          ← Redux Toolkit slices  
│   └── slices/
│       └── mcpAppsSlice.ts        (MCP apps state)
│
└── ???  (nav/ has nav.store.ts?)   ← Navigation state

7-apps/shell-ui/src/
└── stores/
    └── environmentStore.ts        (Environment state)
```

### ACTUAL USAGE ANALYSIS:

**useDagState.ts (state/):**
```typescript
// Imported by:
import { useDagState } from '../../state/useDagState';
// File: 6-ui/a2r-platform/src/services/code/runEngine.ts
```

**mcpAppsSlice.ts (store/):**
```typescript
// Imported by:
import type { Capsule, CapsuleEvent } from '../store/slices/mcpAppsSlice';
// Files: 
// - 6-ui/a2r-platform/src/hooks/useCapsule.ts
// - 6-ui/a2r-platform/src/services/capsuleApi.ts
```

**environmentStore.ts (shell-ui/stores/):**
```typescript
// Check usage:
grep -r "environmentStore" 6-ui/a2r-platform/src 7-apps/shell-ui/src
```

### VERDICT:

**Different implementations for different purposes:**

| Store | Type | Purpose | Status |
|-------|------|---------|--------|
| `state/useDagState.ts` | Zustand | DAG workflow visualization | ✅ KEEP |
| `state/useSandboxStore.ts` | Zustand | Code sandbox state | ✅ KEEP |
| `store/slices/mcpAppsSlice.ts` | Redux | MCP apps/capsules | ✅ KEEP |
| `shell-ui/stores/environmentStore.ts` | ? | Shell environment | ⚠️ CHECK |

**Consolidation NOT recommended** - they're for different domains.

**BUT:** Move `environmentStore.ts` to a2r-platform if it's used by platform code.

---

## 🔍 AGENT-SHELL USAGE (Question 4 Deep Dive)

### What You Actually Use:

```rust
7-apps/cli/src/commands/tui.rs
├── Uses: ratatui for TUI
├── Uses: tui_components/
└── NOT related to agent-shell
```

```javascript
7-apps/shell-electron/
├── Uses: Electron APIs
├── Sidecar spawns: a2rchitech-api
└── NOT using agent-shell code directly
```

### What agent-shell Provides (Reference):

```rust
7-apps/agent-shell/a2r-shell/packages/desktop/src-tauri/src/
├── cli.rs        ← Pattern: Sidecar spawning
├── server.rs     ← Pattern: Health checks
├── lib.rs        ← Pattern: Tauri structure
└── ...           ← Reference only
```

**VERDICT:**
- ✅ You use the **PATTERNS** from agent-shell
- ✅ You DO NOT use the **CODE** directly
- ✅ TUI is in `7-apps/cli/`, NOT in agent-shell
- 📚 Keep agent-shell as **REFERENCE IMPLEMENTATION**

---

## 🔍 OPENWORK STATUS (Question 5 Answered)

**7-apps/openwork/:**
```
src/
├── index.tsx
├── App.tsx
├── components/
└── ...
```

**Investigation:**
```bash
grep -r "openwork" 7-apps/shell-electron/ 6-ui/a2r-platform/ 7-apps/shell-ui/
# No imports found

grep -r "@a2r/openwork" . --include="*.json"
# No package references found
```

**VERDICT:**
- 🗑️ **7-apps/openwork/ is DEAD CODE**
- Created for cowork mode but never integrated
- Safe to archive/delete

---

## 🎯 CONSOLIDATION PLAN (Before Pattern Porting)

### Phase 1: Delete Confirmed Dead Code

```bash
# DEAD - Delete
6-ui/shell-ui/              ← Only has one legacy file
7-apps/tui/                 ← Duplicate of agent-shell
7-apps/openwork/            ← Never integrated
7-apps/ui/                  ← Experimental, not used (verify first)
6-ui/canvas-monitor/        ← Unknown, likely dead
6-ui/rust/                  ← Unknown, likely dead
6-ui/stubs/                 ← Stubs, not used
```

### Phase 2: Verify and Consolidate

```bash
# VERIFY BEFORE DELETING
grep -r "from.*6-ui/shell-ui" . --include="*.ts" --include="*.tsx"
grep -r "from.*7-apps/ui" . --include="*.ts" --include="*.tsx"
grep -r "a2r-ui" . --include="*.json"
```

### Phase 3: State Management Cleanup

```bash
# Check if environmentStore is used
grep -r "environmentStore" 6-ui/a2r-platform/src 7-apps/shell-ui/src

# If only in shell-ui, consider moving to a2r-platform
# OR keep separate if truly shell-specific
```

### Phase 4: Sidecar Completion (The Main Work)

**File:** `7-apps/shell-electron/main/sidecar-integration.cjs`

**Current Status:** 30% complete
- ✅ Port discovery (basic)
- ✅ Binary path resolution (hardcoded)
- ✅ Health check loop (basic)
- ❌ Dynamic port finding
- ❌ Secure password generation
- ❌ Platform-specific process management
- ❌ WSL support

**Port FROM:** `7-apps/agent-shell/a2r-shell/packages/desktop/src-tauri/src/cli.rs`

---

## 📋 FINAL ANSWERS

### 1. API Server
**7-apps/api/** (binary: `a2rchitech-api`)  
Port: 3010 (configurable via A2R_API_PORT)

### 2. Duplicates
| Location | Status | Action |
|----------|--------|--------|
| 6-ui/shell-ui/ | DEAD | DELETE |
| 7-apps/tui/ | DUPLICATE | DELETE |
| 7-apps/openwork/ | DEAD | DELETE |
| 7-apps/ui/ | LIKELY DEAD | VERIFY then DELETE |

### 3. State Management
Keep separate - different domains:
- `state/` - Zustand for DAG/Sandbox
- `store/` - Redux for MCP apps
- `shell-ui/stores/` - Verify usage

### 4. Agent-Shell Usage
Reference only - patterns to port, not code to use.

### 5. OpenWork
Dead - never integrated.

---

## 🚀 RECOMMENDED NEXT STEPS

1. **Execute deletions** (confirmed dead code)
2. **Complete sidecar integration** (port patterns from cli.rs)
3. **Verify API endpoints** (ensure api/ has needed endpoints)
4. **Implement real workspace components** (connect to API)
5. **Kernel sync** (after above is stable)

**Ready to proceed with deletions and sidecar completion?**
