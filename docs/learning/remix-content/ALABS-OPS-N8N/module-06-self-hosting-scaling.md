# Self-Hosting & Scaling

**Course:** ALABS-OPS-N8N — Orchestrate Agents & Automations with n8n  
**Tier:** OPS

## Bridge Concept

Self-hosting n8n is where the real value unlocks. No task limits. No per-execution pricing. Full access to the filesystem, local network, and private APIs. But self-hosting also means you own the uptime, security, and scaling story.

This module covers the production deployment of n8n: Docker Compose setup, environment variables, reverse proxy configuration, database selection (SQLite for solo, PostgreSQL for team), and basic scaling strategies. We also introduce the advanced concept of exposing n8n workflows as MCP tools—turning your automations into agent-callable functions.

## Learning Objectives

- [ ] Deploy n8n locally with Docker Compose and configure a reverse proxy.
- [ ] Select the right database backend based on execution volume and team size.
- [ ] Design an n8n workflow that exposes its functionality as an MCP tool.

## Demo Outline (10 min)

1. **Docker Deploy:** Spin up n8n with Docker Compose. Show the .env file and volume mounts.
2. **Database Swap:** Migrate from the default SQLite to PostgreSQL. Explain why this matters for concurrency.
3. **MCP Exposure:** Build a workflow that accepts a webhook with structured input, processes it, and returns a JSON payload. Explain how this maps to an MCP tool definition.

## Challenge (5 min)

> **The MCP Wrapper:** Take any n8n workflow you have built. Add a webhook trigger that accepts a JSON payload and returns a structured JSON response. Document the input schema as if it were an MCP tool.

## Allternit Connection

- **Internal system:** Allternit runs n8n on a dedicated Docker host with PostgreSQL and Redis for queue management.
- **Reference repo/file:** \"infra/docker/n8n/\" in the DevOps repo.
- **Key difference from standard approach:** Allternit exposes select n8n workflows as MCP tools via mcp-apps-adapter. This lets agui-gateway trigger complex automations without knowing n8n exists.
