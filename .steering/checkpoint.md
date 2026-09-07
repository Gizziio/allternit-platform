# Steering checkpoint

## Goal
Implement CLI Bot Mode parity (Phases B1–B5 of docs/GIZZI_BOT_MODE_SPEC.md) in
the gizzi-code CLI, in this worktree (branch `session/befe7aa3`), coordinated
with — but not overlapping — the parallel platform-track sessions (rail UI
research in allternit-session-railup / botspec, composer pill tabs, and the
Phase-0 platform work in the bots-p0x worktrees). CLI track only; no commits
from child agents — parent lands the branch after steering approval.

## Just did (2026-09-07) — ALL 5 PHASES CODE-COMPLETE
- Spec: `docs/GIZZI_BOT_MODE_SPEC.md` (D1–D7 decisions; benchmarked on Hermes
  Bot Mode docs + platform BOT_TEAMMATES_SPEC; same failure codes, same
  attribution string).
- B1: `src/runtime/bots/bot-store.ts` + `gizzi bot` command group (31 tests).
- B2: `src/runtime/bots/canonical-chat.ts` + `capability-epoch.ts`; persona
  injection in `src/runtime/session/prompt.ts` (TUI + headless); `/new`→compact
  composer guard; `gizzi bot chat <name> [message]` (TUI on pinned session /
  headless print turn). app.tsx now honors `--session` id (pre-existing bug).
- B3: `src/runtime/bots/bot-routines.ts` — `[bot:<name>]` namespace, cron
  agent-executor `config.bot` delivery into canonical session (never
  Session.createNext), catch-up fires, daemon stays non-blocking.
- B4: `failure-reasons.ts` (13-code port, once/after_compact/never), typed
  retry on routine delivery, `run.metadata.reason`, `[reason: <code>]` on
  headless chat errors; `message_agent` tool (canonical chats only, gated in
  resolveTools), durable `inbox.jsonl` per bot, turn-start pickup with exact
  platform attribution, `## Teammates` + `## Messaging protocol` prompt
  sections (epoch already covers roster drift).
- B5 (agent swarm, 4 parallel): `bot-presence.ts` (90s window, turn-start
  hook), `bot-roster.ts` (unread = inbox + watermark deltas), `/bots` TUI pane
  (presence dot, unread badge, open/create/delete/refresh), typecheck baseline
  fix (stale slash-menu test — dash aliases deliberately removed in 37057ec17).

## Verification
- `bun run typecheck`: zero errors (baseline fixed by swarm).
- `bun test test/runtime/bots/ test/cli/bot.test.ts test/cli/bots-pane.test.ts`
  + commands tests: 126+ pass across agents' runs; final combined sweep in
  progress (background task).
- Known limits: NONE — the three below were closed in the Fixes section
  (F1 cron reason column, F2 chat-unread without Instance, F3 REPL reload
  on pane session switch).

## Fixes (2026-09-07, second pass — all three known limitations closed)
- F1 cron reason column: `reason TEXT` on `runs` (raw-SQL schema in
  cron/database.ts + drizzle parity in cron.sql.ts), pragma-guarded
  `ALTER TABLE` migration in `CronDatabase.migrate()`, threaded through
  saveRun/rowToRun; agent-executor sets `run.reason` on BOTH the bot-routine
  and generic agent failure paths. Test: fresh + rebuilt-old-db persistence
  round-trip in bot-routines.test.ts.
- F2 chat-unread without Instance: new `src/runtime/bots/session-db.ts` —
  ensures the data dir, then direct drizzle COUNT queries (same store the
  Instance path uses). canonical-chat pin checks and roster unread now work
  in thin contexts; roster test seeds a real temp sqlite session store
  (XDG_DATA_HOME sandbox) and asserts hasCanonicalChat + watermark unread.
- F3 REPL reload on pane open: `setResumeHandler`/`getResumeHandler` registry
  in bootstrap/state.ts (type-only imports, DAG leaf preserved); REPL.tsx
  publishes its full resume pipeline via effect; `openBotCanonicalChat`
  loads the canonical log (getLastSessionLog/loadFullLog) and hands off with
  entrypoint `'bots_pane'` (new ResumeEntrypoint member); falls back to
  switchSession when no handler is published or the chat is fresh. Pane
  tests cover handler path, fallback path, and unknown-bot no-op.

## Next
- Parent: review final sweep, commit per commit-gate, merge; write ledger
  attestation; clean up worktree per AGENTS.md ritual.
- Future (not this session): group deliberation rooms + cross-machine peer
  fabric (platform Phases 3/4 first), TUI transcript reload on switch.
