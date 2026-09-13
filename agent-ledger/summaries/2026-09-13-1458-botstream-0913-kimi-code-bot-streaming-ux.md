# Session attestation — botstream-0913 — bot streaming UX (landed directly to main)

**Date:** 2026-09-13 ~14:58 local
**Branch:** `ao/bot-streaming-ux` (worktree `allternit-session-botstream-0913`) → landed on `main` as `d69ade9a5` + `9cf1dcd80` (cherry-picked; original branch SHAs `a035a354d` set, never pushed)
**Scope:** perceived-latency work for bot chat (the "Grok fast-first-response" problem) + the console branch integration

## What was done

### 1. Bot streaming UX (the 2 commits on main)

- **First-response preamble** (`canonical-chat.ts`, `prompt.ts`, `bot-routines.ts`): opt-in system-prompt section, active only on user-chat and teammate-DM turns (not cron routines — detected via `ROUTINE_MARKER_PREFIX`, not subtasks, not retries). Bot emits one ≤25-word sentence naming its next action before its first tool call.
- **Live activity line** (`ActivityLine.tsx`, `transcript.ts` fold): latest tool call (name + 80-char input summary, spinner/✓/✗) renders transiently under the in-flight turn; never materializes into settled transcript rows.
- **Stream metrics** (`stream-metrics.ts`, `BotChatSessionView.tsx`): TTFT ("first token 1.4s") folds into a windowed tok/s chip in the chat status line. Exact tok/s when real usage is present, `~` estimate (chars/4) otherwise.
- **Compaction notice** (`SystemLine.tsx`, `agent-compat.ts`, `v1_routes.rs`): `session.compacted` bus event was being dropped by both SSE layers; now translated to a `context_compacted` frame in the gizzi `/agent-chat` stream and the Rust `agent_chat_bridge` (which also serves the desktop operator shell — that path needed no separate work).
- **Usage in finish frames**: `finish` frames in both SSE layers now carry `usage {inputTokens, outputTokens}` captured from the last `message.updated` event (per-step, not turn-aggregate — gizzi doesn't aggregate tokens across steps).
- **Routine-pending label** (`nextRoutineLabel` in `bot-session-chrome.ts`): client-only, sourced from the existing bot-routine zustand store; `next routine "x" in 5m`-style status line. No new endpoint needed.

### 2. Console branch integration (orchestrated, not authored)

`ao/platform-console-agents` had 5 committed cowork commits + 1 uncommitted fabric-session edit pass. Orchestrated: committed the fabric work in the shared checkout (`7e49bb723`, build artifacts excluded, `.gitignore` rules added), cherry-picked all 6 onto main with conflict resolution, verified. **While integrating, another session merged origin/main into the console branch and pushed it to main directly** — the original SHAs landed, our cherry-picked duplicates dropped as empty during rebase (`--empty=drop`). Net: nothing duplicated; history slightly tangled (main contains both the branch merge and, redundantly, our CHANGELOG/test-suite commits' content already upstream).

## Verification evidence

- gizzi-code `bun run typecheck` → exit 0 (pre-rebase integration and final rebase).
- gizzi-code `bun test test/runtime/bots/` → 110/110–112/112 across runs; the one intermittent failure (`markBotRead` watermark timeout) reproduced at the pre-change base — pre-existing.
- Surface `pnpm vitest run src/components/bot-chat src/lib/bots src/lib/agents` → 756/757; sole failure `vm-operator.test.ts` (disk default 102400 vs 20480) fails identically at origin/main tip — pre-existing upstream, unrelated to this work.
- `pnpm run typecheck:fast` → ~39–45 errors, byte-identical to the known pre-existing set (xterm css, office asset declarations, `import.meta.env`); zero in touched files.
- `cargo check -p allternit-api -p allternit-cloud-api` → exit 0 (pre-existing warnings only).
- `node scripts/release-preflight.mjs` → **35/0** (desktop release lock satisfied).
- Final push: `7de4678d8..9cf1dcd80 main -> main` after three origin/main moves (PRs #479, #480, #481 landed mid-integration; final rebase clean, zero conflicts).

## Incidents

- Origin/main moved **three times** during integration (busy machine, multiple concurrent sessions). Last rebase (`7de4678d8` base) replayed the 2 streaming commits with zero conflicts; re-verified cargo check + gizzi typecheck before pushing.
- The console branch's dead-code deletion (2ce28cb3e: `CoworkStreamBlock.tsx`, `CoworkModeAgentTasks.tsx`, ~650 lines, zero importers) did NOT survive: the other session's branch-merge kept main's versions. Deletion still worth landing separately.
- Memory-search pagination from 0fd578c8b was superseded by main's A-T2 principal-scoped memory model (`search_memory_entries`, default-deny grants, no offset param). Intentionally not ported; add offset support to the runtime function if client pagination is wanted.

## Honest deferrals

- **Desktop rebuild from merged main not run** at attestation time (step 8 of the ritual) — touched code is bundled by the desktop (gizzi-code + allternit-api sidecars); rebuild launched as follow-up.
- Routine-pending label reads only the PWA's local routine store (per-device view), not server-side schedule state.
- `finish`-frame usage is last-step-per-request, not a turn aggregate — tok/s for multi-step turns reflects the final step.
- The shared checkout still has `package-lock.json` untracked in `surfaces/allternit-desktop` (deliberately neither committed nor ignored — owner's call).
