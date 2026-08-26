# Site APIs / HAR-derived API Capture — Audit, Research & Redesign Plan

**Status:** Phase 1 & 2 in progress — desktop capture hardened, UI redesigned, CTA wired  
**Scope:** Platform surface (`site-apis`), ACI browser capture button, Browser chat sidepanel, Chrome extension, Desktop Electron capture manager, Rust HAR-derived API backend.  
**Author:** platform-polish session  

---

## 1. Problem Statement

The current **Site APIs** surface is a partially-wired prototype: the UI has explanation cards and sections that feel uninviting, the "Open browser to capture" CTA does not actually start a capture or open a usable browser session, the capture button in the ACI browser top row is desktop-only and reportedly fails even inside the desktop shell, and the same capability is completely absent from the Chrome extension. The agent-chat sidepanel rendering of Site APIs is cramped, clips text, and does not follow Allternit's density/spacing rules.

We need a single, cross-surface workflow: a user performs a website workflow, the agent records the network traffic, saves it as a HAR file, derives typed API endpoints, and exposes them as replayable endpoints or agent skills.

---

## 2. Current Implementation Audit

### 2.1 Frontend — `surfaces/ai.allternit.com/src/views/api-capture/ApiCaptureView.tsx`

- **What it does:** Upload a HAR JSON file, call `POST /api/har-derived-api/ingest`, display derived contracts grouped by domain, replay individual endpoints, generate stub clients, and publish as a local-only API skill.
- **What's wrong:**
  - The workflow strip is a row of explanation cards, not an interactive wizard. It takes up a lot of vertical space and does not guide the user.
  - The left sidebar mixes a dropzone, "Capture Sessions" (always empty because sessions are not persisted), and "Contracts by Domain" in one scrollable stack with inconsistent section spacing.
  - Endpoint cards use `truncate` aggressively; long paths, query strings, and headers are unreadable.
  - The replay form is dense: nested boxes with no visual hierarchy, small hit targets, and no responsive collapse.
  - The "Open browser to capture" button dispatches `allternit:open-view` with `viewType: "browser"`. That opens the **browser landing page**, not a tab ready for capture. There is no URL prompt, no auto-start, and no feedback.

### 2.2 Frontend store — `src/lib/api-capture/store.ts`

- Contracts and API skills are persisted only to `localStorage`.
- `fetchSessions()` always returns an empty array with a comment that backend persistence is missing.
- There is no optimistic UI, no progress during HAR parse, and no sanitization warnings for cookies/auth tokens.

### 2.3 API client — `src/lib/api-capture/api.ts`

- `ingestHar()` posts to `/api/har-derived-api/ingest`.
- `generateClient()` posts endpoint IDs to `/api/har-derived-api/client`.
- `replayEndpoint()` runs `fetch()` directly from the browser with manually reconstructed headers. This bypasses the backend proxy, so CORS and cookies often fail for the derived endpoints.

### 2.4 Backend — `cmd/allternit-api/src/har_api_routes.rs`

- Simple HAR parser. Extracts API-like entries, skips static assets, strips hop-by-hop/sensitive headers.
- Path templating is naive: marks any segment that is numeric, UUID-like, or `>= 12` chars with `-` as `{id}`.
- Client generation is a **stub**: Python/TS/cURL outputs ignore the actual endpoint list and produce generic placeholder code.
- No persistence, no contract versioning, no replay executor on the server, no CORS-safe proxy.

### 2.5 Desktop capture manager — `surfaces/allternit-desktop/src/main/browser-capture-manager.ts`

- Attaches to Electron `session.defaultSession.webRequest` (`onBeforeRequest`, `onBeforeSendHeaders`, `onHeadersReceived`, `onCompleted`).
- Builds a minimal HAR 1.2 archive.
- **Critical bugs:**
  - `stopCaptureSession()` sets `sess.webRequest.onBeforeRequest(null)` etc. This tears down **all** global webRequest listeners, not just the capture listeners.
  - If two captures are started concurrently, the second overwrites the first and the first can never be stopped cleanly.
  - Request bodies are best-effort only; `blobUUID` upload data is dropped.
  - Response bodies are **not captured at all** (`response.content.text` is never populated).
- Preload exposes `window.allternit.browserCapture` (`isAvailable`, `start`, `stop`).

### 2.6 ACI browser capture button — `src/capsules/browser/BrowserApiCaptureButton.tsx`

- Lives in the ACI browser top row (`BrowserCapsuleEnhanced.tsx:1514`).
- Uses `window.allternit.browserCapture` when available; otherwise shows a warning: "Live capture requires the desktop shell..."
- In a normal browser / extension context it is permanently disabled because the web platform cannot record network natively without extension permissions.
- Menu is positioned via `getBoundingClientRect()` and `createPortal`; on small widths it can overflow.

### 2.7 Browser chat sidepanel — `src/capsules/browser/BrowserChatPane.tsx`

- Previously did not expose Site APIs in the sidepanel; the full-width `ApiCaptureView` would clip if mounted there.
- Now renders an "Agent" / "APIs" tab bar and mounts `<ApiCaptureView compact />` for a narrow, sidepanel-appropriate layout.

### 2.8 Chrome extension — `surfaces/allternit-extensions/allternit-extension/`

- Manifest V3 permissions: `tabs`, `activeTab`, `scripting`, `webNavigation`, `sidePanel`, `storage`, `nativeMessaging`.
- **Missing permissions required for network capture:** `webRequest`, `debugger`, or a DevTools panel.
- The extension does not import `BrowserApiCaptureButton` or any HAR/API-capture UI.
- `useBrowserCapture()` in `extension-sidepanel/useBrowserCapture.ts` is unrelated; it calls `/api/browser/capture` for page-to-Figma snapshots.

### 2.9 Integration tracker claim vs. reality

`research/integration-tracker-2026-08.md` marks **1.8 ApiTap / HAR-derived API Capture** as "Done" and references `services/api-capture/`, SQLite persistence, replay executor, and `/api/api-capture/*` proxy routes. Those artifacts **do not exist in the current checkout**; the only implementation is the minimal frontend + `har_api_routes.rs`.

**Branch search result:** `ao/p1-apitap-capture` was not found as a local or remote branch. A grep of all branches for `apitap`, `api-capture`, and `har` returned only `feat/web-observability-charts`. Commit `120fcf008` exists in the current history and is the source of `har_api_routes.rs` and the current frontend capture button, but there is no separate service branch to recover. This plan therefore treats the feature as a working prototype that needs to be completed and hardened, not as a finished subsystem.

---

## 3. Root Cause Summary

| Symptom | Root Cause |
|---------|------------|
| Site APIs surface feels unpolished / badly spaced | Full-width desktop layout crammed into a sidepanel; no responsive breakpoints; explanation cards instead of an action-oriented wizard. |
| "Open browser to capture" does nothing useful | CTA only opens the browser landing page; it does not start capture, navigate to a URL, or show instructions. |
| Capture button says "requires desktop shell" everywhere | Extension and web surfaces have no network-recording backend; the code hard-fails instead of offering upload/import alternatives. |
| Capture button fails inside desktop shell | `browser-capture-manager.ts` has global listener teardown bugs, no response-body capture, and potential session-overwrite races. |
| Site APIs unreadable in agent chat bar | `ApiCaptureView` is not sidepanel-aware; text truncation and fixed widths cause clipping. |
| Cannot do this across surfaces | No unified capture transport. Desktop uses Electron `webRequest`; extension uses none; web uses none. There is no shared HAR pipeline or fallback. |
| Generated clients are useless | `generate_*_client` functions in Rust are hard-coded stubs that ignore the endpoint list. |
| No persistence / sessions always empty | Backend store is not implemented; frontend uses `localStorage` only. |

---

## 4. Research — Open Source Tools & Patterns

### 4.1 HAR → API endpoint extraction

| Project | What it does | Relevance |
|---------|--------------|-----------|
| [kph-02/har-to-curl](https://github.com/kph-02/har-to-curl) | Next.js + NestJS app; upload HAR, describe an endpoint in natural language, get a `curl`. | Good reference for AI-assisted endpoint selection from HAR. |
| [4ier/neo](https://github.com/4ier/neo) | Chrome extension captures traffic, auto-generates schemas, lets AI replay APIs. | Closest product analog; shows MV3 extension + CDP capture is viable. |
| [kalil0321/reverse-api-engineer](https://github.com/kalil0321/reverse-api-engineer) | Plugin that launches a browser with HAR recording, then generates an API client. | Validates the record-then-derive workflow. |
| [adoptai/zapi](https://github.com/adoptai/zapi) | Python library: Playwright browser session, inject auth, capture traffic, export HAR, upload for analysis. | Good backend pattern for auth-aware capture. |
| [praetorian-inc/vespasian](https://github.com/praetorian-inc/vespasian) | API discovery from captured traffic; generates REST/GraphQL/SOAP/WebSocket specs. | Useful for future expansion beyond REST. |
| [jonluca/har-to-openapi](https://github.com/jonluca/har-to-openapi) | HAR → OpenAPI 3 spec generator. | Could replace stub client generation with real OpenAPI-derived clients. |
| [VectorlyApp/bluebox-sdk](https://github.com/VectorlyApp/bluebox-sdk) | CDP monitor + network/storage/interaction capture for reverse engineering. | Strong reference for CDP-based capture architecture. |
| [solentlabs/har-capture](https://github.com/solentlabs/har-capture) | Capture and sanitize HAR files with deep PII removal. | Needed before we store/share HARs. |
| [postmanlabs/httpbin](https://github.com/postmanlabs/httpbin) | Request/response echo service for testing HTTP clients. | Useful for a backend replay test fixture. |
| [mitmproxy/mitmproxy](https://github.com/mitmproxy/mitmproxy) | Interactive TLS-capable intercepting proxy with HAR export and scripting. | Reference for a local proxy fallback on desktop. |
| [giggio/node-chromedriver](https://github.com/giggio/node-chromedriver) / [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) | CDP driver for Node; `Network.getResponseBody`, `Network.requestWillBeSent`, `Network.responseReceived`. | The canonical API for full-body capture in Chromium. |
| [apify/crawlee](https://github.com/apify/crawlee) | Web scraping and browser automation framework with request interception and proxy support. | Shows how to centralize capture across Playwright/Puppeteer. |
| [ProxyKit/ProxyKit](https://github.com/ProxyKit/ProxyKit) (archived) / [YARP](https://github.com/microsoft/reverse-proxy) | .NET reverse proxies useful for a transparent capture layer. | Reference patterns if we build a local capture proxy. |

### 4.2 Browser extension network capture

| Approach | Capabilities | Limitations |
|----------|--------------|-------------|
| `chrome.webRequest` (MV3 service worker) | Observe request/response metadata, headers, redirect chains. | **Cannot read request/response bodies** in MV3. |
| `chrome.debugger` attached to tab | Full CDP access including `Network` domain; bodies, WebSockets, cookies. | Requires `debugger` permission; shows a warning bar in Chrome; one debugger client per tab. |
| DevTools extension (`chrome.devtools.network`) | Full HAR export including bodies while DevTools is open. | Only works when DevTools is open for that tab. |
| Content-script monkey-patch (`fetch`, `XMLHttpRequest`) | Can read bodies for same-origin and CORS-allowed requests. | Misses subresources, navigation requests, service-worker requests; fragile. |
| Native messaging host + external proxy | Extension sends tab ID to desktop app; desktop app launches a local proxy or CDP bridge. | Requires native host + desktop app installed; complex setup. |

**Recommendation for cross-surface:** use a **layered adapter model**:
- **Desktop:** Electron `webRequest` (metadata) + optional CDP for bodies.
- **Extension:** `chrome.debugger` for full capture when available; fall back to content-script interception + service-worker metadata; always allow manual HAR upload.
- **Web (platform.allternit.com):** no native capture; upload HAR or connect to the desktop shell via the existing `extensionAPI` bridge if installed.

### 4.3 Cross-surface capture products

| Product | Pattern |
|---------|---------|
| [Vercel agent-browser `derive-client`](https://github.com/vercel-labs/agent-browser/blob/main/skill-data/derive-client/SKILL.md) | Record traffic to HAR, then generate a standalone client. This is exactly the workflow the user described. |
| [Hyperbrowser / Notte / Browserless](https://www.notte.cc/what-is-notte) | Cloud browser + CDP recording + replay. Useful reference for server-side replay proxy. |
| [Testable.io recording proxy](https://docs.testable.io/scenarios/index.html) | Local proxy records traffic into reusable scenarios. Proxy mode is a good fallback for desktop. |

---

## 5. Design Principles for the Redesigned Surface

1. **Action-first, not explanation-first.** The first screen should let the user choose *Upload HAR*, *Record from this tab*, or *Paste/import a curl collection*. Explanation content belongs in a collapsible help panel, not the hero.
2. **Cross-surface parity with graceful degradation.** Every surface must be able to ingest a HAR. Native recording is a progressive enhancement based on what the host can do.
3. **Allternit spacing & density.** Use the platform's 4-pt grid, `--shell-view-bg`, `--bg-elevated`, and consistent section padding (`p-4`, `gap-4`). Avoid `max-w-5xl` inside narrow sidepanels; use container queries or a compact mode.
4. **No dead-ends.** If live capture is unavailable, show *why* and offer an alternative (upload HAR, copy instructions, or connect desktop shell).
5. **Backend source of truth.** Contracts, sessions, and replays should live in a Rust/SQLite service with frontend caching, not `localStorage`.
6. **Privacy by default.** Strip cookies, authorization headers, and PII before storing; warn the user before publishing a skill.

---

## 6. Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CAPTURE SOURCES                                │
├──────────────┬─────────────────────┬────────────────────────────────────────┤
│ Desktop      │ Extension           │ Web / Upload                           │
│ (Electron)   │ (Chrome MV3)        │                                        │
├──────────────┼─────────────────────┼────────────────────────────────────────┤
│ webRequest   │ chrome.debugger     │ drag-and-drop HAR                      │
│ + optional   │ + content-script    │ import Postman/OpenAPI                 │
│   CDP body   │   interception      │ paste raw curl                         │
└──────┬───────┴──────────┬──────────┴───────────────────┬────────────────────┘
       │                  │                              │
       └──────────────────┴──────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Unified HAR normalizer │  (sanitize, dedupe, annotate)
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  services/api-capture │  Rust service, SQLite, HAR v1.2
              │  - ingest             │  - contract derivation
              │  - persist sessions   │  - replay executor / proxy
              │  - OpenAPI export     │  - skill publishing
              └───────────┬───────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌────────────┐
    │ Site APIs│   │ Agent    │   │ Generated  │
    │ surface  │   │ skills   │   │ OpenAPI /  │
    │          │   │ registry │   │ client SDK │
    └──────────┘   └──────────┘   └────────────┘
```

### 6.1 New/renamed backend service: `services/api-capture/`

Replace the minimal `har_api_routes.rs` with a real service. Minimum viable schema:

- `POST /api/api-capture/sessions` — start a session (returns `session_id`).
- `POST /api/api-capture/sessions/:id/har` — ingest a HAR chunk or complete HAR.
- `POST /api/api-capture/sessions/:id/derive` — run derivation and return the contract.
- `GET  /api/api-capture/contracts` — list persisted contracts.
- `GET  /api/api-capture/contracts/:id` — get contract with endpoints.
- `POST /api/api-capture/contracts/:id/replay/:endpoint_id` — server-side replay proxy (avoids CORS).
- `POST /api/api-capture/contracts/:id/openapi` — export OpenAPI spec.
- `POST /api/api-capture/contracts/:id/client` — generate a real client in Python/TS/cURL.
- `POST /api/api-capture/skills` — publish contract as an agent skill.

Use SQLite for persistence and expose via the existing `cmd/allternit-api` proxy routes.

### 6.2 Capture adapters

Introduce a single TypeScript interface:

```ts
interface ApiCaptureAdapter {
  readonly mode: 'desktop' | 'extension' | 'upload';
  readonly canRecord: boolean;
  startRecording(options?: { filterUrls?: string[] }): Promise<string>; // sessionId
  stopRecording(sessionId: string): Promise<string>; // HAR JSON
  isAvailable(): Promise<boolean>;
  getHelpText(): string;
}
```

Implementations:
- `ElectronApiCaptureAdapter` → `window.allternit.browserCapture`.
- `ExtensionApiCaptureAdapter` → `chrome.debugger` + service worker.
- `UploadApiCaptureAdapter` → file input / dropzone.

The UI picks the best available adapter; if none can record live, it still offers upload.

### 6.3 Frontend redesign

Create a responsive `ApiCaptureSurface` that works in two layouts:
- **Full surface (`site-apis` view):** full rail width, 3-column layout (sources/sessions | contract detail | replay/inspector).
- **Compact sidepanel (`BrowserChatPane` APIs tab):** single-column stacked layout, collapsed endpoint cards, expandable replay drawer.

Add a `CaptureLauncher` component that replaces the workflow explanation strip:
- Primary actions: **Record this tab** / **Upload HAR** / **Import collection**.
- Contextual help: one sentence explaining what will happen.
- Source badge: "Desktop recording active", "Extension connected", or "Upload only".

### 6.4 Extension integration

1. Add `debugger` and `webRequest` permissions to the manifest.
2. Add a background service-worker handler for `chrome.debugger` lifecycle.
3. Re-use `BrowserApiCaptureButton` in the extension popup/sidepanel toolbar (or build an extension-specific compact variant).
4. Send captured HAR to the platform via the existing native-messaging or externally-connectable bridge, or upload directly to `/api/api-capture/sessions/:id/har`.

---

## 7. Implementation Phases

### Phase 1 — Harden desktop capture (P0)

- [x] Fix `browser-capture-manager.ts` listener lifecycle: use global listeners that dispatch to the active session and unregister only when the last session stops.
- [ ] Add response-body capture via Electron CDP `Network.getResponseBody` (deferred; documented as limitation).
- [x] Add request-body capture for non-blob uploads.
- [x] Prevent concurrent sessions; return a clear error if a capture is already running.
- [x] Add unit tests in `surfaces/allternit-desktop` for start/stop/ingest/filter/body.
- [x] Wire `BrowserApiCaptureButton` into the ACI browser top row (`BrowserCapsuleEnhanced.tsx`).
- [x] Wire desktop `browserCapture` API through preload + main IPC so the button works inside the desktop shell.
- [ ] Update `BrowserApiCaptureButton` to show recording progress, elapsed time, and request count while capturing.

### Phase 2 — Redesign the Site APIs surface (P0)

- [x] Add `compact` prop to `ApiCaptureView` for sidepanel/full-width layouts.
- [x] Replace the workflow explanation strip with a `CaptureLauncher`.
- [x] Redesign endpoint cards: show method badge, path, and a "N params" summary; expand on click to show query/header/body details.
- [x] Redesign replay form with fieldsets, better spacing, and a collapsible response panel.
- [x] Add an "APIs" tab to `BrowserChatPane` that renders `<ApiCaptureView compact />`.
- [ ] Add empty states that match Allternit illustration style (use `MatrixLogo` / `Plugs` motifs, not generic icons).
- [x] Fix the "Open browser to capture" CTA: added `armBrowserCapture()` helper that opens browser mode and arms the top-row capture button; the button auto-starts when the armed domain matches the active tab.

### Phase 3 — Backend service & persistence (P1)

- [ ] Create `services/api-capture/` Rust crate or expand `cmd/allternit-api` with SQLite persistence.
- [ ] Move HAR ingest/derive/replay/client-generation out of `har_api_routes.rs` into the service.
- [ ] Implement real client generation from derived endpoints (use `har-to-openapi` logic or templates).
- [ ] Add server-side replay proxy so CORS and cookies are handled by the backend.
- [ ] Add contract/skill persistence and expose `/api/api-capture/*` routes.
- [ ] Migrate frontend store from `localStorage` to the new API with optimistic updates.

### Phase 4 — Cross-surface capture (P1)

- [ ] Define the `ApiCaptureAdapter` interface and refactor `BrowserApiCaptureButton` to use it.
- [ ] Add `ExtensionApiCaptureAdapter` using `chrome.debugger`.
- [ ] Update extension manifest with required permissions.
- [ ] Add the capture button to the extension sidepanel/toolbar.
- [ ] Ensure captured HARs from desktop or extension are normalized and routed to the same backend session.

### Phase 5 — Agent integration & skills (P2)

- [ ] Allow an agent to invoke `api_capture_record` / `api_capture_stop` / `api_capture_replay` tools.
- [ ] When publishing as a skill, generate a skill manifest that includes the contract ID and allowed endpoints.
- [ ] Add a "Record workflow" agent command that watches the user's browser actions and network traffic, then derives the contract automatically.

---

## 8. Acceptance Criteria

1. A user on the desktop app can click **Record network requests** in the ACI browser, perform a workflow, click **Stop**, and see a derived contract with endpoints in the Site APIs surface.
2. A user on the Chrome extension can capture network from the current tab and land in the Site APIs surface.
3. A user in the web platform can upload a HAR file and get the same derived contract.
4. The Site APIs surface is visually polished, follows Allternit spacing, and is readable in both full-width and sidepanel layouts.
5. The "Open browser to capture" CTA no longer opens a dead landing page.
6. Generated clients include the real derived endpoints, not stubs.
7. Contracts and skills survive page reloads because they are stored in the backend.

---

## 9. Open Questions

1. Do we want to use a local proxy mode (like Testable) as a fallback for desktop capture, or stick with Electron `webRequest`/CDP?
2. Should the extension capture require the `debugger` permission (intrusive warning bar) or use a DevTools panel approach?
3. How should we handle authentication replay? Should the backend proxy forward cookies from the recording session, or should we require the user to supply fresh auth tokens?
4. ~~Where should the new `services/api-capture/` crate live? The integration tracker says it already exists on a branch — do we need to locate or re-create it?~~ **Answered:** the branch does not exist locally or on `origin`. We will build from the current prototype.
5. Should Site APIs be a first-class agent skill type with its own execution runtime, or should it generate code that the agent runs via `bash`/`code_execution`?

---

## 10. Related Files

| File | Role |
|------|------|
| `surfaces/ai.allternit.com/src/views/api-capture/ApiCaptureView.tsx` | Main surface UI |
| `surfaces/ai.allternit.com/src/lib/api-capture/store.ts` | Frontend state |
| `surfaces/ai.allternit.com/src/lib/api-capture/api.ts` | API client + local persistence helpers |
| `surfaces/ai.allternit.com/src/capsules/browser/BrowserApiCaptureButton.tsx` | ACI browser top-row button |
| `surfaces/ai.allternit.com/src/capsules/browser/BrowserChatPane.tsx` | Agent sidepanel tabs |
| `surfaces/ai.allternit.com/src/capsules/browser/BrowserCapsuleEnhanced.tsx` | ACI browser shell |
| `surfaces/allternit-desktop/src/main/browser-capture-manager.ts` | Electron capture engine |
| `surfaces/allternit-desktop/src/main/unified-main.ts` | IPC registration |
| `surfaces/allternit-desktop/src/preload/index.ts` | Renderer bridge |
| `cmd/allternit-api/src/har_api_routes.rs` | Current backend ingest/client stubs |
| `surfaces/allternit-extensions/allternit-extension/packages/extension/wxt.config.js` | Extension manifest config |

---

## 11. Immediate Next Steps

1. Get steering approval on the architecture (adapter model + new backend service vs. extending `har_api_routes.rs`).
2. Decide whether to locate the `ao/p1-apitap-capture` branch referenced in `integration-tracker-2026-08.md` or build from the current prototype.
3. Begin Phase 1 desktop capture fixes and Phase 2 UI redesign in parallel.
4. Open a follow-up spike for the extension `chrome.debugger` capture adapter.
