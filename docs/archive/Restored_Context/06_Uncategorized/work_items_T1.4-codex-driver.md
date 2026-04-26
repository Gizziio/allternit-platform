---
wih_version: 1
work_item_id: "T1.4"
title: "Implement OpenAI Codex Driver"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Implement SkillDriver for OpenAI Codex"
    - "Handle .codex/agents.yaml configuration"
    - "Support agent merging"
  context_packs:
    - "infrastructure/allternit-skill-portability/src/drivers/mod.rs"
    - "vendor/txtx-axel/crates/core/src/drivers/codex.rs"
  artifacts_from_deps:
    - "T1.2"
scope:
  allowed_paths:
    - "infrastructure/allternit-skill-portability/src/drivers/codex.rs"
    - "infrastructure/allternit-skill-portability/src/drivers/mod.rs"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "cargo.build"
    - "cargo.test"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "infrastructure/allternit-skill-portability/src/drivers/codex.rs"
  required_reports:
    - "codex_driver_report.md"
acceptance:
  tests:
    - "cargo test -p allternit-skill-portability codex"
  invariants:
    - "Driver installs skills to ~/.codex/"
    - "Agents.yaml is merged correctly"
  evidence:
    - "codex_driver_report.md"
blockers:
  fail_on:
    - "invalid_codex_path"
    - "yaml_parse_error"
stop_conditions:
  escalate_if:
    - "codex_api_change"
  max_iterations: 5
---

# Implement OpenAI Codex Driver

## Objective
Implement the SkillDriver trait for OpenAI Codex integration.

## Implementation Details

### Target Directory
- `~/.codex/agents.yaml` for global configuration
- `.codex/agents.yaml` for workspace-local configuration

### Configuration Format
Codex uses a merged YAML format:
```yaml
agents:
  my-skill:
    description: "Skill description"
    prompt: |
      Multi-line
      prompt content
```

### Key Difference from Claude
- Codex merges all skills into a single agents.yaml file
- Must preserve existing agents when adding new ones
- YAML format requires careful merging

### Methods to Implement
1. `install_skill()` - Merge skill into agents.yaml
2. `remove_skill()` - Remove from agents.yaml
3. `list_skills()` - Parse agents.yaml
4. `skill_format()` - Return YAML agent format

## Testing
- Test YAML merging logic
- Test preservation of existing agents
