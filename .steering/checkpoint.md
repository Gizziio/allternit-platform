# Steering checkpoint

## Goal
Allternit Office extensions overhaul (worktree `allternit-session-office-ext-20260907`, branch `session/office-ext-20260907`):
1. Phase 0 — audit fixes/hygiene (suite typecheck red, CI path filters, docs drift, plugin-registry path, stale artifacts/externals, pdfjs-dist GHSA, hosting origin decision)
2. Phase 1 — native plugin slot in `@allternit/office-suite` OfficeHost; Allternit Assistant occupies the existing per-app chat section (Docs/Sheets/Slides/PDF), wired in office.allternit.com + ai.allternit.com platform views (desktop gets it via platform routes)
3. Phase 2 — MS Office add-in: wire orphaned full AI agent into taskpane entrypoint; fix hosting (platform.allternit.com/office-addins) + docs
4. Phase 3 — polish (GenOffice naming, extensions README, audit doc) + final verification

Plan file: ~/.kimi-code/sessions/wd_joe_db5f68cf8615/session_2391eb48-ed41-4c53-8a90-5c115bedb60d/agents/main/plans/sandman-atom-smasher-sentry.md

## Just did (Phase 0, uncommitted)
- office.allternit.com tsconfig target/lib ES2021 → ES2022 (fixes Intl.Segmenter typecheck failure from office-pptx-render sources)
- build-office-addin.yml path filters: `extension-shared/**` → `surfaces/allternit-extensions/extension-shared/**` (both push + PR)
- allternit-extension plugins/plugin-registry.json: vendor/chrome → built-in/chrome (verified built-in/chrome exists)
- Deleted stale committed artifacts extension-shared/extension-shared... ExtensionSidepanelShell.js + .types.js (grep confirmed zero importers)
- Removed stale `@allternit/allternit-office-suite` Rollup externals block in ai.allternit.com/vite.config.ts (name doesn't exist; real package bundles)
- surfaces/allternit-extensions/README.md: shared-shell path + theme.css source-of-truth path corrected
- allternit-office-addin README quick-start path corrected; DEPLOYMENT.md hosting origin unified on https://platform.allternit.com/office-addins/ (matches committed manifests)
- pdfjs-dist ^5.4.x → ^6.3.289 in 5 package.json files (GHSA-hq66-cqwq-w95j fix ≥6.2.108); pnpm install running

## Next
- Phase 0 gate: typecheck office-surface / office-suite / pdf packages (catch pdfjs 6.x API breaks), wxt build extension, add-in tests
- Commit Phase 0; then Phase 1 (suite extension slot + OfficeAiSlot + Assistant + consumer wiring)

## Open questions
- pdfjs-dist 6.x API compat with existing pdf-signing/pdf-viewer usage — will know at typecheck gate
- Phase 2: how platform.allternit.com serves static assets — need to find its hosting setup before adding /office-addins/ route
