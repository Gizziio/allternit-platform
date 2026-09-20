# Checkpoint — session/mlx-auto-server (Kimi Code)

**Goal:** Auto-manage local model servers (mlx_lm.server) for gizzi-code
local providers: spawn on demand, kill on model switch, kill on clean exit,
adopt-or-kill orphans after abrupt termination (SIGKILL/crash) via a state
file. No gizzi-spawned daemons outlive the session.

**Just did:** Worktree created off origin/main (ed6e039e1). Explored:
ProcessRegistry (exit/cleanup kill), sidecar spawn pattern, provider config
schema (model-level `options` survives zod parse), localModel.ts streaming
path, loaders/index.ts custom-loader map.

**Next:** implement `src/runtime/local-model-server.ts` (ensure/reconcile/
adopt/kill + state file under GlobalPaths.state/local-model-server), wire
into loaders/index.ts (curried providerID) and localModel.ts, add
`test/runtime/local-model-server.test.ts`, typecheck + tests, then commit →
PR → merge per AGENTS.md lifecycle.

**Open questions:** default serverCmd = `mlx_lm.server` with
`python3 -m mlx_lm.server` fallback; startup timeout default 300s (option
`startupTimeoutMs`). Adoption of a manually-started server on the same port
is treated as ownership transfer (gizzi kills it on exit) — logged loudly.
