---
status: done
files_changed:
  - docs/public/parity/codex-security-plugin-changelog.md
  - .parity-reports/codex-security-plugin-changelog.md
items_covered:
  - "0.1.10 (June 23, 2026)"
  - "0.1.11 (July 10, 2026)"
  - "0.1.12 (July 23, 2026)"
  - "0.1.13 (July 25, 2026)"
  - "0.1.14 (July 28, 2026)"
  - "0.1.15 (July 30, 2026)"
  - "0.1.16 (August 4, 2026)"
  - "0.1.17 (August 5, 2026)"
  - "0.1.7 (June 4, 2026)"
  - "0.1.9 (June 18, 2026)"
  - "Apply repository guidance and coverage consistently"
  - "Configure scans with fewer interruptions"
  - "Define repository security policy"
  - "Export portable, verifiable results"
  - "Export results for existing security workflows"
  - "Follow scan progress as it happens"
  - "Give feedback and recover findings"
  - "Handle more repository layouts and paths"
  - "Improve Jira and Linear ticket intake"
  - "Keep scan guidance and repository targets accurate"
  - "Keep scans accurate as projects change"
  - "Produce detailed finding and hardening reports"
  - "Reduce unnecessary scan work"
  - "Resume interrupted deep scans"
  - "Review and remediate validated findings"
  - "Review and rerun previous scans"
  - "Review findings across more environments"
  - "Review findings before tracking them"
  - "Review scan history and recurring findings"
  - "Run deeper scans with clearer progress"
  - "Run deeper scans with consistent results"
  - "Run evidence-backed security reviews"
  - "Run reporting workflows directly"
  - "Run scans with less setup"
  - "Run standard scans with a simpler workflow"
  - "Start and complete scans with less overhead"
  - "Track measured scan usage"
  - "Triage and track existing findings"
  - "Write clearer vulnerability reports"
items_missing:
  - "Dedicated repository/path/deep security scan engine and phase coordinator"
  - "Persisted findings workspace, scan history comparison, and stable finding identities"
  - "Canonical manifest, coverage, JSON, CSV, and SARIF exports"
  - "Scan-specific checkpoint recovery, feedback, remediation, and usage attribution"
  - "Security-aware Jira, Linear, GitHub Issues, and Security Advisory workflows"
  - "Per-finding vulnerability/PoC bundles and structural hardening portfolios"
notes: "All assigned handoff items are documented. Existing Allternit capabilities are mapped as available, partial, or foundation-only; scanner-specific gaps are explicitly marked roadmap. Documentation-only change; no build run."
---

# Codex Security plugin changelog parity report

Created the requested parity page after reviewing the original Codex Security
plugin changelog and the Allternit security-review command, built-in security
skills, repository security policy, approval profiles, session/event APIs, and
usage analytics.

The principal available equivalent is Gizzi's `/security-review` change-review
workflow. The page deliberately does not equate generic sessions, subagents,
MCP connectors, or Markdown output with Codex Security's dedicated scan store,
deep-scan orchestration, findings workspace, portable exports, or tracker
integrations. Those missing scanner-level contracts are listed as roadmap.
