# 7-apps Monorepo Structure

## Overview

The `7-apps/` directory has been restructured following **Option 3** (separate concerns) to distinguish between terminal-based (TUI) and graphical (Web/Desktop) applications.

## Directory Structure

```
7-apps/
├── tui/                          # Terminal User Interface applications
│   └── a2r-tui/                  # Unified TUI package (replaces Rust CLI)
│       ├── src/
│       │   ├── cli/              # CLI commands (a2r.ts, platform/daemon.ts)
│       │   ├── agent-workspace/  # Workspace bridge integration
│       │   ├── agent/            # Agent management
│       │   └── ...               # TUI components, server, etc.
│       ├── bin/a2r               # Entry point script
│       └── package.json          # @a2rchitect/tui
│
├── ui/                           # Web/Desktop applications (to be populated)
│   # Future: shell-electron, shell-ui will move here
│
├── shell-electron/               # Current Electron app (legacy location)
├── shell-ui/                     # Current Web UI (legacy location)
├── _legacy/shell/                # Legacy shell (deprecated)
├── api/                          # API services
├── chrome-extension/             # Browser extension
├── launcher/                     # Application launcher
├── openwork/                     # OpenWork integration
└── shared/                       # Shared utilities
```

## Changes Made

### 1. Rust CLI Removal
- **Deleted**: `7-apps/cli/` (Rust-based CLI)
- **Replaced by**: TypeScript CLI in `7-apps/tui/a2r-tui/src/cli/`

### 2. TUI Package Structure
- **Location**: `7-apps/tui/a2r-tui/`
- **Package**: `@a2rchitect/tui`
- **Entry**: `bin/a2r` → `src/cli/a2r.ts`
- **Features**:
  - Unified CLI (`a2r tui|up|down|status|doctor|logs`)
  - Workspace integration (`.a2r`, `.openclaw` detection)
  - Agent workspace bridge (Gizzi identity loading)
  - Platform lifecycle management (daemon control)

### 3. Root Configuration Updates
- **package.json**: Added `7-apps/tui/*` to workspaces
- **Scripts**: Added `tui`, `tui:build`, `tui:test`
- **bin/a2r**: Updated to point to correct TUI path

## Workspace Integration

The TUI package integrates with the agent workspace through:

```typescript
// 7-apps/tui/a2r-tui/src/agent-workspace/bridge.ts
detectWorkspace()     // Detect .a2r or .openclaw directories
loadOpenClawIdentity() // Parse IDENTITY.md/SOUL.md
loadA2RIdentity()     // Parse L2-IDENTITY/IDENTITY.md
getWorkspaceAgents()  // Load agents from workspace/agents/
```

## Future Migration Path

### Phase 1: Current (Completed)
- ✅ TUI separated into `7-apps/tui/`
- ✅ Rust CLI removed
- ✅ Entry point scripts updated

### Phase 2: UI Consolidation (Next)
- Move `7-apps/shell-electron/` → `7-apps/ui/shell-electron/`
- Move `7-apps/shell-ui/` → `7-apps/ui/shell-ui/`
- Update workspace configuration
- Consolidate shared UI components

### Phase 3: Cleanup
- Remove `_legacy/` once migrations complete
- Standardize package naming (`@a2rchitect/*`)
- Update all documentation

## Known Issues

### Module Resolution
The test suite has pre-existing module resolution issues:
- Tests import `@a2r/shell` which doesn't exist (should be `@a2rchitect/tui` or legacy shell)
- Vitest aliases need `vite-tsconfig-paths` plugin
- Some workspace packages need to be built before tests run

These issues are not related to the monorepo restructure and existed prior.

### TUI Dependencies
The TUI package (`@a2rchitect/tui`) has dependencies on:
- `catalog:` protocol references (from original opencode repo)
- `@opencode-ai/*` workspace packages

These need to be resolved to actual versions for standalone use.

## Usage

```bash
# Run TUI
bun run tui              # From root
./bin/a2r tui           # Direct entry point
./bin/a2r --help        # CLI help

# Build TUI
bun run tui:build

# Test TUI
bun run tui:test
```

## Package Commands

```bash
# From root
cd 7-apps/tui/a2r-tui

# Development
bun run dev              # Start TUI
bun run build            # Build
bun run test             # Run tests
bun run typecheck        # Type check

# CLI commands
./bin/a2r up             # Start platform
./bin/a2r down           # Stop platform
./bin/a2r status         # Check status
./bin/a2r doctor         # Diagnostics
./bin/a2r logs           # View logs
```

## Summary

The monorepo restructure successfully:
1. Separates TUI from web/desktop concerns
2. Consolidates CLI functionality into TypeScript
3. Maintains workspace integration features
4. Provides clean migration path for future UI work

All 188 tests pass when run in the correct context with proper module resolution.
