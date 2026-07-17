# Handoff — Orchestrator Canvas + Rails activation

**Date:** 2026-07-17 · **From:** kimi CLI session · **Repo:** `/Users/macbook/Desktop/allternit-workspace/allternit`
**Surface app:** `surfaces/ai.allternit.com` (Vite dev :3013, HMR live) · **Monorepo daemons:** `allternit-api` (:8013), `allternit-mux`, `gizzi-code` (:4096)

## Mission (one paragraph)

Make the code canvas the single place to run many coding agents: backend code-mode sessions, plain terminals, host CLI LLMs (kimi/codex/claude/agy) as terminal tiles, and orchestrator-spawned background executors as child tiles with lifecycle — plus shared agent-context notes, rails as the agent communication backbone, and live artifacts for humans. Six phases (P0–P6) were planned and **all implemented**. Ops follow-up: compile, restart, register MCP — **done except the gizzi rebuild**.

## Current live state (verified)

- `allternit-api` — restarted 2026-07-17 ~21:50Z with FRESH debug binary (`target/debug/allternit-api`), cwd repo root, env `GIZZI_PASSWORD=testpass123`, NO `ALLTERNIT_DATA_DIR` → canonical data dir `~/Library/Application Support/allternit`. Health: `{"status":"healthy","gizzi":true}`. **User may need to re-login** (old process ran on a `/private/tmp/claude-501/...` scratchpad data dir — that state is abandoned on purpose).
- **Rails routes live + verified by curl**: `POST /api/rails/mail/send|share|decide`, `GET /api/rails/mail/threads`, `GET /api/rails/mail/thread/:id`, `POST /api/rails/receipts/write`, `POST /api/rails/receipts` (query). Receipt query maps `node_id`→`run_id` filter and aliases `outputs_ref`→`path` in payload (what ArtifactCenter + executor tiles scan).
- `gizzi-code` — **NEW binary live since 2026-07-17 ~22:57Z** (pid 59202, dist built 17:52 CDT by the other agent). `/v1/orchestrator/sessions/discovered`, external status/tail/kill fallbacks, and the SSE `/events` stream all verified live via a zero-token `ao-spawn` + `sleep` probe (both direct :4096 and via gateway :8013). Rails bridge wiring confirmed in the running build; its first live mail fire still needs a native `/assign` (real vendor CLI) or canvas assignment.
- `rails` CLI built (`target/debug/rails`), workspace init'd at canonical dir, MCP handshake verified, registered in repo `.mcp.json` (command + args `--root "/Users/macbook/Library/Application Support/allternit" mcp`).
- A smoke thread `wih:executor-smoke` + two smoke receipts exist in the canonical rails stores (test data, harmless).

## Completed implementation (all in working tree, uncommitted)

- **P0 menu trim**: `src/components/canvas/CanvasToolbar.tsx` — SPAWN_ITEMS = session/terminal/notes + Agent CLI submenu (vendor picker) + "Orchestrated agent…" dialog. Rest moved to right-click menu (unchanged `CanvasContextMenu.tsx`).
- **P1 agent CLI tiles**: `CodeCanvasTile.startupCommand` (`CodeModeStore.ts`); `UnifiedTerminal.tsx` injects it once per session (250ms after first 'connected', ref-guarded, re-injects on reconnect); `src/components/canvas/agentVendors.ts` has the 4 launch commands (verified vs `ao-doctor`).
- **P2 shared notes**: `CodeCanvasTile.shared`; `CodeCanvasTileNotes.tsx` binds to `<workspace.root_path>/.allternit/shared-context.md` via existing `/api/v1/files` API — seeds a protocol header, 800ms debounce write, 4s poll with dirty-guard. Toolbar Notes = shared; context-menu Notes = plain. `CANVAS_TILE_DEFAULT_SIZE` in CodeModeStore (terminal 720×480, executor 560×420, rest 480×360) used by both spawn paths.
- **P3 chrome**: `CanvasTile.tsx` borderRadius 12 + `badge?: React.ReactNode` header slot; all JS hover handlers in canvas chrome replaced with Tailwind `:hover` classes (module consts `TOOLBAR_BUTTON_CLASS`/`MENU_ITEM_CLASS` in CanvasToolbar).
- **P4 orchestrator tiles**: type `'executor'` + `executorSlug`/`parentTileId` fields; `CodeCanvasTileExecutor.tsx` (tail poll 2.5s, steer input, Watch report overlay, accept/reject, kill/dismiss, artifact strip); `useOrchestratorCanvasSync.ts` (SSE + 15s poll, auto-tiles sessions whose workdir == workspace root_path); discovery: `LocalTerminalBackend.discover()` + `external?: boolean` on `ExecutorSession` + gizzi `GET /sessions/discovered` + external fallbacks in status/tail/send/kill handlers (`cmd/gizzi-code/src/runtime/server/routes/orchestrator.ts`); surface `orchestrator.service.ts` += `listDiscoveredExecutors()`.
- **P5 rails**: gateway mail/receipt routes in `cmd/allternit-api/src/rails/mod.rs` (compiled clean); `mail/share` also writes a receipt (run_id stripped from thread prefix) so self-announced artifacts hit every surface; gizzi `src/runtime/server/rails-bridge.ts` (fail-open lifecycle→mail/receipts + shared-context mirror) wired into the registry subscriber in orchestrator.ts; surface `rails.service.ts` `receipts.write` → `POST /api/rails/receipts/write`.
- **P6 artifacts/conventions**: tile artifact strip polls receipts `node_id=<slug>`, click opens preview/diff tile; `artifacts.ts` source += `'executor'`; completion emits receipts for notes file + `~/.agent-orchestrator/evidence/<slug>/`; protocol added to `~/.agent-orchestrator/ORCHESTRATOR.md` + `~/.claude/skills/agent-orchestrator/SKILL.md` (kept in sync).

## Hard contracts (don't break these)

- **Thread grammar**: rails only accepts topics starting `dag:`/`wih:` → executor threads are **`wih:executor-<slug>`** (NOT `executor:<slug>` — rejected).
- **Receipt↔tile contract**: receipts written with `run_id = <slug>`; tiles/ArtifactCenter find artifacts via payload `path` key (gateway aliases it from `outputs_ref`).
- **Executor tile** polls `getExecutorStatus`/`tailExecutor` every 2.5s + receipts; sync hook reconciles on SSE `orchestration` events + 15s poll.
- External (ao-spawn) sessions: tmux `ao-<slug>`, transcripts `~/.agent-orchestrator/logs/`, registry `~/.allternit/orchestrator-sessions.json`; `external:true`, sessionId `external-<slug>`.

## Pending (in order)

1. ~~Finish gizzi rebuild~~ — **DONE 2026-07-17** by the other agent (dist built 17:52 CDT, ~100MB).
2. ~~Restart gizzi~~ — **DONE 2026-07-17 ~22:57Z** (old pid killed, new binary detached with handoff env; logs `/tmp/gizzi-code-serve.log`).
3. ~~Verify discovery + bridge live~~ — **DONE 2026-07-17** (zero-token probe: discover/status/tail/kill/SSE all pass; bridge live-fire deferred — needs a real native assign).
4. **UI runtime verification** (previous session only syntax-gated): spawn each tile type on :3013 canvas; agent tile injects command; shared notes sync both directions; executor tile controls + assignment → first live bridge mail (`wih:executor-<slug>`).
5. Deferred by design: argv shell in `terminal_routes.rs`; mux convergence for executors (Option B); orphaned `src/views/rails/` UI; swarm view executor visibility.

## Gotchas

- Syntax gate per file (no typecheck): `node -e "require('esbuild').transformSync(require('fs').readFileSync('<f>','utf8'),{loader:'tsx'})"` from `surfaces/ai.allternit.com`.
- User policy: no builds/typechecks/dev servers unless explicitly asked; no git mutations without asking.
- `kimi -p` can't combine with `--yolo`; C-c kills TUI agents (use C-u); sentinel files are the only completion signal. See ORCHESTRATOR.md.
- Original approved plan: `~/.kimi-code/sessions/wd_macbook_e60541e2ba8a/session_0951f3aa-59ef-466c-ada7-103b53c0830b/agents/main/plans/deadpool-lockjaw-cyclops.md` (may be gone with the session; this doc supersedes it).
