---
wih_version: 1
work_item_id: "T2.4"
title: "Implement Pane Orchestrator"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Implement pane grid layout"
    - "Support agent pane spawning"
    - "Handle pane lifecycle"
  context_packs:
    - "services/orchestration/workspace-service/src/"
  artifacts_from_deps:
    - "T2.3"
scope:
  allowed_paths:
    - "services/orchestration/workspace-service/src/orchestrator.rs"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "cargo.build"
    - "cargo.test"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "services/orchestration/workspace-service/src/orchestrator.rs"
  required_reports:
    - "pane_orchestrator_report.md"
acceptance:
  tests:
    - "cargo test -p workspace-service orchestrator"
  invariants:
    - "Panes are created in correct layout"
    - "Agent commands execute in correct panes"
  evidence:
    - "pane_orchestrator_report.md"
blockers:
  fail_on:
    - "layout_error"
stop_conditions:
  escalate_if:
    - "tmux_limitation"
  max_iterations: 5
---

# Implement Pane Orchestrator

## Objective
Orchestrate tmux panes for agent execution.

## PaneOrchestrator
```rust
pub struct PaneOrchestrator {
    session_manager: SessionManager,
    layouts: LayoutEngine,
}

impl PaneOrchestrator {
    pub async fn spawn_agent_pane(
        &self,
        session: &str,
        agent: &Agent,
        wih: &WIH,
    ) -> Result<Pane>;
    
    pub async fn create_grid(
        &self,
        config: GridConfig,
    ) -> Result<Session>;
    
    pub async fn arrange_panes(
        &self,
        session: &str,
        layout: Layout,
    ) -> Result<()>;
}
```

## Layout Types
- `Grid` - Matrix layout
- `Stack` - Vertical/horizontal stack
- `Custom` - User-defined positions

## Features
- Spawn panes with specific commands
- Capture pane output
- Route pane events
