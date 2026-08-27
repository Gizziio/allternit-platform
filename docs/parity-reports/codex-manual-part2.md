---
status: done
files_changed:
  - docs/public/parity/codex-manual-part2.md
  - docs/parity-reports/codex-manual-part2.md
items_covered:
  - "codex-manual-part2: all assigned handoff items from History (table) through Trace exporter"
items_missing:
  - "Image generation: multimodal I/O exists, but no public first-party text-to-image tool or endpoint is documented."
  - "Codex Security and Prisma AIRS: vendor-specific services are not bundled; Allternit provides sandbox, policy, audit, vault, and CI composition points."
  - "Native Windows sandbox elevation and WSL provisioning: no Allternit-specific implementation; WSL can host the normal Linux CLI."
  - "Codex-managed UI metadata: notices, tooltip state, footer/title item lists, notification transport, and syntax theme controls have no stable public equivalents."
  - "Compaction customization: one-off /compact instructions exist, but no global inline/file prompt compatibility keys are public."
  - "Project-documentation tuning: no public AGENTS.md byte cap, fallback-name list, or configurable root-marker list."
  - "MCP OAuth callback port/redirect/store controls and MCP resources: not exposed by the current public MCP configuration/server methods."
  - "Hosted plugin marketplace submission and submission errors: local and repository packaging/install work; hosted submission is roadmap."
  - "Deterministic Record & Replay and rollout token weighting/reminder cadence: explicit session budgets and idempotent response replay exist, but not these Codex controls."
  - "Per-app/per-skill boolean tables and a user-facing spawned-agent concurrency cap: current governance uses connector/RBAC/tool permissions and deployment limits."
notes: "Docs-only research and changes. No Rust code changed, so cargo check was not run. No Git mutations were performed. Every assigned concept is mapped or explicitly labeled Not applicable / roadmap."
---

# Completion report

Created a consolidated parity guide for the assigned Codex manual section. The
page maps implemented Allternit capabilities to their public config, CLI, API,
MCP, plugin, session, security, and observability surfaces, with TOML, JSON,
`curl`, and CLI examples.

Concepts that are Codex product state, third-party branded services, operating
system provisioning, or absent public controls are called out as not applicable
or roadmap rather than represented as compatible settings.

Research included `cmd/gizzi-code`, `cmd/allternit-api/src`,
`sdk/allternit-sdk`, and the existing public CLI, API, tools, security, skill,
and provider documentation.
