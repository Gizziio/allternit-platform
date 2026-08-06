# GenOffice → Allternit Coherent Architecture

## Principles

1. **One engine, many surfaces.** The GenOffice-derived office engines (`@allternit/office-docx-engine`, etc.) are core platform libraries. They power the web editor, the desktop editor, the backend parsing API, and eventually mobile views — not a separate app.
2. **No bundled Node sidecars in production.** The desktop architecture already forbids bundled services. `services/office-engine` is a Phase 0 prototype; shipping endpoints live in the backend.
3. **Browser-native first.** The engine runs in Node, browser, and web workers today. WASM is reserved for future optimization, not Phase 0.
4. **Reuse existing plumbing.** Desktop windows, auth, custom protocols (`allternit-api://`), and the platform `ViewRegistry` are reused rather than duplicated.

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Surfaces                                                     │
│  • ai.allternit.com /docs/:artifactId   (shipping target)    │
│  • allternit-desktop                    (Electron 41 shell)  │
│  • allternit-mobile                     (WKWebView viewer)   │
└───────────────────────┬─────────────────────────────────────┘
                        │ allternit-api://  /  HTTPS
┌───────────────────────▼─────────────────────────────────────┐
│ Backend                                                      │
│  • /api/office/parse                                        │
│  • /api/office/roundtrip                                    │
│  • imports @allternit/office-docx-engine / file-parse        │
└───────────────────────┬─────────────────────────────────────┘
                        │ workspace imports
┌───────────────────────▼─────────────────────────────────────┐
│ Office Engine Packages (GenOffice-derived)                   │
│  • @allternit/office-docx-engine                            │
│  • @allternit/office-pptx-engine                            │
│  • @allternit/office-pptx-render                            │
│  • @allternit/office-file-parse                             │
└─────────────────────────────────────────────────────────────┘
```

## Phase 0 deviations

To de-risk integration before the platform route and backend API are ready, Phase 0 uses two temporary spikes:

- **`surfaces/allternit-docs`** — standalone Vite surface so the engine can be exercised in a browser/web worker without blocking on `ai.allternit.com` route work.
- **`services/office-engine`** — standalone Hono service so the artifact-flow proof can run before backend endpoints are implemented.

Both are explicitly marked as spikes and will be migrated into the platform/backend in Phase 1.

## Desktop window flow

The desktop reuses the existing `designWindow` pattern:

1. `ipcMain.handle('shell:open-docs', openDocsWindow)` creates/focuses a `BrowserWindow`.
2. In dev, the window loads `http://localhost:3014` (`surfaces/allternit-docs`).
3. In packaged builds, the window loads a static copy of `surfaces/allternit-docs/dist` copied into `Resources/office-docs/`.
4. The window uses the same preload script and `allternit-api://` proxy as every other desktop window.

## WASM decision

The completion criterion originally asked for "docx-engine compiles to WASM." After audit, this was rejected for Phase 0 because:

- The engine is TypeScript with `jszip` and `fast-xml-parser` dependencies; there is no practical JS→WASM path.
- A Rust rewrite would be a multi-month effort and would fork from the GenOffice reference implementation.
- Web workers achieve the actual product goal (engine off the main thread) immediately.

The Phase 0 proof is therefore **web-worker roundtrip**. WASM remains a future optimization if profiling justifies it.

## iOS path

iOS cannot run Electron or a Node sidecar. The current iOS artifact preview uses a sandboxed `WKWebView`. The Phase 0 iOS scope is:

- Load the platform `/docs/:artifactId` route in `WKWebView` for read-only viewing.
- Call backend office endpoints over HTTPS.

Read/write editing on iOS requires a stable web editor and native file-picker/file-provider integration; it is Phase 2+.

## License and attribution

All forked engine packages retain GenOffice's Apache-2.0 `LICENSE` and `NOTICE` files and are recorded in `THIRD_PARTY_NOTICES.md`. The service and standalone docs surface are Allternit-original code (MIT).
