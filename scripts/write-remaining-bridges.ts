import fs from 'fs/promises';
import path from 'path';

const BASE_DIR = '/Users/macbook/Desktop/allternit-workspace/allternit/remix-content';

interface BridgeModule {
  courseCode: string;
  fileName: string;
  content: string;
}

const modules: BridgeModule[] = [
  // ========== ALABS-CORE-PROMPTS ==========
  {
    courseCode: 'ALABS-CORE-PROMPTS',
    fileName: 'module-01-the-problem-guesswork-vs-systematic-prompt-engineering.md',
    content: `# The Problem: Guesswork vs. Systematic Prompt Engineering

**Course:** ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems  
**Tier:** CORE

## Bridge Concept

Most people treat prompt engineering as magic: type a wish into the model and hope for the best. When it fails, they add more adjectives. When it still fails, they blame the model. This module replaces guesswork with a systematic framework: prompts are interfaces, and like any interface, they should be designed, tested, and versioned.

We introduce the Prompt Engineering Stack: context, constraints, examples, and evaluation. You will learn to treat a prompt as a deployable artifact that lives in version control, not a chat message that disappears into Slack.

## Learning Objectives

- [ ] Distinguish between exploratory prompting (chat) and production prompting (system interfaces).
- [ ] Apply the four layers of the Prompt Engineering Stack to a real task.
- [ ] Write a prompt test suite that catches regression when the model or context changes.

## Demo Outline (10 min)

1. **The Guesswork Loop:** Show a "vibe prompt" for a support ticket classifier. Run it 5 times. Show inconsistent labels.
2. **The Systematic Rewrite:** Add a role, output schema, few-shot examples, and a constraint. Run it 5 times. Show consistency.
3. **Regression Test:** Change the model temperature. Show how the structured prompt is more robust than the vibe prompt.

## Challenge (5 min)

> **The One-Prompt Test:** Pick a simple classification task. Write one "vibe" prompt and one "systematic" prompt. Run 10 examples through both. Score accuracy and consistency. The systematic prompt must win on both.

## Allternit Connection

- **Internal system:** agui-gateway stores all production prompts in \\\"prompts/\\\" as versioned YAML files.
- **Reference repo/file:** \\\"prompts/support_classifier_v2.yaml\\\" in agui-gateway.
- **Key difference from standard approach:** Allternit never allows prompt changes in production without passing a regression test suite. Prompts are code.
`,
  },
  {
    courseCode: 'ALABS-CORE-PROMPTS',
    fileName: 'module-06-bridge-allternit-s-agui-gateway-prompt-tiers.md',
    content: `# Bridge: Allternit's agui-gateway Prompt Tiers

**Course:** ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems  
**Tier:** CORE

## Bridge Concept

Not all prompts are equal. A one-shot question needs a different contract than a long-running agent conversation. At Allternit, we use a tiered prompt system: Tier 1 (single-turn utilities), Tier 2 (multi-turn sessions), and Tier 3 (autonomous agent loops). Each tier adds more context-management machinery.

This module explains how agui-gateway stays coherent across long sessions. It is not one giant system prompt. It is a stack of prompts: a static base prompt, a dynamic context prompt (built from conversation history), and a task-specific prompt (injected per turn). Understanding this architecture lets you design prompts that scale from 1 turn to 100 turns without drift.

## Learning Objectives

- [ ] Design a tiered prompt architecture: base, context, and task layers.
- [ ] Implement a context-compaction strategy that preserves critical state while staying under token limits.
- [ ] Debug long-session drift by isolating which prompt tier is corrupting the agent's behavior.

## Demo Outline (10 min)

1. **The Tier Stack:** Show the three prompt files for a support agent. Base (never changes), Context (summarized history), Task (current intent).
2. **Drift Demo:** Run a 20-turn simulation with a monolithic prompt. Show how early instructions are forgotten. Run the same simulation with tiered prompts. Show retention.
3. **Compaction:** Show how the context tier is summarized when the token budget is exceeded. Explain what is kept and what is dropped.

## Challenge (5 min)

> **Build a Tiered Prompt:** For a conversation agent of your choice, write three separate prompt files (base, context, task) and a Python function that assembles them. Run a 10-turn conversation and verify that the base instructions are still respected at turn 10.

## Allternit Connection

- **Internal system:** agui-gateway's prompt assembler lives in \\\"services/prompt-engine/\\\".
- **Reference repo/file:** \\\"services/prompt-engine/tiered_assembler.py\\\"
- **Key difference from standard approach:** Allternit treats the context tier as a first-class data structure, not just a string. It is a list of events that can be filtered, ranked, and summarized independently.
`,
  },
  {
    courseCode: 'ALABS-CORE-PROMPTS',
    fileName: 'module-07-capstone-design-a-3-prompt-suite-red-team-report.md',
    content: `# Capstone: Design a 3-Prompt Suite + Red-Team Report

**Course:** ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems  
**Tier:** CORE

## Bridge Concept

The capstone tests whether you can design a complete prompt system for a real-world agent task. You will write three interlocking prompts for a customer-support agent:
1. **Classifier Prompt:** Routes the ticket to the right department.
2. **Response Prompt:** Drafts the reply based on the classification.
3. **Safety Prompt:** Scans the draft for PII, toxicity, or policy violations.

Then you will red-team your own prompts: try to make them fail with adversarial inputs, edge cases, and jailbreak attempts. The deliverable is the prompt suite plus a red-team report documenting the failures and mitigations.

## Learning Objectives

- [ ] Design a multi-prompt system where each prompt has a single, clear responsibility.
- [ ] Write a structured evaluation dataset that covers normal, edge, and adversarial cases.
- [ ] Red-team a prompt system and implement concrete mitigations for each failure mode.

## Demo Outline (10 min)

1. **The Suite:** Walk through the three prompts. Show how the classifier's JSON output feeds into the response prompt's context.
2. **Red-Team Examples:** Show three successful attacks: a category the classifier missed, a rude customer message that triggered an inappropriate tone, and a ticket containing fake PII.
3. **The Fix:** Show the mitigations: expanded few-shot examples, a tone constraint, and a PII regex filter in the safety prompt.

## Challenge (Capstone — 60 min)

> **Build:** A 3-prompt suite for a support agent:
> - Prompt 1: Classify incoming tickets into 5 categories with confidence scores.
> - Prompt 2: Draft a polite, helpful response using internal knowledge-base snippets.
> - Prompt 3: Validate the draft for safety, accuracy, and policy compliance.
> - Red-team the suite with at least 10 adversarial inputs.
> - Write a 1-page red-team report with findings and fixes.
>
> **Deliverable:** A GitHub repo or PDF containing the prompts, test dataset, and red-team report.

## Allternit Connection

- **Internal system:** agui-gateway uses a classifier → drafter → validator pipeline for all customer-facing messages.
- **Reference repo/file:** \\\"prompts/support_suite/\\\" in agui-gateway.
- **Key difference from standard approach:** Allternit runs every production prompt through a quarterly red-team exercise. The prompts that survive are the ones that have been explicitly hardened against known failure modes.
`,
  },

  // ========== ALABS-OPS-N8N ==========
  {
    courseCode: 'ALABS-OPS-N8N',
    fileName: 'module-01-the-problem-why-n8n-over-saas-automation.md',
    content: `# The Problem: Why n8n Over SaaS Automation

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
- **Reference repo/file:** \\\"docs/automation/migration-zapier-to-n8n.md\\\" (internal).
- **Key difference from standard approach:** Allternit does not use n8n Cloud. Every workflow runs on infrastructure we control, with full access to internal APIs and no task limits.
`,
  },
  {
    courseCode: 'ALABS-OPS-N8N',
    fileName: 'module-05-n8n-as-connector-layer.md',
    content: `# n8n as Connector Layer

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
- **Reference repo/file:** \\\"workflows/slack_claude_bridge.json\\\" in the n8n instance.
- **Key difference from standard approach:** Allternit never stores third-party API keys in n8n credentials if the key has admin scope. Keys are scoped to the minimum permissions required.
`,
  },
  {
    courseCode: 'ALABS-OPS-N8N',
    fileName: 'module-06-self-hosting-scaling.md',
    content: `# Self-Hosting & Scaling

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
- **Reference repo/file:** \\\"infra/docker/n8n/\\\" in the DevOps repo.
- **Key difference from standard approach:** Allternit exposes select n8n workflows as MCP tools via mcp-apps-adapter. This lets agui-gateway trigger complex automations without knowing n8n exists.
`,
  },
  {
    courseCode: 'ALABS-OPS-N8N',
    fileName: 'module-07-bridge-how-allternit-uses-n8n.md',
    content: `# Bridge: How Allternit Uses n8n

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
- **Reference repo/file:** \\\"docs/architecture/workflow-engine-boundaries.md\\\" (internal).
- **Key difference from standard approach:** Allternit never stores business-critical state inside n8n. All state lives in the application database. n8n is stateless except for execution metadata.
`,
  },
  {
    courseCode: 'ALABS-OPS-N8N',
    fileName: 'module-08-capstone-build-a-self-hosted-n8n-mcp-workflow.md',
    content: `# Capstone: Build a Self-Hosted n8n MCP Workflow

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
- **Reference repo/file:** \\\"workflows/mcp_routing_template.json\\\" in the n8n instance.
- **Key difference from standard approach:** Allternit requires every n8n MCP workflow to validate its input with a JSON Schema before processing. This prevents malformed requests from triggering expensive or destructive actions.
`,
  },
];

async function main() {
  for (const mod of modules) {
    const filePath = path.join(BASE_DIR, mod.courseCode, mod.fileName);
    await fs.writeFile(filePath, mod.content);
    console.log(`Wrote ${mod.courseCode}/${mod.fileName} (${Buffer.byteLength(mod.content)} bytes)`);
  }
}

main().catch(console.error);
