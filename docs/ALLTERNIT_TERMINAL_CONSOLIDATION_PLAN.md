# Terminal Stack Consolidation Plan — One Service

> **STATUS:** Phases 1–4 implemented and verified (2026-07-17); phase 5 = design notes below
> **CREATED:** 2026-07-17
> **CONTEXT:** Gap analysis (2026-07-16) found five fragmented terminal stacks;
> `allternit-mux` (ADR-style plan: `docs/ALLTERNIT_MUX_PLAN.md`) added a sixth.
> This plan consolidates them into **one terminal service** with compatibility
> shims for every existing consumer.

## The six stacks today

| # | Stack | Path | Role | Verdict |
|---|-------|------|------|---------|
| 1 | ADR-0044 orchestrator | `packages/@allternit/orchestrator` + `cmd/gizzi-code/src/runtime/server/routes/orchestrator.ts` | Delegation (spawn→send→watch→review) on tmux/termctrl | **Keep semantics; swap backend to mux** |
| 2 | allternit-mux | `cmd/allternit-mux` | Daemon-owned PTYs, UDS API, persistence, agent states | **THE service (consolidation target)** |
| 3 | Code Mode terminal API | `cmd/allternit-api/src/terminal_routes.rs` | tmux + SSE for xterm.js web UI | **Rewrite as thin mux proxy** |
| 4 | Gizzi bun-pty | `cmd/gizzi-code/src/runtime/integrations/pty/pty.ts` + `routes/pty.ts` | In-process PTYs, REST, no persistence, dead WS attach | **Replace internals with mux client** |
| 5 | workspace-service | `api/services/workspace-service` | Simulated sessions/panes (no PTY) for rails + web | **Back it with mux (or retire in favor of mux)** |
| 6 | vps-node PTY | `infrastructure/vps-node/src/pty.rs` | portable-pty over WebSocket for remote nodes | **Keep (different deployment role); phase 5 alignment** |

Adjacent, not counted: `ao-*` shell scripts (reference impl of #1), swarm `TmuxBackend`
(panes inside the *user's own* tmux — genuinely different use case), archived
`terminal_manager.rs` (dead).

## Target architecture

```
                        ┌────────────────────────────────────────────┐
                        │        allternit-mux (Rust daemon)         │
                        │  owns: PTYs, scrollback, persistence,      │
                        │        agent detection, UDS NDJSON API     │
                        └───────────────▲────────────────────────────┘
                                        │ Unix socket (NDJSON)
        ┌───────────────────┬───────────┼───────────────┬────────────────┐
        │                   │           │               │                │
  MuxBackend          allternit-api   gizzi pty      workspace-service  CLI
  (orchestrator       proxy routes    proxy (TS)     (real impl or     (attach,
   ExecutorBackend)   /terminal/*     /pty/*          compat shim)      wait, run)
        │
  ADR-0044 SessionRegistry (unchanged contract: sentinel file, review gate)
```

**Principles**

1. **Mux is the only PTY owner.** No other component spawns or holds PTYs.
2. **Consumers keep their APIs.** Every existing surface (orchestrator HTTP/MCP,
   `/terminal/*` for the web UI, gizzi `/pty/*`, workspace-service REST) becomes a
   thin proxy or a mux client. No consumer changes in phase 1–4.
3. **State authority is unchanged.** ADR-0044 sentinel-file completion remains the
   only contract signal for orchestrated runs. Mux heuristics
   (working/idle/blocked) are observability only — shown in UIs, never gating.
4. **Mux stays local-first.** Browser/remote reach comes from the existing
   `allternit-api` proxy + cloud `runtime_relay` (which already supports raw
   socket tunneling), not from mux listening on TCP.

## What mux must grow (prerequisites, small)

Ordered before consumer work:

- **P0 — verified send** (`pane.send_verified`): write → read scrollback tail →
  confirm echo → send Enter. The orchestrator's core safety property; today it
  lives in `local-terminal.backend.ts` via `capture-pane`.
- **P1 — file watch** (`pane.wait_file` or generic `wait --file`): orchestrator
  watches for the sentinel notes file. Today mux `wait` only polls agent state.
- **P2 — HTTP facade decision**: either (a) recommended — `allternit-api` gains
  `mux_proxy.rs` (same stateless-proxy pattern as `orchestrator_routes.rs`), or
  (b) mux gains an optional axum listener behind a flag. Pick (a): auth, TLS, and
  relay already live in allternit-api; mux stays a local single-user daemon.
- **P3 — spawn env support**: `pane.run` already supports cwd; add explicit env
  map (orchestrator passes vendor env vars).

## Phases

### Phase 1 — Orchestrator on mux (kills tmux dependency in the critical path)
- New `packages/@allternit/orchestrator/src/backends/mux.backend.ts` implementing
  `ExecutorBackend` (`spawn/send/status/tail/watch/footprint/kill`) over the mux
  UDS API. Footprint stays git-based (worktrees are created by the orchestrator
  layer; mux just receives `cwd`).
- `MuxBackend` becomes default behind `ALLTERNIT_EXECUTOR_BACKEND=mux`;
  `local-terminal` (tmux) stays as fallback for one release.
- Verified send + sentinel watch use P0/P1.
- **Done when:** the 3-run ADR-0044 rollout gate passes on mux backend (same gate
  the tmux backend satisfied), `ao-*` equivalent flows work via mux.

### Phase 2 — Code Mode terminal API → mux proxy (kills terminal_routes tmux)
- Rewrite `cmd/allternit-api/src/terminal_routes.rs` internals: `create` →
  mux `session.create`+`pane.create`, `input` → `pane.send_input`,
  `stream` → mux `events.subscribe(pane.output)` fanned out over SSE,
  `resize`/`close` → direct mappings. HTTP contract unchanged →
  `UnifiedTerminal.tsx` and `terminal-api.ts` untouched.
- Gain for free: persistence across API restarts (mux owns sessions), real
  scrollback replay (replaces the 75 ms log-file poller).
- **Done when:** web terminal works end-to-end with no tmux on PATH; restart
  allternit-api mid-session and the terminal reconnects with history intact.

### Phase 3 — Gizzi pty subsystem → mux client (kills bun-pty stack)
- Rewire `cmd/gizzi-code/src/runtime/server/routes/pty.ts` handlers to a small
  mux client (TS, UDS). Keep the REST shape (`/pty/list|create|:id|DELETE`,
  write/resize) so existing callers don't change.
- Wire the existing-but-dead `Pty.connect()` WS attach to mux `events.subscribe`
  instead — gizzi gains attach/persistence it never had.
- Delete `src/runtime/integrations/pty/pty.ts` (bun-pty) after parity.
- **Done when:** gizzi `/pty/*` passes its current behavior expectations with
  mux down-to-the-metal, and PTYs survive `gizzi serve` restart.

### Phase 4 — workspace-service: real panes via mux (kills the simulation)
- Option A (preferred): replace `PaneRecord.output_buffer` simulation with a mux
  client; `send` writes to mux, `capture`/`logs` read mux scrollback. Service
  keeps its port/contract for `rails/src/workspace/client.rs` and the web client.
- Option B: retire the service and point both clients at mux directly. Bigger
  diff, cleaner end state. Decide at phase start.
- **Done when:** `README:98`'s "simulated — real impl would write to pty" is gone.

### Phase 5 — Alignment of the remote/swarm edges (design-first)
- **vps-node**: runs on remote hosts; keep as the remote-runtime analog. Align
  by having vps-node embed mux (as a crate) or proxy to a node-local mux, so
  remote and local expose the same pane model to the control plane.
- **Swarm `TmuxBackend`**: panes live in the user's own terminal — keep.
  Optional later: `MuxBackend` for swarms that should run headless.
- **ao-\* scripts**: re-point at mux (`ao-spawn` → `pane.run`, `ao-send` →
  verified send, `ao-watch` → `wait`) or retire in favor of the orchestrator MCP
  tools. Low priority — they're dev tooling.

## What gets deleted at the end

- tmux dependency in: orchestrator default backend, `terminal_routes.rs`, swarm
  (kept only for the user-terminal use case), `tmux-injector.ts`
- `cmd/gizzi-code/src/runtime/integrations/pty/` (bun-pty)
- workspace-service pane simulation
- `external termctrl` backend (mux subsumes its rendered-screen verification via
  scrollback-based verified send)
- `docs/specs/code-session-mount-and-pane.md:121`'s "replace tmux with
  portable-pty" TODO — resolved by phase 2

## Risks / open questions

- **ADR-0044 amendment**: mux heuristics stay observability-only, but the ADR
  should be amended to bless the mux backend + note the heuristic layer. Small
  doc change, same reviewers.
- **Single-user assumption**: mux UDS is per-user. Multi-tenant/cloud execution
  keeps going through the kernel/cloud backends — not affected by this plan.
- **macOS-first**: mux is Unix-only today; Windows agents stay on the tmux/termctrl
  path until mux ports (portable-pty supports ConPTY, so this is feasible later).
- **Protocol stability**: mux NDJSON protocol becomes a public contract the moment
  gizzi/orchestrator depend on it — version it (`ping` returns protocol version).

## Verification strategy (per phase)

Each phase keeps its consumer's existing tests/behavior as the gate, plus:
- Phase 1: ADR-0044 3-run rollout gate on mux backend.
- Phase 2: browser terminal e2e (existing Code Mode flows) + API-restart
  persistence check.
- Phase 3: gizzi pty route behavior parity + gizzi-restart persistence check.
- Phase 4: rails workspace flow e2e against real panes.

---

## Implementation record (2026-07-17)

### Phase 0 — mux maturity (work item A) — DONE
- vt100 rendered-screen model per pane (`cmd/allternit-mux/src/session.rs`);
  `pane.read --source screen` for rendered reads; raw byte scrollback retained
  as the transcript layer (vt100 scrollback is not publicly readable).
- TOML detection manifests (`src/manifest.rs`): bundled defaults +
  `<state>/agent-detection/*.toml` / `~/.config/allternit-mux/agent-detection/`
  overrides. Blocked-state rules now match against the rendered screen bottom.
- `pane.send_verified` (alnum-normalized read-back before Enter, C-u on
  mismatch — same semantics as the tmux backend's verified send).
- `wait.file` (orchestrator sentinel watch), `pane.run`/`pane.create` env
  support, `pane.pid`, `ping` returns `protocol: 1`.
- `pane.create`/`pane.split` accept an optional command (argv array or shell
  string) so executors spawn directly without a shell-first dance.
- 19 mux tests green (10 unit + 9 integration).

### Phase 1 — orchestrator on mux — DONE
- `packages/@allternit/orchestrator/src/backends/mux.backend.ts`: full
  ExecutorBackend (spawn/send/status/tail/watch/footprint/kill) over the mux
  socket. Transcripts archived to `~/.agent-orchestrator/logs/` on kill
  (mux `session.close` deletes its state dir; review evidence must outlive it).
- Registered in gizzi `/v1/orchestrator` routes (`backend: "mux"` accepted in
  the assign/handoff schema; restore mapping; doctor probe). tmux remains
  default for one release per plan.
- Verified: `test/mux-backend.e2e.mjs` ALL PASS (spawn → verified send →
  sentinel watch → footprint → kill).
- Infra fix: `cmd/gizzi-code/node_modules/@allternit/orchestrator` symlink
  repointed to `packages/@allternit/orchestrator` (was the same-named
  control-plane package; all route typecheck errors cleared).

### Phase 2 — Code Mode terminal API on mux — DONE
- `cmd/allternit-api/src/terminal_routes.rs` rewritten as a thin mux proxy,
  identical HTTP contract. tmux dependency removed from this path.
- Label-based recovery (`allt-term-<uuid>`) rebuilds the id mapping from mux
  after an API restart — terminals now survive API restarts with history
  intact (the old in-memory tmux registry lost them).
- Verified against a live daemon: create/input/resize/stream/close, SSE
  replay+live, API-restart persistence (pre-restart session streamed
  `before-restart-ok` and accepted new input after restart).

### Phase 3 — gizzi /pty/* on mux — DONE
- `cmd/gizzi-code/src/runtime/integrations/pty/index.ts` (the live module —
  the sibling `pty.ts` was never imported) rewritten mux-backed with the same
  namespace surface; bun-pty import removed; routes unchanged. `connect()` now
  does persistent scrollback replay + live event streaming, which never
  worked before. PTYs survive `gizzi serve` restarts.
- **Standalone parity preserved:** gizzi auto-spawns `allternit-mux serve`
  when the socket is missing (binary resolution: `ALLTERNIT_MUX_BIN` →
  `Bun.which("allternit-mux")` → repo `target/debug`), so `/pty` works
  self-contained like the rest of the single-binary product. Desktop
  packaging should vendor `allternit-mux` alongside the gizzi binary
  (same pattern as Claude Code's vendored ripgrep).
- `bun test test/pty/mux.test.ts` PASS against a genuinely auto-spawned
  daemon; neighboring suites unchanged vs HEAD (remaining failures are stale
  tests importing deleted source dirs — `src/continuity`, `src/ide`,
  `src/project/instance` — plus pre-existing MCP SDK typecheck errors in
  `orchestratorMcp.ts`).
- Merge-rot repairs required to load the chain: rebuilt broken default
  exports in `shared/utils/{envUtils,errors,debug,path,cwd,file,log}.ts`
  (they referenced nonexistent identifiers and crashed any importing chain at
  load time; the `src/utils/*` default re-export shims now resolve);
  repointed the `@allternit/orchestrator` symlink to
  `packages/@allternit/orchestrator`; added `../../../../src/*` path fallback
  to `src/cli/ui/ink-app/tsconfig.json`.
- Leftover: `bun-pty` still listed in gizzi package.json deps (unused);
  remove with the next lockfile regeneration.

### Phase 4 — workspace-service real panes — DONE
- `api/services/workspace-service`: panes backed by mux (lazy `ws-<id>` mux
  session per workspace session; `pane.create` with command/shell; real
  `send_keys` PTY input; capture/logs read mux scrollback; delete closes mux
  resources). Metadata-only fallback retained when mux is unreachable.
- Verified: 4 existing tests pass (fallback path) +
  `tests/mux_panes.rs` proves real PTY I/O (command result captured, not the
  old simulated `$ cmd` echo).

## Phase 5 — alignment design notes

### vps-node (remote runtimes)
- Keep as the remote-runtime analog; do NOT merge into the local mux daemon.
- Alignment path: vps-node already has a solid `portable-pty` manager
  (`infrastructure/vps-node/src/pty.rs`). Options:
  (a) embed `allternit-mux` as a library inside vps-node so the WS layer
      speaks the mux NDJSON protocol to a node-local store — one pane model
      local and remote; or
  (b) leave vps-node as-is and have the control plane treat it as a separate
      runtime class.
- Recommend (a) when remote agent orchestration becomes a requirement; (b) is
  acceptable until then. The cloud `runtime_relay` raw-socket tunneling can
  already carry mux NDJSON frames end-to-end, so a browser reaching a remote
  mux needs no protocol work.

### Swarm TmuxBackend (user-terminal panes)
- Panes deliberately live inside the *user's own* tmux so the human sees the
  swarm — keep. Optional later: a `MuxBackend` swarm variant for headless
  swarms (teammates as mux panes, leader steers via the mux socket). This is
  additive; no change to the default swarm path.

### ao-* scripts
- Dev tooling; re-point or leave. Natural mapping when wanted:
  `ao-spawn` → `pane.create -- <agent-cmd>` (or the orchestrator MuxBackend),
  `ao-send` → `pane.send_verified`, `ao-watch` → `wait.file`,
  `ao-status` → `agent.state`, `ao-kill` → `pane.close`/`session.close`.
- Lowest priority of the alignment items; the orchestrator MCP tools already
  cover the workflow for agents.

### Deferred cleanups
- Remove `bun-pty` from gizzi package.json on next lockfile regeneration.
- Remove tmux path from `local-terminal.backend.ts` after MuxBackend passes
  the ADR-0044 3-run rollout gate in production use.
- `termctrl` (`local-pty` backend) can be retired at the same time; mux's
  rendered-screen verified send subsumes its evidence capture.
- `domains/agent-swarm` `tmux-injector.ts` stays until the swarm decides on a
  headless variant.

## Packaging: vendored allternit-mux (Claude Code ripgrep model)

allternit-mux ships *inside* the gizzi/desktop distributions as a managed
child binary — one install, one launch, gizzi auto-spawns it on demand.

- **Vendor tree (npm-style):** `cmd/gizzi-code/vendor/allternit-mux/<platform>-<arch>/allternit-mux`
  built by `cmd/gizzi-code/script/vendor-mux.sh` (`--all` cross-builds every
  installed rustup target). `script/build-production.js` copies the tree into
  `dist/vendor/` alongside each compiled gizzi binary.
- **Desktop installer:** `scripts/build-desktop.sh` builds
  `target/release/allternit-mux` and copies it to `resources/bin/allternit-mux`
  (packed by electron-builder `extraResources`, same as the gizzi binary and
  the voice sidecar — this pattern was already idiomatic here).
- **Runtime resolution (gizzi pty auto-spawn):** `ALLTERNIT_MUX_BIN` →
  `<execDir>/allternit-mux` (desktop resources/bin) →
  `<execDir>/vendor/allternit-mux/<platform>-<arch>/allternit-mux` (vendor
  tree) → `PATH` → repo `target/{release,debug}` (dev).
- **Desktop bootstrap:** `gizzi-manager` resolves the sibling vendored binary
  and passes `ALLTERNIT_MUX_BIN` explicitly when spawning gizzi.
- Precedent: gizzi already ships a managed helper daemon (the Ollama
  sidecar), so a second managed binary is not a packaging-model change.

## Merge-rot repair (gizzi production build) — fix list as of 2026-07-17

Handoff doc: `docs/GIZZI_BUILD_FIX_TASK.md`. Driver for worker-only builds:
`cmd/gizzi-code/.driver-build.ts`.

**Key discoveries**
- Bun honors ONLY the first tsconfig path-mapping entry (no fallback iteration)
  — the root cause of the entire "file not found" error class.
- The production build's phantom "No matching export" errors were Babel 8's
  preset-typescript misparsing JSX fragments `<>` as empty type-parameter
  lists; the transform crash cascaded into fake export errors. Fixed by adding
  `@babel/plugin-syntax-jsx` to the transform (Babel 8 removed the
  `allExtensions`/`isTSX` options).

**tsconfig rewrites** — `tsconfig.base.json`, `tsconfig.json`,
`src/cli/ui/ink-app/tsconfig.json`: single correct entries per subtree
(services/state/hooks/commands → `cli/ui/ink-app/*`, shared → `src/shared/*`,
plus stub mappings).

**Typed stubs** (`src/vendor/anthropic-stubs/`): sandbox-runtime (probes
return unavailable, activation throws), bedrock-sdk, foundry-sdk, vertex-sdk
(constructors throw on gated paths), allternit-extension (empty
BROWSER_TOOLS), audio-capture-napi, react-compiler-runtime (no-op memo cache).

**Import repairs (25+ files)**: claude-core/setup.ts (29 imports →
`src/shared/utils/...`), coordinator/coordinatorMode.ts (4), mcptool/UI.tsx,
oauth/client.ts, types/hooks.ts, constants/prompts.ts,
compact/postCompactCleanup.ts, tools-registry-claude.ts,
agenttool/{resumeAgent,forkSubagent}.ts, shared/utils/attachments.ts,
runtime/services/{claudeAiLimits,api/logging,api/errors}.ts,
ink-renderer/{Box,ScrollBox}.tsx (global.d.ts), analytics/datadog.ts,
exitplanmodetool/ExitWorktreeTool.ts.

**Structural fixes**:
- solidPlugin `@/` resolver rewritten to mirror tsconfig tree rules.
- `mcp/client.ts` lazy require of TLA graph → async `import()` (+ Promise.all).
- Merge-by-re-export (partial module + `export *` underneath):
  `src/bootstrap/state.ts` (+204 exports), `src/ink.ts`,
  `runtime/services/tokenEstimation.ts`.
- Default-vs-named exports: `src/ink/components/{Box,Link,ScrollBox,Text}.ts`.
- Missing export added: `getCwdState`/`setCwdState` superseded by the
  state.ts merge.

**Workstream A (ripgrep)** — complete: official 15.1.0 binaries vendored for
arm64/x64 darwin + linux and x64-win32; wrapper resolution vendored-first;
`vendor-ripgrep.sh`/`vendor-mux.sh`; dist vendor copies in
`build-production.js`; `test/ripgrep/vendor.test.ts` passing.

**Remaining at handoff**: worker bundle passes the driver except one error
class at a time (datadog import just fixed, unverified). Finish the driver
loop, then one full production build, then the verification contract in the
handoff doc.
