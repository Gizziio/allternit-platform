# Orphan Rust Crate Audit

Generated: 2026-07-03 12:32

Passes completed:
- Archived 8 tiny dead stubs to `archive/rust-orphans/`.
- Archived 19 additional dead stubs (providers, governance stubs, bridge stubs, etc.).
- Integrated memory subsystem: 8 crates added to workspace members.

Remaining orphan crates: 72

## Remaining orphans by size

| Path | Package | Rust files | Rust LOC | Last commit | Referenced by |
|------|---------|------------|----------|-------------|---------------|
| cmd/launcher | allternit-platform-launcher | 1 | 246 | 2026-07-03 | — |
| domains/agent-swarm/core | allternit-meta-swarm | 44 | 7493 | 2026-07-01 | — |
| domains/agent/allternit-embodiment | allternit-embodiment | 1 | 2943 | 2026-07-03 | — |
| domains/governance/audit-logging/core-audit | audit-log | 1 | 185 | 2026-07-01 | — |
| domains/governance/evidence-management/receipts-schema | allternit-receipts-schema | 4 | 1554 | 2026-04-25 | — |
| domains/governance/garbage-collection/gc-agents | allternit-gc-agents | 4 | 2322 | 2026-04-25 | — |
| domains/governance/identity-access-control/core-policy | policy | 1 | 468 | 2026-07-01 | — |
| domains/governance/security-network | allternit-federation | 9 | 4834 | 2026-07-01 | — |
| domains/governance/security-network/terminal | allternit-terminal | 1 | 1229 | 2026-07-01 | — |
| domains/governance/security-quality-assurance/evals | allternit-evals | 1 | 1823 | 2026-04-25 | — |
| domains/kernel/allternit-intent-graph-kernel/allternit-intent-graph-kernel | intent-graph-kernel | 9 | 927 | 2026-07-01 | — |
| domains/kernel/allternit-presentation-kernel | presentation-kernel | 9 | 1272 | 2026-07-01 | — |
| domains/kernel/core/kernel-compat | allternit-kernel-compat | 1 | 892 | 2026-04-25 | — |
| domains/kernel/drivers/allternit-acp-driver/allternit-acp-driver | allternit-acp-driver | 10 | 1921 | 2026-04-25 | — |
| domains/kernel/drivers/allternit-environment-spec | allternit-environment-spec | 19 | 5727 | 2026-07-01 | — |
| domains/kernel/drivers/allternit-parity | allternit-parity | 8 | 2059 | 2026-04-25 | — |
| domains/kernel/drivers/allternit-providers | allternit-providers | 14 | 6306 | 2026-04-25 | — |
| domains/kernel/drivers/allternit-rlm | allternit-rlm | 9 | 3462 | 2026-07-01 | — |
| domains/kernel/drivers/allternit-runtime | allternit-runtime | 23 | 5621 | 2026-04-25 | — |
| domains/kernel/drivers/context-pack-builder | allternit-context-pack-builder | 1 | 663 | 2026-04-25 | — |
| domains/kernel/drivers/dag-wih-integration | allternit-dag-wih-integration | 5 | 2337 | 2026-04-25 | path:services/ui/browser-view-service |
| domains/kernel/drivers/evaluation-harness | allternit-evaluation-harness | 9 | 3037 | 2026-04-25 | — |
| domains/kernel/drivers/harness-engineering | allternit-harness-engineering | 1 | 1043 | 2026-04-25 | — |
| domains/kernel/drivers/hooks-system | allternit-hooks-system | 1 | 838 | 2026-04-25 | — |
| domains/kernel/drivers/ivkge-advanced | allternit-ivkge-advanced | 5 | 1379 | 2026-07-01 | — |
| domains/kernel/drivers/multimodal-streaming | allternit-multimodal-streaming | 4 | 1373 | 2026-07-01 | — |
| domains/kernel/drivers/purpose-binding-core | allternit-purpose-binding-core | 1 | 530 | 2026-04-25 | — |
| domains/kernel/drivers/swarm-advanced | allternit-swarm-advanced | 5 | 1647 | 2026-04-25 | — |
| domains/kernel/drivers/tambo-integration | allternit-tambo-integration | 12 | 5696 | 2026-04-25 | — |
| domains/kernel/drivers/tambo-napi | allternit-tambo-napi | 2 | 726 | 2026-07-02 | — |
| domains/kernel/service/allternit-local-compute/executor | executor | 1 | 705 | 2026-04-25 | — |
| domains/kernel/service/allternit-local-compute/local-inference | allternit-local-inference | 4 | 559 | 2026-04-25 | — |
| domains/kernel/service/allternit-local-compute/local-inference-gguf | local-inference | 4 | 295 | 2026-07-01 | — |
| domains/kernel/service/allternit-ops/packaging | allternit-packaging | 1 | 1462 | 2026-04-25 | — |
| domains/kernel/service/autonomous-code-factory | allternit-autonomous-code-factory | 1 | 538 | 2026-04-25 | — |
| domains/kernel/service/environment-standardization | allternit-environment | 7 | 1583 | 2026-07-02 | — |
| domains/kernel/service/multimodal-streaming | multimodal-streaming-execution | 29 | 14126 | 2026-07-02 | — |
| infrastructure/chrome-stream/runtime | allternit-browser-runtime | 4 | 1353 | 2026-04-25 | — |
| infrastructure/executor/bridge-systems/io-daemon | allternit-io-daemon | 4 | 716 | 2026-07-01 | — |
| infrastructure/local | allternit-multi-region | 6 | 2033 | 2026-07-01 | — |
| infrastructure/providers/vendor-integration/wrappers | allternit-vendor-wrappers | 1 | 520 | 2026-04-25 | — |
| infrastructure/scheduler | allternit-scheduler | 5 | 1222 | 2026-04-25 | — |
| infrastructure/scheduler/cron-parser | allternit-cron-parser | 1 | 506 | 2026-04-25 | — |
| infrastructure/vps-node | allternit-node | 11 | 5544 | 2026-07-01 | — |
| platform/contracts/capsule/capsule-system/allternit-capsule-compiler | capsule_compiler | 1 | 692 | 2026-04-25 | — |
| platform/contracts/capsule/capsule-system/allternit-capsule-runtime | capsule-runtime | 9 | 914 | 2026-07-02 | — |
| platform/contracts/schemas/allternit-capsule-spec | capsule_spec | 1 | 395 | 2026-04-25 | path:services/orchestration/orchestration/kernel-service |
| platform/protocols/allternit-protocol | allternit-protocol | 1 | 888 | 2026-04-25 | path:infrastructure/vps-node |
| platform/protocols/transport-sms | allternit-transport-sms | 1 | 655 | 2026-04-25 | — |
| platform/sdk/adapters/rust/marketplace | marketplace | 11 | 3105 | 2026-04-25 | — |
| platform/sdk/allternit-skill-portability | allternit-skill-portability | 8 | 1676 | 2026-04-25 | — |
| services/gateway/stdio | gateway-stdio | 2 | 812 | 2026-04-25 | — |
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
| services/orchestration/orchestration/kernel-service | kernel | 83 | 22363 | 2026-07-02 | — |
| services/orchestration/orchestration/node-registry | allternit-node-registry | 1 | 594 | 2026-04-25 | — |
| services/process-driver | allternit-process-driver | 1 | 429 | 2026-07-01 | path:domains/kernel/drivers/allternit-environment-spec |
| services/registry/apps-registry | allternit-registry-apps | 2 | 905 | 2026-04-25 | path:domains/kernel/service/allternit-local-compute/executor |
| services/registry/framework-registry | framework | 4 | 1088 | 2026-07-01 | — |
| services/registry/functions-registry | allternit-registry-functions | 2 | 545 | 2026-04-25 | path:domains/kernel/service/allternit-local-compute/executor |
| services/registry/server-registry | registry-server | 3 | 1277 | 2026-07-01 | — |
| services/tools/kernel-tools | allternit-tools | 4 | 410 | 2026-07-01 | — |
| services/ui/browser-view-service | allternit-browser-view-service | 3 | 979 | 2026-04-25 | — |

## Recommended next actions

1. Integrate coherent subsystems that compile (kernel drivers, orchestration control-plane, local compute) by adding their crates to workspace members and resolving dependency chains.
2. Evaluate large standalone subsystems (>5000 LOC) for packaging as separate repos like `rails`.
3. Continue archiving unreferenced stubs after verifying no external references.
