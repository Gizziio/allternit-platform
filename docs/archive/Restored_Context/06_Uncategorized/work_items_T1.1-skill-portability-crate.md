---
wih_version: 1
work_item_id: "T1.1"
title: "Create allternit-skill-portability Crate"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
  security: "agent.security"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Create new crate in infrastructure"
    - "Set up Cargo.toml with dependencies"
    - "Define crate structure"
  context_packs:
    - "infrastructure/allternit-substrate/"
    - "vendor/txtx-axel/crates/core/src/drivers/"
  artifacts_from_deps:
    - "T0.2"
scope:
  allowed_paths:
    - "infrastructure/allternit-skill-portability/**"
    - "infrastructure/Cargo.toml"
  forbidden_paths:
    - "infrastructure/allternit-substrate/**"
    - "infrastructure/allternit-intent-graph-kernel/**"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "fs.mkdir"
    - "cargo.build"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "infrastructure/allternit-skill-portability/Cargo.toml"
    - "infrastructure/allternit-skill-portability/src/lib.rs"
    - "infrastructure/allternit-skill-portability/src/types.rs"
  required_reports:
    - "crate_setup_report.md"
acceptance:
  tests:
    - "cargo check -p allternit-skill-portability"
  invariants:
    - "Crate compiles without errors"
    - "Dependencies are minimal and justified"
  evidence:
    - "crate_setup_report.md"
blockers:
  fail_on:
    - "compilation_error"
stop_conditions:
  escalate_if:
    - "dependency_conflict"
  max_iterations: 5
---

# Create allternit-skill-portability Crate

## Objective
Create a new Rust crate in the infrastructure layer for skill portability across LLMs.

## Crate Structure
```
allternit-skill-portability/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── types.rs
│   ├── drivers/
│   │   ├── mod.rs
│   │   ├── claude.rs
│   │   ├── codex.rs
│   │   ├── opencode.rs
│   │   └── kimi.rs
│   └── sync.rs
└── tests/
```

## Dependencies
- allternit-substrate (workspace)
- serde
- anyhow
- tokio
- walkdir

## Key Design Decisions
1. Trait-based driver architecture
2. Async sync operations
3. Workspace-aware skill resolution
