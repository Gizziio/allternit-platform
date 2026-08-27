# The Problem: Why n8n Over SaaS Automation

**Course:** ALABS-OPS-N8N — Orchestrate Agents & Automations with n8n  
**Tier:** OPS

## Bridge Concept

Zapier and Make.com are the default choices for no-code automation. They are fast to set up, well-integrated, and require zero infrastructure. But they come with a hidden cost: vendor lock-in, per-task pricing, and a hard ceiling on complexity. When your workflow needs a custom node, a local database, or an on-premise API, the SaaS automation stack hits a wall.

n8n is the open-source alternative. Self-hosted, code-friendly, and unlimited in execution volume. This module makes the economic and architectural case for owning your automation infrastructure. We compare total cost of ownership, data residency, and extensibility across Zapier, Make, and self-hosted n8n.

## Learning Objectives

- [ ] Calculate the 3-year TCO difference between Zapier Team and self-hosted n8n for a mid-size operation.
- [ ] Identify three automation scenarios where SaaS tools fail and n8n succeeds.
- [ ] Explain the data-residency and compliance implications of self-hosting workflows.

## Demo Outline (10 min)

1. **The Lock-In Map:** Show a real Zapier workflow. Point out the proprietary nodes that cannot be exported or replicated elsewhere.
2. **The Cost Curve:** Plot task volume vs. cost for Zapier vs. n8n. Show the crossover point where self-hosting wins.
3. **The Escape Hatch:** Export a Zapier workflow as a JSON spec. Show how n8n can ingest or rebuild it with open standards.

## Challenge (5 min)

> **The TCO Spreadsheet:** Build a simple spreadsheet comparing Zapier Professional (50K tasks/mo) vs. self-hosted n8n on a $20 VPS over 3 years. Include time estimates for maintenance. Present your conclusion.

## Allternit Connection

- **Internal system:** Allternit migrated from Zapier to n8n in 2024 to support on-premise MCP integrations.
- **Reference repo/file:** \"docs/automation/migration-zapier-to-n8n.md\" (internal).
- **Key difference from standard approach:** Allternit does not use n8n Cloud. Every workflow runs on infrastructure we control, with full access to internal APIs and no task limits.
