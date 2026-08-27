# Capstone: Build a Self-Hosted n8n MCP Workflow

**Course:** ALABS-OPS-N8N — Orchestrate Agents & Automations with n8n  
**Tier:** OPS

## Bridge Concept

The capstone integrates everything: self-hosted n8n, external API integration, LLM routing, and MCP tool exposure. You will build a workflow that receives a Slack message, classifies its intent using an LLM, routes it to the correct action (Notion note, email draft, or internal webhook), and exposes the entire flow as an MCP tool.

This is not a toy demo. It is the exact pattern Allternit uses to connect conversational interfaces to backend automations. The evaluation criteria are reliability, schema correctness, and documentation quality.

## Learning Objectives

- [ ] Build a multi-branch n8n workflow that makes a routing decision based on LLM output.
- [ ] Self-host the workflow and verify it runs without n8n Cloud dependencies.
- [ ] Document the workflow as an MCP tool with a clear input/output contract.

## Demo Outline (10 min)

1. **The Trigger:** Send a Slack message to a webhook. Show n8n receiving it.
2. **The Router:** Show the LLM classification node and the three branches: Notion, Email, Webhook.
3. **The MCP Contract:** Present the JSONSchema input and output. Show an external client calling the workflow successfully.

## Challenge (Capstone — 60 min)

> **Build:** A self-hosted n8n workflow that:
> - Accepts structured input via webhook (message text + sender info).
> - Classifies intent using a local or remote LLM.
> - Routes to at least two different downstream actions.
> - Returns a structured JSON response confirming the action taken.
> - Is documented as an MCP tool with input/output schemas.
>
> **Deliverable:** A GitHub repo containing the workflow JSON, Docker Compose file, and MCP tool documentation.

## Allternit Connection

- **Internal system:** Allternit's internal automation hub uses this exact pattern for cross-tool routing.
- **Reference repo/file:** \"workflows/mcp_routing_template.json\" in the n8n instance.
- **Key difference from standard approach:** Allternit requires every n8n MCP workflow to validate its input with a JSON Schema before processing. This prevents malformed requests from triggering expensive or destructive actions.
