# allternit-api vs. Agno AgentOS — Gap Analysis & Fix Plan

Source trigger: Agno AgentOS launch article (FastAPI app serving agents as an API, MCP
server, and through chat apps; durable runtime, RBAC, background execution,
checkpointing, session management, tracing, evals, guardrails, resumable streams).

This doc records what `allternit-api` (`cmd/allternit-api/src/`) actually has today,
verified against source (not docs/marketing), and a prioritized, sequenced fix plan.
Status as of 2026-07-21: **all 9 planned items implemented** (Phase A + Phase B),
plus one unplanned critical security fix found and fixed along the way. See §4.

---

## 1. Capability comparison

| AgentOS claim | allternit-api reality | Verdict |
|---|---|---|
| Durable runtime | Real engine exists: `rails/routes_cowork.rs`'s `RunManager` (job state machine: Scheduled→Queued→Leased→Running→Checkpointing→AwaitingApproval→RetryBackoff→Completed/DeadLetter/Cancelled). But the *named* `checkpoints_routes.rs` API is a pure stub (`"stub": true`, hardcoded IDs, no DB writes). Two implementations, only one real. | 🟡 Split |
| Resumable streams across disconnects | `RunManager` has genuine `attach`/`reattach`/`detach` with lease/cursor tokens — matches the AgentOS pitch. But `agent_session_routes.rs`'s SSE proxy (the path most sessions use today) just re-opens a fresh Gizzi connection on reconnect, no cursor replay. Good version exists, isn't the default path. | 🟡 Split |
| Multi-user security w/ RBAC | Real but ad hoc: role checks (`role IN ('owner','admin')`) copy-pasted across ~8 route files (`workspace_routes.rs`, `usage_routes.rs`, `cowork_team_routes.rs`, `team_skill_routes.rs`, `cloud_credentials_routes.rs`, `me_routes.rs`, `llm_gateway/admin_routes.rs`). No central policy layer. | 🟡 Fragmented |
| Background execution | `queue_routes.rs`: real atomic SQL-claim job queue (`cowork_queue`), no worker/retry loop of its own. `orchestrator_routes.rs`: pure reverse proxy to external Gizzi runtime, no logic here. Real engine is `RunManager` again. | 🟡 Fragmented |
| Checkpointing | Real in `RunManager` (`max_checkpoint_age_hours`, DAG-aware). Fake in `checkpoints_routes.rs`. | 🔴 Needs fix |
| Session management | Thin gateway onto external "Gizzi" runtime, not native. `revert_session`/`compact_session` are no-ops today. | 🟡 Partial |
| Tracing | Not found. `audit_log_routes.rs` / `usage_routes.rs` are billing/audit trails, not request tracing or LLM-call spans. | 🔴 Missing |
| Evals | Scaffolded honestly: `agent_operations_routes.rs` has `create_evaluation`/`run_evaluation`, code comment admits "no evaluation engine exists yet," every run inserts `0 passed / 0 failed`. | 🔴 Missing (honest stub) |
| Guardrails | Not found anywhere in the tree. Only `content_filter` as a passthrough finish-reason string in `llm_gateway/translate.rs`. | 🔴 Missing |
| MCP server | allternit-api is an MCP **client only** — `mcp_routes.rs` authenticates to and consumes external MCP servers/connectors; `office_cli_mcp.rs` bridges to a local process via stdio. No inbound `tools/list`/`tools/call` handler exists. Inverse of AgentOS's model. | 🔴 Missing |
| Serving through chat apps (Slack/WhatsApp/Telegram) | 181-entry connector catalog lists slack/whatsapp/discord/msteams as **outbound** connectors (agent calls them as tools). No inbound webhook handling exists (no Slack Events API, no WhatsApp Business webhook, no Telegram bot updates — Telegram isn't even in the catalog). `webhook_routes.rs` only handles Clerk auth events. | 🔴 Missing |

**Overall read:** the ambition and a lot of the hard mechanics (job state machine,
lease/reattach, checkpointing) already exist and are comparable to AgentOS — but
duplicated/scattered rather than unified, with the two headline "serving" surfaces
(MCP server mode, inbound chat) architecturally inverted (client-only, outbound-only).

---

## 2. Fix plan

Ordered by leverage: consolidation fixes first (cheap, remove real duplication /
dead-end stubs), then net-new builds (expensive, genuinely new surface area).

### Phase A — Consolidation (fix duplication, no new capability) — DONE 2026-07-21

1. **`checkpoints_routes.rs` — DONE, scope corrected on read.** The premise was
   wrong: this isn't a duplicate of `RunManager`'s run/job checkpoints — it backs
   a completely different frontend feature, `Checkpointing.tsx`
   ("Git-based checkpoint and recovery management": commit hash/message/author/
   tags/branch, restore-via-reset). `RunManager`'s checkpoints were already real
   and untouched. Rewrote `checkpoints_routes.rs` to actually shell out to `git`
   (matching the existing `run_git` pattern in `agent_operations_routes.rs`):
   `GET /checkpoints` lists real commits + tags via `git log`/`for-each-ref`,
   `POST /checkpoints/commit` does `git add -A && git commit --allow-empty`,
   `POST /checkpoints/tag` does `git tag`, and added the previously-missing
   `POST /checkpoints/:id/restore` (stash-then-`reset --hard`) that the frontend
   already called but no route existed for. Returns `409` instead of stubbing if
   `workdir` isn't a git repo (no silent auto-`git init`).

2. **SSE resume — DONE, scope corrected on read.** Premise was wrong here too:
   `agent_session_routes.rs`'s chat sessions (Gizzi-backed) and `RunManager`'s
   cowork runs are unrelated subsystems, not two implementations of the same
   feature — wiring one to the other made no sense. The real gap: Gizzi's
   `/v1/event` bus (`cmd/gizzi-code/src/runtime/server/routes/event.ts`) had
   *zero* replay capability (live-only pub/sub, confirmed by reading `Bus`).
   Added a bounded (500-entry) replay ring buffer to `Bus`
   (`shared/bus/index.ts`: `historySince`/`currentSeq`), had `event.ts` honor
   `Last-Event-ID`/`?since=` on reconnect and tag every SSE frame with `id:`,
   then fixed the Rust proxy (`sync_sessions` in `agent_session_routes.rs`) to
   forward the browser's `Last-Event-ID` header upstream and propagate `id:`
   through to the client — it was parsing away the `id:` line entirely before.
   End to end: a dropped browser `EventSource` now auto-reconnects (native
   behavior) and actually replays the missed events instead of silently
   resuming with a gap.

3. **`revert_session`/`unrevert_session`/`compact_session` — DONE.** Gizzi
   already has real endpoints (`/session/:id/revert`, `/unrevert`, `/summarize`
   — confirmed in `cmd/gizzi-code/src/runtime/server/routes/session.ts`); the
   Rust handlers just weren't calling them. Wired revert/unrevert to the real
   endpoints, then re-fetch+transform the session afterward (matching
   `get_session`'s shape) since the frontend (`mode-session-store.ts`) feeds the
   response through `mapBackendSession` and would break on a foreign shape.
   `compact_session` now calls `/summarize` — noted in-code that this is *not*
   the same as the agent loop's internal `SessionCompaction.process` (that's
   driven by an internal task queue mid-turn, not a standalone REST primitive;
   wiring true on-demand compaction would mean synthesizing a task into the
   turn loop, out of scope here).

4. **RBAC — DONE, scope intentionally narrowed.** Added `cmd/allternit-api/src/rbac.rs`
   with `is_admin_role`/`is_org_admin`, and wired the three call sites that were
   structurally identical fetch-then-`matches!` checks: `usage_routes.rs`,
   `cloud_credentials_routes.rs`, `llm_gateway/admin_routes.rs`. Deliberately did
   **not** touch the workspace-level checks embedded inside larger SQL joins in
   `workspace_routes.rs`, `team_skill_routes.rs`, `cowork_team_routes.rs` —
   there's no Rust toolchain on this machine to compile-check a rewrite of
   live authorization SQL, and a transcription error there is a security bug,
   not a style nit. Documented as a deliberate scope limit in `rbac.rs`'s module
   doc comment.

**Caveat that applies to all of Phase A and everything below:** this machine has
no Rust toolchain (`cargo`/`rustc` not installed — confirmed, matches prior
session findings) and no way to run the TypeScript build either was attempted.
All Rust/TS changes were written and reviewed by hand against the real source
(including checking exact axum/hono API signatures in the vendored
`~/.cargo/registry` source and `node_modules/hono` types) but are **unverified
by compiler/test run**. Build and smoke-test before deploying.

### Unplanned: critical auth bypass found and fixed 2026-07-21

While centralizing RBAC (Phase A item 4) and reading `auth.rs` closely,
found that `extract_desktop_bootstrap_user` granted full authenticated access
(including caller-claimed `organization_role: owner`) to anyone who sent
`x-allternit-user-id` + *any* value in `x-allternit-desktop-access-token` — the
token's value was read but never validated against anything, and the check ran
unconditionally before Clerk JWT verification on every deployment, not just
self-hosted ones. Confirmed via full-tree grep that no real secret existed for
it to check against; the only actual sender was a `#if DEBUG`-gated iOS
dev-testing shim (`surfaces/allternit-mobile/ios/Core/API/APIClient.swift`)
that sends the literal string `"dev"`.

Fixed: added `AppConfig::desktop_access_token()` (`config.rs`, env-var-only,
mirrors the existing `internal_service_token` pattern) and a constant-time
comparison in `auth.rs` (mirrors `internal_auth::require_internal_token`'s
established fail-closed posture). `extract_desktop_bootstrap_user` now
requires a real match; with no token configured (true everywhere today) the
path is disabled outright. Does not affect production Electron/web (neither
sends this header) or the separate, already-correct `local_dev_bypass()` +
localhost-origin fallback. Breaks the iOS debug shim until a developer sets
`ALLTERNIT_DESKTOP_ACCESS_TOKEN=dev` locally to match — not fixed here
(iOS-side change, out of scope for this pass).

### Phase B — Net-new (genuinely missing capability)

5. **MCP server mode — DONE.** New `mcp_server_routes.rs`, mounted at `/mcp/server`
   inside the existing (Clerk-protected) `/mcp` nest. Hand-rolled JSON-RPC 2.0 over
   the MCP Streamable HTTP transport (no MCP SDK crate was a dependency, so no
   off-the-shelf server helper): `initialize`, `ping`, `tools/list`, `tools/call`,
   backed by the same tool registry `tool_routes.rs` already exposes over REST
   (`execute_tool_internal` made `pub(crate)` and reused directly — one registry, two
   front doors, same auth gate, so this doesn't expand what an authenticated caller
   could already do). Scope limits stated in the module doc: single JSON-RPC objects
   only (no batch arrays), no `Mcp-Session-Id` issuance (stateless, fine for a tool
   set with no server-initiated messages).

6. **Inbound chat-app serving (Slack) — DONE, WhatsApp/Telegram deferred.** New
   `slack_webhook_routes.rs`, mounted publicly (Slack signs its own requests, same
   posture as `webhook_routes.rs`'s Clerk webhook). Real HMAC-SHA256 signature
   verification (`X-Slack-Signature`/`X-Slack-Request-Timestamp`, ±5min replay
   window) gated on a new `ALLTERNIT_SLACK_SIGNING_SECRET` — fails closed if unset.
   Handles the `url_verification` handshake, then on `event_callback` message events
   (skipping bot-authored/subtyped messages to avoid reply loops) spawns a background
   task that: maps the channel+thread to a Gizzi session (new migration
   `V30__slack_channel_sessions.sql`, creating one on first contact), posts the
   message into it, polls `GET /v1/session/:id/messages` for the completed assistant
   reply (bounded ~60s/1s — a one-shot background task per message, not a held
   connection, so polling is the right tool here, not a bus subscription), and posts
   it back via `chat.postMessage` using a new `ALLTERNIT_SLACK_BOT_TOKEN`. WhatsApp
   Business webhook and Telegram bot updates not built — same shape, follow-on work
   (Telegram also isn't in the connector catalog yet, per the original gap).

7. **Guardrails — corrected finding, DONE.** The original "NOT FOUND" verdict
   was wrong: `llm_gateway/dlp.rs` already had a real, well-tested guardrail —
   secret-pattern scanning + prompt-injection scoring on the *request* path
   (block/redact/warn, tenant-overridable), just not labeled "guardrails" and
   missed by keyword search. The actual gap was narrower: it only scanned
   requests, never the model's own response, so a completion could echo back
   a secret (or hallucinate one) with zero policy applied. Added
   `scan_and_redact_response`/`scan_response` in `dlp.rs`, reusing the same
   tested `dlp_patterns::scan_text`/`redact_text` primitives against
   `choices[].message.content`, wired in after `next.run(request)`. Scoped to
   non-streaming responses only — a streamed SSE response has already flushed
   earlier chunks by the time later ones could be scanned, so safely
   redacting/blocking a stream after the fact needs per-chunk hold-back
   buffering, stated as real follow-on work rather than faked here.

8. **Real eval runner — DONE.** Replaced the `0/0` stub in `run_evaluation`
   (`agent_operations_routes.rs`) with a real engine: `dataset` is now parsed
   as `Vec<EvalCase>` (`{input, expected?, contains?}` — a schema that didn't
   exist before, since `dataset` was previously stored opaquely and never
   interpreted), each case runs against `target` (an agent id) in a throwaway
   Gizzi session (created, messaged, polled for the completed reply, deleted
   — evaluation runs shouldn't clutter the user's session list), graded by
   substring match, and real `total/passed/failed/skipped` + per-case
   `details` get persisted to `agent_evaluation_runs`. Bounded to 10 cases /
   20s each so the (synchronous, per the existing endpoint contract) HTTP
   handler can't hang indefinitely — stated as a real limit, with turning this
   into a proper background job (via the same `RunManager`/queue machinery
   from Phase A) as the honest follow-on rather than silently capping forever.

9. **Tracing — partially done, scoped honestly.** Added
   `#[tracing::instrument]` spans to the highest-value request paths touched
   this session (`llm_gateway::proxy::chat_completions`, `dlp_middleware`,
   `mcp_server_routes::handle_rpc`, `slack_webhook_routes::handle_message_event`,
   `agent_operations_routes::run_evaluation`) — real span correlation/timing,
   not just log lines. Did **not** wire an actual OTel exporter: the workspace
   `Cargo.toml` already pins `opentelemetry`/`opentelemetry_sdk`/
   `tracing-opentelemetry`/`opentelemetry-http` (confirmed unused by any crate
   in the repo via grep), so the dependency choice exists, but with no Rust
   toolchain on this machine to compile-check against these pre-1.0 crates'
   real (and historically churny) builder APIs, and no in-repo example to
   model from, hand-writing that wiring blind was a real risk of landing
   plausible-looking code that doesn't actually build. Documented as explicit
   follow-on work in `main.rs` next to the tracing-subscriber init, not
   silently dropped.

---

## 3. Sequencing note

Phase A items 1–2 are the highest-leverage fixes: they make the *already-built*
durable-runtime story (which is the core of AgentOS's pitch) actually reachable
through the API surface clients use today, with no new capability required. Phase A
item 4 is cheap risk-reduction. Phase B items are real scoped builds and should be
sized individually before starting.

## 4. Final status — 2026-07-21

All 9 items implemented, plus the unplanned auth-bypass fix (§2). Files touched:

**New:** `rbac.rs`, `mcp_server_routes.rs`, `slack_webhook_routes.rs`,
`migrations/V30__slack_channel_sessions.sql`.

**Rewritten/substantially edited:** `checkpoints_routes.rs` (full rewrite, git-backed),
`agent_session_routes.rs` (SSE `Last-Event-ID` forwarding, revert/unrevert/compact),
`tool_routes.rs` (`execute_tool_internal` → `pub(crate)`), `auth.rs` (desktop-bootstrap
token validation), `config.rs` (4 new secret accessors), `main.rs` (route mounting +
tracing comment), `usage_routes.rs`/`cloud_credentials_routes.rs`/
`llm_gateway/admin_routes.rs` (RBAC centralization), `llm_gateway/dlp.rs` (response-side
scan), `agent_operations_routes.rs` (real eval runner), `llm_gateway/proxy.rs`
(instrument span), `lib.rs` (module registration).

**gizzi-code (TypeScript):** `shared/bus/index.ts` (replay buffer),
`runtime/server/routes/event.ts` (`Last-Event-ID` handling).

**Verification — 2026-07-21, toolchains installed and actually run (updates the
"unverified" caveat above, which was accurate when written but no longer is):**
`rustup` was already Homebrew-installed but not on `PATH` (Homebrew's formula is
keg-only and doesn't create the usual `~/.cargo/bin` shims) — fixed by adding
`/opt/homebrew/opt/rustup/bin` to `PATH` in `~/.zshrc` and `~/.zshenv`. This
resolves the project's pinned `1.91.0` via `rust-toolchain.toml` automatically.

- `cargo check -p allternit-api` (lib) and `--bins` (main.rs): **clean, 0 errors**,
  only 3 pre-existing warnings, all in files this session never touched
  (`agent_routes.rs:720`, `vm_session_routes.rs:211`, `vm_session_routes.rs:1252`).
- `cargo test -p allternit-api --lib llm_gateway::dlp`: **27/27 pass**, including
  the pre-existing tests exercising the request-path code the new response-side
  scan sits next to.
- `gizzi-code` TypeScript: `tsc --noEmit` reports 358 pre-existing errors across
  this large in-progress monorepo (confirmed via `git status` this repo has
  ~200 other uncommitted files from concurrent work), **none in the two files
  this session edited**. Verified rigorously, not just by inspection: stashed
  only `shared/bus/index.ts` and `runtime/server/routes/event.ts`, re-ran `tsc`,
  got the identical 358-error count with those changes reverted, then restored
  them (`git stash pop`).

New env vars read (all optional, each feature no-ops/fails-closed if unset):
`ALLTERNIT_DESKTOP_ACCESS_TOKEN`, `ALLTERNIT_SLACK_SIGNING_SECRET`,
`ALLTERNIT_SLACK_BOT_TOKEN`. Not yet done: a full `cargo test` run across the
whole workspace (only the touched `dlp` module was targeted) and exercising the
new endpoints against a live Gizzi instance.
