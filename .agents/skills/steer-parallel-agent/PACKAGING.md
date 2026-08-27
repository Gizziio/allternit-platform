# Packaging Agent Orchestration + Steering into Allternit Platform / gizzi-code

> How the desktop-local orchestration tooling (`ao-*`, `steer-*`, agent-orchestrator skill, steer-parallel-agent skill) becomes part of the shipped product.

## What exists today and where it lives

| Asset | Current location | Scope |
|---|---|---|
| `agent-orchestrator` skill (spawn/monitor/review external CLI agents) | `~/.claude/skills/agent-orchestrator/`, mirrored at `~/.agent-orchestrator/ORCHESTRATOR.md` | Desktop only |
| `ao-*` scripts (`ao-doctor`, `ao-spawn`, `ao-send`, `ao-watch`, `ao-status`, `ao-kill`) | `~/.claude/skills/agent-orchestrator/scripts/`, symlinked to `~/.local/bin/` | Desktop only |
| `steer-parallel-agent` skill (redirect an already-running session) | `~/.kimi-code/skills/steer-parallel-agent/` | Desktop only |
| `steer-*` scripts (`steer`, `steer-discover`, `steer-context`, `steer-checkpoint`, `steer-prompt`, `steer-verify`) | `~/.kimi-code/skills/steer-parallel-agent/scripts/`, symlinked to `~/.local/bin/` | Desktop only |
| Rails steering/peer endpoints | `cmd/allternit-api/src/rails/mod.rs` | **Already in platform** |
| Rails peer registration in gizzi-code | `cmd/gizzi-code/src/runtime/gizzi-core/services/railsPeer.ts` (behind `GIZZI_ENABLE_RAILS_PEER=1`) | **Already in platform, opt-in** |

## Target packaging

### 1. Scripts → `allternit-platform/bin/` (or `packages/agent-steering/`)

The platform repo already ships CLI tools from `bin/` (`allternit-stage`, `verify-*.sh`, `run-graph`, etc.). Move both toolkits there:

```
allternit-platform/bin/
  ao-doctor  ao-spawn  ao-send  ao-watch  ao-status  ao-kill
  steer  steer-discover  steer-context  steer-checkpoint  steer-prompt  steer-verify
```

Distribution channels that already exist:
- **Homebrew tap** (`Allternit-websites/projects/homebrew-tap/`) — formula/cask symlinks `bin/*` into a PATH dir.
- **Install pages** (`install.allternit.com`, `install.gizziio.com`) — shell installers do the same for Linux.

Portability requirements already satisfied: scripts are bash + python3 only, no absolute paths baked in (`KIMI_SESSIONS_DIR` env override exists in steer-*, `~/.local/bin` symlink pattern exists in ao-*).

### 2. Skills → three channels, in priority order

gizzi-code skill loading supports all three today:

| Channel | Path | When to use |
|---|---|---|
| Bundled | `cmd/gizzi-code/src/skills/bundled/` | Compiled into the CLI; ships to every install. `bundledSkills.ts` registry is currently empty — register the two skills here. |
| Project | `<repo>/.agents/skills/` | Loads for any agent that opens the repo. Put `agent-orchestrator` and `steer-parallel-agent` in `allternit-platform/.agents/skills/` (same pattern as `alabs-course-pipeline`). |
| Workspace | `<workspace>/.allternit/skills/**` | Loaded by `src/workspace/loader.ts:90`. For user-level workspaces. |

For kimi-code specifically, `config.toml` supports `extra_skill_dirs = []` — the installer can append the platform repo's `.agents/skills/` path so kimi sessions pick up the same skills.

### 3. Rails endpoints → no new work

`/api/rails/steer/checkpoint`, `/api/rails/steer/consult`, `/api/rails/peers` are already in `cmd/allternit-api`. `steer-checkpoint` curls them; `ao-*` platform integration announces via `/api/rails/mail/share`. This layer is done.

### 4. Session discovery → one code change

`steer-discover` scans `~/.kimi-code/sessions/*/state.json` — kimi-specific. To work across vendors and across machines in the desktop-app model:

1. **Primary:** query the Rails peer registry (`GET http://127.0.0.1:8013/api/rails/peers`). Peers already carry `name`, `cwd`, `vendor`, `last_heartbeat_at`, `status`.
2. **Fallback:** filesystem scan (current behavior) for agents that don't register.

Prerequisite: make peer registration default-on in gizzi-code (currently `GIZZI_ENABLE_RAILS_PEER=1` opt-in) and add equivalent registration hooks to kimi/codex/agy session-start via their respective config/hook surfaces. Until that lands, the filesystem fallback keeps the tool functional.

### 5. Steering hooks → per-repo convention, already working

The `.steering/checkpoint.md` convention + Stop-hook steering consult is documented in the platform `AGENTS.md` and works today. Repos opt in by adding the hook config and a `.steering/README.md`. `Allternit-websites` now has `.steering/checkpoint.md` written by the audit agent; adding the Stop hook there is a repo-config decision, not product code.

## Migration checklist

- [x] `ao-*` scripts: repo already canonical at `tools/agent-orchestrator/scripts/` (shims over `allternit-rails`); desktop `~/.local/bin` re-synced to repo via `tools/agent-orchestrator/install.sh`.
- [x] `steer-*` scripts added to `tools/agent-orchestrator/scripts/`; desktop symlinks repointed to repo.
- [x] Skills copied to `allternit-platform/.agents/skills/{agent-orchestrator,steer-parallel-agent}/` (project scope, auto-discovered by gizzi-code's skill scanner).
- [x] Both skills registered in the gizzi-code builtin catalog: `cmd/gizzi-code/src/runtime/skills/bundledSkills.ts` imports `src/runtime/skills/bundled/{agentOrchestrator,steerParallelAgent}.md` via Bun's text loader (`.md` module types already declared in `src/types/global.d.ts`).
- [x] `steer-discover` is Rails-first (`GET $ALLTERNIT_RAILS_URL/api/rails/peers`, default `http://127.0.0.1:8013`) with kimi filesystem-scan fallback.
- [x] `GIZZI_ENABLE_RAILS_PEER` is now default-on in gizzi-code (opt out with `=0`): `railsPeer.ts`, `tools-registry-gizzi.ts`, `cli/ui/ink-app/tools.ts` flipped from `isEnvTruthy` to `!isEnvDefinedFalsy`.
- [x] `tools/agent-orchestrator/install.sh` symlinks all 13 tools + `allternit-rails` binary into `~/.local/bin` (builds the binary via `cargo build --release -p allternit-agent-system-rails` when missing).
- [ ] Homebrew **formula** for the CLI tools — deferred: needs release tarballs with sha256; the desktop cask (`homebrew-tap/Casks/allternit.rb`) should bundle the tools into the app's resources and run `install.sh` on first run instead.
- [ ] `install.allternit.com` — the DMG installer should invoke the toolkit install step post-install (owned by the websites repo; coordinate before editing).
- [x] `ORCHESTRATOR.md` + SKILL.md files now state the repo is canonical.

**Note:** `~/.local/bin` symlinks currently point into the session worktree. After this branch merges to main, re-run `tools/agent-orchestrator/install.sh` from the main checkout to repoint them durably.

## What NOT to package

- Session-specific state (`~/.kimi-code/sessions/`, wire logs) — machine-local by design.
- The Rails API server itself — already part of `cmd/allternit-api`, runs as a platform service.
- Evidence/log dirs (`~/.agent-orchestrator/logs/`, `evidence/`) — runtime output, not product code.
