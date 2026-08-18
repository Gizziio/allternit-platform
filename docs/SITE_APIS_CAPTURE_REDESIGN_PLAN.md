# Site APIs / Cross-Surface API Capture Redesign Plan

## Problem Statement

The "Site APIs" surface in the Allternit platform is unpolished and does not work end-to-end across surfaces:

- **UI/UX**: `ApiCaptureView` is a collection of explanation cards and sections with poor spacing, unclear hierarchy, and an inviting empty states. The site-API design inside the ACI browser agent chat bar is badly spaced, clips text, and is hard to read.
- **Capture button**: The ACI browser top-row "Site APIs" CTA does not start capture in the browser. Live capture is advertised but reports "requires desktop shell", and even inside the desktop shell it is not wired to actually ingest the recording.
- **Cross-surface limitation**: Capture only works (partially) inside the Electron desktop shell. There is no fallback for the browser extension or for direct HAR upload, and there is no unified adapter that picks the right capture source for the current surface.
- **Workflow gap**: The intended workflow — agent watches the user perform a website workflow, records network traffic, saves a HAR, and derives typed API endpoints — is not connected to agent tools. The agent cannot start/stop capture or replay a captured endpoint on behalf of the user.
- **Backend gap**: `har_api_routes.rs` only has stateless `ingest` and stub `client` generation. There is no persistence for contracts/sessions, no server-side replay proxy, and no real client code generated from actual endpoint data.

## Research: How others solve this

| Project | What it does | Relevance |
|--------|--------------|-----------|
| [Stuk/server-replay](https://github.com/Stuk/server-replay) | Replays server responses from a HAR file via a local proxy. | Model for a server-side replay proxy that substitutes captured responses. |
| [jonluca/har-to-openapi](https://github.com/jonluca/har-to-openapi) | Converts HAR files into OpenAPI 3.0 specs. | Shows how to derive path templates, query params, and schemas from traffic. |
| [alufers/mitmproxy2swagger](https://github.com/alufers/mitmproxy2swagger) | Converts mitmproxy captures (including HAR) into OpenAPI specs. | Reinforces pattern: capture → deduplicate → template → spec. |
| [AndrewWalsh/openapi-devtools](https://github.com/AndrewWalsh/openapi-devtools) | Browser extension that generates OpenAPI specs for any site. | Direct model for an extension-based capture fallback. |
| [bobvanderlinden/harhar](https://github.com/bobvanderlinden/harhar) | CLI to record, replay, manipulate, and analyze HAR files. | Replay server from HAR; good reference for capture timing. |
| [ctala/api-reverse-engineer](https://github.com/ctala/api-reverse-engineer) | Chrome extension to capture and reverse-engineer API calls. | Another extension capture reference; shows UI patterns for listing captured calls. |
| [Eddym06/chrome-devTools-advanced-mcp](https://github.com/Eddym06/chrome-devTools-advanced-mcp) | Chrome automation MCP server with CDP network interception and HAR recording. | Model for exposing capture/replay as agent tools via MCP. |
| [Playwright `routeFromHAR`](https://playwright.dev/docs/network#replaying-from-har) | Browser automation library with built-in HAR record/replay. | Canonical pattern for deterministic API replay. |

### Key takeaways

1. **Capture surface is independent of replay surface**. The best tools capture anywhere (extension, desktop proxy, DevTools export) and replay centrally.
2. **Derive a contract, not just a list of URLs**. OpenAPI-style path templating, parameter detection, and example responses make the captured traffic reusable.
3. **Replay should be a proxy or direct HTTP re-issuance**, not a browser re-run. This avoids UI flakiness and focuses on the API contract.
4. **Agent access matters**. Exposing capture/replay as tools (`record`, `stop`, `replay`) lets the agent operate the workflow without custom UI code.

## Target architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                User surfaces                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Allternit Desktop│  │ Browser extension │  │ Platform web (upload)        │  │
│  │ Electron webRequest│  │ chrome.debugger  │  │ Drop HAR file                │  │
│  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────────┘  │
│           │                    │                         │                    │
│           └────────────────────┴─────────────────────────┘                    │
│                                │                                              │
│                    Capture Adapter (desktop → extension → upload)             │
│                                │                                              │
└────────────────────────────────┼──────────────────────────────────────────────┘
                                 │ HAR JSON / session events
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              allternit-api                                   │
│  POST /api/har-derived-api/ingest        → derive endpoints                  │
│  POST /api/har-derived-api/sessions      → start a named capture session     │
│  GET  /api/har-derived-api/sessions/:id  → poll session status               │
│  POST /api/har-derived-api/sessions/:id/stop → persist contract              │
│  GET  /api/har-derived-api/contracts     → list persisted contracts          │
│  GET  /api/har-derived-api/contracts/:id → get contract + endpoints          │
│  DELETE /api/har-derived-api/contracts/:id                                   │
│  POST /api/har-derived-api/replay        → server-side replay proxy          │
│  POST /api/har-derived-api/client        → generate real client code         │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Agent tool belt                                   │
│  api_capture_record  → start capture via adapter or backend session          │
│  api_capture_stop    → stop capture, return contract id                      │
│  api_capture_replay  → replay a captured endpoint with supplied params       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Design principles

1. **Desktop is primary, extension is fallback, upload is always available.**
2. **One adapter API in the frontend** hides the surface differences.
3. **Backend is the source of truth** for contracts and sessions; skills can remain local-only initially.
4. **Agent tools operate on backend contracts**, so the agent can replay without requiring the original surface.
5. **Sanitization first**: strip secrets, cookies, authorization headers, and long tokens before storing or generating clients.

## Implementation phases

### Phase 1 — Backend persistence + replay + real client generation

- Add migration `V90__api_capture.sql` with tables:
  - `har_capture_sessions(id, user_id, domain, source, status, started_at, ended_at)`
  - `har_api_contracts(id, user_id, domain, source, derived_at)`
  - `har_api_endpoints(...)` with JSON columns for params, headers, body template, response sample.
- Add `DbHandle` methods for CRUD.
- Expand `har_api_routes.rs`:
  - `POST /har-derived-api/sessions`
  - `POST /har-derived-api/sessions/:id/stop` (accepts optional HAR JSON)
  - `GET /har-derived-api/sessions`, `GET /har-derived-api/sessions/:id`
  - `GET /har-derived-api/contracts`, `GET /har-derived-api/contracts/:id`, `DELETE /har-derived-api/contracts/:id`
  - `POST /har-derived-api/replay` — server-side proxy that builds the request from the stored endpoint and supplied params/headers/body.
  - `POST /har-derived-api/client` — generate real Python / TypeScript / cURL snippets from the stored endpoint data.

### Phase 2 — Frontend adapter + store migration

- Create `surfaces/ai.allternit.com/src/lib/api-capture/adapter.ts` with `getCaptureAdapter()` that returns:
  - Desktop adapter when `window.allternit.browserCapture` is available.
  - Extension adapter when `chrome.runtime` + message passing is available.
  - Upload adapter (no-op start/stop; file upload is handled separately).
- Refactor `BrowserApiCaptureButton.tsx` to use the adapter, removing the hard-coded "desktop only" error.
- Migrate `store.ts` to load/save contracts through the backend API instead of `localStorage`.
- Update `api.ts` with new endpoints and remove `localStorage` helpers.

### Phase 3 — Extension capture fallback

- Add `debugger` and `webRequest` permissions to `wxt.config.ts`.
- Create `surfaces/allternit-extensions/allternit-extension/src/api-capture/background.ts` that uses `chrome.debugger` to attach to the active tab and capture network events, or `chrome.webRequest` if available.
- Wire message handlers into `src/entrypoints/background.ts`.
- Implement the extension-side adapter in the platform surface.

### Phase 4 — Agent tools

- Add three tools in `cmd/allternit-api/src/tool_routes.rs`:
  - `api_capture_record` — calls the adapter or starts a backend session.
  - `api_capture_stop` — stops capture and returns the contract.
  - `api_capture_replay` — calls the replay proxy.
- Register them in `list_tools` with JSON schemas.

### Phase 5 — UI/UX polish

- Tighten spacing and hierarchy in `ApiCaptureView.tsx`.
- Improve the agent chat bar site-API design to avoid clipping.
- Ensure the ACI browser CTA starts capture in the correct surface.

## Verification

- `cargo check -p allternit-api` ✅ passes (warnings only).
- `cargo test -p allternit-api extract_endpoints` ✅ passes.
- `cargo test -p allternit-api tool_routes` ✅ 21 passed.
- `pnpm exec tsc --project tsconfig.typecheck.json --noEmit` in `surfaces/ai.allternit.com` reports no errors in touched files (pre-existing `office-*` asset errors remain).
- `pnpm test -- browser-capture-manager.test.ts` in `surfaces/allternit-desktop` ✅ 94 passed.
- `pnpm exec wxt build` in `surfaces/allternit-extensions/allternit-extension` ✅ succeeded.
- **Headless backend smoke test** (`cmd/allternit-api/scripts/test-api-capture.mjs`) ✅ exercises ingest → session → contract → replay → client generation.
- **Headless Electron capture test** (`surfaces/allternit-desktop/tests/api-capture-headless.spec.ts`) ✅ records httpbin.org traffic through the real preload API and produces a HAR.

## Bug found and fixed during testing

The backend HAR extractor expected snake_case field names (`query_string`, `post_data`, `mime_type`) while Electron and Chrome export standard camelCase HAR (`queryString`, `postData`, `mimeType`). Added `#[serde(rename_all = "camelCase")]` to the HAR structs in `cmd/allternit-api/src/har_api_service.rs`.

## Open questions

- Should contract storage be scoped per-user or per-workspace?
- Should replay go through a backend proxy (cors-safe) or direct client-side fetch?
- Do we want to generate OpenAPI specs in addition to client snippets?
