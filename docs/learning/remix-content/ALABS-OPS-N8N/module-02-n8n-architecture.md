# n8n Architecture

**Course:** ALABS-OPS-N8N — Orchestrate Agents & Automations with n8n  
**Tier:** OPS

## Module Overview

This module covers the foundational architecture of n8n: how workflows are structured, how data flows between nodes, and how the execution engine processes triggers and actions. Understanding these fundamentals is essential before building complex automations.

## Learning Objectives

- [ ] Explain the difference between trigger nodes, regular nodes, and credential nodes.
- [ ] Diagram how data passes between nodes in JSON format.
- [ ] Configure workflow settings: execution mode, error handling, and timeouts.

## Lecture Guide

**Source:** Master N8N Automations in 2 hours + N8N for Beginners + Build AI Agents with n8n

1. **Introduction to n8n UI** — Workspace layout, node panel, execution preview.
2. **Triggers Explained** — Manual, webhook, schedule, and app-specific triggers.
3. **Node Anatomy** — Parameters, credentials, output mapping, and expression editor.
4. **Data Flow** — How the JSON item-list structure moves through a workflow.
5. **Workflow Settings** — Saving, activating, and monitoring executions.
6. **Error Handling** — Continue on fail, error workflows, and retry logic.
7. **Expressions & Functions** — Using $() syntax to transform data between nodes.
8. **Credentials Management** — Securely storing API keys and OAuth tokens.
9. **Sub-workflows** — Calling one workflow from another for modularity.
10. **Debugging Tools** — Execution preview, pinned data, and console logs.
11. **Nodes Deep Dive** — HTTP Request, Set, Code, IF/Switch, and Wait nodes.
12. **Webhook Security** — Validation, headers, and response configuration.
13. **Scheduling Patterns** — Cron expressions and interval-based triggers.
14. **Data Transformation** — Splitting, aggregating, and merging item lists.
15. **Best Practices** — Naming conventions, documentation, and version control.

## Demo Outline (10 min)

1. Build a 4-node workflow: Webhook → HTTP Request → Set → Respond to Webhook.
2. Pin sample data and step through execution to show JSON flow.
3. Introduce an intentional error and configure "Continue On Fail."

## Challenge (5 min)

> **The Data Router:** Build a workflow that receives a webhook with a \"type\" field. Use an IF node to route \"type=lead\" to one HTTP endpoint and \"type=support\" to another. Return a confirmation message.

## Allternit Connection

- **Internal system:** workflow-engine uses n8n for all webhook-based integrations.
- **Reference repo/file:** \"workflows/inbound_webhook_router.json\"
- **Key difference from standard approach:** Allternit versions every n8n workflow as JSON in Git. Production workflows are never edited directly in the UI without a backup export.
