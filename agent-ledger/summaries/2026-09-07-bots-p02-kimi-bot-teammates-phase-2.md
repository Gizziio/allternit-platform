# Session Attestation — session/bots-p02 (kimi) — Bot Teammates Phase 2

- **Date:** 2026-09-07
- **Branch:** `session/bots-p02` @ c11535b49 (fast-forwarded to `main`).
- **Spec:** `docs/BOT_TEAMMATES_SPEC.md` — Phase 2 (Visibility layer) of 6.

## What was done

- **Watermark unread** (`lib/bots/bot-activity-watermark.ts`): seed-on-mount so history never marks unread; focused canonical chat marks seen instead of badging (refresh-in-place); feeds the TEAMMATES row dot.
- **Activity toasts** (`lib/bots/bot-activity-toasts.ts`): opt-in pref `allternit:bot-activity-toasts`, **default OFF**; DM ("🤖 New message for \<bot>") vs generic activity title; 140-char clip; archived/deprecated/hidden bots never toast; reuses existing ToastProvider; toggle lives in the Inbox pane footer.
- **Unified Inbox rail row** (`ShellRail.tsx` + `lib/bots/bot-inbox.ts`): Bell row in home nav; badge = Σ mail unread + visible attention + new-activity watermarks; pin-able 320px pane (persisted `allternit:rail:inbox-pinned`) with Mail / Needs attention / Active feeds; Mark-all-read. Known deviation: `loadThreads` uses first-bot id (rails threads endpoint is global; concurrent per-bot calls would race the store's single threads array).
- **Avatar asset endpoints**: new `cmd/allternit-api/src/bot_assets.rs` (POST/GET `/api/bots/:id/avatar`, atomic tmp+rename, traversal guard, geometric/pet/image types; two one-line registrations). Surface client `lib/bots/bot-assets-api.ts`; CreateBotForm/EditAgentForm fire-and-forget saves. Deliberately did NOT touch `agent_session_routes.rs` (another session's WIP lives there).

## Verification

- tsc clean on touched files (only known environmental xterm/univerjs errors remain).
- vitest **1296 passed**; 1 failure (`fabric-session-kind.test.ts`, expects 'cowork' vs code 'bot') verified **pre-existing on origin/main** — identical file content at 762eeb5e1, another session's in-flight bot-home work; not from this phase.
- `bun run build` still blocked by the other session's stale univerjs install (docs-ui@0.25.1 vs core@0.21.1 alias mismatch) — re-verify after their `pnpm install`.
- `cargo check -p allternit-api` PASSED (4m09s).

## Notes

- Merge of origin/main (6524abdc5) auto-merged ShellApp/ShellRail cleanly with the concurrently-committed Groups rail work; only `.steering/checkpoint.md` conflicted (resolved ours).
- Worktree used 3 node_modules symlinks from the shared checkout (scratch, deleted with worktree).
