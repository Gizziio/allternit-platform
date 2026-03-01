# CODEBASE.MD — A2rchitech Codebase Map (Updated - Layered Architecture)

Generated: 2026-02-03

This file is the canonical retrieval anchor for the A2rchitech codebase. It maps the current layered structure, defines canonical vs legacy elements, and establishes boundaries for change.

## Layered Architecture

### 0-substrate/ — Shared Foundations
- Types, events, logging primitives, shared utilities, shared UI tokens (only if truly universal)
- Contains unit templates and foundational elements

### 1-kernel/ — Execution Engine
- Mechanism / execution: sandboxing, process runners, filesystem ops, "do the work."
- Rust kernel engine located at `1-kernel/a2r-engine/`
- If Rust exists, it lives here as a unit

### 2-governance/ — Policy & Audit
- Policy + audit: WIH, receipts, approvals, permission gates, replay logs, policy DSL, enforcement
- Located at `2-governance/a2r-governor/`
- Previously named `packages/a2r-kernel/` (renamed to avoid "kernel" confusion)

### 3-adapters/ — Vendor Integration
- Anything "not you": upstream vendor intake, external connectors, protocol bindings, UI render adapters (json-render), etc.
- Runtime boundary: `3-adapters/a2r-runtime/` (formerly `packages/a2r-runtime/`, renamed to remove legacy vendor branding)
- Vendor quarantine: `3-adapters/vendor/` (read-only upstream code)
- This is where vendor code sits

### 4-services/ — Orchestration Services
- Orchestration services: DAG runner, agent router, cron/background agent supervisor, scheduling, memory promotions, indexing services, tool registry
- Services located at `4-services/` (moved from `services/` directory)
- Examples: `4-services/kernel-service/`, `4-services/gateway-service/`, `4-services/router-service/`

### 5-ui/ — Reusable UI Components
- Reusable UI primitives/components used by multiple apps (Shell UI kit, console drawer component, glass tokens, dock surfaces)
- Platform kit located at `5-ui/a2r-platform/` (formerly `packages/a2r-platform/`)

### 6-apps/ — Application Entrypoints
- Entrypoints: Electron host, shell-ui app, CLI/TUI, future mobile/web
- Each app imports from 5-ui and from 4-services through stable contracts
- Located at `6-apps/` (moved from `apps/` directory)
- Examples: `6-apps/shell-ui/`, `6-apps/shell-electron/`

## Canonical vs Legacy Mapping

### ✅ CANONICAL (Active Development)
- `6-apps/shell-ui/` — Current desktop shell UI (mounted via @a2r/platform)
- `5-ui/a2r-platform/` — Core platform kit (ShellApp, views, navigation) 
- `6-apps/shell-electron/` — Electron wrapper for desktop app
- `2-governance/a2r-governor/` — Core governance/policy engine
- `3-adapters/a2r-runtime/` — Runtime boundary (replaces @a2r/runtime)
- `1-kernel/a2r-engine/` — Rust execution engine
- `4-services/*` — Orchestration services

### 🚨 LEGACY (Frozen - No Edits)
- `apps/shell/` — Legacy shell implementation (marked frozen, may be in old location during transition)
- Any references to `@a2r/runtime` (should be updated to `@a2r/runtime`)
- Any references to `@a2r/kernel` (should be updated to `@a2r/governor`)

## Runtime Architecture

### Boot Sequence
```
6-apps/shell-electron/main/index.cjs (Electron main process)
    ↓
Vite dev server (port 5177) from 6-apps/shell-ui/
    ↓
5-ui/a2r-platform/src/shell/ShellApp.tsx (UI kernel)
```

### Entrypoints
- **Electron Main**: `6-apps/shell-electron/main/index.cjs`
- **Vite Dev Server**: `6-apps/shell-ui/vite.config.ts` (port 5177)
- **Shell Mount**: `5-ui/a2r-platform/src/shell/ShellApp.tsx`

## Package Graph

### Core Platform Dependencies
```
6-apps/shell-ui/ → @a2r/platform (workspace:*)
5-ui/a2r-platform/ → React ecosystem libraries + @a2r/governor, @a2r/runtime
6-apps/shell-electron/ → Electron runtime
3-adapters/a2r-runtime/ → @a2r/governor (workspace:*)
```

### Workspace Structure
- **6-apps/**: `shell-ui`, `shell-electron`, and other apps
- **5-ui/**: `a2r-platform` (UI platform kit)
- **3-adapters/**: `a2r-runtime` (runtime boundary), `vendor/` (quarantined upstream)
- **2-governance/**: `a2r-governor` (policy/governance layer)
- **4-services/**: Various service implementations
- **1-kernel/**: `a2r-engine` (Rust execution engine)

## Change Boundaries

### Apps Layer (6-apps/)
- `6-apps/shell-ui/` — UI layer changes allowed
- `6-apps/shell-electron/` — Electron wrapper changes allowed
- `apps/shell/` — ❌ FROZEN (no changes permitted)

### UI Layer (5-ui/)
- `5-ui/a2r-platform/` — Core platform evolution
- Must use @a2r/runtime boundary for vendor integration

### Runtime Layer (3-adapters/)
- `3-adapters/a2r-runtime/` — Runtime boundary changes allowed
- `3-adapters/vendor/` — ❌ READ-ONLY (no changes permitted)

### Governance Layer (2-governance/)
- `2-governance/a2r-governor/` — Policy logic changes allowed

## Critical Files to Protect

### Core Infrastructure
- `package.json` — Workspace configuration
- `pnpm-workspace.yaml` — Monorepo structure (updated to include layer paths)
- `Cargo.toml` — Rust workspace configuration (updated to include new kernel path)
- `SOT.md` — Source of truth for architecture

### Runtime Configuration
- `6-apps/shell-electron/main/index.cjs` — Electron entry
- `6-apps/shell-ui/vite.config.ts` — Dev server config
- `5-ui/a2r-platform/src/shell/ShellApp.tsx` — UI kernel

## Vendor Code Quarantine

### Upstream Code (Read-Only)
- `3-adapters/vendor/` — Contains original upstream vendor code
- ❌ DO NOT MODIFY directly in this location
- ❌ DO NOT IMPORT directly from UI layer
- ALL EXECUTION must go through `@a2r/runtime` boundary

### Integration Pattern
```
UI Layer → @a2r/runtime → 3-adapters/vendor/ (via runtime boundary)
```

## Naming Conventions

### Execution Layer (1-kernel/)
- ✅ "engine" - Execution engine (e.g., `a2r-engine`)
- ✅ "executor" - Task executor
- ✅ "sandbox" - Isolation environment

### Governance Layer (2-governance/)
- ✅ "governor" - Policy enforcement (e.g., `a2r-governor`)
- ✅ "policy" - Policy management
- ✅ "audit" - Audit trail

### Adapters Layer (3-adapters/)
- ✅ "runtime" - Runtime bridge (e.g., `a2r-runtime`)
- ✅ "bridge" - Integration bridge
- ✅ "adapter" - Protocol adapter

## Next Steps for Consolidation

1. Verify all workspace references updated to new locations
2. Ensure all import paths updated to use new package names
3. Confirm vendor quarantine is effective (no direct imports from UI to vendor)
4. Update documentation to reflect new layer-based structure
5. Implement sprawl prevention checks to maintain layer discipline
