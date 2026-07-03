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

Remaining orphan crates: 31

## Remaining orphans by size

| Path | Package | Rust files | Rust LOC | Last commit | Referenced by |
|------|---------|------------|----------|-------------|---------------|
| cmd/launcher | allternit-platform-launcher | 1 | 246 | 2026-07-03 | — |
| domains/agent/allternit-embodiment | allternit-embodiment | 1 | 2943 | 2026-07-03 | — |
| domains/governance/garbage-collection/gc-agents | allternit-gc-agents | 4 | 2322 | 2026-04-25 | — |
| domains/governance/security-quality-assurance/evals | allternit-evals | 1 | 1823 | 2026-04-25 | — |
| domains/kernel/core/kernel-compat | allternit-kernel-compat | 1 | 892 | 2026-04-25 | — |
| domains/kernel/drivers/allternit-acp-driver/allternit-acp-driver | allternit-acp-driver | 10 | 1921 | 2026-04-25 | — |
| domains/kernel/drivers/allternit-parity | allternit-parity | 8 | 2059 | 2026-04-25 | — |
| domains/kernel/drivers/allternit-runtime | allternit-runtime | 23 | 5621 | 2026-04-25 | — |
| domains/kernel/drivers/evaluation-harness | allternit-evaluation-harness | 9 | 3037 | 2026-04-25 | — |
| domains/kernel/drivers/harness-engineering | allternit-harness-engineering | 1 | 1043 | 2026-04-25 | — |
| domains/kernel/drivers/hooks-system | allternit-hooks-system | 1 | 838 | 2026-04-25 | — |
| domains/kernel/drivers/purpose-binding-core | allternit-purpose-binding-core | 1 | 530 | 2026-04-25 | — |
| domains/kernel/service/allternit-ops/packaging | allternit-packaging | 1 | 1462 | 2026-04-25 | — |
| infrastructure/executor/bridge-systems/io-daemon | allternit-io-daemon | 4 | 716 | 2026-07-01 | — |
| infrastructure/providers/vendor-integration/wrappers | allternit-vendor-wrappers | 1 | 520 | 2026-04-25 | — |
| infrastructure/vps-node | allternit-node | 11 | 5544 | 2026-07-01 | — |
| platform/protocols/transport-sms | allternit-transport-sms | 1 | 655 | 2026-04-25 | — |
| platform/sdk/allternit-skill-portability | allternit-skill-portability | 8 | 1676 | 2026-04-25 | — |
| services/memory/data/allternit-memory-provider | allternit-memory-provider | 3 | 789 | 2026-04-25 | — |
| services/memory/data/ars-contexta/native | ars-contexta-nlp | 5 | 522 | 2026-04-25 | — |
| services/ml/pattern-service | pattern-service | 4 | 219 | 2026-07-01 | — |
| services/ml/prompt-pack-service | prompt-pack-service | 10 | 1844 | 2026-07-01 | — |
| services/orchestration/control-plane/allternit-agent-orchestration/hooks | allternit-hooks | 3 | 1167 | 2026-04-25 | — |
| services/orchestration/control-plane/allternit-control/control-plane | allternit-control-plane | 1 | 1669 | 2026-04-25 | — |
| services/orchestration/control-plane/unified-registry/artifact-registry | allternit-artifact-registry | 1 | 2245 | 2026-04-25 | — |
| services/orchestration/orchestration/budget-metering | allternit-budget-metering | 1 | 608 | 2026-04-25 | — |
| services/orchestration/orchestration/byoc-edge-runner | allternit-edge-runner | 1 | 521 | 2026-04-25 | — |
| services/orchestration/orchestration/conflict-arbitration | allternit-conflict-arbitration | 1 | 530 | 2026-04-25 | — |
| services/orchestration/orchestration/node-registry | allternit-node-registry | 1 | 594 | 2026-04-25 | — |
| services/process-driver | allternit-process-driver | 1 | 429 | 2026-07-01 | — |
| services/tools/kernel-tools | allternit-tools | 4 | 410 | 2026-07-01 | — |
| services/ui/browser-view-service | allternit-browser-view-service | 3 | 979 | 2026-04-25 | — |

## Recommended next actions

1. Continue integrating remaining 31 orphans with clean dependency graphs.
2. Evaluate large subsystems (>5000 LOC) such as allternit-providers, allternit-runtime, allternit-node, and allternit-embodiment for packaging as separate repos like `rails`.
3. Audit `cmd/launcher` for the missing embed pipeline before re-enabling.
4. Resolve `ars-contexta-nlp` `tch` version conflict or archive it.
