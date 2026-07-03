# Orphan Rust Crate Audit

Generated: 2026-07-03 12:48

Passes completed:
- Archived 8 tiny dead stubs.
- Archived 19 additional dead stubs.
- Integrated memory subsystem: 8 crates.
- Integrated 15 clean orphans without broken dependency paths.
- Archived 8 orphans that referenced already-archived crates.
- Integrated registry subsystem: apps-registry, framework-registry, functions-registry.
- Archived registry-server (compile errors: missing base64 module).
- Skipped ars-contexta-nlp due to conflicting `tch` versions.
- Fixed old directory-structure path references and integrated 13 remaining orphans:
  - domains/agent-swarm/core (allternit-meta-swarm) — fixed 19 compile errors
  - domains/kernel/drivers/allternit-providers
  - domains/kernel/drivers/allternit-rlm
  - domains/kernel/drivers/context-pack-builder
  - domains/kernel/drivers/dag-wih-integration
  - domains/kernel/service/allternit-local-compute/executor
  - domains/governance/evidence-management/receipts-schema
  - infrastructure/chrome-stream/runtime (allternit-browser-runtime)
  - infrastructure/scheduler
  - infrastructure/scheduler/cron-parser
  - platform/contracts/capsule/capsule-system/allternit-capsule-runtime
  - services/orchestration/control-plane/unified-registry/tool-registry
- Un-archived and restored 2 crates needed by capsule-runtime:
  - platform/sdk/adapters/rust/marketplace
  - platform/types/a2ui-types
- Integrated 10 additional orphans (workspace-referenced and orphan clusters):
  - services/process-driver (referenced by session-manager)
  - domains/kernel/drivers/harness-engineering (referenced by evolution-layer, hooks-system)
  - domains/kernel/drivers/allternit-runtime
  - domains/kernel/drivers/allternit-acp-driver/allternit-acp-driver (fixed BrainRuntime trait mismatch)
  - domains/kernel/core/kernel-compat
  - domains/agent/allternit-embodiment
  - domains/governance/security-quality-assurance/evals
  - domains/kernel/service/allternit-ops/packaging
  - services/orchestration/control-plane/allternit-control/control-plane
  - services/orchestration/control-plane/unified-registry/artifact-registry

Remaining orphan crates: 1

## Remaining orphans by size

| Path | Package | Rust files | Rust LOC | Last commit | Referenced by |
|------|---------|------------|----------|-------------|---------------|
| cmd/launcher | allternit-platform-launcher | 1 | 246 | 2026-07-03 | standalone workspace |

## Resolved in this pass

- Integrated 20 standalone orphans into the workspace:
  - domains/governance/garbage-collection/gc-agents
  - domains/kernel/drivers/hooks-system
  - domains/kernel/drivers/purpose-binding-core
  - infrastructure/executor/bridge-systems/io-daemon
  - infrastructure/providers/vendor-integration/wrappers
  - platform/protocols/transport-sms
  - platform/sdk/allternit-skill-portability
  - services/memory/data/allternit-memory-provider
  - services/ml/pattern-service
  - services/ml/prompt-pack-service
  - services/orchestration/control-plane/allternit-agent-orchestration/hooks
  - services/orchestration/orchestration/budget-metering
  - services/orchestration/orchestration/conflict-arbitration
  - services/orchestration/orchestration/node-registry
  - services/tools/kernel-tools
  - domains/kernel/drivers/allternit-parity
  - domains/kernel/drivers/evaluation-harness
  - infrastructure/vps-node (allternit-node)
  - services/orchestration/orchestration/byoc-edge-runner
  - services/ui/browser-view-service
- Fixed compile error in purpose-binding-core (String vs &str contains checks).
- Archived `ars-contexta-nlp` to `archive/rust-orphans/ars-contexta-nlp` due to unresolved `tch` version conflict.

## Recommended next actions

1. Build the embed pipeline for `cmd/launcher` (`api/embed/allternit-api`, `cmd/shell-ui/dist`) and re-enable it in the root workspace.
2. Evaluate large subsystems (>5000 LOC) such as `allternit-providers`, `allternit-runtime`, `allternit-node`, and `allternit-embodiment` for packaging as separate repos like `rails`.
3. Audit `allternit-desktop` for design/layout/feature gaps.
4. Implement tasks/cron execution infrastructure.
