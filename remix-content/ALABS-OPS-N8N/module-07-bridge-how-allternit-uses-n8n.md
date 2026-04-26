# Bridge: How Allternit Uses n8n

**Course:** ALABS-OPS-N8N — Orchestrate Agents & Automations with n8n  
**Tier:** OPS

## Bridge Concept

At Allternit, n8n is not the brain. It is the hands. The brain is agui-gateway and the domain services. n8n handles the messy, API-driven integrations that do not belong in core application code: Slack notifications, CRM updates, file exports, and third-party webhook processing.

This module reveals the internal architecture. We show how workflow-engine delegates orchestration tasks to n8n while retaining state in its own database. We cover the failure-handling strategy: what happens when n8n is down, when a workflow fails mid-flight, or when an external API returns garbage. And we share the decision framework for when to build a workflow in n8n vs. when to write it in TypeScript.

## Learning Objectives

- [ ] Diagram the boundary between Allternit's application layer and its n8n integration layer.
- [ ] Design a failure-handling strategy for n8n workflows that includes retries, dead-letter queues, and alerting.
- [ ] Apply the "n8n vs. Code" decision framework to a real feature request.

## Demo Outline (10 min)

1. **Architecture Diagram:** Show a request flowing from agui-gateway → workflow-engine → n8n → Slack/Notion/CRM. Highlight where state is owned.
2. **Failure Handling:** Simulate a failed n8n execution. Show the retry logic, the error webhook back to workflow-engine, and the alert in the monitoring dashboard.
3. **The Decision Framework:** Present three feature requests. Walk through whether each belongs in n8n or in application code.

## Challenge (5 min)

> **Draw the Boundary:** For a system you are familiar with, draw a diagram showing what should live in application code vs. what should live in n8n. Defend your boundary with at least three criteria.

## Allternit Connection

- **Internal system:** workflow-engine is the orchestrator; n8n is the executor for SaaS integrations.
- **Reference repo/file:** \"docs/architecture/workflow-engine-boundaries.md\" (internal).
- **Key difference from standard approach:** Allternit never stores business-critical state inside n8n. All state lives in the application database. n8n is stateless except for execution metadata.
