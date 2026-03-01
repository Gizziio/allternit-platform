# Source of Truth - A2rchitect Shell Architecture

**Last Updated**: 2026-02-02

## Directory Structure

```
/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/
├── apps/
│   ├── shell/              ← LEGACY (frozen, do not edit)
│   ├── shell-ui/           ← NEW: Active UI app (mounts platform)
│   └── shell-electron/     ← Electron host (points to shell-ui)
│
├── packages/
│   └── a2r-platform/       ← UI kernel library (no app scaffolding)
│
└── .references/            ← Cloned vendor libraries (FlexLayout, kbar, etc.)
```

## Rules

### 1. apps/shell - FROZEN LEGACY
- **DO NOT EDIT** - No new code, no fixes, no refactors
- Kept for reference during migration only
- See `apps/shell/LEGACY.md`

### 2. apps/shell-ui - ACTIVE DEVELOPMENT
- Vite + React app
- Mounts `<ShellApp />` from `@a2r/platform`
- Dev server: port 5177
- **This is where you see live edits**

### 3. packages/a2r-platform - PURE LIBRARY
- Exports: ShellApp, components, stores, hooks
- No Vite config, no index.html, no main.tsx
- Used by: `apps/shell-ui`

### 4. apps/shell-electron - HOST ONLY
- Loads `http://127.0.0.1:5177` in dev
- Loads `apps/shell-ui/dist` in prod
- No UI code, just window management + IPC

## Import Rules

| From | Can Import |
|------|-----------|
| `apps/shell-ui` | `@a2r/platform`, React, Vite |
| `apps/shell-electron` | Nothing (Electron APIs only) |
| `packages/a2r-platform` | Vendor libs (flexlayout, kbar, radix, etc.) |
| `apps/shell` | **FROZEN** - Nothing new |

## Vendor Libraries (in .references/)

All vendor wrappers live in `packages/a2r-platform/src/vendor/`:
- `flexlayout/` - FlexLayout wrapper
- `panels/` - react-resizable-panels wrapper
- `command/` - kbar wrapper
- `radix/` - Radix UI primitives wrapper
- `hotkeys/` - react-hotkeys-hook wrapper

## To Run Development

```bash
# Terminal 1: Start the UI dev server
cd apps/shell-ui && pnpm dev
# (runs on http://localhost:5177)

# Terminal 2: Start Electron
cd apps/shell-electron && pnpm dev
# (loads from port 5177)
```

Or combined:
```bash
cd apps/shell-electron && npm run dev
# (starts both automatically)
```

## Migration Status

| Phase | Status |
|-------|--------|
| 0: Vendor Wrappers | 🔄 In Progress |
| 1: Navigation Substrate | ⏳ Pending |
| 2: Docking Workspace | ⏳ Pending |
| 3: MiniMax Runner | ⏳ Pending |
| 4: Console Drawer | ⏳ Pending |
| 5: Visual Glass | ⏳ Pending |
| 6: Legacy Bridge | ⏳ Pending |

---
*This file prevents agent drift. Update when architecture changes.*
Rule:
Any token beginning with a:// is intercepted by the A2R runtime router and MUST NOT be forwarded to the host OS shell or filesystem APIs.