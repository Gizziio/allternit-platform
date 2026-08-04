# Mini-apps Store — Gap Map

**Item:** #40 Mini-apps Store (GAP → iOS)  
**Branch:** `feat/ios-mini-apps-store`  
**Reference:** web `surfaces/ai.allternit.com/src/views/aci/AciMiniAppsView.tsx`,
`mini-app-registry.ts`, `mini-app.types.ts`, `use-mini-app-catalog.ts`

## Current state

- Web has a full Mini-apps Store: catalog browsing, pinning, install/start/stop
  via a desktop bridge (`window.allternit.miniApps`), and embedded-web
  rendering.
- iOS has zero mini-app UI.
- The catalog data comes from three sources:
  1. A hardcoded `COMMUNITY_CATALOG` in `use-mini-app-catalog.ts`.
  2. The public MCP registry at
     `https://registry.modelcontextprotocol.io/v0.1/servers?limit=24`.
  3. An Allternit registry at `/v1/miniapps` (requires signing + signature
     verification; skipped in phase 1).

## Phase 1 plan

Ship a browse-only Mini-apps Store on iOS.

1. Add a `MiniApp` model matching the web's `InstalledMiniApp` subset used in
   the catalog list.
2. Add `MiniAppCatalogStore` that serves the hardcoded community catalog and
   fetches the public MCP registry.
3. Build `MiniAppsStoreView.swift`: searchable catalog grid with category
   badges, pin/unpin, and "Open" action.
4. Pin state persists in `UserDefaults` (no backend for installed apps on iOS).
5. "Open" launches the mini-app URL in Safari (iOS has no desktop bridge for
   embedded install/start/runtime).
6. Add a "Mini Apps" shortcut to the ACI/Browser landing grid that opens the
   store.

## Files

- Read:
  - `surfaces/ai.allternit.com/src/views/aci/AciMiniAppsView.tsx`
  - `surfaces/ai.allternit.com/src/views/aci/mini-app.types.ts`
  - `surfaces/ai.allternit.com/src/views/aci/use-mini-app-catalog.ts`
  - `surfaces/allternit-mobile/ios/Features/ACI/Views/ACITabView.swift`
- Write:
  - `docs/MINI_APPS_STORE_MAP.md`
  - `surfaces/allternit-mobile/ios/Core/API/Models/MiniApp.swift`
  - `surfaces/allternit-mobile/ios/Core/MiniAppCatalogStore.swift`
  - `surfaces/allternit-mobile/ios/Features/ACI/Views/MiniAppsStoreView.swift`
  - Update `surfaces/allternit-mobile/ios/Features/ACI/Views/ACITabView.swift`

## Constraints

- Match existing iOS conventions.
- No backend schema changes (uses public MCP registry + hardcoded catalog).
- No builds/typechecks; syntax review only.
- Phase 1 is browse + pin + Safari-open. Install/start/stop/runtime and
  embedded-web rendering are deferred.
