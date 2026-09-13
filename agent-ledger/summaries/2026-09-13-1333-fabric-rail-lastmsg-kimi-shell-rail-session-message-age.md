# Shell rail sessions: current message + age (PR #310)

**Session:** `ao/fabric-pwa-phone-polish` (branch merged via PR #310, merge commit `9f399c9e0`)
**Date:** 2026-09-13
**Agent family:** kimi

## What was done

Every session row in the shell rail's bot-mode **Sessions** panel now shows (1) the text of the last user prompt the bot is working on, truncated, and (2) a relative age chip ("2m") for how long ago that message arrived. Covers every session row; rows whose harness has no recoverable prompt render unchanged (single line).

End-to-end data path, all new plumbing:

- **ao-engine native catalog** (`infrastructure/executor/ao-engine/src/ao/native/`): `NativeSession` gained `lastPrompt`/`lastPromptAt` (epoch ms), populated per harness from each CLI's own on-disk session files — chosen over send-layer capture because prompts arrive via `ao-send`/tmux send-keys as well as the engine, but every harness persists to disk regardless of transport:
  - **kimi** — `state.json lastPrompt` + last `prompt.accepted` record in `agents/main/wire.jsonl` (with cross-fallbacks in both directions)
  - **claude / gizzi / qwen / cursor** — last `type:"user"` line in the transcript (claude-like readers; cursor-agent is a claude fork and reuses the extractor)
  - **codex** — last `payload.type:"user_message"` rollout line
  - **grok** — last `user_message_chunk` run in `updates.jsonl` (contiguous chunks joined; epoch secs → ms)
  - **kimi-cli, amp** — last user record text; no per-message timestamp exists in those formats → age chip omitted
  - **copilot, pi, omp, openhands, muse, vibe, gemini, droid** — generic tolerant tail-scan for the last user record (role/type/source/payload markers; string or block-array content; gemini single-line JSON arrays; epoch s/ms/ISO normalized)
  - All extraction is bounded 64KB tail-reads (seek-from-end, never whole files — the visibility call runs under an 800ms gateway timeout); every fallible step degrades to `None`, no panics. cline/amp reuse documents those walkers already read in full (no new I/O).
- **ao-engine visibility** (`ao/visibility/mod.rs`): `PanelEngineAgent` gained `lastMessage`/`lastMessageAt`, populated from the already-joined native catalog row; peer-backed panes join peer cwd+vendor → catalog row (max `updatedAt`) when no `agent_session` join exists.
- **Gateway** (`cmd/allternit-api/src/rails/`): `VisibilityPane` gained `lastMessage`/`lastMessageAt` (explicit serde renames to camelCase) and passes them through from the parsed agent; PeerRegistry fallback path leaves them `None`.
- **Client** (`surfaces/ai.allternit.com`): `VisibilityPane`/`CommRailItem` types + `parseDto`; the commrail-sections hook now re-fetches visibility every 15s (cleared on unmount, keeps last good snapshot on failed/down polls so the rail never blanks); Sessions rows restyled to the established two-line rail pattern (label+status, then muted truncated message + `text-[10px]` age chip via the file-local `formatRelativeTime`) — no second line when no prompt was captured.

## Also fixed (same PR)

- **ao-engine did not compile**: commit `0290d9c95` added `src/ao/mailbox.rs` importing `allternit_agent_system_rails` without declaring the dep. Added `allternit-agent-system-rails = { workspace = true }` to `ao-engine/Cargo.toml`. Verified this is the correct fix (every imported type/method exists in `commrails/compat`, the repo's intentional alias crate; module doc names it explicitly). Dev-profile `cargo check` had been masking it because the failing crate resolved in a different feature order — surfaced by `cargo build --release`.
- **Cursor walker never listed anything**: its `.jsonl` filter used `Path::ends_with` (component match, always false) — now a string suffix check.

## Merge notes

The branch also carried the earlier phone-home commit `ec501f045`. Merging required resolving conflicts against main's 564 intervening commits in 4 files (none from this feature — it merged cleanly): `.steering/checkpoint.md` (took main's — belongs to live session console-fe-p7), `fabric-session-service-worker.js` (cache bump v26 → v42, took main's), `FabricAppChrome.tsx` (main's structural classes + kept the branch's phone-visible `n/n online` count), `DashboardPage.tsx` (Shell link now targets `ai.allternit.com` per main's platform move).

## Verification evidence

- `cargo check -p herdr -p allternit-api -p allternit-cowork-runtime` on the merged tree — clean (only pre-existing warnings). Note: at the pre-merge branch tip, `allternit-cowork-runtime` failed with 40 errors; merging main resolved it (main completed an in-flight cowork refactor) — not a change made here.
- `cargo test -p herdr --bin ao ao::` — 123 passed / 0 failed (14 new catalog tests). `cargo test -p allternit-api rails::visibility` — 2/2.
- Live smoke: `ao visibility --root /Users/joe` over 4,122 native rows — claude, gizzi, codex, grok, kimi, kimi-cli populate both fields correctly against real session files (grok chunk-join and kimi `prompt.accepted` times hand-verified).
- `pnpm run typecheck:fast` in `surfaces/ai.allternit.com` — 0 errors in-surface (15 pre-existing errors in sibling office/xterm packages, identical with changes stashed); `pnpm run build` (vite) — succeeded.

## Honest deferrals

- copilot, pi/omp, cursor, openhands, muse, vibe, gemini, droid extractors are fixture-tested only — no live session data for those tools exists on this machine; they degrade to `None` on shape drift. Worth a live check when real sessions appear.
- PeerRegistry-fallback panes (ao-down path) show no message fields by design.
- Desktop rebuild from merged main not run in this session.
