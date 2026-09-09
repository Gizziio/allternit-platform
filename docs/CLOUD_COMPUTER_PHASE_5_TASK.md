# Cloud Computer Phase 5 — Distribution surface (TASK)

Spec rq-20260909-004 Phase 5 (final phase). Phases 1–4 are merged: any-owner
create + full specs + restart (PR #201), resize/clone/auto-stop/workspaces-lite
(#204), PTY ws + guest events + in-VM proxy (#206), templates-as-code with
golden snapshots (#216). Do NOT regress any of it. Do NOT start anything
beyond this file.

Worktree `allternit-ao-cloud-computer-orgo-p5`, branch `ao/cloud-computer-orgo-p5`.
All first-party only — NO external developer API keys (deliberate non-goal;
that ships with the Allternit Cloud subscription product later). No approval
un-gating anywhere: risky actions keep requiring approval_id / ACI grants on
EVERY new surface.

Read first for ground truth: `cmd/allternit-api/src/computer_routes.rs`
(router at ~:135), `cmd/allternit-api/src/computer_ws.rs` (ws-token, pty,
events, proxy), `sdk/computer-use/src/mcp-tool-spec.ts` (tool-spec idiom),
`cmd/cli/src/` (commander CLI idiom), `sdk/computer-use/python/src/allternit_computer_use/client.py` (stdlib Python client idiom), `surfaces/ai.allternit.com/src/views/bots/BotComputerViewport.tsx` + `cmd/allternit-api/src/bot_desktop_stream.rs` (VNC ws proxy + noVNC connect).

## Locked decisions

1. **Computers MCP server (standalone TS).** New package
   `mcp/computers-server/` (pnpm workspace; `@modelcontextprotocol/sdk`
   stdio server — precedent `cmd/gizzi-code/src/cli/ui/ink-app/utils/computerUse/mcpServer.ts`).
   Config via env: `ALLTERNIT_API_URL` (default `http://127.0.0.1:8013`),
   `ALLTERNIT_TOKEN` (Clerk bearer). Tools derived 1:1 from real routes —
   write an `mcp-tool-spec.ts`-style spec module, then implement against it:
   lifecycle (`computers.create/list/get/start/stop/restart/resize/clone/delete`),
   control (`computers.screenshot/mouse/keyboard/shell/files.upload/files.download`),
   snapshots, `templates.list/import/build` (Phase 4). Every risky tool takes
   an optional `approvalId` and passes it through as `?approval_id=` — never
   auto-obtain approvals. Include a README (what it is, env config, tool list).
   Also add lifecycle tools to the API-hosted catalog
   (`tool_routes.rs::list_tools` — control-only tools exist at ~:1255; add
   create/list/start/stop/resize/clone with the same approval threading) so
   `/mcp/server` users get parity.
2. **CLI: `allternit computers …`** in `cmd/cli` (commander, existing
   `--api-url`/`--token`/`--json` globals, `api-client.ts`). Subcommands:
   `create` (flags for owner/specs/template), `list`, `get`, `start`, `stop`,
   `restart`, `delete`, `resize`, `clone`, `ssh` (PTY over WS: mint ws-token
   via `POST /computers/:id/ws-token`, connect with a `ws` dependency or raw
   terminal passthrough — pick the smallest honest mechanism; document
   limitation if full tty pty isn't feasible in v1), `drive` (shell + files
   upload/download subcommands). Colocated `tsx --test` tests like existing
   command tests. Do NOT touch the existing `computer-use` command (ACU
   engine, different plane).
3. **SDK parity.** (a) TS: new package `sdk/computers/` (`@allternit/computers`)
   — a framework-free client class `{baseUrl, token}` mirroring the real route
   shapes (same serde-mirror types as `computers-api.ts`; do NOT import from
   the web surface), vitest tests with a mocked fetch. (b) Python: new package
   `sdk/computers/python/` (`allternit-computers-sdk`, stdlib-only
   urllib-style client matching the `allternit_computer_use/client.py` idiom)
   with tests (the repo's first Python tests for this plane — use unittest or
   pytest only if already a repo dep; otherwise unittest). Both: approval_id
   threading on risky calls. Parity matrix (REST lifecycle + control +
   snapshots + templates) documented in each README.
4. **Embeddable live-computer widget.** Three new pieces:
   (a) `GET /api/v1/computers/:id/status` (viewer state: status, os,
   ws URLs, control_state analog) — standalone computers have no VNC today;
   (b) computer-scoped VNC WS route `/ws/computers/:id/vnc` mirroring
   `bot_desktop_stream.rs` (binary WS proxy; extend `sign_computer_token`
   claims with `purpose: "vnc"`, read-only variant claim `read_only: true`
   that suppresses input forwarding — the deliberate non-goal about approval
   gating still applies to control); (c) embed token + viewer:
   `POST /api/v1/computers/:id/embed-token` (short-TTL HMAC token, purpose
   `embed`, single-computer bound) and a served viewer page
   `GET /embed/computers/:id?token=` returning minimal self-contained HTML
   (noVNC from the existing `@novnc/novnc` npm package built/copied at build
   time or a static vendored copy — no CDN) with a restrictive CSP
   (`frame-ancestors` configurable via env `ALLTERNIT_EMBED_FRAME_ANCESTORS`,
   default `*` for v1 self-host, documented) and read-only default.
   BotComputerViewport stays untouched (reuse patterns, not the component).
5. Non-goals: warm pool, external API keys, GPU/Android, replacing ACU
   engine, approval un-gating, mobile apps.

## Verification (evidence to ~/.agent-orchestrator/evidence/cloud-computer-orgo-p5/)

- `cargo test -p allternit-api --lib computer_` (routes/ws/stream modules) —
  new tests for status route, vnc token claims/purpose, embed-token TTL/scope.
- `cargo check -p allternit-api` → cargo-check.log.
- `pnpm --filter @allternit/computers test`, new package build/typecheck;
  computers-server build + a smoke that boots the stdio server and lists tools.
- `cmd/cli`: `tsx --test` for computers commands.
- Python: run the new unittest suite. Full logs to evidence dir.
- Pre-existing failures (agent_cloud_routes control-plane tests; vitest
  fabric-session-kind / vm-operator snapshot on main) are PRE-EXISTING — do
  not investigate, do not fix, just record.

## Process (hard rules — phase 4 executor died twice ignoring these)

- **Commit and push after EACH of the 4 deliverables** (milestone commits on
  `ao/cloud-computer-orgo-p5`). Do not batch everything into one commit.
- **Never run commands outside this worktree.** Do not debug unrelated repos
  or binaries. Unrelated test failures = record and move on.
- Update `.steering/checkpoint.md` at each milestone (short). If a
  steering/commit gate stalls >3 min, stop retrying git verbs and note it in
  NOTES — orchestrator finishes git.
- No PR merge. When done: `gh pr create`, then the sentinel.

## Deliverable sentinel

Write `docs/CLOUD_COMPUTER_PHASE_5_NOTES.md`, frontmatter:
`status: done|blocked`, `files_changed: [...]`, `deviations: [...]`,
`remaining: [...]`, then prose (how it works, verification counts + log paths,
PR number, incidents). File existing = done.
