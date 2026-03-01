# LEGACY SHELL - DO NOT EDIT

This directory (`apps/shell`) is **frozen legacy code**.

## Status
- **DO NOT EDIT** - No new features, no bug fixes, no refactors
- **Replaced by** - `apps/shell-ui` (mounts `@a2r/platform`)
- **Kept for** - Reference only during migration

## New Architecture
```
apps/shell-ui/        ← NEW: Active development happens here
packages/a2r-platform/ ← UI kernel imported by shell-ui
apps/shell/           ← THIS: Frozen legacy
```

## When to Delete
Delete this folder only when:
- `apps/shell-ui` reaches feature parity
- All useful primitives have been ported to platform kit
- 30 days without referencing this code

## Migration Path
Port useful logic (not UI state) via:
`packages/a2r-platform/src/integration/a2r/legacy.bridge.ts`

---
Frozen: 2026-02-02
