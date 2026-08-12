# Steering checkpoint

## Goal

Finish the Allternit Desktop auth/onboarding handoff: review fixes 1–13, implement the two remaining items (#14 Sidecar-backed Local Brain model routes + ModesStep rework, #15 `gizzi init` wiring), then build/test/package and commit scoped changes.

## Just did

- Implemented #14 end-to-end:
  - Added `cmd/gizzi-code/src/runtime/server/routes/sidecar.ts` exposing `/sidecar/models` (list), `/sidecar/models/search` (HF GGUF search), `/sidecar/models/install` (SSE install progress), `/sidecar/models/:tag/remove`.
  - Registered the route in `cmd/gizzi-code/src/runtime/server/server.ts` under both unversioned `/sidecar` and `/v1/sidecar`.
  - Added proxy routes in `cmd/allternit-api/src/local_brain_routes.rs` under `/api/local-brain/models/*` forwarding to gizzi-code.
  - Added `setupApi.listLocalModels` / `searchLocalModels` / `installLocalModel` / `removeLocalModel` in `surfaces/ai.allternit.com/src/services/setup-api.ts`.
  - Reworked the `ModesStep` Local Brain UI to list installed sidecar models, search HuggingFace, install with SSE progress, remove, and select as the default brain.
- Implemented #15 end-to-end:
  - Extracted reusable `initializeProject()` into `cmd/gizzi-code/src/runtime/project/init.ts`.
  - Refactored `cmd/gizzi-code/src/cli/commands/init.ts` to call the shared function (no CLI behavior change).
  - Added `POST /v1/project/init` route in `cmd/gizzi-code/src/runtime/server/routes/project.ts`.
  - Added `POST /api/onboarding/init-project` proxy in `cmd/allternit-api/src/onboarding_routes.rs`.
  - Added `setupApi.initProject()` and wired it into the wizard `finish()` handler using `data.workspacePath`.
  - Added workspace path to the Done screen summary.
- Verified code health:
  - `cargo check -p allternit-api` ✅
  - `cargo build --release -p allternit-api` ✅; copied fresh binary into `surfaces/allternit-desktop/resources/bin/allternit-api`.
  - `bun run typecheck` in `cmd/gizzi-code` ✅
  - `pnpm exec tsc --noEmit` in `surfaces/ai.allternit.com` ✅
  - `pnpm test` in `surfaces/allternit-desktop` ✅ (94 passed)
  - Desktop main/preload typecheck ✅
- Started full DMG build (`npm run build:electron:dmg` with live Clerk key) — currently running in background task `bash-z0fskqnw`.

## Next

1. Wait for DMG build to finish; inspect result.
2. Stage and commit the scoped set of files touched for this handoff, avoiding unrelated WIP.
3. Update this checkpoint once commits are ready for steering approval.

## Open questions

- Worktree policy: AGENTS.md requires sessions to use linked worktrees, but the entire handoff state (fixes 1–13) is in the main checkout. Working in main checkout to avoid losing/cherry-picking 194 files of WIP; commit guard will be triggered for approval.

## Files changed / to commit

New:
- `cmd/gizzi-code/src/runtime/server/routes/sidecar.ts`
- `cmd/gizzi-code/src/runtime/project/init.ts`

Modified:
- `cmd/gizzi-code/src/runtime/server/server.ts`
- `cmd/gizzi-code/src/runtime/server/routes/project.ts`
- `cmd/gizzi-code/src/cli/commands/init.ts`
- `cmd/allternit-api/src/local_brain_routes.rs`
- `cmd/allternit-api/src/onboarding_routes.rs`
- `surfaces/ai.allternit.com/src/services/setup-api.ts`
- `surfaces/ai.allternit.com/src/components/onboarding/OnboardingFlow.tsx`
- `surfaces/allternit-desktop/resources/bin/allternit-api` (binary refresh)

---

## Swarm E checkpoint (2026-08-09)

Goal: Complete Swarm E Enterprise Auth & Vault Phase 0.

Just did: Added V36 credential/vault schema, scoped enterprise credential management and bearer authentication, encrypted AllternitVault storage, and authenticated gateway idempotency ownership.

Next: Stage and commit the completed Phase 0 files once the linked-worktree Git index is writable.

Open questions: Commit is blocked because the sandbox denies creation of the linked-worktree `index.lock` under the canonical checkout's `.git/worktrees` directory. Builds/tests are intentionally not run under the Swarm E repository instructions.

---

## Swarm A checkpoint (2026-08-09)

Goal: Complete Swarm A Core API / Harness Phase 2.

Just did:
- Verified the SDK retry/backoff interceptor (`retry.ts`) and wired it into the Anthropic BYOK fetch path.
- Added `GET /v1/rate-limits` to the LLM gateway (`auth.rs`, `proxy.rs`, `mod.rs`) with unit tests.
- Added normalized `HarnessStopReason` taxonomy to harness types, mapped Anthropic/OpenAI stop/finish reasons via `mapStopReason`, surfaced the reason in `run()`/`done` chunks, and emitted `run.stop` lifecycle events from `RunState`.
- Added legacy OpenAI `functions`/`function_call` output support to `toOpenAIRequest` with tests.
- Updated harness tests and added `provider-request.test.ts`.
- `cargo check -p allternit-api` and `cargo test -p allternit-api --lib` pass (136 tests). Targeted `bun test` for `sdk/allternit-sdk/src/ai-runtime/harness/__tests__` passes (51 tests). Broader `bun test` in the SDK has pre-existing failures (missing `zod` dep, unimplemented Google/Local harness streaming) not introduced by these changes.

Next: Stage all Phase 2 files and commit to `ao/p2-swarm-a`, then write `docs/SWARM_A_PHASE2_NOTES.md`.

Open questions: None.

---

## Codex manual parity part 3 checkpoint (2026-08-12)

Goal: Document Allternit parity for the assigned Codex manual part 3 items
covering configuration, UI, integrations, permissions, observability, and
security workflows.

Just did: Created `docs/public/parity/codex-manual-part3.md` and its required
coverage report. Mapped project discovery, worktrees, approvals, credentials,
provider endpoints, model availability, MCP/apps, agents/hooks, web search,
TypeScript, TUI customization, analytics, OTLP, and vulnerability reporting;
marked Codex-hosted and literal-schema-only features as not applicable or
roadmap.

Next: Reviewer can validate the semantic mappings and decide whether the
documented network-proxy, Windows-isolation, TUI, OTLP, and security-workbench
gaps should become implementation tasks.

Open questions: None. Documentation-only work; no build was run.

---

## Parity docs: developer commands (2026-08-12)

Goal: Document Allternit parity for the 53 assigned ChatGPT/Codex developer-command items.

Just did: Researched the Gizzi TUI command registry, global CLI flags,
keybinding schema, session lifecycle APIs, connector catalog, MCP server, work
queue, memory, preferences, permissions, and hooks. Created
`docs/public/parity/developer-commands.md` and the required coverage report.

Next: Reviewer can validate command naming and roadmap classifications. No build
is needed because the change is documentation-only.

Open questions: None.

---

## Codex manual parity part 4 checkpoint (2026-08-12)

Goal: Document Allternit parity for the assigned Codex manual part 4
configuration literals.

Just did: Created `docs/public/parity/codex-manual-part4.md` with researched
mappings for providers, MCP/OAuth, compaction and memory, tools, sandboxing,
history/OTel, TUI controls, authentication, connectors, and web search. Added
the required `.parity-reports/codex-manual-part4.md` report. Unsupported
Codex-hosted and configuration-specific controls are explicitly labeled not
applicable or roadmap.

Next: Reviewer can validate wording and roadmap classifications. No build is
needed because the changes are documentation-only.

Open questions: None.

---

## Parity docs: non-interactive, commands, prompts, administration, usage (2026-08-12)

Goal: Document the 24 assigned OpenAI ChatGPT/Codex handoff items across five
Allternit parity pages.

Just did: Researched `gizzi exec`, stdin/structured output, auth profiles,
session resume, TUI commands/keybindings/search, guarded deep links, custom
command frontmatter, admin routes/CLI, gateway budgets, spend caps, and managed
session budgets. Created the five public pages and the required coverage report;
classified hosted ChatGPT subscription allowances and implicit external posting
as not applicable to the self-host/BYOC model.

Next: Reviewer can validate terminology and cross-links. No build is needed
because the change is documentation-only.

Open questions: None.

---

## Codex manual parity part 1 checkpoint (2026-08-12)

Goal: Document Allternit parity for the 118 assigned Codex manual items through
`History & File Opener`.

Just did: Created `docs/public/parity/codex-manual-part1.md` with configuration,
provider, sandbox, MCP, session, UI, analytics, governance, and security mappings;
marked unsupported Codex syntax and SaaS-only concepts as not applicable/roadmap;
created the required `.parity-reports/codex-manual-part1.md` report.

Next: Reviewer can validate terminology and decide whether roadmap gaps should
be promoted into implementation tasks.

Open questions: None.
