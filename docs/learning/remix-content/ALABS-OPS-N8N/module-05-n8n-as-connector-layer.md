# n8n as Connector Layer

**Course:** ALABS-OPS-N8N — Orchestrate Agents & Automations with n8n  
**Tier:** OPS

## Bridge Concept

n8n is not just a workflow engine. It is a universal connector. With HTTP Request nodes, webhooks, and custom code, n8n can bridge any system that speaks HTTP: Claude, ChatGPT, local LLMs, CRMs, databases, and internal microservices. This module treats n8n as the integration layer of an agent ecosystem.

We focus on three connector patterns: inbound webhooks (triggering n8n from external systems), outbound HTTP calls (n8n calling AI APIs), and bidirectional sync (keeping two systems in alignment). The goal is to see n8n not as a standalone automation tool, but as the nervous system connecting disparate tools into a coherent workflow.

## Learning Objectives

- [ ] Design a webhook-triggered workflow that receives events from an external system and routes them to an LLM.
- [ ] Call the Claude API from an n8n HTTP Request node with proper authentication and error handling.
- [ ] Implement a bidirectional sync pattern that detects drift and reconciles state between two systems.

## Demo Outline (10 min)

1. **Webhook Inbound:** Create an n8n webhook. Send a JSON payload from curl. Show n8n parsing the payload and branching based on a field value.
2. **Claude Outbound:** Build an HTTP Request node that sends a prompt to the Claude API. Handle the response and extract the text.
3. **Bidirectional Sync:** Show a workflow that reads records from System A, compares them to System B, and updates only the changed records.

## Challenge (5 min)

> **The Slack-to-Claude Bridge:** Build an n8n workflow that listens for a Slack webhook, sends the message text to Claude, and posts Claude's reply back to the same Slack thread.

## Allternit Connection

- **Internal system:** workflow-engine uses n8n as its primary integration layer for external SaaS tools.
- **Reference repo/file:** \"workflows/slack_claude_bridge.json\" in the n8n instance.
- **Key difference from standard approach:** Allternit never stores third-party API keys in n8n credentials if the key has admin scope. Keys are scoped to the minimum permissions required.
