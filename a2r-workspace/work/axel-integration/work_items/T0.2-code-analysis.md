---
wih_version: 1
work_item_id: "T0.2"
title: "Analyze Axel Codebase Structure"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Analyze axel core components"
    - "Document key patterns for porting"
    - "Identify integration points"
  context_packs:
    - "vendor/txtx-axel/README.md"
    - "vendor/txtx-axel/crates/core/src/"
    - "vendor/txtx-axel/crates/cli/src/"
  artifacts_from_deps:
    - "T0.1"
scope:
  allowed_paths:
    - "vendor/txtx-axel/**"
    - "docs/research/**"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "grep.search"
    - "shell.exec"
  execution_permission:
    mode: "read_only"
outputs:
  required_artifacts:
    - "docs/research/axel-code-analysis.md"
    - "docs/research/axel-integration-points.md"
  required_reports:
    - "code_analysis_report.md"
acceptance:
  tests:
    - "test -f docs/research/axel-code-analysis.md"
  invariants:
    - "Analysis covers all major components"
    - "Integration points are documented"
  evidence:
    - "code_analysis_report.md"
blockers:
  fail_on:
    - "incomplete_analysis"
stop_conditions:
  escalate_if:
    - "code_too_complex"
  max_iterations: 3
---

# Code Analysis Task

## Objective
Analyze the txtx/axel codebase to understand:
1. Core component structure
2. Key patterns for skills portability
3. Terminal multiplexing implementation
4. Session management

## Key Files to Analyze
- `crates/core/src/config.rs` - Configuration parsing
- `crates/core/src/tmux.rs` - Terminal management
- `crates/core/src/drivers/` - LLM skill drivers
- `crates/cli/src/commands/` - CLI commands

## Deliverables
1. Component architecture diagram
2. Integration points mapping
3. Pattern recommendations
