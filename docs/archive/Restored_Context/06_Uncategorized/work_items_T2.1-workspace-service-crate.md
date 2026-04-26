---
wih_version: 1
work_item_id: "T2.1"
title: "Create workspace-service Crate"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Create new service in services"
    - "Set up HTTP API with Axum"
    - "Define service structure"
  context_packs:
    - "services/orchestration/"
    - "vendor/txtx-axel/crates/core/src/tmux.rs"
  artifacts_from_deps:
    - "T0.2"
scope:
  allowed_paths:
    - "services/orchestration/workspace-service/**"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "cargo.build"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "services/orchestration/workspace-service/Cargo.toml"
    - "services/orchestration/workspace-service/src/main.rs"
    - "services/orchestration/workspace-service/src/lib.rs"
  required_reports:
    - "workspace_service_setup.md"
acceptance:
  tests:
    - "cargo check -p workspace-service"
  invariants:
    - "Service compiles and starts"
  evidence:
    - "workspace_service_setup.md"
blockers:
  fail_on:
    - "compilation_error"
stop_conditions:
  escalate_if:
    - "port_conflict"
  max_iterations: 5
---

# Create workspace-service Crate

## Objective
Create a new service for terminal workspace orchestration.

## Service Structure
```
workspace-service/
├── Cargo.toml
├── src/
│   ├── main.rs
│   ├── lib.rs
│   ├── api/
│   │   ├── mod.rs
│   │   ├── sessions.rs
│   │   └── panes.rs
│   ├── tmux/
│   │   ├── mod.rs
│   │   ├── client.rs
│   │   └── parser.rs
│   └── state/
│       ├── mod.rs
│       └── manager.rs
└── tests/
```

## Dependencies
- axum
- tokio
- serde
- allternit-substrate
- tmux_interface (or custom)

## API Surface
- `POST /sessions` - Create new session
- `GET /sessions` - List sessions
- `POST /sessions/{id}/panes` - Create pane
- `GET /sessions/{id}/panes` - List panes
