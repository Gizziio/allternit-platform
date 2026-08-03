# Agent Activity — gizzi-code CLI Phase 1 Task

Read `docs/AGENT_ACTIVITY_CLI_MAP.md` first. Also read `cmd/gizzi-code/src/runtime/server/rails-bridge.ts` in full (short file) and `cmd/gizzi-code/src/cli/commands/ac.ts` in full (for the command-file shape — but remember: `ac` is a *different, unrelated* system, don't copy its business logic, only its yargs/output conventions).

## Files to add

1. **`cmd/gizzi-code/src/cli/lib/rails-mail-client.ts`** (or wherever this codebase keeps small shared API-client helpers for CLI commands — check for a precedent directory before picking one) — a plain `fetch`-based client, no auth header (matching `rails-bridge.ts`'s documented local-dev-bypass reasoning — cite `cmd/allternit-api/src/auth.rs:730-746` in a comment the way the map doc does), base URL from `process.env.GIZZI_RAILS_URL ?? "http://127.0.0.1:8013/api/rails"` (literally reuse `rails-bridge.ts`'s constant if it's exported, or duplicate the one line if it isn't — check first). Functions: `listThreads()`, `readThread(threadId)`, `sendMessage(threadId, body)`, `decide(threadId, approve)`, `tailLedger(count)` — matching the exact request/response shapes in the map doc (these are already fully verified, from two prior phases — no need to re-verify against the Rust source, just implement to the documented contract).
2. **`cmd/gizzi-code/src/cli/commands/mail.ts`** — new yargs command module, `cmd({ command: "mail", ... })`, subcommands:
   - `mail list` — fetch threads, print one line per thread (`thread_id`, message count, relative last-activity time — check if this codebase already has a relative-time formatting util before writing a new one).
   - `mail read <threadId>` — fetch messages for the thread, print each (`from_agent`, `event_type`, `timestamp`, `body`), then fetch a ledger-tail batch (reasonable count, e.g. 200) and print a short "⚠ guard activity" / "🔒 reservation activity" / "❓ review pending" line if the heuristic (map doc) finds any matching event for this thread — read-only, same as web/iOS.
   - `mail send <threadId> <body>` — call `sendMessage`, print confirmation.
   - `mail decide <threadId> --approve` / `mail decide <threadId> --reject` — two boolean yargs options (or one `--approve`/`--no-approve` pair, your call on the cleanest yargs idiom), mutually exclusive, required one-or-the-other; call `decide(threadId, approve)`, print confirmation.
3. **`cmd/gizzi-code/src/cli/main.ts`** — register `MailCommand` the same way `AcCommand` is registered.

## Constraints

- Do not touch `ac.ts` or `AgentWorkspaceCommunication` — genuinely separate system, out of scope.
- Do not touch `rails-bridge.ts`'s existing write path — this phase adds a new *read-capable* client alongside it, doesn't modify the executor-lifecycle integration.
- Apply the `process.exit(0)`-after-output fix if any subcommand doesn't naturally terminate (check the established pattern in `status.ts` etc. first, per the map doc).
- No backend changes — every action maps to an already-verified-working endpoint.
- Do NOT start any item from `docs/SURFACE_AUDIT_PROGRESS.md` — unrelated, separate tracked work.
- This environment can run TypeScript directly (unlike the iOS phases' Xcode-build limitation) — actually try running `gizzi mail list`/`gizzi mail read` etc. against a real local `allternit-api` if one can be started in this environment; if not feasible (no local Postgres/SQLite state, no way to seed a real thread), say so explicitly and fall back to a syntax/type-check (`tsc --noEmit` or equivalent scoped to the changed files) rather than claiming untested code works.

## Deliverable

`docs/AGENT_ACTIVITY_CLI_PHASE_1_NOTES.md`, YAML frontmatter (`status`, `files_changed`, `deviations`, `remaining`), then prose: whether you managed a real end-to-end run (and what you saw) or only static verification, and any assumption made where the spec was ambiguous. That file existing = done.
