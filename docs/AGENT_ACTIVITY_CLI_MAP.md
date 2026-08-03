# Agent Activity — gizzi-code CLI Phase Map

Third and final phase of the same initiative as `docs/AGENT_ACTIVITY_WEB_MAP.md` (PR #17) and `docs/AGENT_ACTIVITY_IOS_MAP.md` (PR #18) — same backend (`allternit-api`'s Rails Mail), a real command surface instead of a hidden/nonexistent one on this surface too.

## Important: this is NOT the same system as gizzi-code's existing `ac` command

`cmd/gizzi-code/src/cli/commands/ac.ts` (`gizzi ac send/read/channels/join/auth`) talks to `AgentWorkspaceCommunication` — a **separate, local, channel-based** agent-messaging system, unrelated to Rails Mail. The original audit's own note on `ac` ("may only matter internally to cowork-team") was about this different system. **Do not extend `ac` — build a new, clearly-named command** so the two systems stay distinguishable. Suggested name: `mail` (`gizzi mail ...`), matching the same "Mail" name Rails Mail's own API namespace already uses (`rails.service.ts`'s `mail: {...}`, `cmd/allternit-api/src/rails/mod.rs`'s `/mail/*` routes).

gizzi-code already has a real, working, *write-only* integration with this same real system: `cmd/gizzi-code/src/runtime/server/rails-bridge.ts` posts executor lifecycle events into Rails Mail threads (`POST ${RAILS_BASE}/mail/send`) for agent-orchestrator's own evidence trail. It reads `RAILS_BASE` from `process.env.GIZZI_RAILS_URL ?? "http://127.0.0.1:8013/api/rails"` and sends **no auth header at all** — confirmed why this works: `cmd/allternit-api/src/auth.rs:730-746` has a real `local_dev_bypass()` + `is_localhost_origin()` check that skips Clerk auth entirely for localhost-origin requests when enabled. This phase's new command should follow the exact same `GIZZI_RAILS_URL` env var + no-auth-header pattern for the common local case (a CLI user running against their own local allternit-api instance) — reuse `rails-bridge.ts`'s constant/pattern rather than reinventing it. A remote/authenticated allternit-api instance is out of scope for this phase, same as it already is for `rails-bridge.ts`.

## Backend contract — same as web/iOS phases, already fully verified there

- `GET {RAILS_BASE}/mail/threads` → `{ threads: [{ thread_id, messages: <count>, last_ts }] }`
- `GET {RAILS_BASE}/mail/thread/:thread_id` → `{ messages: [{ message_id, thread_id, from_agent, body, event_type, timestamp }] }`
- `POST {RAILS_BASE}/mail/send` body `{ thread, body }` → `{ sent, thread_id, message_id }`
- `POST {RAILS_BASE}/mail/decide` body `{ thread, approve: bool }` → `{ decided, thread_id }` (strictly boolean, no N-way — same constraint the other two phases already documented)
- `POST {RAILS_BASE}/mail/share` body `{ thread, asset_ref, note? }` → `{ shared, share_id, thread_id }`
- `POST {RAILS_BASE}/ledger/tail` body `{ count }` → bare `UiLedgerEvent[]` (`{ event_id, event_type, timestamp, payload }`, payload untyped) — same read-only reservation/guard heuristic both other phases already use (substring match on `event_type` against `/guard/i`/`/reserve/i`, filtered by `payload.thread_id`/`payload.mail_thread_id`). Both prior phases found there's no structured reservation/guard schema — don't invent richer output than the real data supports here either.

## Existing CLI conventions to match

- **Command registration**: `cmd/gizzi-code/src/cli/main.ts` — `import { AcCommand } from "@/cli/commands/ac"` then `.command(AcCommand)` (~line 200). Add `MailCommand` the same way.
- **Command file shape**: `cmd/gizzi-code/src/cli/commands/ac.ts` — `cmd({ command, describe, builder: (yargs) => yargs.command('sub <args>', 'description', (yargs) => yargs.positional(...)/.option(...), async (argv) => {...}) })`, emoji-prefixed `console.log` output (`📬`, `✅`, `❌`), `process.exit(1)` on real errors.
- **Process-exit gotcha** (already fixed once this session, PR #1 — `docs/HTML_ARTIFACTS_PHASE_3_NOTES.md` or nearby): commands that don't explicitly exit can hang the process after finishing. Check `status.ts`/`cowork.ts`/`pair.ts`/`init.ts`/`serve.ts` for the established `process.exit(0)` pattern after the final output and apply it here too if this command's subcommands don't naturally terminate.

## Scope decision

`gizzi mail list` (threads), `gizzi mail read <threadId>` (messages + any review/guard/reservation tags derived from a ledger-tail call), `gizzi mail send <threadId> <body>`, `gizzi mail decide <threadId> --approve` / `--reject` (boolean flags, not a `--decision` string, matching the API's real boolean semantics). Share and channel-join-style richness: skip for phase 1, matching how both prior phases also deferred lower-value actions (web deferred archive's confusing semantics; iOS left share client-only-unwired).
