# 2026-09-07-0832 — Office Extensions: Native Suite Integration + MS Add-in Rewire

- **Session:** `session/office-ext-20260907` (worktree `allternit-session-office-ext-20260907`)
- **Agent family:** kimi
- **Branch state:** Phase 0 `761c5ff20`, Phase 1 `40732354d`, Phase 2 `2964082b9` — all pushed to origin. Phase 3 polish commit pending final sweep (see Unfinished).

## What was done

Three-phase overhaul of the Allternit Office extension story, per approved plan (`sandman-atom-smasher-sentry.md`).

**Phase 0 — audit hygiene (`761c5ff20`)**
- Fixed the red `office.allternit.com` typecheck (tsconfig ES2021→ES2022; `office-pptx-render` uses `Intl.Segmenter`).
- `build-office-addin.yml` CI path filters pointed at a nonexistent `extension-shared/**` — corrected to `surfaces/allternit-extensions/extension-shared/**`.
- Chrome extension `plugin-registry.json` pointed at nonexistent `plugins/vendor/chrome` → `built-in/chrome`.
- Deleted stale compiled artifacts in `extension-shared/extension-sidepanel/` (zero importers).
- Removed dead Rollup externals for the never-existed `@allternit/allternit-office-suite` package name in `ai.allternit.com/vite.config.ts`.
- pdfjs-dist 5.x→6.3.289 in 5 package.json files (GHSA-hq66-cqwq-w95j); migrated `PDFDocumentProxy.destroy()` → `PDFDocumentLoadingTask.destroy()` (pdfjs 6 API removal) in office-file-parse, office-pdf-app (incl. loadDoc signature: dropped `previous` param, added `pdfTaskRef`), office-pdf-viewer.
- Docs drift: extensions README paths, add-in README quick-start, DEPLOYMENT.md hosting origin unified on `https://platform.allternit.com/office-addins/`.

**Phase 1 — native extension slot (`40732354d`)**
- `OfficeHost.extensions` + `OfficeExtensionDescriptor`/`OfficeExtensionContext` added to the suite bridge contract; `OfficeAiSlot` + `useOfficeExtensions` + `createAllternitAssistantExtension` in `packages/@allternit/allternit-office-suite/src/extensions/` (exported via root and `./bridge`).
- Registered extensions **occupy each vendored app's existing AI chat section** (Docs/Sheets/Slides/PDF mount sites wrapped; built-in panels are the fallback when no extensions registered — standalone behavior bit-for-bit preserved).
- Allternit Assistant: `useOfficeAi()` contract, per-appKey model picker, `AgentLoop` streaming chat, active-document awareness via module registry populated by the suite app adapters.
- Wired into `office.allternit.com` (all five tabs; Sign gets a 360px side slot + AI rail since it has no chat surface) and `ai.allternit.com` platform views via shared `getOfficeExtensions()` — which is what desktop Office windows load.

**Phase 2 — MS Office add-in rewire (`2964082b9`)**
- Taskpane mode switch: full in-pane AI (`OfficeSidepanelApp` = `useOfficeSidepanelAdapter` + shared `ExtensionSidepanelShell`) when Office.js ready AND bootstrap/auth context; companion document-binding shell preserved as fallback; live upgrade on auth/bootstrap events (`runtime-mode.ts`, 6 tests).
- Live document context fed to the agent per conversation start: bridge summary + markdown export + officecli snapshot note, `allSettled` best-effort, 16k/24k caps (`document-context.ts`, 5 tests).
- Real model default `claude-3-5-sonnet` (`agent-defaults.ts`) matching gateway `config/allternit.json` `agent.default_model` (bootstrap payload verified to carry no model info). Replaced invented `claude-sonnet-4-6` strings.
- Fixed pre-existing `ToolExecutionCard` TDZ crash in shared `ExtensionSidepanelShell.tsx` (blocked typecheck once the shell was actually imported).
- Hosting made real: `platform.allternit.com` = Cloudflare Pages project `allternit-platform` from `surfaces/platform.allternit.com/dist`; `deploy-cloudflare-pages.yml` now builds the add-in with prod env and `postbuild.mjs` embeds `dist/office-addins/` (prefers `deployment/office-addins`). Manifests regenerated: Version 1.1.0.0, SourceLocation `platform.allternit.com/office-addins/...`. `deployment/` gitignored.
- README/DEPLOYMENT.md rewritten to describe the wired reality. Tests 132→143.

**Phase 3 — polish (uncommitted at writing)**
- "GenOffice" user-facing copy renamed to Allternit Office (OfficeSuiteSection, OfficeLauncherView, nav comments, desktop office-programs comment). Provenance comments ("ported from GenOffice") and the PDF annotation producer string `T:'GenOffice'` deliberately left — they document fork lineage / are baked into saved-file metadata.
- `surfaces/allternit-extensions/README.md` now documents the three surfaces (native suite panel, Chrome extension, MS Office add-in).
- `cmd/gizzi-code/docs/DEPENDENCY_AUDIT.md` stale note about the dead `@allternit/allternit-office-suite` workspace name marked RESOLVED.

## How it works (integration contract)

Embedding hosts register extensions: `createBrowserHost({ extensions: [createAllternitAssistantExtension()] })` or directly on the `OfficeHost` passed to `OfficeHostProvider`. `OfficeAiSlot` (rendered at each vendored app's chat mount) reads `host.extensions` — empty → built-in panel; non-empty → tab strip (one tab per extension + "Built-in") occupying the same dock. The Assistant inherits whatever `OfficeAiClient` the host provides (`useOfficeAi()`), so office.allternit.com (standalone AI client, Clerk-gated), the platform views, and any future host each keep their own AI wiring.

## Verification

- Phase gates all green: suite + 4 vendored apps + office-surface typecheck/build; `ai.allternit.com` (`@allternit/ai`) typecheck/build; xlsx-engine tests; add-in 143/143 tests + typecheck + prod-base build (assets under `/office-addins/` grep-confirmed); manifest regen + deploy.sh verify; desktop `prepare:office-addins` interface unchanged; extension `wxt build`.
- Final sweep (desktop typecheck, all above re-run) — results in this session's task log at sweep time.

## Unfinished / deferred

- **MERGED to main @ 4f7a3d00d (remote push, fast-forward):** origin/main (153291895, later 5bd4fc589) was merged into the session branch (conflicts in `.steering/checkpoint.md` + `agent-ledger/LEDGER.md` resolved; post-merge sweep green). The shared main checkout had another session's active uncommitted work in overlapping files, so the merge landed via `git push origin HEAD:main` instead of a local-checkout merge — zero risk to that session's work; it pulls when ready. Worktree + session branch removed after the push.
- Sideload smoke in real Word/Excel/PowerPoint is manual (documented in add-in README/DEPLOYMENT.md).
- `ARCHITECTURE.md` (add-in) still philosophically conflicts with the advanced settings panel — needs a product decision.
- Add-in local `pnpm build` without env vars rewrites tracked manifests to localhost URLs (pre-existing footgun; deploy.sh/CI always set env).
- `pnpm test:hosted` / `test:binding` need live HTTPS + gateway endpoints.
- `sdk/allternit-sdk` still pins pdfjs-dist 5.x (separate owner, flagged in DEPENDENCY_AUDIT.md).
- Sign tab uses `appKey="pdf"` (no `'sign'` in `OfficeAppKey`); cosmetic cross-tab document-name echo.
- Fresh worktrees must build the vendored page-agent dist bundles (`allternit-extension/packages/*`) before `wxt build` — gitignored bootstrap step.
