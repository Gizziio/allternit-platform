---
status: done
coherence_score: 5
top_risk: Treating "compile docx-engine to WASM" as a Phase 0 proof. It would fork the engine effort, require rewriting JSZip/XML dependencies or porting to Rust, and delay the real integration work.
---

# GenOffice → Allternit Architecture Audit

## 1. What was reviewed

| Source | Path |
|---|---|
| Allternit Desktop architecture | `surfaces/allternit-desktop/ARCHITECTURE.md` |
| Allternit Desktop main process | `surfaces/allternit-desktop/src/main/unified-main.ts` |
| Allternit Desktop preload | `surfaces/allternit-desktop/src/preload/index.ts` |
| Platform web routes/registry | `surfaces/ai.allternit.com/src/routes.tsx`, `src/shell/ViewRegistry.tsx` |
| docx-engine package | `packages/@allternit/office-docx-engine/package.json`, `src/parse.ts`, `src/index.ts` |
| Office-engine prototype | `services/office-engine/src/index.ts`, `package.json` |
| GenOffice upstream docs | `~/.cache/genoffice-clone/README.md`, `apps/docs/package.json`, `apps/docs/src/main/docs-main.ts`, `apps/docs/src/renderer/App.tsx` |
| iOS artifact preview | `surfaces/allternit-mobile/ios/Features/Artifacts/Views/SandboxedArtifactWebView.swift` |
| Existing Office add-in | `surfaces/allternit-extensions/allternit-office-addin/package.json` |

No `GENOFFICE_INTEGRATION_PLAN.md` or `GENOFFICE_COHERENT_ARCHITECTURE.md` exists in the Allternit repo. This audit is therefore based on the code and the upstream GenOffice README/architecture notes.

## 2. Executive summary

The GenOffice *engine* packages are already a sensible addition to the Allternit workspace. The three Phase 0 proofs, however, are not equally coherent:

- **Proof A (Electron 41 desktop loads an Allternit Docs editor window)** — feasible, but the upgrade is mostly orthogonal to the Docs feature. The bigger question is where the editor lives.
- **Proof B (docx-engine compiled to WASM, round-tripping in a web worker)** — not a realistic Phase 0 goal. The engine is TypeScript, depends on `jszip` and `fast-xml-parser`, and has no WASM compilation path today.
- **Proof C (document flows through office-engine and returns as an Allternit artifact)** — already works as a prototype, but the standalone Node service is not the coherent long-term integration point.

The most coherent path is to make the Docs editor a **new route in `ai.allternit.com`**, opened by the desktop in a dedicated `BrowserWindow` (the same pattern already used for `/design` and code sessions), and to fold `office-engine` into the existing Allternit backend API rather than shipping it as a separate service.

## 3. Assessment of the three Phase 0 proofs

### 3.1 Proof A — Electron 41 upgrade + Docs editor window

**Feasibility: medium-high. Coherence: medium.**

`surfaces/allternit-desktop/package.json:42` currently pins `electron: ^33.0.0` with `electron-builder: ^25.1.8`. The upstream GenOffice Docs app uses `electron: ^41.0.3` and `electron-builder: ^26.0.12` (`~/.cache/genoffice-clone/apps/docs/package.json:37-38`).

Upgrading is doable, but it is not a small version bump. Electron 41 ships Chromium 146, V8 14.6, and Node 24.14.0 ([Electron 41 release notes](https://electronjs.org/blog/electron-41-0)). Between 33 and 41 the desktop will need to account for:

- `electron-builder` 26 is required for Electron 41 packaging.
- ASAR integrity digest is optional but recommended on macOS; requires re-signing.
- Native modules must build against Node 24 ABI / C++20.
- `BrowserView` is deprecated in favor of `WebContentsView` (Electron 30+); the desktop does not currently use `BrowserView`, so this is low-touch.
- PDFs no longer create a separate guest `WebContents` (Electron 41).
- Linux Wayland default, GTK 4 on GNOME, rounded-corner frameless defaults.
- Renderer clipboard access is deprecated/removed; any direct renderer clipboard use must move into the preload `contextBridge` wrapper.

The desktop already opens platform routes in separate windows: `designWindow` loads `/design` from `activePlatformUrl` (`surfaces/allternit-desktop/src/main/unified-main.ts:1726-1758`), and code-session windows load `/shell` with query params (`src/main/unified-main.ts:1762-1806`). The same mechanism can host a `/docs/:artifactId` editor window. That is more coherent than spawning a second Electron app.

**Verdict:** upgrade Electron to 41 in its own PR; do not block the Docs proof on it. The editor window should load a platform route, not a new standalone app.

### 3.2 Proof B — docx-engine compiled to WASM and round-tripped in a web worker

**Feasibility: low for Phase 0. Coherence: low.**

The current `@allternit/office-docx-engine` is pure TypeScript and depends on:

- `jszip` for ZIP read/write (`packages/@allternit/office-docx-engine/package.json:18-19`)
- `fast-xml-parser` for XML parsing/serialization

`parseDocx` loads the byte stream through `JSZip.loadAsync(bytes)` and then slices XML strings (`packages/@allternit/office-docx-engine/src/parse.ts:122-127`). There is no WASM compilation path for this codebase today. Realistic options:

1. **Compile the TypeScript to WASM** using a JS-in-WASM toolchain (e.g., ComponentizeJS/Javy). This is experimental for code that uses `jszip`/Buffer/typed arrays heavily, and bundle sizes would be large.
2. **Rewrite the engine in Rust** and compile to WASM. This would require re-implementing paragraph patching, style resolution, numbering, chart injection, math/OMML, etc., and keeping byte-level parity with the GenOffice reference implementation. That is a multi-month project, not a Phase 0 proof.
3. **Run the existing TS engine in a web worker.** This is trivial, unblocks performance and UI responsiveness, and is what the product actually needs.

**Verdict:** drop the WASM proof from Phase 0. Use web workers (and Node worker threads in the backend) to run the engine off the main thread. Revisit WASM only if profiling shows the engine is a bottleneck and only after the architecture is stable.

### 3.3 Proof C — office-engine service returns an Allternit artifact

**Feasibility: high as a prototype. Coherence: low as an endpoint.**

`surfaces/office-engine/src/index.ts` already exposes `/parse` and `/docx/roundtrip` over HTTP. It works, but it is a standalone Node service that the platform and desktop would have to discover, start, and authenticate to independently.

The Allternit stack already has:

- A Rust API gateway at port 8013 (`surfaces/allternit-desktop/src/main/config.ts:10`)
- A custom `allternit-api://` protocol in the desktop that proxies `/api/*` calls to the backend (`surfaces/allternit-desktop/src/main/unified-main.ts:412-420`)
- A Next.js platform surface (`ai.allternit.com`) that the desktop loads

The coherent place for `/parse` and `/docx/roundtrip` is inside the existing backend API or as a Next.js API route, not as a separate Hono service. The desktop architecture doc explicitly says "No Bundled Services" (`surfaces/allternit-desktop/ARCHITECTURE.md:49`); adding a user-managed Node sidecar contradicts that unless it is managed exactly like the existing gizzi sidecar.

**Verdict:** keep `services/office-engine` as a local dev/prototyping tool, but plan to migrate its endpoints into the backend. The desktop should call them through `allternit-api://` like every other API.

## 4. Where the Allternit Docs editor should live

The three obvious options are:

| Option | Pros | Cons |
|---|---|---|
| **A. New route in `ai.allternit.com`** (`/docs/:artifactId`) | Reuses auth, theming, shell routing, backend proxy, and works in browser + desktop + mobile WKWebView. Matches how `/design` and code sessions are handled. | Requires porting/adapting the GenOffice Docs renderer into the Next.js platform. |
| **B. Separate Electron surface (`surfaces/allternit-docs`)** | Can reuse GenOffice `apps/docs` renderer almost verbatim. | Splits auth, updates, state, and IPC; becomes a second app to ship. |
| **C. Desktop webview / BrowserView hosting a local Vite server** | Fastest hack for a demo. | Violates "no bundled services," hard to secure, and does not work on web/iOS. |

**Recommendation: Option A.** Add a `docs` view to the platform `ViewRegistry` (`surfaces/ai.allternit.com/src/shell/ViewRegistry.tsx`) and a route such as `/docs/:artifactId` in `routes.tsx`. The desktop opens it in a dedicated `BrowserWindow` with the existing preload, identical to `designWindow`. The editor component imports `@allternit/office-docx-engine` and a TipTap-based renderer adapted from `~/.cache/genoffice-clone/apps/docs/src/renderer/App.tsx`.

This is the only option that gives one editor for desktop, web (VPS/self-hosted), and mobile webview without forking the stack.

## 5. How office-engine should connect

Current prototype uses plain HTTP on `OFFICE_ENGINE_PORT` (default 8099). For production:

1. **Backend-first:** Move the endpoints into the Allternit API gateway (`/api/office/parse`, `/api/office/roundtrip`) or into Next.js API routes under `ai.allternit.com/api/office/*`. The engine packages are workspace dependencies, so importing them on the server is straightforward.
2. **Desktop access:** Use the existing `allternit-api://` custom protocol handler (`surfaces/allternit-desktop/src/main/unified-main.ts:1436`). This avoids CORS, mixed-content, and credential-exposure problems.
3. **Mobile access:** Call the same HTTPS backend endpoints. No custom protocol or sidecar is needed.
4. **Temporary sidecar (if backend is not ready):** If the service must run locally before backend integration, launch it from `unified-main.ts` the same way gizzi is launched, and expose it through a new privileged custom protocol (`allternit-office://`). Do **not** let the renderer call `http://localhost:8099` directly.

The standalone `services/office-engine` should be considered a development spike, not the shipping architecture.

## 6. iOS implications

iOS cannot run Electron or a Node sidecar. The current iOS surface loads artifact previews in a sandboxed `WKWebView` using a custom `artifact://` scheme (`surfaces/allternit-mobile/ios/Features/Artifacts/Views/SandboxedArtifactWebView.swift:18`). That view is read-only and intentionally locked down.

What works on iOS today:

- Loading the platform `/docs/:artifactId` route in a `WKWebView`.
- Calling backend office-engine endpoints over HTTPS.
- Running the existing TypeScript engine inside a WKWebView web worker (offline parsing/roundtrip).

What is missing:

- A read-write document editor UI in the platform.
- File import/export via `UIDocumentPickerViewController` and a file-provider extension.
- Native document persistence / iCloud Drive integration.
- A way to save `.docx` back to the user's Files app.

For Phase 0, iOS should be limited to **viewing** documents rendered by the backend (HTML/artifact preview). A native or WKWebView-based editor is a later phase.

## 7. Most coherent integration path (recommended)

1. **Treat engine packages as core platform libraries.** Keep `@allternit/office-docx-engine`, `@allternit/office-file-parse`, etc. Do not maintain a parallel GenOffice app fork.
2. **Build the Docs editor as a platform route.** Add `/docs/:artifactId` to `ai.allternit.com`, register a `docs` view in `ViewRegistry`, and open it from the desktop in a dedicated window using the existing preload/backend connection.
3. **Move office-engine into the backend.** Retire the standalone Node service; expose `/api/office/parse` and `/api/office/roundtrip` from the Allternit API gateway or Next.js API routes. The desktop uses `allternit-api://`; mobile uses HTTPS.
4. **Use web workers, not WASM, for Phase 0.** Run engine operations off the main thread in both browser and Node. Revisit WASM only after the product path is proven.
5. **Upgrade Electron to 41 separately.** Align with GenOffice's Electron version, but do not make it a blocker for the editor integration. Update `electron-builder` to ^26 and test ASAR/notarization.
6. **Defer iOS editing.** iOS gets read-only artifact preview first; editing comes after the web editor is stable.

## 8. Unrealistic or wasteful directions to avoid

- **Shipping a separate `allternit-docs` Electron app.** It duplicates auth, updates, and state and breaks the "one platform, many surfaces" model.
- **Pursuing WASM compilation of the existing docx-engine in Phase 0.** It is a research project that would delay the coherent integration by months.
- **Keeping `office-engine` as a long-term standalone Node service.** It duplicates the backend and complicates self-hosted deployments.
- **Using the Microsoft Office add-in (`allternit-office-addin`) as the Allternit Docs editor.** The add-in is a task-pane companion for Word/Excel/PowerPoint; it is not an Allternit-native document surface.
- **Loading the editor from a local Vite server inside the desktop.** This reintroduces bundled services and is not portable to web or iOS.

## 9. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| WASM Phase 0 diverts engineering | High | Cancel WASM proof; use web workers. |
| office-engine stays a standalone service | Medium | Add migration ticket to backend API; run as managed sidecar only if backend is blocked. |
| Electron 41 upgrade breaks notarization/build | Medium | Upgrade in isolated PR; test `electron-builder` 26 + ASAR integrity + macOS signing. |
| Editor route scope creeps into full GenOffice port | Medium | Scope Phase 0 to open/view/roundtrip; defer pagination parity, comments, tracked changes. |
| iOS treated as a first-class editor target too early | Medium | Limit iOS to artifact preview in Phase 0. |

## 10. Next actions

1. Write a one-page `GENOFFICE_INTEGRATION_PLAN.md` adopting Option A (platform route) and the backend API migration for office-engine.
2. Create the `/docs/:artifactId` route and a minimal `DocsView` in `ai.allternit.com`.
3. Port the TipTap-based editor shell from `~/.cache/genoffice-clone/apps/docs/src/renderer/App.tsx` into the platform view.
4. Add `/api/office/parse` and `/api/office/roundtrip` to the backend, importing `@allternit/office-docx-engine`.
5. Add a desktop IPC handler (`shell:open-document`) that opens the `/docs/:artifactId` route in a new `BrowserWindow`.
6. Remove or downscope the WASM proof; replace with a web-worker roundtrip demo.
7. Schedule Electron 41 upgrade as a separate infrastructure task.
