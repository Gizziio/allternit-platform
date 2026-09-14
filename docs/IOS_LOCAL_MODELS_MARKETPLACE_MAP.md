# iOS / Local Models / Marketplace Branch Map

**Branch:** `session/7d581442-d796-4e0e-bdac-2fec641c3677`  
**Worktree:** `~/Desktop/allternit-workspace/allternit-session-7d581442-d796-4e0e-bdac-2fec641c3677`  
**Goal:** Bring the branch back to a clean, reviewable state and identify the remaining work to land the iOS Models tab, local-model sidecar, agent marketplace, and Lens context features.

## Feature areas present in the branch

1. **iOS app surfaces** (`surfaces/allternit-mobile/ios/`)
   - Models tab, marketplace UI, performance stats, on-device MLX chat.
   - Widgets extension (`AllternitWidgets`).

2. **Agent marketplace** (`surfaces/ai.allternit.com/src/components/marketplace/`, `cmd/allternit-api/src/marketplace_routes.rs`)
   - Publish / browse / install / rate agents and connectors.
   - Capability cards, checkout modal, plugin marketplace.

3. **Local models runtime** (`surfaces/ai.allternit.com/src/lib/local-models/`)
   - Bonsai runtime, Qwen tokenizer/kernel benchmark.

4. **Gizzi-code codemap / graph** (`cmd/gizzi-code/src/codemap/`)
   - Deterministic codemap generation, vault/brain graph topology.

5. **Allternit Lens context layer** (`cmd/gizzi-code/src/cli/ui/ink-app/component/dialog-plugin-marketplace.tsx`, prior commits)
   - Lens context settings panel, connector sidecar spawning.

6. **Sidecar / runtime** (`cmd/gizzi-code/src/runtime/sidecar/`, `cmd/gizzi-code/src/runtime/server/routes/sidecar.ts`)
   - Connector sidecar API and runtime.

## Current problems

- The top commit is `WIP: preserve local changes before consolidation` — an accidental safety-net commit from the worktree cleanup. It may contain real work mixed with consolidation noise.
- The branch is far behind `origin/main`; `git diff origin/main --stat` shows thousands of lines of unrelated deletions (parity reports, skills, workflows). This makes review impossible until the branch is rebased/merged with `main`.
- It is unclear which files in the WIP commit are intentional and which are consolidation artifacts.

## Success criteria

- WIP commit is either dropped (if it is pure noise) or split into coherent commits.
- `origin/main` is merged into the branch and conflicts resolved.
- Branch is pushed to `origin/session/7d581442-...`.
- A written MAP/NOTES file lists the actual changed files per feature area and flags anything blocked or incomplete.
