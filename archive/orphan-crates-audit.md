# Orphan Rust Crate Audit

Generated: 2026-07-03 12:40

Passes completed:
- Archived 8 tiny dead stubs.
- Archived 19 additional dead stubs.
- Integrated memory subsystem: 8 crates.
- Integrated 15 clean orphans without broken dependency paths.
- Archived 8 orphans that referenced already-archived crates (including security-network, environment-spec, kernel-service, marketplace, etc.).
- Skipped ars-contexta-nlp due to conflicting `tch` versions.

Remaining orphan crates: 48

## Remaining orphans by size

| Path | Package | Rust files | Rust LOC | Last commit | Referenced by |
|------|---------|------------|----------|-------------|---------------|
| cmd/launcher | allternit-platform-launcher | 1 | 246 | 2026-07-03 | — |
| domains/agent-swarm/core | allternit-meta-swarm | 44 | 7493 | 2026-07-01 | — |
| domains/agent/allternit-embodiment | allternit-embodiment | 1 | 2943 | 2026-07-03 | — |
| domains/governance/evidence-management/receipts-schema | allternit-receipts-schema | 4 | 1554 | 2026-04-25 | — |
| domains/governance/garbage-collection/gc-agents | allternit-gc-agents | 4 | 2322 | 2026-04-25 | — |
| domains/governance/security-quality-assurance/evals | allternit-evals | 1 | 1823 | 2026-04-25 | — |
| domains/kernel/core/kernel-compat | allternit-kernel-compat | 1 | 892 | 2026-04-25 | — |
| domains/kernel/drivers/allternit-acp-driver/allternit-acp-driver | allternit-acp-driver | 10 | 1921 | 2026-04-25 | — |
| domains/kernel/drivers/allternit-parity | allternit-parity | 8 | 2059 | 2026-04-25 | — |
| domains/kernel/drivers/allternit-providers | allternit-providers | 14 | 6306 | 2026-04-25 | — |
| domains/kernel/drivers/allternit-rlm | allternit-rlm | 9 | 3462 | 2026-07-01 | — |
| domains/kernel/drivers/allternit-runtime | allternit-runtime | 23 | 5621 | 2026-04-25 | — |
| domains/kernel/drivers/context-pack-builder | allternit-context-pack-builder | 1 | 663 | 2026-04-25 | — |
| domains/kernel/drivers/dag-wih-integration | allternit-dag-wih-integration | 5 | 2337 | 2026-04-25 | path:services/ui/browser-view-service |
| domains/kernel/drivers/evaluation-harness | allternit-evaluation-harness | 9 | 3037 | 2026-04-25 | — |
| domains/kernel/drivers/harness-engineering | allternit-harness-engineering | 1 | 1043 | 2026-04-25 | — |
| domains/kernel/drivers/hooks-system | allternit-hooks-system | 1 | 838 | 2026-04-25 | — |
| domains/kernel/drivers/purpose-binding-core | allternit-purpose-binding-core | 1 | 530 | 2026-04-25 | — |
| domains/kernel/service/allternit-local-compute/executor | executor | 1 | 705 | 2026-04-25 | — |
| domains/kernel/service/allternit-ops/packaging | allternit-packaging | 1 | 1462 | 2026-04-25 | — |
| infrastructure/chrome-stream/runtime | allternit-browser-runtime | 4 | 1353 | 2026-04-25 | — |
| infrastructure/executor/bridge-systems/io-daemon | allternit-io-daemon | 4 | 716 | 2026-07-01 | — |
| infrastructure/providers/vendor-integration/wrappers | allternit-vendor-wrappers | 1 | 520 | 2026-04-25 | — |
| infrastructure/scheduler | allternit-scheduler | 5 | 1222 | 2026-04-25 | — |
| infrastructure/scheduler/cron-parser | allternit-cron-parser | 1 | 506 | 2026-04-25 | — |
| infrastructure/vps-node | allternit-node | 11 | 5544 | 2026-07-01 | — |
| platform/contracts/capsule/capsule-system/allternit-capsule-runtime | capsule-runtime | 9 | 914 | 2026-07-02 | — |
| platform/protocols/transport-sms | allternit-transport-sms | 1 | 655 | 2026-04-25 | — |
| platform/sdk/allternit-skill-portability | allternit-skill-portability | 8 | 1676 | 2026-04-25 | — |
| services/memory/data/allternit-memory-provider | allternit-memory-provider | 3 | 789 | 2026-04-25 | — |
| services/memory/data/ars-contexta/native | ars-contexta-nlp | 5 | 522 | 2026-04-25 | — |
| services/ml/pattern-service | pattern-service | 4 | 219 | 2026-07-01 | — |
| services/ml/prompt-pack-service | prompt-pack-service | 10 | 1844 | 2026-07-01 | — |
| services/orchestration/control-plane/allternit-agent-orchestration/hooks | allternit-hooks | 3 | 1167 | 2026-04-25 | — |
| services/orchestration/control-plane/allternit-control/control-plane | allternit-control-plane | 1 | 1669 | 2026-04-25 | — |
| services/orchestration/control-plane/unified-registry/artifact-registry | allternit-artifact-registry | 1 | 2245 | 2026-04-25 | — |
| services/orchestration/control-plane/unified-registry/tool-registry | allternit-tool-registry | 1 | 575 | 2026-04-25 | — |
| services/orchestration/orchestration/budget-metering | allternit-budget-metering | 1 | 608 | 2026-04-25 | — |
| services/orchestration/orchestration/byoc-edge-runner | allternit-edge-runner | 1 | 521 | 2026-04-25 | — |
| services/orchestration/orchestration/conflict-arbitration | allternit-conflict-arbitration | 1 | 530 | 2026-04-25 | — |
| services/orchestration/orchestration/node-registry | allternit-node-registry | 1 | 594 | 2026-04-25 | — |
| services/process-driver | allternit-process-driver | 1 | 429 | 2026-07-01 | — |
| services/registry/apps-registry | allternit-registry-apps | 2 | 905 | 2026-04-25 | path:domains/kernel/service/allternit-local-compute/executor |
| services/registry/framework-registry | framework | 4 | 1088 | 2026-07-01 | — |
| services/registry/functions-registry | allternit-registry-functions | 2 | 545 | 2026-04-25 | path:domains/kernel/service/allternit-local-compute/executor |
| services/registry/server-registry | registry-server | 3 | 1277 | 2026-07-01 | — |
| services/tools/kernel-tools | allternit-tools | 4 | 410 | 2026-07-01 | — |
| services/ui/browser-view-service | allternit-browser-view-service | 3 | 979 | 2026-04-25 | — |

## Recommended next actions

1. Fix broken path references in remaining orphans (old directory structure) and integrate coherent subsystems.
2. For orphans with broken references to archived crates, archive those orphans too.
3. Evaluate large subsystems (>5000 LOC) for packaging as separate repos like `rails`.
