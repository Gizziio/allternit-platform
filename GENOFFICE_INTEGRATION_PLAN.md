# GenOffice → Allternit Integration Plan

## Goal

Bring GenOffice's proven document office engines into the Allternit platform as a coherent, maintainable layer — not a bolted-on fork. Phase 0 proved the three integration points; Phase 1 folded them into the shipping stack.

## Current state: Phase 1 hardening complete

| Item | Status | Evidence |
|---|---|---|
| **A. Electron 41 desktop loads an Allternit Docs editor window** | ✅ Pass | `surfaces/allternit-desktop` on Electron 41.10.3. `openDocsWindow()` loads `/docs/:artifactId?` on the active platform URL (no hardcoded ports). E2E: `surfaces/allternit-desktop/tests/docs-window.spec.ts` passes (~5s). |
| **B. docx-engine round-trips .docx in a web worker** | ✅ Pass | `packages/@allternit/office-docs-editor` runs `parseDocx` + `saveDocx` in a Vite `?worker`. Browser test `surfaces/allternit-docs/tests/worker-roundtrip.spec.ts` and desktop e2e both pass. |
| **C. Document flows through office-engine and returns as Allternit artifact** | ✅ Pass | `services/office-engine` exposes `/parse`, `/docx/roundtrip`, `/pptx/parse`, `/pptx/roundtrip`, `/extract`, `/xlsx/parse`, `/xlsx/recalc`. 15/15 tests pass, including a real IronCalc recalculation through the vendored sidecar. |
| **D. `/docs/:artifactId` route + DocsView in the platform shell** | ✅ Pass | `surfaces/ai.allternit.com/src/views/docs/DocsView.tsx`, route in `src/routes.tsx`, `"docs"` in `ViewType`/`nav.policy.ts`, registered in `src/shell/ViewRegistry.tsx`. |
| **E. Artifact write-back** | ✅ Pass | `DocsView` loads artifact sections into the editor and saves blocks back via the artifacts API (sections + optional revision). `surfaces/ai.allternit.com/tests/docs-artifact.spec.ts` passes. |
| **F. Gateway-managed office endpoints** | ✅ Pass | `cmd/allternit-api/src/office_engine_routes.rs` proxies all seven endpoints under `/api/office/*` behind auth; `cargo check` green. |
| **G. Desktop-managed sidecar lifecycle** | ✅ Pass | `surfaces/allternit-desktop/src/main/office-engine-manager.ts` adopts-or-spawns `services/office-engine` (dev: tsx; packaged: esbuild bundle staged by `scripts/prepare-office-engine.cjs` via `extraResources`), wired into boot Step 1.6 and `before-quit`. Desktop unit suite wired to vitest: 89/89 pass. |
| **H. xlsx engine fork** | ✅ Pass | `packages/@allternit/office-xlsx-engine`: vendored Rust sidecar (calamine + IronCalc) + Node JSON-lines client; 3/3 tests against the real binary. Upstream pinned in `upstream/sources.yaml` (rev `8f523289`). |
| **I. Skill migration** | ✅ Done | `.agents/skills/docx/SKILL.md` and `powerpoint/SKILL.md` now document the office-engine endpoints and mark the Summit/document-generator backends deprecated. |

## Architecture (as built)

- **Engine packages** — `packages/@allternit/office-{docx-engine,pptx-engine,pptx-render,file-parse,xlsx-engine}`, forked and rebranded from `@genspark/*`, Apache-2.0 `LICENSE`/`NOTICE` per package, `dist/` ESM + declarations builds. xlsx is a vendored Rust crate (calamine + IronCalc recalc) driven through a JSON-lines sidecar protocol.
- **Editor package** — `packages/@allternit/office-docs-editor`: the single source of truth for the React 18 docs editor (`DocsEditor` + docx web worker). Source-exported, repo `form-surfaces` convention.
- **Web surface** — `surfaces/ai.allternit.com` (`@allternit/ai`, Vite + react-router 7 + React 18): `/docs/:artifactId?` URL route renders `DocsView`, which hydrates title AND content from `/api/v1/artifacts/:id` and saves blocks back as sections. Also registered as shell view type `"docs"`.
- **Dev harness** — `surfaces/allternit-docs` (`@allternit/office-docs`): narrowed to a thin Vite harness importing `@allternit/office-docs-editor`; keeps the Phase 0 Playwright test.
- **Backend** — the Rust axum gateway `cmd/allternit-api` (port 8013) is the platform backend; there is no Next.js server. `office_engine_routes.rs` transparently proxies `/api/office/{parse,roundtrip,pptx/parse,pptx/roundtrip,extract,xlsx/parse,xlsx/recalc}` to the office-engine sidecar (`OFFICE_ENGINE_URL`, default `http://127.0.0.1:8099`), behind the global auth middleware.
- **Desktop** — `surfaces/allternit-desktop`: docs window URL = `new URL('/docs[/:artifactId]', process.env.ALLTERNIT_PLATFORM_URL || activePlatformUrl)`; preload exposes `shellAPI.openDocs(artifactId?)`; `office-engine-manager` keeps the sidecar alive (adopt-or-spawn, best-effort). Renderer `/api/*` calls ride the `allternit-api://` protocol redirect and inherit desktop auth headers.

## Key decisions

1. **Web workers, not WASM.** The docx engine is TypeScript over `jszip` + `fast-xml-parser`; WASM would be a rewrite. Revisit only if profiling demands it.
2. **One editor, one package.** The editor shell lives in `@allternit/office-docs-editor`; both the platform surface and the dev harness consume it. No duplicated editor code.
3. **Gateway proxy, not gateway reimplementation.** The office engine stays a Node/TS sidecar (`services/office-engine`); the Rust gateway proxies to it (same pattern as `orchestrator_routes.rs`). The stale "Next.js API route" option was removed — the surface migrated to Vite long ago.
4. **Vitest aligned.** Engine packages and the office-engine service use Vitest 1.6.1 like the rest of the monorepo.
5. **iOS editing deferred.** Read-only viewing first; native/WKWebView editing after the web editor stabilizes.

## Phase 2 progress (in flight)

- ✅ **Slides editor** — `packages/@allternit/office-slides-editor` + `/slides/:artifactId?` route/view/registry. Text-level editing with engine patch-save, web-worker round-trip, export, artifact write-back (`slides-editor/slide` sections). 5 Playwright tests. Required making the pptx-engine browser-clean (`buffer` polyfill, FNV fingerprint replacing node:crypto SHA-256, pako replacing node:zlib) — 520/520 engine tests still green.
- ✅ **Sheets editor** — `packages/@allternit/office-sheets-editor` + `/sheets/:artifactId?`. Grid UI; opens real .xlsx through new `POST /xlsx/read` service endpoint (cell matrix via sidecar, 17/17 service tests); recalculates through `/xlsx/recalc`; client-side xlsx writer for export (3/3 writer tests, IronCalc-compatible styles); artifact write-back (`sheets-editor/sheet` TSV sections). 6 Playwright tests. Gateway proxies `/office/xlsx/read` too.
- ✅ **PDF viewer** — `packages/@allternit/office-pdf-viewer` + `/pdf/:artifactId?`. pdf.js (pdfjs-dist v5) canvas rendering with page nav + zoom, text extraction per page, export; artifact write-back stores extracted page text (`pdf-viewer/page` sections; text-only mode when no file is open). 4 Playwright tests including a real hand-built PDF parsed by pdf.js.
- ✅ **Unified Documents & Office launcher** — `src/views/office/OfficeLauncherView.tsx` at `/office`: four editor cards (create-new → route) + open-file with real byte handoff (`file-handoff.ts` one-shot stash → router state → `initialFile` prop on all four editors). The cowork `DocumentsView` is consolidated onto it (legacy editor packs superseded; workflow surface preserved). 3 Playwright tests including the full file-handoff chain.

**Phase 2 complete.** All four editors (docs, slides, sheets, PDF) ship as platform routes with artifact write-back; 21 office Playwright tests green.

## Phase 3 complete (desktop programs)

- **Office window manager** — `surfaces/allternit-desktop/src/main/office-programs.ts` (pure, unit-tested) + a generalized `openOfficeWindow(target, artifactId?)` in `unified-main.ts`: one `BrowserWindow` per editor (docs/sheets/slides/pdf) plus the launcher, each loading the platform route (same pattern as `/design`). Tray submenu "Allternit Office" with all five targets; IPC `shell:open-office` (both `handle` and `on` paths); preload `shell.openOffice(target, artifactId?)`.
- **File associations** — `fileAssociations` for .docx/.xlsx/.pptx/.pdf in the electron-builder config; `open-file` (macOS), `second-instance` argv, and cold-start argv all route through `openOfficeWithFile()`, which reads the bytes and delivers them to the loaded window over `office:open-file` IPC. The platform surface's `src/views/office/desktop-bridge.ts` receives the payload (preload `allternit.office.onOpenFile`), stashes it in the launcher file-handoff, and navigates to the right editor.
- **Verification** — desktop unit suite 93/93 (office-programs routing tests included); e2e `tests/office-windows.spec.ts` opens every editor window and the launcher via IPC against the real app (2/2), `tests/docs-window.spec.ts` regression green; desktop typecheck clean. Gotcha documented: `ipcMain.handle` does not receive `ipcMain.emit` — the `on` path exists for fire-and-forget/test calls.

## Desktop office suite — shell-first model (post-UI-port design)

- **Normal use: editors open as ACI shell views** in the main window. The four view types (`docs`/`sheets`/`slides`/`pdf`) are registered in `src/shell/ViewRegistry.tsx` against the real GenOffice apps and receive both `artifactId` and `handoffId` from view context. The office launcher (`cowork-documents` → `DocumentsView` → `OfficeLauncherView`) is shell-aware: given the registry's `open`, it opens editors as in-shell views (with the file handoff flowing through context); on the standalone `/office` route it navigates to the full-page routes instead.
- **Dedicated windows stay for two cases**: "Open with" file associations (focused single-document window) and explicit pop-out/multi-window use. Everything else defaults to shell views.
- **One artifact contract everywhere**: binary sections (`{docs,sheets,slides,pdf}-editor/binary` + plaintext) drive routes, shell views, desktop windows, and the iOS read-only view identically.
- **Platform entry point: the "Office & Extensions" shell view** (`browser-extensions`) hosts the suite — the shared `src/views/office/OfficeSuiteSection.tsx` renders the four Allternit-branded cards (Allternit Docs / Sheets / Slides / PDF) and opens editors as in-shell views via the registry's `open` (`BrowserExtensionsView openView` prop); browser extensions live on the same page below the suite. The standalone `/office` launcher reuses the same section, and the full-page `/docs|/sheets|/slides|/pdf` routes remain for desktop windows and iOS.
- **E2e coverage**: shell views (platform Playwright suite), dedicated windows (`office-windows.spec.ts`), file-save round trip inside Electron (`docs-window.spec.ts`, asserted via `session.defaultSession` `will-download` since Playwright's page `download` event does not fire for blob downloads in Electron).

## Phase 4 (iOS + add-in convergence)

- **iOS read-only viewing** — `surfaces/allternit-mobile/ios/Features/Office/`: `OfficeArtifactClient` (artifact-service client), `OfficeDocumentsView` (list, presented from the Artifacts library toolbar), `OfficeDocumentView` (native read-only rendering of all four editors' section mappings: doc blocks, slide cards, TSV sheet grid, PDF pages), and `OfficeEditorWebView` (WKWebView to the platform editor route, Bearer-signed initial navigation; per-request auth bridging for the SPA's XHRs is a documented follow-up). DEBUG deep-links `-open-office-documents` / `-open-office-document-id <id>` follow the app's existing regression-arg pattern. **Verified end-to-end in the iPhone 16 simulator**: the app builds (BUILD SUCCEEDED), the list shows a live artifact from the gateway, and the read-only view renders its heading + paragraphs natively. Along the way, 10 pre-existing compile errors from other workstreams were fixed minimally (missing `modeStore`/state plumbing in ChatView/ComposerView, `private(set)` store errors given setter methods, an unannotated generic, a private→internal view, a missing `Identifiable` conformance).
- **Add-in backend convergence** — the gateway now mounts the GenOffice engine proxy twice: `/api/office/*` (surface path) and `/api/v1/office/engines/*` (add-in path), coexisting with the legacy `/api/v1/office/cli/*` — OfficeCLI stays operational until the engine backend is proven in production (documented retirement gate).
- **Execution hardening** — `code-executor.ts` split into `executeStructuredCode` (trusted `buildToolCallCode` templates, always runs, blocklist still applied) and `executeCode` (freeform AI code, **default-denied** behind a persisted user opt-in `setFreeformExecutionAllowed`); `useOfficeAgent` tool path moved to the structured executor, freeform path shows a denial notice instead of executing. 6 new gate tests.
- **Plugin path fix** — `plugin-registry.json` and `plugin-loader.ts` embedded paths corrected from the nonexistent `src/plugins/vendor/office-*` to the real `src/plugins/built-in/office-*` (verified against on-disk structure).
- **Binding schema** — `src/lib/office-binding.ts`: zod schemas + factories for `OfficeBinding` and `OfficeRuntimeSession` per `OFFICE_PRODUCTION_ARCHITECTURE.md`, plus a local binding store (`ensureOfficeBinding` — stable bindingId per host+document) that the backend table can later adopt as the same contract. Add-in suite: **127/127 tests pass**, typecheck clean.

## Office AI assistant (office-ai transport)

The vendored GenOffice editors bound their AI panels to Genspark's backend. That layer is replaced with a real Allternit-backed transport, same UI, same `AgentLoop` interface:

- **`packages/@allternit/office-ai`** — `stream.ts`: `streamOfficeAi()` POSTs `/api/agent-chat` and normalizes the platform SSE `{chunk_type, chunk}` stream into delta/tool-call/tool-result/done/error chunks (text chunks are deltas — pure append). `loop.ts`: `OfficeAgentLoop`, interface-compatible with upstream `AgentLoop` (`busy`/`run`/`cancel`/`reset`/`restore`, events `onText`/`onToolStart`/`onToolExecuted`/`onDone`/`onError`/`onTurnEnd`). Single-turn v1: streams chat with the app's skill context (`skill.buildContext()` + `systemSuffix`, string or thunk); tool-call chunks surface as muted "not executed" entries until the Allternit skill runtime phase.
- **Wiring per app** — sheets: `renderer/ai/agent-stub.ts` re-exports `OfficeAgentLoop as AgentLoop`; docs: `src/renderer/ai/AiPanel.tsx` is a real implementation streaming via the loop with document blocks as context; slides/pdf: `stubs/agent-core.ts` re-exports the loop (the vendored `AiPanel`s use it unchanged). Composers use the vendored class names (`.ai-input-box`, `.ai-input-footer`, `.ai-send-btn`, `.ai-attach-btn`, `.ai-composer`) so each app's own skin applies.
- **Settings gate** — the vendored panels refuse to run without a configured provider (`isAgentConfigured()` requires `providers[provider].model` + (`provider === 'genspark'` || `apiKey`)). Each app's bridge returns `{ provider: 'allternit', providers: { allternit: { model: 'default', apiKey: 'platform-managed' } } }` — the key is unused by the transport (the host endpoint owns credentials), it only satisfies the gate. Slides registers its AI IPC channels in the browser bridge (`registerAiIpc()` + `registerSlidesOnlyAiIpc()` after `registerSlidesIpc()` in `installSlidesBridge`); pdf registers `AI_CHANNELS.getSettings` in `installPdfBridge`.
- **E2E proof** — `surfaces/ai.allternit.com/tests/office-ai.spec.ts`: all four editors stream a real answer from a mocked SSE `/api/agent-chat` into the assistant panel (4/4 green).

**Later phases (not yet done):** AI tool execution through the Allternit skill runtime (loop currently marks tool calls "not executed"), and AI settings UI defaults.

**Related:** the anydoc document/URL → Markdown capability (`POST /markdown`, `POST /markdown-url` on office-engine, `markdown-preview` view, desktop target, add-in action) is tracked in `ANYDOC_INTEGRATION_PLAN.md`.

## Phase 5 — OS program packaging: blocked-with-reason (recorded)

The Phase 5 precondition is **not met**: the AllternitOS contract spine (ADR-002–ADR-012) is not ratified — `ALLTERNIT_OS_LIVING_ROADMAP.md` lists ADR creation as outstanding with statuses "investigation"/"recommended", and the capability register records "Contract spine | not started". Per the master plan's own gate, the Documents and Office integration stays internal and does not claim OS program status. Full decision record with evidence and revisit criteria: `docs/GENOFFICE_PHASE5_DECISION.md`.

**Integration complete.** All six master-plan phases are resolved: Phases 0–4 shipped and verified; Phase 5 recorded as blocked-with-reason per its documented precondition.

**Known upstream issue:** the vendored crate's `convert_workbook` writer omits `<cellStyles>` from styles.xml, and IronCalc's importer panics on that — recalc against converted files fails until the crate writer is patched (fixture workaround: include `<cellStyles>`; the editor's client-side writer already does).
