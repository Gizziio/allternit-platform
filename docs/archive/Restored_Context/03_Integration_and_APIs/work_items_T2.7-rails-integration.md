---
wih_version: 1
work_item_id: "T2.7"
title: "Integrate Workspace Service with Rails"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Add workspace client to Rails"
    - "Integrate pane spawning with WIH execution"
    - "Update Rails API routes"
  context_packs:
    - "infrastructure/allternit-agent-system-rails/"
    - "services/orchestration/workspace-service/"
  artifacts_from_deps:
    - "T2.6"
scope:
  allowed_paths:
    - "infrastructure/allternit-agent-system-rails/src/"
    - "6-apps/api/src/rails.rs"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "cargo.build"
    - "cargo.test"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "infrastructure/allternit-agent-system-rails/src/workspace/client.rs"
    - "6-apps/api/src/workspace.rs"
  required_reports:
    - "rails_integration_report.md"
acceptance:
  tests:
    - "cargo test -p allternit-agent-system-rails workspace"
    - "cargo test -p allternit-api workspace"
    - "integration_test --workspace"
  invariants:
    - "Rails can spawn agent panes"
    - "WIH execution creates terminal context"
  evidence:
    - "rails_integration_report.md"
blockers:
  fail_on:
    - "integration_failure"
stop_conditions:
  escalate_if:
    - "api_breakage"
  max_iterations: 5
---

# Integrate Workspace Service with Rails

## Objective
Connect the workspace service to Allternit Rails for agent pane management.

## Rails Integration

### WorkspaceClient
```rust
pub struct WorkspaceClient {
    base_url: String,
    http: reqwest::Client,
}

impl WorkspaceClient {
    pub async fn spawn_for_wih(&self, wih: &WIH) -> Result<TerminalContext>;
    pub async fn attach_to_pane(&self, pane_id: &str) -> Result<AttachHandle>;
    pub async fn stream_logs(&self, pane_id: &str) -> Result<WebSocketStream>;
}
```

### WIH Execution Hook
```rust
pub async fn execute_wih_with_terminal(
    &self,
    wih: &WIH,
) -> Result<ExecutionResult> {
    // Spawn terminal context
    let terminal = self.workspace.spawn_for_wih(wih).await?;
    
    // Update WIH with terminal context
    let mut wih = wih.clone();
    wih.terminal_context = Some(terminal);
    
    // Execute WIH
    self.execute(wih).await
}
```

## API Routes
- `POST /api/v1/workspaces` - Create workspace
- `POST /api/v1/workspaces/{id}/panes` - Create pane
- `GET /api/v1/panes/{id}/logs` - Stream logs
