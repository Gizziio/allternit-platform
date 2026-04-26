---
wih_version: 1
work_item_id: "T3.1"
title: "Create worktree-manager Crate"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Create new crate in domains/governance"
    - "Implement git worktree operations"
    - "Handle branch management"
  context_packs:
    - "domains/governance/"
    - "vendor/txtx-axel/crates/core/src/git.rs"
  artifacts_from_deps:
    - "T0.2"
scope:
  allowed_paths:
    - "domains/governance/worktree-manager/**"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "cargo.build"
    - "cargo.test"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "domains/governance/worktree-manager/Cargo.toml"
    - "domains/governance/worktree-manager/src/lib.rs"
    - "domains/governance/worktree-manager/src/git.rs"
  required_reports:
    - "worktree_manager_setup.md"
acceptance:
  tests:
    - "cargo check -p worktree-manager"
  invariants:
    - "Crate compiles"
    - "Git operations are safe"
  evidence:
    - "worktree_manager_setup.md"
blockers:
  fail_on:
    - "compilation_error"
stop_conditions:
  escalate_if:
    - "design_issue"
  max_iterations: 5
---

# Create worktree-manager Crate

## Objective
Create a crate for automated git worktree management.

## Crate Structure
```
worktree-manager/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── git.rs          # Git operations
│   ├── worktree.rs     # Worktree abstraction
│   ├── manager.rs      # Main manager
│   └── policies.rs     # Cleanup policies
└── tests/
```

## WorktreeManager
```rust
pub struct WorktreeManager {
    base_repo: PathBuf,
    worktree_root: PathBuf,
}

impl WorktreeManager {
    pub async fn ensure_worktree(&self, branch: &str) -> Result<Worktree>;
    pub async fn remove_worktree(&self, branch: &str) -> Result<()>;
    pub async fn list_worktrees(&self) -> Result<Vec<Worktree>>;
    pub async fn cleanup(&self, policy: CleanupPolicy) -> Result<()>;
}
```

## Dependencies
- git2 or gix (pure Rust git)
- tokio
- allternit-substrate
