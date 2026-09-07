# Bot Mode CLI parity B1–B5 (gizzi-code) — session befe7aa3

- **Date:** 2026-09-07
- **Agent:** kimi (K2.7 Coding), session `befe7aa3`
- **Branch:** `session/befe7aa3` @ a0504e280 (feature commit 34d2580b8 + origin/main merge), PR #121
- **Spec:** `docs/GIZZI_BOT_MODE_SPEC.md` (decisions D1–D7), benchmarked on Nous Research Hermes Bot Mode (`https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode`) and the platform's `docs/BOT_TEAMMATES_SPEC.md`
- **Scope:** gizzi-code CLI only. Platform track (bots-p0x sessions) untouched.

## What was built

Phases B1–B5 of the spec, plus closure of all three known limitations found
during the first verification pass.

### B1 — Bot profiles
- `cmd/gizzi-code/src/runtime/bots/bot-store.ts`: persistent bot registry
  (name, model, systemPrompt, pinned canonical session) backed by the existing
  config store.
- `cmd/gizzi-code/src/cli/commands/bot.ts`: `gizzi bot` command group —
  create / list / show / delete / run.

### B2 — Canonical chats + capability epoch
- `src/runtime/bots/canonical-chat.ts`: every bot gets exactly one pinned
  session; all turns (human and routine) land there. `hasCanonicalChat`,
  `ensureCanonicalChat` work without a live Instance.
- `src/runtime/bots/capability-epoch.ts`: epoch counter bumps on roster
  changes; prompt header invalidated on drift, not on wall-clock.
- Persona injection in `src/runtime/session/prompt.ts` (TUI + headless paths);
  `/new` on a pinned session routes through compact-with-composer-guard.
- `gizzi bot chat <name> [message]`: TUI when no message, headless single-turn
  print otherwise. Fixed pre-existing bug where app.tsx ignored `--session`.

### B3 — Bot routines
- `src/runtime/bots/bot-routines.ts`: `[bot:<name>]` job namespace; cron
  agent-executor delivers into the canonical session via `config.bot` (never
  `Session.createNext`); catch-up fires on missed windows; daemon stays
  non-blocking.

### B4 — Failure taxonomy + messaging
- `src/runtime/bots/failure-reasons.ts`: 13-code port, identical to the
  platform taxonomy (same codes, same attribution string). Retry policies:
  once / after_compact / never.
- `src/runtime/tools/builtins/message-agent.ts`: `message_agent` tool —
  canonical chats only, gated in `resolveTools`; durable per-bot `inbox.jsonl`;
  turn-start pickup with exact platform attribution string.
- Prompt sections `## Teammates` + `## Messaging protocol` injected for bots.

### B5 — Presence, roster, /bots pane
- `src/runtime/bots/bot-presence.ts`: 90s presence window, turn-start hook.
- `src/runtime/bots/bot-roster.ts`: unread = inbox entries + watermark deltas.
- `src/cli/ui/ink-app/screens/bots-pane/`: `/bots` TUI pane — presence dot,
  unread badge, open / create / delete / refresh.

### Limitation fixes (second pass)
- **F1 — cron `reason` column:** `reason TEXT` on `runs` (raw SQL schema in
  `cron/database.ts` + drizzle parity in `cron.sql.ts`); pragma-guarded
  `ALTER TABLE` migration in `CronDatabase.migrate()`; threaded through
  `saveRun`/`rowToRun`; `agent-executor.ts` sets `run.reason` on both the
  bot-routine and generic-agent failure paths. Old databases migrate in place;
  pre-migration rows legitimately read `reason` back as `null`.
- **F2 — chat-unread without Instance:** new `src/runtime/bots/session-db.ts` —
  ensures the data dir, then direct drizzle COUNT queries against the same
  session store the Instance path uses. Canonical-chat pin checks and roster
  unread now work in thin contexts (headless, tests).
- **F3 — REPL transcript reload on pane open:** `setResumeHandler` /
  `getResumeHandler` registry in `bootstrap/state.ts` (type-only imports — DAG
  leaf preserved); REPL.tsx publishes its full resume pipeline via effect;
  `openBotCanonicalChat` loads the canonical log and hands off with
  entrypoint `'bots_pane'` (new `ResumeEntrypoint` member); falls back to
  `switchSession` when no handler is published or the chat is fresh.

## Verification

- `bun run typecheck` (post-merge with origin/main): clean.
- Test sweep post-merge: **168 pass / 0 fail** —
  `test/runtime/bots/` (7 files), `test/cli/bots-pane.test.ts`,
  `test/cli/bot.test.ts`, `test/commands/slash-menu.test.ts`,
  `test/commands/completions.test.ts`, `test/commands/dash.test.ts`,
  plus main's two new UI tests.
- Real `~/.local/share/gizzi-code/gizzi.db` verified clean of test rows
  (0 messages / 0 sessions matching the test prefix) after the run.
- Merge-conflict resolutions: `slash-menu.test.ts` (union of both sides'
  regression guards — verified passing), `.steering/checkpoint.md` (merged
  both sessions' checkpoints verbatim).

## Test-infrastructure notes (for future sessions)

- `bun`'s `mock.module` registrations live for the whole test process and
  poison later files in a combined `bun test` run. The bots-pane tests use
  pure dependency injection (a `fakeDeps(overrides)` helper + real
  `getBot`) — no `mock.module` at all.
- Combined runs can bind the lazy `Database.Client` singleton to the real
  `~/.local/share/gizzi-code/gizzi.db` if an earlier file touches the store
  before a later file's XDG sandbox env is set. The roster test uses
  per-run-unique session ids plus an afterAll that deletes exactly its own
  rows wherever the store bound.

## Unfinished / future work (per spec D7)

- **Group deliberation rooms** — platform Phase 4 (bots-p04) built the
  server-side rooms; CLI-side room participation is not implemented.
- **Cross-machine peer fabric** — platform Phase 3 (bots-p03) built the
  remote-peers server; CLI adoption of the fabric-replies contract is
  deliberately deferred to integration.
- These remain platform-track items; the CLI spec marks them out of scope for
  B1–B5.
