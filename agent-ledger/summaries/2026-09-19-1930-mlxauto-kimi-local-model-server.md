# Session mlxauto (Kimi Code) — auto-managed local model servers

**PR:** #723 (merged 230cc11e4) | **Branch:** session/mlx-auto-server (deleted)

## What
gizzi-code local providers (local-mlx/local) auto-manage per-model inference
servers. Opt-in via `options.modelPath` on a model in gizzi.json. New module
`cmd/gizzi-code/src/runtime/local-model-server.ts`; wired into
`adapters/loaders/index.ts` (managedLocal wrapper) and
`ink-app/services/api/localModel.ts`.

## Contract
- Spawn `mlx_lm.server --model <path> --port <port>` on first use; wait for
  /v1/models (300s default, per-model `startupTimeoutMs`, `serverCmd` override).
- Kill on model switch; kill on clean exit via ProcessRegistry.
- Abrupt termination: state file under `~/.local/state/gizzi-code/local-model-server/`
  → next launch adopts same-model orphans (avoids reload) or kills
  different-model ones; adopted pids are tracked so this session reaps them too.
- Foreign server on the port: adopt only if it provably serves the requested
  model AND pid is identifiable (lsof); otherwise fail — never kill strangers.
- stdio is a log-file fd, not a parent pipe — critical: pipe breakage after
  parent SIGKILL wedged orphans via SIGPIPE (found in live smoke).

## Verification
- 15/15 unit tests (`test/runtime/local-model-server.test.ts`).
- tsc --noEmit clean.
- Live smoke on isolated ports 8084/8085: real gemma-3-4b + Qwen3.5-4B loads,
  SIGKILL → orphan survives → adopted same pid → switch kills gemma → exit
  reaps qwen → port free, no mlx processes.

## Deferred
- Desktop rebuild (lifecycle step 8) not run — no desktop-bundled files touched.
- Installed brew gizzi-code 2.0.8 does not carry this; activates next release.
- User gizzi.json already carries modelPath for the two new MLX models.
