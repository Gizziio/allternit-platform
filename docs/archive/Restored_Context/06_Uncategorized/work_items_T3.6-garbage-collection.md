---
wih_version: 1
work_item_id: "T3.6"
title: "Implement Worktree Garbage Collection"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
  security: "agent.security"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Implement orphaned worktree detection"
    - "Implement stale worktree cleanup"
    - "Add safety checks"
  context_packs:
    - "domains/governance/worktree-manager/"
  artifacts_from_deps:
    - "T3.5"
scope:
  allowed_paths:
    - "domains/governance/worktree-manager/src/gc.rs"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "cargo.build"
    - "cargo.test"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "domains/governance/worktree-manager/src/gc.rs"
  required_reports:
    - "gc_report.md"
acceptance:
  tests:
    - "cargo test -p worktree-manager gc"
  invariants:
    - "No data loss"
    - "Orphaned worktrees are detected"
  evidence:
    - "gc_report.md"
blockers:
  fail_on:
    - "safety_check_failure"
stop_conditions:
  escalate_if:
    - "uncommitted_changes_detected"
  max_iterations: 5
---

# Implement Worktree Garbage Collection

## Objective
Clean up orphaned and stale worktrees safely.

## GarbageCollector
```rust
pub struct GarbageCollector {
    manager: WorktreeManager,
    ledger: Arc<Ledger>,  // Reference to Rails ledger
}

impl GarbageCollector {
    pub async fn find_orphans(&self) -> Result<Vec<Worktree>>;
    pub async fn find_stale(&self, age: Duration) -> Result<Vec<Worktree>>;
    pub async fn collect(&self, worktrees: &[Worktree]) -> Result<GCReport>;
}
```

## Safety Checks
1. Verify worktree is not referenced by active DAG
2. Check for uncommitted changes
3. Verify no open files
4. Archive before deletion (optional)

## GC Report
```rust
pub struct GCReport {
    pub scanned: usize,
    pub removed: usize,
    pub archived: usize,
    pub errors: Vec<String>,
}
```
