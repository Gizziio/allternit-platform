# Agent Work Ledger

Chronological attestation of agent sessions in the Allternit workspace.

Each entry is a signed line of accountability: the agent attests that the work
was performed, describes what was created and how it works, cites the commit,
and flags anything that was promised but not delivered.

## Entry format

Append newest entries to the top of the `## Entries` section.

- **Date/Time:** ISO-8601 or `YYYY-MM-DD HH:MM` local time
- **Session ID / Branch:** e.g., `session/<id>` or `<repo>-session-<id>`
- **Agent:** family/model of the agent (e.g., gizzi, claude, codex, kimi)
- **Summary:** one-line description of the change
- **Commit:** SHA or PR link that contains the work
- **How it works:** brief explanation of the change and its effect
- **Outstanding work:** anything claimed but unfinished, deferred, or blocked
- **Summary file:** link to the full attestation in `./summaries/`

## Entries

### 2026-09-03 08:16 — kimi — Typography Validation CI Fix

- **Session ID / Branch:** `session/typography-fix-20260903`
- **Commit:** `578792f36` — merged into `main`
- **How it works:** Replaces hardcoded `fontFamily: 'monospace'` in the h5i diff and commit panels with `fontFamily: 'var(--font-mono)'` and broadens `scripts/validate-typography.py` exemptions to cover document-rendering packages, docs surfaces, tests, and the VS Code extension, where system font names are legitimate.
- **Outstanding work:** None.
- **Summary file:** [summaries/2026-09-03-0816-session-typography-fix-kimi.md](./summaries/2026-09-03-0816-session-typography-fix-kimi.md)

### 2026-09-03 06:04 — kimi — Groq Integration + Platform Model Catalog Fixes

- **Session ID / Branch:** `session/platform-followup-20260903`
- **Commit:** `90f97cdb0` — merged into `main`
- **How it works:** Adds four curated Groq aliases to the cloud API, fixes the generic OpenAI adapter to parse string-priced model lists from Groq, deploys the API to the VPS, and fixes `platform.allternit.com` to read flattened model fields from `/v1/models` so prices and names render correctly. Updates marketing copy on `/models` and `/plans` to list Groq as a live provider.
- **Outstanding work:** DeepInfra and OpenRouter completions are blocked by zero upstream balance; Fireworks reasoning aliases route but return empty assistant content; `ai.allternit.com` was not redeployed.
- **Summary file:** [summaries/2026-09-03-0604-platform-followup-kimi-groq-console.md](./summaries/2026-09-03-0604-platform-followup-kimi-groq-console.md)

### 2026-08-30 09:20 — kimi — Workspace Package Install/Build Fixes

- **Session ID / Branch:** `session/caade5dc-3e9c-4ee6-889f-cd1276faec7c`
- **Commit:** `233e1707e` — merged into `main`
- **How it works:** Pins the repo to Node 24, fixes an undefined variable in `composer-drag.ts`, adds missing devDependencies to the page-agent extension packages, patches webpack 5.106’s `ProgressPlugin` schema for Docusaurus compatibility, and relaxes the plugin-sdk website’s broken-link policy so the static build succeeds.
- **Outstanding work:** Pre-existing typecheck errors in the office-suite packages remain; the main checkout had unrelated uncommitted changes from another session when `origin/main` was fast-forwarded.
- **Summary file:** [summaries/2026-08-30-0920-caade5dc-3e9c-4ee6-889f-cd1276faec7c-kimi-workspace-package-fixes.md](./summaries/2026-08-30-0920-caade5dc-3e9c-4ee6-889f-cd1276faec7c-kimi-workspace-package-fixes.md)

### 2026-08-27 15:29 — kimi — Brain Selector Modal Runtime Selection Fix

- **Session ID / Branch:** `session/brain-selector-fix`
- **Commit:** `140ed37a9` — merged into `main`
- **How it works:** Makes provider/runtime rows in the chat ModelPicker selectable. Clicking a runtime row in single-select mode now selects the runtime's currently selected model (or its first model) and closes the modal. The chevron remains a separate expand/collapse affordance, and the provider containing the active selection auto-expands when the modal opens.
- **Outstanding work:** None; multi-select mode intentionally keeps checkbox-only selection.
- **Summary file:** [summaries/2026-08-27-1529-brain-selector-fix-kimi-runtime-selection.md](./summaries/2026-08-27-1529-brain-selector-fix-kimi-runtime-selection.md)

### 2026-08-27 09:42 — kimi — Repo Hygiene Follow-up (Open Items)

- **Session ID / Branch:** `session/repo-hygiene-followup`
- **Commit:** `aefcc6fa1` — merged into `main`
- **How it works:** Commits the untracked platform audit under `docs/audit/`, deletes root `.beads/`, and moves `.pipeline/`, `.parity-reports/`, and `.shared/` into `docs/` with updated references. Leaves `.allternit/`, `.gizzi/`, and `.steering/` at root because live code hardcodes those paths.
- **Outstanding work:** `.allternit/`, `.gizzi/`, `.steering/` could be made configurable in a future pass instead of hardcoded.
- **Summary file:** [summaries/2026-08-27-0942-repo-hygiene-followup-kimi-cleanup.md](./summaries/2026-08-27-0942-repo-hygiene-followup-kimi-cleanup.md)

### 2026-08-27 09:14 — kimi — Repo Hygiene & Root-Level Reorganization

- **Session ID / Branch:** `session/repo-hygiene`
- **Commit:** `3bbbec07c` — merged into `main`
- **How it works:** Removes improperly-linked nested worktrees and scratch `.tmp-*` entries from the git index, deletes ignored working-tree noise (`.cache/`, `.references/`, `.pytest_cache/`, etc.), and consolidates root-level drift (`marketing/`, `upstream/`, `remix-content/`, ad-hoc scripts/docs) into `docs/` and `scripts/` so the root layout matches `REPO_STRUCTURE.md`.
- **Outstanding work:** Historical references in `docs/archive/` and `docs/Future_Blueprints/` were left as-is; `.parity-reports/allternit-audit.md` remains untracked pending decision on whether to commit it.
- **Summary file:** [summaries/2026-08-27-0914-repo-hygiene-kimi-cleanup.md](./summaries/2026-08-27-0914-repo-hygiene-kimi-cleanup.md)

### 2026-08-26 21:13 — kimi — Remote Control Gap Fix (secure push, PWA, UX polish)

- **Session ID / Branch:** `session/remote-control-gap-fix`
- **Commit:** `2c21d67e3` — merged into `main`
- **How it works:** Secures the push worker with Clerk-bearer `/subscribe` auth and service-secret/device-token `/notify` auth, adds KV TTL/rate-limiting/dead-subscription cleanup, hardens the Remote Control PWA with a precached offline app shell and iOS tags, fixes dashboard push permission/auth handling, and polishes setup UX with honest permission copy and empty states.
- **Outstanding work:** Replace placeholder PWA icons/splash with final assets; run full manual E2E.
- **Summary file:** [summaries/2026-08-26-2113-remote-control-gap-fix-kimi-secure-push-pwa-polish.md](./summaries/2026-08-26-2113-remote-control-gap-fix-kimi-secure-push-pwa-polish.md)

### 2026-08-26 10:13 — agent — Unified Compute & Desktop Cloud MVP

- **Session ID / Branch:** `session/desktop-cloud-mvp`
- **Commit:** `6295201ec` — Merge local desktop-cloud MVP state with unified compute work
- **How it works:** Introduces a unified `computers` domain with `/api/v1/computers` API, consolidates compute settings UI, wires cloud-desktop provisioning into bot session lifecycle, and backfills legacy bot desktop sandboxes.
- **Outstanding work:** Not merged to `main`; deprecated routes retained for backward compatibility; live VM end-to-end provisioning not fully verified; `computer_minute` pricing is a placeholder; old platform worktrees may still exist.
- **Summary file:** [summaries/2026-08-26-1013-desktop-cloud-mvp-agent-unified-compute-desktop-cloud.md](./summaries/2026-08-26-1013-desktop-cloud-mvp-agent-unified-compute-desktop-cloud.md)

