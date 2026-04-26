---
wih_version: 1
work_item_id: "T1.7"
title: "Add Skill Sync Commands to CLI"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Add 'skill sync' command"
    - "Add 'skill install' command"
    - "Add 'skill list' command"
    - "Add 'skill remove' command"
  context_packs:
    - "cmd/cli/src/"
    - "infrastructure/allternit-skill-portability/"
  artifacts_from_deps:
    - "T1.3"
    - "T1.4"
    - "T1.5"
    - "T1.6"
scope:
  allowed_paths:
    - "cmd/cli/src/commands/skill.rs"
    - "cmd/cli/src/commands/mod.rs"
    - "cmd/cli/src/main.rs"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "cargo.build"
    - "cargo.test"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "cmd/cli/src/commands/skill.rs"
  required_reports:
    - "cli_commands_report.md"
acceptance:
  tests:
    - "cargo test -p allternit-cli skill"
    - "cargo build -p allternit-cli"
  invariants:
    - "All commands have --help"
    - "Commands are registered in CLI"
  evidence:
    - "cli_commands_report.md"
blockers:
  fail_on:
    - "cli_error"
stop_conditions:
  escalate_if:
    - "design_issue"
  max_iterations: 5
---

# Add Skill Sync Commands to CLI

## Objective
Add CLI commands for skill portability management.

## Commands to Implement

### `allternit skill sync`
Sync skills across all configured LLMs:
```bash
allternit skill sync --llm claude --llm codex
allternit skill sync --all
```

### `allternit skill install <path>`
Install a skill from file or directory:
```bash
allternit skill install ./skills/my-skill.md
allternit skill install ./skills/ --all
```

### `allternit skill list`
List installed skills:
```bash
allternit skill list
allternit skill list --llm claude
```

### `allternit skill remove <name>`
Remove a skill:
```bash
allternit skill remove my-skill
allternit skill remove my-skill --llm claude
```

## Implementation
- Use clap for argument parsing
- Integrate with allternit-skill-portability crate
- Support both global and workspace-local skills
