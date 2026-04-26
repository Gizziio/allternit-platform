---
wih_version: 1
work_item_id: "T6.5"
title: "Update Documentation"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/ARCHITECTURE.md"
  requirements:
    - "Update ARCHITECTURE.md"
    - "Add skills portability docs"
    - "Add workspace service docs"
    - "Create usage examples"
  context_packs:
    - "docs/"
    - "ARCHITECTURE.md"
  artifacts_from_deps:
    - "T6.4"
scope:
  allowed_paths:
    - "docs/axel-integration/"
    - "ARCHITECTURE.md"
    - "README.md"
  allowed_tools:
    - "fs.read"
    - "fs.write"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "docs/axel-integration/README.md"
    - "docs/axel-integration/skills-portability.md"
    - "docs/axel-integration/workspace-service.md"
    - "examples/axel-integration/"
  required_reports:
    - "documentation_report.md"
acceptance:
  tests:
    - "docs_test"
  invariants:
    - "All docs are complete"
    - "Examples work"
  evidence:
    - "documentation_report.md"
blockers:
  fail_on:
    - "incomplete_docs"
stop_conditions:
  escalate_if:
    - "clarification_needed"
  max_iterations: 5
---

# Update Documentation

## Objective
Document the axel integration.

## Documentation Structure
```
docs/axel-integration/
├── README.md
├── skills-portability.md
├── workspace-service.md
├── worktree-manager.md
├── session-recovery.md
└── examples/
    ├── skills-sync.rs
    ├── workspace-creation.rs
    └── dag-with-terminals.yaml
```

## README.md Outline
```markdown
# Axel Integration

## Overview
What was integrated from txtx/axel...

## Features
- Skills Portability
- Terminal Multiplexer
- Git Worktree Automation
- Session Recovery

## Quick Start
...

## Architecture
...

## API Reference
...
```

## Examples
```rust
// examples/skills-sync.rs
use allternit_skill_portability::SkillEngine;

#[tokio::main]
async fn main() -> Result<()> {
    let engine = SkillEngine::new();
    
    // Sync skill to all LLMs
    engine.sync("./skills/my-skill.md").await?;
    
    Ok(())
}
```

## ARCHITECTURE.md Updates
Add new services to architecture diagram:
- workspace-service
- worktree-manager
- session-recovery
