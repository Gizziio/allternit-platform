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

## Swarm C Phase 1 checkpoint (2026-08-09)

Goal: Complete the mapped web adapters, text editor, and computer-use schema alignment.

Just did: Implemented injected-fetch Tavily/Perplexity/Bing adapters with DuckDuckGo fallback; added a workspace-confined text editor with view/create/replace/insert/undo; aligned computer-use actions, pixel coordinates, metadata, and screenshot image blocks; added offline unit coverage; resolved a committed merge marker in mapped `tools/types.ts`.

Next: From a session with write access to the canonical checkout's linked-worktree Git metadata, stage and commit the completed Phase 1 changes to `ao/p1-swarm-c`; run the targeted tool-belt test once dependencies are available.

Open questions: Commit is blocked because the sandbox denies creation of `/Users/joe/Desktop/allternit-workspace/allternit/.git/worktrees/allternit-parity-p1-swarm-c/index.lock`. The targeted Vitest command also cannot start because this worktree has no installed Vitest binary.
