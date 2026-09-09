---
status: done
files_changed:
  - mcp/computers-server/ (new package @allternit/computers-server)
  - cmd/allternit-api/src/tool_routes.rs
  - cmd/allternit-api/src/mcp_server_routes.rs
  - cmd/allternit-api/src/computer_routes.rs
  - cmd/allternit-api/src/computer_ws.rs
  - cmd/allternit-api/src/computer_embed.rs
  - cmd/allternit-api/src/computer_audit.rs
  - cmd/allternit-api/src/bot_desktop_stream.rs
  - cmd/allternit-api/src/main.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/package.json
  - cmd/allternit-api/scripts/vendor-novnc.mjs
  - cmd/allternit-api/assets/novnc/ (vendored noVNC, build artifact)
  - cmd/cli/src/commands/computers.ts
  - cmd/cli/src/commands/computers.test.ts
  - cmd/cli/src/index.ts
  - sdk/computers/ (new: TS @allternit/computers + python/allternit-computers-sdk)
  - pnpm-lock.yaml (registers the new workspace packages)
deviations:
  - Executor died after D2/D3/D4 completed (D3/D4 self-committed; D1 MCP + D2 CLI finished on disk but uncommitted). Orchestrator verified everything directly (MCP build + stdio smoke, CLI tsx --test 13 checks, SDK vitest + Python unittest 19, cargo check + 55 computer-module tests), then committed milestones 3 (CLI) and 4 (MCP + API catalog) itself per the repo orchestrator-escape precedent.
  - assets/novnc/ is a committed build artifact of scripts/vendor-novnc.mjs (noCDN requirement); regenerable, committed so the embed page works without a build step.
remaining:
  - Live smoke owed: real embed iframe render + VNC ws against a running computer (same class of debt as Phases 2/4).
  - allternit computers ssh uses the PTY ws-token path; full tty passthrough quality depends on terminal client — documented in the command help.
---

# Phase 5 NOTES — Distribution surface

## What shipped (4 deliverables, first-party only, no external API keys)

1. **Computers MCP server** — `mcp/computers-server/` standalone stdio MCP
   (`@modelcontextprotocol/sdk`), env config `ALLTERNIT_API_URL` /
   `ALLTERNIT_TOKEN`. 22 tools derived 1:1 from real `/api/v1/computers`
   routes (tool-spec module first, implementation second): lifecycle
   (create/list/get/start/stop/restart/resize/clone/delete), control
   (screenshot/mouse/keyboard/shell/files), snapshots, templates list/import/
   build. Risky tools take optional `approvalId` → `?approval_id=` passthrough
   (no auto-approvals). API-hosted catalog (`tool_routes.rs`) gains the
   lifecycle tools so `/mcp/server` users get parity.
2. **CLI** — `allternit computers …` in `cmd/cli` on the existing
   `--api-url/--token/--json` globals: create/list/get/start/stop/restart/
   delete/resize/clone/ssh/drive. `tsx --test` coverage.
3. **SDK parity** — `sdk/computers/`: TS `@allternit/computers`
   (framework-free `{baseUrl, token}` client, serde-mirror types, vitest) and
   `python/` `allternit-computers-sdk` (stdlib-only urllib client, unittest) —
   the repo's first Python client for the computers plane. approval_id
   threading on risky calls in both. READMEs carry the parity matrix.
4. **Embeddable widget** — `GET /computers/:id/status` (standalone computers
   had no viewer state); computer VNC ws `/ws/computers/:id/vnc` with token
   `purpose: "vnc"` + `read_only` claim (input suppressed); embed token
   `POST /computers/:id/embed-token` (short-TTL HMAC, single-computer);
   self-contained viewer page `GET /embed/computers/:id?token=` served by the
   API with vendored noVNC (no CDN) and CSP `frame-ancestors` configurable
   via `ALLTERNIT_EMBED_FRAME_ANCESTORS` (default `*`, self-host v1).

## Verification (evidence: ~/.agent-orchestrator/evidence/cloud-computer-orgo-p5/)

- cargo check -p allternit-api: clean exit 0 (cargo-check.log)
- cargo test --lib computer_*: 55/55 (cargo-test-computer.log)
- MCP server: tsc build clean; stdio smoke — initialize ok, 22 tools, approvalId exposure ok (mcp-smoke.log)
- CLI: tsx --test computers.test.ts 13 checks pass (cli-tests.log)
- SDK TS: vitest pass (sdk-ts-vitest.log); SDK Python: unittest 19/19 (sdk-python-unittest.log)
- Pre-existing failures unchanged (agent_cloud_routes control-plane suite; vitest fabric-session-kind / vm-operator on main).

## Incidents

- Executor's pane died ("Terminated: 15") right after D2's subagent completed,
  before committing D1/D2. All four deliverables' code was on disk;
  orchestrator verified directly and committed milestones 3+4. D3/D4 were
  committed by the executor before it died.
