# /spec/Baseline.md — Codebase Baseline (Atlas-derived)

Generated: 2026-01-27

This baseline is derived from the **A2RCHITECH_CODEBASE_ATLAS.md** file (repo inventory snapshot). It is the frozen reference for subsequent deltas.

## Repo topology signals (from Atlas)

Top-level directory frequency (path mentions):

| root | mentions |
|---|---:|
| `services/` | 86957 |
| `apps/` | 60412 |
| `crates/` | 443 |
| `packages/` | 121 |
| `spec/` | 6 |
| `/` | 4 |
| `dev/` | 2 |
| `types/` | 2 |
| `.beads/` | 1 |
| `.codex/` | 1 |
| `.gemini/` | 1 |
| `.git/` | 1 |
| `.github/` | 1 |
| `.logs/` | 1 |
| `.opencode/` | 1 |
| `.shared/` | 1 |
| `.venv/` | 1 |
| `agent/` | 1 |
| `bin/` | 1 |
| `contracts/` | 1 |
| `dist/` | 1 |
| `docs/` | 1 |
| `examples/` | 1 |
| `infra/` | 1 |
| `intent/` | 1 |
| `kernel/` | 1 |
| `launchd/` | 1 |
| `libs/` | 1 |
| `memory/` | 1 |
| `node_modules/` | 1 |
| `plan/` | 1 |
| `reference/` | 1 |
| `runtime/` | 1 |
| `scripts/` | 1 |
| `shell/` | 1 |
| `target/` | 1 |
| `tests/` | 1 |
| `tools/` | 1 |
| `ui/` | 1 |
| `workspace/` | 1 |

## Notable paths (sample)

- `.beads/`
- `.codex/`
- `.gemini/`
- `.git/`
- `.github/`
- `.logs/`
- `.opencode/`
- `.shared/`
- `.venv/`
- `/tmp/a2rchitech.canvas.jsonl`
- `/v1/sessions/:id/events`
- `/v1/tools`
- `/v1/tools/:id/execute`
- `agent/`
- `apps/`
- `apps/.DS_Store`
- `apps/README.md`
- `apps/SHELLUI_FEATURES.md`
- `apps/api`
- `apps/api/.DS_Store`
- `apps/api/Cargo.toml`
- `apps/api/Dockerfile`
- `apps/api/README.md`
- `apps/api/UPGRADES.md`
- `apps/api/src`
- `apps/api/src/handlers`
- `apps/api/src/main.rs`
- `apps/api/src/routes.rs`
- `apps/api/src/terminal_session.rs`
- `apps/api/tests`
- `apps/cli`
- `apps/cli/.DS_Store`
- `apps/cli/Cargo.toml`
- `apps/cli/Dockerfile`
- `apps/cli/Ideas`
- `apps/cli/README.md`
- `apps/cli/logo_matrix_compact.txt`
- `apps/cli/src`
- `apps/cli/src/.DS_Store`
- `apps/cli/src/client.rs`
- `apps/cli/src/commands`
- `apps/cli/src/commands/agent_template.rs`
- `apps/cli/src/commands/auth.rs`
- `apps/cli/src/commands/brain_integration.rs`
- `apps/cli/src/commands/canvas.rs`
- `apps/cli/src/commands/cap.rs`
- `apps/cli/src/commands/capsule.rs`
- `apps/cli/src/commands/daemon.rs`
- `apps/cli/src/commands/ev.rs`
- `apps/cli/src/commands/j.rs`
- `apps/cli/src/commands/marketplace.rs`
- `apps/cli/src/commands/mod.rs`
- `apps/cli/src/commands/model.rs`
- `apps/cli/src/commands/persona.rs`
- `apps/cli/src/commands/project_template.rs`
- `apps/cli/src/commands/repl.rs`
- `apps/cli/src/commands/rlm.rs`
- `apps/cli/src/commands/run.rs`
- `apps/cli/src/commands/skills.rs`
- `apps/cli/src/commands/tools.rs`
- `apps/cli/src/commands/tui.rs`
- `apps/cli/src/commands/validate.rs`
- `apps/cli/src/commands/voice.rs`
- `apps/cli/src/commands/webvm.rs`
- `apps/cli/src/commands/workflow.rs`
- `apps/cli/src/commands/workflow.rs.bak`
- `apps/cli/src/config.rs`
- `apps/cli/src/main.rs`
- `apps/console`
- `apps/openwork`
- `apps/openwork/.DS_Store`
- `apps/openwork/node_modules`
- `apps/openwork/node_modules/`
- `apps/openwork/node_modules/.bin`
- `apps/openwork/node_modules/.bin/tsx`
- `apps/openwork/node_modules/.bin/vite`
- `apps/openwork/node_modules/react`
- `apps/openwork/node_modules/react-dom`
- `apps/openwork/node_modules/vite`
- `apps/openwork/package.json`
- `apps/openwork/src`
- `apps/openwork/src/index.tsx`
- `apps/openwork/tsconfig.json`
- `apps/shared`
- `apps/shared/contracts.d.ts`
- `apps/shared/contracts.js`
- `apps/shared/contracts.ts`
- `apps/shell`
- `apps/shell-electron`
- `apps/shell-electron/dist`
- `apps/shell-electron/dist/main`
- `apps/shell-electron/dist/main/index.d.ts`
- `apps/shell-electron/dist/main/index.d.ts.map`
- `apps/shell-electron/dist/main/index.js`
- `apps/shell-electron/dist/main/index.js.map`
- `apps/shell-electron/dist/preload`
- `apps/shell-electron/dist/preload/index.d.ts`
- `apps/shell-electron/dist/preload/index.d.ts.map`
- `apps/shell-electron/dist/preload/index.js`
- `apps/shell-electron/dist/preload/index.js.map`
- `apps/shell-electron/main`
- `apps/shell-electron/main/index.cjs`
- `apps/shell-electron/node_modules`
- `apps/shell-electron/node_modules/`
- `apps/shell-electron/node_modules/.bin`
- `apps/shell-electron/node_modules/.bin/conc`
- `apps/shell-electron/node_modules/.bin/concurrently`
- `apps/shell-electron/node_modules/.bin/electron`
- `apps/shell-electron/node_modules/.bin/esbuild`
- `apps/shell-electron/node_modules/.bin/extract-zip`
- `apps/shell-electron/node_modules/.bin/semver`
- `apps/shell-electron/node_modules/.bin/tree-kill`
- `apps/shell-electron/node_modules/.bin/tsc`
- `apps/shell-electron/node_modules/.bin/tsserver`
- `apps/shell-electron/node_modules/.bin/tsx`
- `apps/shell-electron/node_modules/.bin/wait-on`
- `apps/shell-electron/node_modules/.ignored`
- `apps/shell-electron/node_modules/.ignored/concurrently`
- `apps/shell-electron/node_modules/.ignored/concurrently/LICENSE`
- `apps/shell-electron/node_modules/.ignored/concurrently/README.md`

## Gaps / warnings captured from Atlas text

- apps/shell/copilotkit-reference/docs/content/docs/integrations/direct-to-llm/tutorials/ai-todo-app
- apps/shell/copilotkit-reference/docs/content/docs/integrations/direct-to-llm/tutorials/ai-todo-app/step-4-frontend-tools.mdx
- apps/shell/copilotkit-reference/docs/content/docs/integrations/direct-to-llm/tutorials/ai-todo-app/overview.mdx
- apps/shell/copilotkit-reference/docs/content/docs/integrations/direct-to-llm/tutorials/ai-todo-app/step-1-checkout-repo.mdx
- apps/shell/copilotkit-reference/docs/content/docs/integrations/direct-to-llm/tutorials/ai-todo-app/step-3-copilot-readable-state.mdx
- apps/shell/copilotkit-reference/docs/content/docs/integrations/direct-to-llm/tutorials/ai-todo-app/next-steps.mdx
- apps/shell/copilotkit-reference/docs/content/docs/integrations/direct-to-llm/tutorials/ai-todo-app/step-2-setup-copilotkit.mdx
- apps/shell/copilotkit-reference/docs/content/docs/integrations/direct-to-llm/tutorials/ai-todo-app/meta.json
- apps/shell/node_modules/cytoscape/tests-examples/demo-todo-app.spec.js
- apps/shell/node_modules/lucide-react/dist/esm/icons/list-todo.js.map
- apps/shell/node_modules/lucide-react/dist/esm/icons/list-todo.js
- apps/shell/node_modules/@iconify/utils/lib/emoji/test/missing.js
- apps/shell/node_modules/@iconify/utils/lib/emoji/test/missing.d.ts
- apps/shell/node_modules/lucide/dist/esm/icons/list-todo.js.map
- apps/shell/node_modules/lucide/dist/esm/icons/list-todo.js
- apps/shell/node_modules/streamdown/node_modules/lucide-react/dist/esm/icons/list-todo.js.map
- apps/shell/node_modules/streamdown/node_modules/lucide-react/dist/esm/icons/list-todo.js
- services/voice-service/.venv/lib/python3.11/site-packages/scipy/io/arff/tests/data/missing.arff
- services/voice-service/.venv/lib/python3.11/site-packages/pandas/core/missing.py
- services/voice-service/.venv/lib/python3.11/site-packages/pandas/core/__pycache__/missing.cpython-311.pyc
- services/voice-service/.venv/lib/python3.11/site-packages/pandas/core/dtypes/missing.py
- services/voice-service/.venv/lib/python3.11/site-packages/pandas/core/dtypes/__pycache__/missing.cpython-311.pyc
- services/voice-service/.venv/lib/python3.11/site-packages/pandas/core/ops/missing.py
- services/voice-service/.venv/lib/python3.11/site-packages/pandas/core/ops/__pycache__/missing.cpython-311.pyc
- services/voice-service/.venv/lib/python3.11/site-packages/pandas/tests/extension/base/missing.py
- services/voice-service/.venv/lib/python3.11/site-packages/pandas/tests/extension/base/__pycache__/missing.cpython-311.pyc
- services/voice-service/.venv/lib/python3.11/site-packages/pandas/_libs/missing.pyi
- services/voice-service/.venv/lib/python3.11/site-packages/pandas/_libs/missing.cpython-311-darwin.so
- - UNIMPLEMENTED: WIH schema references were not found; only capsule and A2UI schemas are present. (spec/schemas/capsule_spec.v0.1.schema.json, docs/OPERATOR_PACK/schemas/A2UI.v0.1.json)
- - CLI brain sandboxing scrubs env vars when workspace_only is enabled; network disabling is stubbed. (services/kernel/src/brain/drivers/cli.rs)
- - UI-TARS operator reads API keys from env and falls back to mock inference if missing. (services/ui-tars-operator/src/main.py)
- ### TODO and stub inventory (paths and line numbers)
- reference/jared/Jared/PluginManager.swift:70:        //TODO: Add better version comparison (2.1.0 should be compatible with 2.0.0)
- reference/mlx-examples/segment_anything/segment_anything/mask_decoder.py:201:# TODO: Naive implem. Replace when mlx.nn support conv_transpose
- reference/mlx-examples/segment_anything/segment_anything/image_encoder.py:377:    # TODO: replace mx.einsum when its ready
- reference/mlx-examples/segment_anything/segment_anything/utils/amg.py:112:    # TODO: fix this with mlx
- reference/mlx-examples/flux/flux/sampler.py:35:            # TODO: Should we upweigh 1 and 0.75?
- reference/mlx-examples/flux/flux/autoencoder.py:155:            attn = []  # TODO: Remove the attn, nobody appends anything to it
- reference/mlx-examples/flux/flux/autoencoder.py:189:                # TODO: Remove the attn
- reference/mlx-examples/flux/flux/autoencoder.py:251:            attn = []  # TODO: Remove the attn, nobody appends anything to it
- reference/mlx-examples/flux/flux/autoencoder.py:285:                # TODO: Remove the attn
- crates/control/artifact-registry/src/lib.rs:3:// use a2rchitech_evals::EvaluationEngine; // TODO: Re-enable evals after fixing evals package
- crates/control/artifact-registry/src/lib.rs:1215:    // evaluation_engine: Arc<EvaluationEngine>, // TODO: Re-enable after fixing evals package
- crates/control/artifact-registry/src/lib.rs:1237:        // evaluation_engine: Arc<EvaluationEngine>, // TODO: Re-enable after fixing evals package
- crates/control/artifact-registry/src/lib.rs:1262:            // evaluation_engine, // TODO: Re-enable after fixing evals package
- reference/extism/DEVELOPING.md:34:    - TODO: We can add automation to this step so that we test on downstream deps automatically: e.g., if we
- reference/mlx-examples/lora/models.py:52:        # TODO remove when input_dims and output_dims are attributes
- packages/cli/bin/a2r-parallel.js:65:      // TODO: Implement SelfhostedExecutor
- packages/cli/bin/a2r-parallel.js:70:      // TODO: Implement LocalExecutor
- reference/extism/runtime/src/sdk.rs:27:    // TODO: v128, ExternRef, FuncRef
- reference/bluebubbles-server/packages/server/src/server/api/http/api/v1/socketRoutes.ts:310:         * TODO: DEPRECATE!
- services/kernel/src/memory_maintenance_daemon.rs:7:TODO(INTEGRATE):
- services/kernel/Cargo.toml:42:# a2rchitech-evals = { path = "../../crates/security/evals" } # TODO: Re-enable after fixing evals package
- services/kernel/src/brain/router.rs:109:            requirements_met: true, // TODO: Implement check_requirements
- services/kernel/src/brain/manager.rs:176:                // TODO: Re-hydrate runtime if needed.
- services/gateway-browser/src/lib.rs:35:        // TODO: Implement browser gateway functionality
- services/kernel/src/main.rs:45:// use a2rchitech_evals::EvaluationEngine; // TODO: Re-enable after fixing evals package
- services/kernel/src/main.rs:1660:    // ); // TODO: Re-enable after fixing evals package
- services/kernel/src/main.rs:1725:            // evaluation_engine.clone(), // TODO: Re-enable after fixing evals package
- services/kernel/src/main.rs:2774:    // ); // TODO: Re-enable after fixing evals package

## Baseline implications

- Atlas indicates an existing kernel + workspace persistence substrate and specs, but governance anchors (SOT/CODEBASE/WIH schema/ADRs) may be incomplete or absent in-tree.
- Any behavior claims must be validated against code; this baseline is structural.
