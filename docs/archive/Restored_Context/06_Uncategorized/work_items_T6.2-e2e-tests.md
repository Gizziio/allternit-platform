---
wih_version: 1
work_item_id: "T6.2"
title: "Write End-to-End Tests"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/tests/README.md"
  requirements:
    - "Test full DAG execution with terminals"
    - "Test worktree automation"
    - "Test session recovery"
  context_packs:
    - "tests/e2e/"
  artifacts_from_deps:
    - "T6.1"
scope:
  allowed_paths:
    - "tests/e2e/axel-integration/"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "cargo.test"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "tests/e2e/axel-integration/full_dag_test.rs"
    - "tests/e2e/axel-integration/recovery_test.rs"
  required_reports:
    - "e2e_tests_report.md"
acceptance:
  tests:
    - "cargo test --test axel_e2e"
  invariants:
    - "All tests pass"
  evidence:
    - "e2e_tests_report.md"
blockers:
  fail_on:
    - "test_failure"
stop_conditions:
  escalate_if:
    - "infrastructure_issue"
  max_iterations: 5
---

# Write End-to-End Tests

## Objective
Write end-to-end tests covering full workflows.

## Test Scenarios

### Full DAG Execution
```rust
#[tokio::test]
async fn test_dag_with_terminals() {
    // 1. Create DAG with terminal context
    // 2. Execute DAG
    // 3. Verify panes are created
    // 4. Verify logs are streamed
    // 5. Verify completion
}
```

### Worktree Automation
```rust
#[tokio::test]
async fn test_worktree_auto_create() {
    // 1. Create DAG node with worktree config
    // 2. Start node execution
    // 3. Verify worktree is created
    // 4. Verify branch exists
    // 5. Complete node
    // 6. Verify cleanup (if configured)
}
```

### Session Recovery
```rust
#[tokio::test]
async fn test_session_snapshot_restore() {
    // 1. Create session with DAG
    // 2. Take snapshot
    // 3. Modify session
    // 4. Restore from snapshot
    // 5. Verify state is restored
}
```

## Infrastructure
- Use testcontainers for services
- Mock external dependencies
- Clean up after tests
