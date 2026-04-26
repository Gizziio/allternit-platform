# Tauri Cleanup Phase - Electron Migration

## Status: Phase A Complete ✅

The Electron BrowserView implementation is now operational:
- IPC fixed (send → invoke)
- Single source of truth for tabId
- Bounds clamping (min 64x64)
- Lifecycle hardening complete

## What Works

```
[Electron Main] Allternit Shell initialized
[Electron] [CREATE_TAB] tabId=9a0dfb5b-aa40-416f-8097-b500617abfe3 url=https://example.com
[Electron] [DID_FINISH_LOAD] tabId=9a0dfb5b-aa40-416f-8097-b500617abfe3
[Electron] [LOAD_URL_SUCCESS] tabId=9a0dfb5b-aa40-416f-8097-b500617abfe3 url=https://example.com
```

## Frozen (Not Deleted Yet)

| Path | Reason |
|------|--------|
| `apps/shell-tauri/` | May need reference code; freeze until Phase C |
| `apps/ui/src/views/GpuRenderer.tsx` | Has Tauri webview.emit calls |
| `apps/ui/src/views/StageSlot.tsx` | Legacy capsule rendering |

## Runtime Path (Electron Only)

```
apps/shell/src/components/CapsuleView.tsx
  → routes browser_view → WindowedBrowserView.tsx
  → uses electronBrowserHost.ts (IPC bridge)
  → apps/shell-electron/preload/index.ts (contextBridge)
  → apps/shell-electron/main/index.cjs (BrowserView)
```

## What Must NOT Be Used in Electron Build

- `window.__TAURI__` - Tauri global (not available in Electron)
- `@tauri-apps/api` imports
- Any `apps/ui/src/views/*` for browser capsule rendering

## Phase B: Tauri Cleanup (Next)

### Pre-Deletion Verification Required

1. **Acceptance Tests Pass**
   - [ ] Drag window → BrowserView moves with it
   - [ ] Resize window → BrowserView resizes instantly
   - [ ] Snap left/right → BrowserView fills snapped region
   - [ ] Close window → BrowserView detaches + tab closes

2. **No Tauri Imports in Production Code**
   ```bash
   # Verify no Tauri usage in shell
   grep -r "window.__TAURI__\|@tauri-apps/api" apps/shell --include="*.ts" --include="*.tsx"
   # Should return nothing
   ```

3. **Feature Flag Strategy**
   ```typescript
   // In code that might need Tauri support
   if (import.meta.env.DEV && import.meta.env.ELECTRON) {
     // Electron path
   } else if (import.meta.env.DEV && import.meta.env.TAURI) {
     // Tauri path (future)
   }
   ```

### Files Ready for Deletion (After Phase B Verification)

1. `apps/shell-tauri/` - entire directory
2. `apps/ui/src/views/GpuRenderer.tsx` - Tauri-specific webview
3. `apps/ui/src/views/StageSlot.tsx` - legacy capsule rendering
4. Any `*tauri*.ts` files in apps/shell

## Phase C: Lockfile Cleanup

After Phase B verification, prune dependencies:
```bash
npm prune
# Or manually remove from package-lock.json:
# - @tauri-apps/api
# - @tauri-apps/cli
```

## Rollback Plan

If Electron breaks:
1. Revert `apps/shell-electron/preload/index.ts` (send → invoke)
2. Revert `apps/shell/src/components/windowing/WindowedBrowserView.tsx`
3. Revert `apps/shell-electron/main/index.cjs`

All changes are in git - rollback is safe.

## Verification Commands

```bash
# Start shell
cd apps/shell && npm run dev

# Start electron (new terminal)
cd apps/shell-electron && npm run dev

# Expected logs:
# [CREATE_TAB] tabId=... url=https://example.com
# [DID_FINISH_LOAD] tabId=...
# [ATTACH_STAGE] tabId=... bounds=...
```

## Key Files Changed

| File | Change |
|------|--------|
| `apps/shell-electron/preload/index.ts` | IPC: send → invoke |
| `apps/shell/src/components/windowing/WindowedBrowserView.tsx` | Single source of truth, clamping, logging |
| `apps/shell/src/components/windowing/WindowManager.tsx` | Removed DPR division, fixed origin |
| `apps/shell-electron/main/index.cjs` | Debug logging, guards |
