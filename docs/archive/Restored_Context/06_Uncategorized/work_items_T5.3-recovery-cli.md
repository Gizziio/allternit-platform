---
wih_version: 1
work_item_id: "T5.3"
title: "Add Recovery Commands to CLI"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Add 'session snapshot' command"
    - "Add 'session restore' command"
    - "Add 'session list-snapshots' command"
  context_packs:
    - "cmd/cli/"
    - "services/orchestration/session-recovery/"
  artifacts_from_deps:
    - "T5.2"
scope:
  allowed_paths:
    - "cmd/cli/src/commands/session.rs"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "cargo.build"
    - "cargo.test"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "cmd/cli/src/commands/session.rs"
  required_reports:
    - "recovery_cli_report.md"
acceptance:
  tests:
    - "cargo test -p allternit-cli session"
  invariants:
    - "Commands work correctly"
  evidence:
    - "recovery_cli_report.md"
blockers:
  fail_on:
    - "cli_error"
stop_conditions:
  escalate_if:
    - "api_issue"
  max_iterations: 5
---

# Add Recovery Commands to CLI

## Objective
Add CLI commands for session recovery.

## Commands

### `allternit session snapshot`
Create a snapshot of the current session:
```bash
allternit session snapshot
allternit session snapshot --name "before-refactor"
```

### `allternit session restore`
Restore from a snapshot:
```bash
allternit session restore <snapshot-id>
allternit session restore --latest
```

### `allternit session list-snapshots`
List available snapshots:
```bash
allternit session list-snapshots
allternit session list-snapshots --session <id>
```

## Implementation
```rust
pub fn session_subcommand() -> Command {
    Command::new("session")
        .subcommand(Command::new("snapshot").arg(arg!(--name <NAME>)))
        .subcommand(Command::new("restore").arg(arg!(<SNAPSHOT_ID>)))
        .subcommand(Command::new("list-snapshots"))
}
```
