---
wih_version: 1
work_item_id: "T6.1"
title: "Write Integration Tests"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/tests/README.md"
  requirements:
    - "Test skills portability"
    - "Test workspace service"
    - "Test worktree manager"
  context_packs:
    - "tests/"
    - "infrastructure/allternit-skill-portability/"
    - "services/orchestration/workspace-service/"
    - "domains/governance/worktree-manager/"
  artifacts_from_deps:
    - "T1.8"
    - "T2.7"
    - "T3.6"
    - "T4.5"
    - "T5.4"
scope:
  allowed_paths:
    - "tests/integration/axel-integration/"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "cargo.test"
    - "npm.test"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "tests/integration/axel-integration/skills_test.rs"
    - "tests/integration/axel-integration/workspace_test.rs"
    - "tests/integration/axel-integration/worktree_test.rs"
  required_reports:
    - "integration_tests_report.md"
acceptance:
  tests:
    - "cargo test --test axel_integration"
  invariants:
    - "All tests pass"
    - "Coverage > 80%"
  evidence:
    - "integration_tests_report.md"
blockers:
  fail_on:
    - "test_failure"
stop_conditions:
  escalate_if:
    - "flaky_test"
  max_iterations: 5
---

# Write Integration Tests

## Objective
Write comprehensive integration tests for axel integration.

## Test Structure
```
tests/integration/axel-integration/
├── mod.rs
├── skills_test.rs      # Skills portability tests
├── workspace_test.rs   # Workspace service tests
├── worktree_test.rs    # Worktree manager tests
└── common/
    ├── mod.rs
    └── fixtures.rs
```

## Skills Tests
```rust
#[tokio::test]
async fn test_skill_sync_claude() {
    // Test syncing skill to Claude
}

#[tokio::test]
async fn test_skill_sync_codex() {
    // Test syncing skill to Codex
}

#[tokio::test]
async fn test_skill_remove() {
    // Test removing skill from LLM
}
```

## Workspace Tests
```rust
#[tokio::test]
async fn test_session_creation() {
    // Test creating tmux session
}

#[tokio::test]
async fn test_pane_spawning() {
    // Test spawning agent pane
}

#[tokio::test]
async fn test_log_streaming() {
    // Test WebSocket log streaming
}
```

## Worktree Tests
```rust
#[tokio::test]
async fn test_worktree_creation() {
    // Test creating worktree
}

#[tokio::test]
async fn test_worktree_cleanup() {
    // Test cleanup policies
}
```
