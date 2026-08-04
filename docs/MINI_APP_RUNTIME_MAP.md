# Mini-app frame/runtime — Gap Map

**Item:** #41 Mini-app frame/runtime (GAP → iOS)  
**Branch:** `feat/ios-mini-app-runtime`  
**Reference:** web `surfaces/ai.allternit.com/src/views/aci/MiniAppRuntimeSurface.tsx`,
`mini-app-harness.ts`, `mini-app-presentation.ts`

## Current state

- Web has `MiniAppRuntimeSurface.tsx`: renders a mini-app either as an
  embedded `<webview>`/`<iframe>` (when `presentation.uiUrl` exists) or as a
  native-capabilities placeholder (when `presentation.mode === 'native'`).
- The harness (`mini-app-harness.ts`) can spawn ACP/subprocess agents via the
  gizzi-code server; iOS has no equivalent.
- iOS has no mini-app runtime host at all.

## Phase 1 plan

Ship an iOS mini-app runtime host that can open a mini-app inside the app.

1. Add `MiniAppRuntimeView.swift`: a view that hosts a mini-app.
   - If the app declares `uiUrl`, load it in a `WKWebView`.
   - Otherwise, show a native-capabilities placeholder matching web's
     `NativeCapabilities` panel.
2. Update `MiniAppsStoreView.swift` so tapping "Open" pushes
   `MiniAppRuntimeView` instead of launching Safari.
3. No agent harness or native JS bridge in phase 1 — that requires the
   gizzi-code spawn machinery which doesn't exist on iOS.

## Files

- Read:
  - `surfaces/ai.allternit.com/src/views/aci/MiniAppRuntimeSurface.tsx`
  - `surfaces/allternit-mobile/ios/Features/ACI/Views/MiniAppsStoreView.swift`
- Write:
  - `docs/MINI_APP_RUNTIME_MAP.md`
  - `surfaces/allternit-mobile/ios/Features/ACI/Views/MiniAppRuntimeView.swift`
  - Update `surfaces/allternit-mobile/ios/Features/ACI/Views/MiniAppsStoreView.swift`

## Constraints

- Match existing iOS conventions.
- No backend schema changes.
- No builds/typechecks; syntax review only.
- Phase 1 hosts the declared `uiUrl` in WKWebView or shows capabilities.
  Agent harness, ACP spawn, and JS bridge are deferred.
