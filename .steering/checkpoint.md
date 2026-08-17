# Steering checkpoint

## Goal
Implement the cross-surface Site APIs / HAR-derived API capture redesign: add backend persistence, server-side replay proxy, real client generation, a frontend capture adapter (desktop → extension → upload), extension capture fallback, and agent tools (`api_capture_record`, `api_capture_stop`, `api_capture_replay`).

## Milestones
- [x] **Milestone 1**: Backend persistence + replay proxy + real client generation.
- [x] **Milestone 2**: Frontend adapter factory + store migration + `BrowserApiCaptureButton` refactor.
- [x] **Milestone 3**: Extension capture fallback via `chrome.debugger`/`webRequest`.
- [x] **Milestone 4**: Agent tools registered in backend tool routes.
- [x] **Milestone 5**: Verification; UI polish was already applied in prior checkpoint.

## Just did
- Implemented Milestones 1–4 in parallel via subagents:
  - Backend: added `V90__api_capture.sql`, `har_api_service.rs`, DbHandle persistence methods, full REST route set (`sessions`, `contracts`, `replay`, `client`, `ingest`), and stable-UUID endpoint extraction.
  - Frontend: created `getCaptureAdapter()` (desktop → extension → upload), migrated `store.ts`/`api.ts` to backend APIs, and refactored `BrowserApiCaptureButton.tsx` to use the adapter.
  - Extension: added `debugger`/`webRequest` permissions, `api-capture/background.ts` with CDP Network capture, and message handlers in `background.ts`.
  - Agent tools: added `api_capture_record`, `api_capture_stop`, `api_capture_replay` to `tool_routes.rs` with JSON schemas and ownership checks.
- Wrote `docs/SITE_APIS_CAPTURE_REDESIGN_PLAN.md` with research references (`server-replay`, `har-to-openapi`, `mitmproxy2swagger`, `openapi-devtools`, `harhar`, `api-reverse-engineer`, `chrome-devTools-advanced-mcp`, Playwright `routeFromHAR`).
- Verification:
  - `cargo check -p allternit-api` ✅
  - `cargo test -p allternit-api har_api` ✅ 3 passed
  - `cargo test -p allternit-api tool_routes` ✅ 21 passed
  - `pnpm exec tsc --project tsconfig.typecheck.json --noEmit` in `surfaces/ai.allternit.com` ✅ no errors in touched files
  - `pnpm test -- browser-capture-manager.test.ts` in `surfaces/allternit-desktop` ✅ 94 passed
  - `pnpm exec wxt build` in extension ✅ succeeded
- Security fix: added user-ownership check in `api_capture_stop` before stopping a session.

## Next
- Full `cargo test -p allternit-api` is running in background; inspect result when it completes.
- Stage and commit the Site APIs capture changes separately from unrelated Office Suite WIP.

## Open questions
- Should contract storage be scoped per-user or per-workspace? (Currently per-user.)
- Should replay be a backend proxy (cors-safe) or direct client-side fetch? (Currently backend proxy via `reqwest`.)

---

## Goal
Implement the approved Allternit Office Suite standalone plan: create `@allternit/allternit-office-suite`, refactor the four office apps and Sign to use an injectable `OfficeHost` contract, decouple `@allternit/office-ai` and the xlsx engine from platform endpoints, and build `surfaces/office.allternit.com` as a standalone host. Platform (`surfaces/ai.allternit.com`) remains the primary entry point.

## Milestones
- [x] **Milestone 1**: Scaffold `@allternit/allternit-office-suite` with `OfficeHost`, `OfficeAiClient`, `XlsxEngineHost`, `OfficeStorageProvider`, bridge context, and theme.
- [x] **Milestone 2**: Wrap Docs/Sheets/Slides/PDF with host-aware adapters; platform views provide a browser host that overrides `saveFile` with artifact persistence.
- [ ] **Milestone 3**: Decouple `@allternit/office-ai` and the xlsx engine from platform endpoints via the host contract.
- [ ] **Milestone 4**: Extract Allternit Sign into the suite and normalize its UI palette.
- [ ] **Milestone 5**: Build `surfaces/office.allternit.com` standalone host.
- [ ] **Milestone 6**: Verification, tests, and documentation.

## Just did
- Milestone 2:
  - Added `DocsApp`, `SheetsApp`, `SlidesApp`, `PdfApp` adapters in the suite package.
  - Added `createBrowserHost` helper for standalone surfaces.
  - Updated platform views (`DocsView`, `SheetsView`, `SlidesView`, `PdfView`) to use `OfficeHostProvider`.
  - Added ambient declaration for `harfbuzzjs/hb.js` so the suite package typechecks cleanly.
  - Verified suite and platform surface typechecks pass.

## Next
- **Milestone 4** (Sign extraction): move the native signing UI/utilities into the suite package as a host-aware `SignApp`, normalize its palette to match the office apps, and update the platform view to use it.
- Return to **Milestone 3** once Sign is extracted, because it requires deeper changes to the vendored app bridges.

## Open questions
- Should the standalone Sheets host implement a client-side recalc engine, or gracefully degrade to the simpler `@allternit/office-sheets-editor`?
- Should the standalone AI host default to Ollama, a no-op, or a lightweight built-in LLM stub?
