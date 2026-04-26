---
wih_version: 1
work_item_id: "T0.1"
title: "Vendor Setup - Clone Axel Repository"
owner_role: "orchestrator"
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
inputs:
  sot: "/docs/research/txtx-axel-analysis.md"
  requirements:
    - "Clone txtx/axel repository into vendor folder"
    - "Verify clone integrity"
  context_packs:
    - "/docs/research/txtx-axel-analysis.md"
scope:
  allowed_paths:
    - "vendor/**"
  forbidden_paths:
    - "infrastructure/**"
    - "domains/kernel/**"
    - "domains/governance/**"
    - "services/**"
    - "services/**"
    - "5-agents/**"
    - "surfaces/**"
    - "cmd/**"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "fs.mkdir"
    - "shell.exec"
    - "git.clone"
  execution_permission:
    mode: "write_leased"
outputs:
  required_artifacts:
    - "vendor/txtx-axel/README.md"
    - "vendor/txtx-axel/Cargo.toml"
    - "vendor/txtx-axel/crates/"
  required_reports:
    - "vendor_setup_report.md"
acceptance:
  tests:
    - "test -d vendor/txtx-axel"
    - "test -f vendor/txtx-axel/README.md"
    - "test -d vendor/txtx-axel/crates"
  invariants:
    - "Vendor folder exists and is not empty"
    - "Git repository is valid"
  evidence:
    - "vendor_setup_report.md"
blockers:
  fail_on:
    - "clone_failure"
    - "network_error"
stop_conditions:
  escalate_if:
    - "repository_not_accessible"
  max_iterations: 3
---

# Vendor Setup Task

## Objective
Clone the txtx/axel repository into the vendor folder for analysis and reference during implementation.

## Steps
1. Create vendor directory if not exists
2. Clone https://github.com/txtx/axel.git into vendor/txtx-axel
3. Verify clone integrity
4. Document directory structure

## Verification
- [ ] Repository cloned successfully
- [ ] All crates present
- [ ] Documentation accessible
