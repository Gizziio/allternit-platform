---
wih_version: 1
work_item_id: "T2.5"
title: "Extend WIH with Terminal Context"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/agent/Agentic Prompts/formats/wih-scheme.md"
  requirements:
    - "Add terminal_context to WIH schema"
    - "Update WIH parser"
    - "Update validation"
  context_packs:
    - "infrastructure/allternit-agent-system-rails/src/wih/"
    - "agent/Agentic Prompts/formats/wih-scheme.md"
  artifacts_from_deps:
    - "T2.4"
scope:
  allowed_paths:
    - "infrastructure/allternit-agent-system-rails/src/wih/types.rs"
    - "infrastructure/allternit-agent-system-rails/src/wih/projection.rs"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "cargo.build"
    - "cargo.test"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "infrastructure/allternit-agent-system-rails/src/wih/types.rs"
  required_reports:
    - "wih_extension_report.md"
acceptance:
  tests:
    - "cargo test -p allternit-agent-system-rails wih"
  invariants:
    - "Backward compatibility maintained"
    - "New fields are optional"
  evidence:
    - "wih_extension_report.md"
blockers:
  fail_on:
    - "breaking_change"
stop_conditions:
  escalate_if:
    - "schema_conflict"
  max_iterations: 5
---

# Extend WIH with Terminal Context

## Objective
Add terminal context to Work Item Headers for pane association.

## Schema Extension
```rust
pub struct WIH {
    // ... existing fields ...
    
    #[serde(default)]
    pub terminal_context: Option<TerminalContext>,
}

pub struct TerminalContext {
    pub session_id: String,
    pub pane_id: String,
    pub worktree_path: Option<PathBuf>,
    pub log_stream_endpoint: String,
}
```

## WIH v2 Example
```yaml
wih_version: 2
work_item_id: "T123"
# ... other fields ...
terminal_context:
  session_id: "sess-abc123"
  pane_id: "allternit-session:0.2"
  worktree_path: ".allternit/worktrees/feature-xyz"
  log_stream_endpoint: "ws://localhost:3020/stream"
```

## Backward Compatibility
- terminal_context is optional
- WIH v1 files still work
- Migration path documented
