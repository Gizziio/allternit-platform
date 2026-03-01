---
wih_version: 1
work_item_id: "T6.3"
title: "Performance Testing & Optimization"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Benchmark skills sync"
    - "Benchmark workspace operations"
    - "Optimize bottlenecks"
  context_packs:
    - "benches/"
  artifacts_from_deps:
    - "T6.2"
scope:
  allowed_paths:
    - "benches/axel-integration/"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "cargo.bench"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "benches/axel-integration/skills_bench.rs"
    - "benches/axel-integration/workspace_bench.rs"
  required_reports:
    - "performance_report.md"
acceptance:
  tests:
    - "cargo bench --bench axel_integration"
  invariants:
    - "Skills sync < 1s for 100 skills"
    - "Pane spawn < 500ms"
  evidence:
    - "performance_report.md"
blockers:
  fail_on:
    - "performance_regression"
stop_conditions:
  escalate_if:
    - "unfixable_bottleneck"
  max_iterations: 5
---

# Performance Testing & Optimization

## Objective
Benchmark and optimize the axel integration.

## Benchmarks

### Skills Sync
```rust
fn bench_skill_sync(c: &mut Criterion) {
    c.bench_function("sync_100_skills", |b| {
        b.iter(|| {
            // Sync 100 skills to 4 LLMs
        })
    });
}
```

### Workspace Operations
```rust
fn bench_pane_spawn(c: &mut Criterion) {
    c.bench_function("spawn_10_panes", |b| {
        b.iter(|| {
            // Spawn 10 panes
        })
    });
}
```

### Targets
| Operation | Target |
|-----------|--------|
| Skills sync (100 skills) | < 1s |
| Pane spawn | < 500ms |
| Worktree create | < 2s |
| Snapshot create | < 500ms |
| Log stream latency | < 100ms |

## Optimization Areas
- Parallel skill sync
- Connection pooling
- Caching
- Lazy loading
