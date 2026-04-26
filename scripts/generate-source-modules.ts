import fs from 'fs/promises';
import path from 'path';

const BASE_DIR = '/Users/macbook/Desktop/allternit-workspace/allternit/remix-content';

interface SourceModule {
  courseCode: string;
  moduleIndex: number;
  fileName: string;
  title: string;
  content: string;
}

const sourceModules: SourceModule[] = [
  // ========== ALABS-OPS-N8N Source Modules ==========
  {
    courseCode: 'ALABS-OPS-N8N',
    moduleIndex: 1,
    fileName: 'module-02-n8n-architecture.md',
    title: 'n8n Architecture',
    content: `# n8n Architecture

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

> **The Data Router:** Build a workflow that receives a webhook with a \\\"type\\\" field. Use an IF node to route \\\"type=lead\\\" to one HTTP endpoint and \\\"type=support\\\" to another. Return a confirmation message.

## Allternit Connection

- **Internal system:** workflow-engine uses n8n for all webhook-based integrations.
- **Reference repo/file:** \\\"workflows/inbound_webhook_router.json\\\"
- **Key difference from standard approach:** Allternit versions every n8n workflow as JSON in Git. Production workflows are never edited directly in the UI without a backup export.
`,
  },
  {
    courseCode: 'ALABS-OPS-N8N',
    moduleIndex: 2,
    fileName: 'module-03-business-workflow-patterns.md',
    title: 'Business Workflow Patterns',
    content: `# Business Workflow Patterns

**Course:** ALABS-OPS-N8N — Orchestrate Agents & Automations with n8n  
**Tier:** OPS

## Module Overview

This module applies n8n architecture to real business scenarios: lead generation, email automation, CRM updates, and approval chains. You will learn the patterns that make business workflows reliable and maintainable.

## Learning Objectives

- [ ] Design a lead-capture workflow that validates, enriches, and routes data.
- [ ] Implement an approval workflow with conditional branching and notifications.
- [ ] Build a multi-step email sequence triggered by user actions.

## Lecture Guide

**Source:** N8N for Beginners: Lead Generation, Automation & AI Agents + Bonus n8n courses

1. **Lead Generation Pattern** — Form capture → validation → enrichment → CRM entry.
2. **Email Automation** — Trigger → delay → personalized email → open/click tracking.
3. **CRM Synchronization** — Bi-directional sync between n8n and HubSpot/Salesforce.
4. **Approval Workflows** — Request → manager notification → approve/reject branch.
5. **Notification Patterns** — Slack, email, and SMS alerts based on workflow events.
6. **Data Enrichment** — Calling Clearbit/Hunter APIs to augment lead records.
7. **Deduplication** — Checking for existing records before creating new ones.
8. **Conditional Logic** — Using IF and Switch nodes for complex routing.
9. **Looping Constructs** — Processing lists of items with Split In Batches.
10. **Error Recovery** — Handling API rate limits and transient failures.
11. **File Processing** — Receiving attachments, parsing CSVs, and storing results.
12. **Calendar Integration** — Creating events and checking availability.
13. **Survey/Form Processing** — Aggregating responses and generating reports.
14. **Customer Onboarding** — Multi-step welcome sequences across channels.
15. **Workflow Documentation** — Maintaining runbooks and node descriptions.

## Demo Outline (10 min)

1. Build a lead-capture workflow: Typeform webhook → validation → Slack alert → Google Sheets row.
2. Add an approval branch: if deal size > $10K, notify manager before CRM entry.
3. Show the execution log for a complete run.

## Challenge (5 min)

> **The Support Escalator:** Build a workflow that receives a support ticket. If priority is \\\"high\\\" AND it has been open > 2 hours, send a Slack DM to the team lead and create a PagerDuty incident.

## Allternit Connection

- **Internal system:** Customer success workflows are orchestrated in n8n.
- **Reference repo/file:** \\\"workflows/support_escalation.json\\\"
- **Key difference from standard approach:** Allternit never stores PII in n8n execution logs. Sensitive fields are hashed or redacted at the entry node.
`,
  },
  {
    courseCode: 'ALABS-OPS-N8N',
    moduleIndex: 3,
    fileName: 'module-04-openai-agent-nodes.md',
    title: 'OpenAI Agent Nodes',
    content: `# OpenAI Agent Nodes

**Course:** ALABS-OPS-N8N — Orchestrate Agents & Automations with n8n  
**Tier:** OPS

## Module Overview

This module explores how n8n integrates with AI agents using OpenAI and LangChain nodes. You will build workflows where LLMs classify text, summarize content, extract entities, and make decisions that drive branching logic.

## Learning Objectives

- [ ] Configure the OpenAI node for chat completions with system and user prompts.
- [ ] Use LLM output to control workflow branching (classification, extraction, scoring).
- [ ] Implement a basic agent loop with memory using LangChain nodes in n8n.

## Lecture Guide

**Source:** Build AI Agents with n8n: Free Hands-On Training + AI Agent N8N Masterclass

1. **OpenAI Node Basics** — API key setup, model selection, temperature, and max tokens.
2. **Prompt Engineering in n8n** — Constructing dynamic prompts from workflow data.
3. **Classification Workflows** — Using LLM output to route items into categories.
4. **Summarization Pipelines** — Feeding long documents to GPT and parsing summaries.
5. **Entity Extraction** — Structured JSON output from unstructured text.
6. **Sentiment Analysis** — Scoring customer feedback and triggering alerts.
7. **Question Answering** — Retrieval-augmented responses with context injection.
8. **LangChain Agent Node** — Tool-calling agents inside n8n workflows.
9. **Memory & Context** — Maintaining conversation state across workflow executions.
10. **Function Calling** — Defining JSON schemas for structured LLM responses.
11. **Multi-Step Reasoning** — Chaining multiple LLM calls for complex tasks.
12. **Cost Tracking** — Estimating token usage and API spend per workflow run.
13. **Retry & Fallback** — Handling OpenAI rate limits and model downtime.
14. **Local LLM Alternative** — Connecting to Ollama or LM Studio from n8n.
15. **Security Best Practices** — Prompt injection prevention and output validation.

## Demo Outline (10 min)

1. Build an email classifier: Gmail trigger → OpenAI node (classify as urgent/standard/spam) → route to Slack or archive.
2. Show structured output using function calling to get JSON.
3. Add a validation step: if the JSON is malformed, retry with a stricter prompt.

## Challenge (5 min)

> **The Ticket Tagger:** Build a workflow that receives support emails, asks GPT to assign priority (1-4) and department, and routes to the correct Slack channel based on the response.

## Allternit Connection

- **Internal system:** agui-gateway uses n8n for lightweight NLP tasks before handing off to domain agents.
- **Reference repo/file:** \\\"workflows/email_classifier_v2.json\\\"
- **Key difference from standard approach:** Allternit always validates LLM JSON output against a Zod schema before using it for routing. Malformed outputs are sent to a human review queue.
`,
  },

  // ========== ALABS-CORE-COPILOT Source Modules ==========
  {
    courseCode: 'ALABS-CORE-COPILOT',
    moduleIndex: 1,
    fileName: 'module-02-copilot-as-infrastructure.md',
    title: 'Copilot as Infrastructure',
    content: `# Copilot as Infrastructure

**Course:** ALABS-CORE-COPILOT — Build AI-Assisted Software with Copilot & Cursor  
**Tier:** CORE

## Module Overview

This module treats GitHub Copilot not as a fancy autocomplete, but as a development infrastructure layer. You will learn how to configure Copilot for maximum relevance, use context commands effectively, and maintain code quality when a machine is writing half your lines.

## Learning Objectives

- [ ] Configure Copilot settings (suggestion frequency, inline chat, commit messages).
- [ ] Use context commands (@workspace, @terminal, @vscode) to improve suggestion quality.
- [ ] Review AI-generated code for correctness, security, and project conventions.

## Lecture Guide

**Source:** Master GitHub Copilot – From Basics to Advanced AI Coding

1. **Copilot Setup** — Installation, authentication, and IDE integration.
2. **Suggestion Mechanics** — How Copilot uses file context and neighboring tabs.
3. **Inline Chat** — Asking questions and requesting changes without leaving the editor.
4. **Context Commands** — @workspace for repo-wide context, @terminal for shell help.
5. **Code Completion** — Accepting, rejecting, and cycling through suggestions.
6. **Comment-to-Code** — Writing descriptive comments to guide generation.
7. **Test Generation** — Using Copilot to generate unit tests and edge cases.
8. **Documentation Assist** — Generating docstrings and README sections.
9. **Refactoring** — Prompting Copilot to rename, extract, or restructure code.
10. **Multi-Language Support** — Python, TypeScript, Rust, and shell scripts.
11. **GitHub Copilot Chat** — The sidebar chat interface for complex queries.
12. **Commit Message Generation** — Summarizing diffs into conventional commits.
13. **Pull Request Summaries** — Drafting descriptions and review comments.
14. **Security Scanning** — Spotting vulnerabilities in generated code.
15. **Advanced Context** — Copilot agent mode and multi-file reasoning.

## Demo Outline (10 min)

1. Open a TypeScript repo. Show how Copilot completes a function signature based on imports.
2. Use @workspace to ask: \\\"Where is the authentication middleware defined?\\\"
3. Generate a unit test for a new function and review it for missing edge cases.

## Challenge (5 min)

> **The Convention Check:** Write a function using only Copilot suggestions. Then run your project's linter. Fix every violation Copilot introduced. Document the top 3 convention failures.

## Allternit Connection

- **Internal system:** Allternit engineers use Copilot for ~60% of boilerplate code.
- **Reference repo/file:** \\\"docs/copilot-conventions.md\\\" (internal).
- **Key difference from standard approach:** Allternit requires every AI-generated test to be manually validated against the actual function behavior. Copilot's tests are a starting point, not the final suite.
`,
  },
  {
    courseCode: 'ALABS-CORE-COPILOT',
    moduleIndex: 2,
    fileName: 'module-03-cursor-workflows.md',
    title: 'Cursor Workflows',
    content: `# Cursor Workflows

**Course:** ALABS-CORE-COPILOT — Build AI-Assisted Software with Copilot & Cursor  
**Tier:** CORE

## Module Overview

Cursor is an AI-native code editor that goes beyond autocomplete. This module covers Cursor's unique features: Composer for multi-file edits, codebase-wide queries, and agentic code generation. You will learn how to use Cursor for architectural changes, not just line-by-line completion.

## Learning Objectives

- [ ] Use Cursor Composer to refactor across multiple files in a single prompt.
- [ ] Query the entire codebase with natural language to find patterns and dependencies.
- [ ] Evaluate when Cursor's agentic mode is appropriate vs. when it is too risky.

## Lecture Guide

**Source:** Master GitHub Copilot course (Cursor section) + Cursor documentation

1. **Cursor vs. VS Code+Copilot** — What makes Cursor different.
2. **Composer Basics** — Writing prompts that span multiple files.
3. **Codebase Queries** — Finding functions, types, and patterns with natural language.
4. **Agentic Mode** — Letting Cursor plan and execute a multi-step edit.
5. **Context Pinning** — Keeping specific files in context for better suggestions.
6. **Terminal Integration** — Running commands and debugging from within Cursor.
7. **Diff Review** — Inspecting and accepting/rejecting multi-file changes.
8. **Image-to-Code** — Generating UI components from screenshots.
9. **Documentation Generation** — Creating architecture docs from code exploration.
10. **Refactoring Patterns** — Renaming, extracting services, and migrating APIs.
11. **Error Fixing** — Pasting compiler errors into chat for targeted fixes.
12. **Custom Rules** — Teaching Cursor your project's conventions.
13. **Model Selection** — Claude, GPT-4, and o1 inside Cursor.
14. **Privacy Settings** — What gets sent to the cloud and how to limit it.
15. **Team Workflows** — Sharing prompts and review practices.

## Demo Outline (10 min)

1. Open a project. Use Composer to: \\\"Extract all validation logic from these three routes into a single middleware file.\\\"
2. Review the diff. Show how Cursor updated imports and call sites.
3. Use codebase query: \\\"Where do we handle OAuth token refresh?\\\"

## Challenge (5 min)

> **The Cross-File Refactor:** Pick a duplicated pattern in your codebase. Use Cursor Composer to consolidate it into one location. Review every changed file and fix any broken references.

## Allternit Connection

- **Internal system:** agui-gateway was heavily refactored using Cursor Composer.
- **Reference repo/file:** See migration commits tagged \\\"cursor-refactor\\\" in agui-gateway.
- **Key difference from standard approach:** Allternit never accepts a Composer diff without file-by-file review. The AI can propose architecture changes; the human approves them line by line.
`,
  },
  {
    courseCode: 'ALABS-CORE-COPILOT',
    moduleIndex: 3,
    fileName: 'module-04-prompting-for-clean-code.md',
    title: 'Prompting for Clean Code',
    content: `# Prompting for Clean Code

**Course:** ALABS-CORE-COPILOT — Build AI-Assisted Software with Copilot & Cursor  
**Tier:** CORE

## Module Overview

AI assistants are only as good as the prompts that steer them. This module teaches how to prompt for clean, maintainable code: explicit naming, single-responsibility functions, strong typing, and comprehensive error handling. You will learn to reject messy first drafts and iterate toward production quality.

## Learning Objectives

- [ ] Write prompts that explicitly request clean-code qualities.
- [ ] Iterate on AI-generated code using targeted follow-up prompts.
- [ ] Enforce type safety, error handling, and test coverage through prompting.

## Lecture Guide

**Source:** Master GitHub Copilot course + Clean Code principles

1. **The Prompt as Specification** — Why vague prompts produce vague code.
2. **Naming Conventions** — Prompting for descriptive variable and function names.
3. **Single Responsibility** — Breaking generated monoliths into focused functions.
4. **Type-Driven Development** — Asking the AI to define types before implementation.
5. **Error Handling** — Prompting for exhaustive error paths and custom exceptions.
6. **Immutability** — Preferring const, pure functions, and avoiding mutation.
7. **Comment Quality** — Explaining *why*, not *what*.
8. **Test-Driven Prompting** — Generating tests first, then implementation.
9. **Refactoring Prompts** — \\\"Make this function shorter and more readable.\\\"
10. **Pattern Consistency** — Matching the style of existing codebase.
11. **Security Awareness** — Prompting for input validation and sanitization.
12. **Performance Constraints** — Asking for Big-O analysis and optimizations.
13. **Dependency Discipline** — Minimizing imports and avoiding bloat.
14. **Documentation Strings** — Generating JSDoc, docstrings, and OpenAPI specs.
15. **Review Prompts** — Using AI to critique its own output.

## Demo Outline (10 min)

1. Show a vague prompt: \\\"Write a function to process users.\\\" Result: messy, 40-line monolith.
2. Rewrite with clean-code constraints: typed inputs, error handling, single responsibility. Result: 3 clean functions.
3. Ask the AI to write tests for the new functions. Review for missing edge cases.

## Challenge (5 min)

> **The Clean-Up Round:** Take a messy AI-generated function. In exactly 3 follow-up prompts, transform it into clean code that passes your project's linting and has full type coverage.

## Allternit Connection

- **Internal system:** Allternit's \\\".cursorrules\\\" file encodes clean-code expectations for AI assistants.
- **Reference repo/file:** \\\"docs/clean-code-prompt-patterns.md\\\" (internal).
- **Key difference from standard approach:** Allternit requires every AI-generated function to include at least one error-handling branch. Happy-path-only code is rejected in review.
`,
  },
  {
    courseCode: 'ALABS-CORE-COPILOT',
    moduleIndex: 4,
    fileName: 'module-05-extending-assistants-with-tools.md',
    title: 'Extending Assistants with Tools',
    content: `# Extending Assistants with Tools

**Course:** ALABS-CORE-COPILOT — Build AI-Assisted Software with Copilot & Cursor  
**Tier:** CORE

## Module Overview

AI coding assistants are not limited to the IDE. They can be extended with custom tools: linters, test runners, documentation generators, and domain-specific validators. This module covers how to augment Copilot and Cursor with tool integrations that enforce project standards automatically.

## Learning Objectives

- [ ] Configure VS Code tasks and extensions to augment Copilot's context.
- [ ] Build a simple CLI tool that an AI assistant can invoke via terminal integration.
- [ ] Design a tool schema so the AI knows when and how to use your custom tooling.

## Lecture Guide

**Source:** Master GitHub Copilot course + MCP/tool documentation

1. **Tool-Augmented Coding** — Moving beyond autocomplete to agentic assistance.
2. **VS Code Extensions** — Enhancing Copilot with custom extensions and tasks.
3. **Terminal Integration** — Running build, test, and lint commands from chat.
4. **Custom Scripts** — Writing small utilities that the AI can call.
5. **MCP Introduction** — The Model Context Protocol for tool standardization.
6. **Tool Schemas** — Defining inputs, outputs, and error states for AI tools.
7. **Context Enrichment** — Feeding build errors and test results back into the AI.
8. **Code Review Bots** — Using AI tools to pre-review pull requests.
9. **Documentation Tools** — Auto-generating architecture diagrams and API docs.
10. **Security Scanners** — Integrating SAST tools into the coding loop.
11. **Test Orchestration** — Running targeted tests based on changed files.
12. **Refactoring Tools** — Automated migration scripts for large codebases.
13. **Package Managers** — Using AI to update dependencies safely.
14. **Database Migrations** — Generating and reviewing schema changes.
15. **Deployment Hooks** — Connecting CI/CD status back to the editor.

## Demo Outline (10 min)

1. Show a custom VS Code task that runs a project-specific linter.
2. Ask Cursor to fix lint errors by running the task and interpreting the output.
3. Introduce a simple MCP server concept: a tool that queries internal API docs.

## Challenge (5 min)

> **The Custom Tool:** Write a small Node.js or Python script that validates your project's import rules. Run it from the terminal inside Cursor/Copilot Chat. Ask the AI to fix any violations it finds.

## Allternit Connection

- **Internal system:** mcp-apps-adapter exposes internal tools to agui-gateway and Cursor.
- **Reference repo/file:** \\\"tools/project_lint.py\\\" in mcp-apps-adapter.
- **Key difference from standard approach:** Allternit treats every custom tool as an MCP server. This means any agent—Cursor, Claude Code, or agui-gateway—can invoke it with the same interface.
`,
  },

  // ========== ALABS-CORE-PROMPTS Source Modules ==========
  {
    courseCode: 'ALABS-CORE-PROMPTS',
    moduleIndex: 1,
    fileName: 'module-02-the-prompt-engineering-stack.md',
    title: 'The Prompt Engineering Stack',
    content: `# The Prompt Engineering Stack

**Course:** ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems  
**Tier:** CORE

## Module Overview

This module introduces the four-layer stack for systematic prompt engineering: Context, Constraints, Examples, and Evaluation. You will learn to design prompts as interfaces rather than messages, and to test them with the same rigor as application code.

## Learning Objectives

- [ ] Apply the four layers of the Prompt Engineering Stack to any task.
- [ ] Write a system prompt that includes role, task, format, and guardrails.
- [ ] Build a prompt test suite with at least 5 test cases covering normal and edge inputs.

## Lecture Guide

**Source:** ChatGPT Prompt Engineering (Free Course) + FREE Prompt Engineering Masterclass

1. **Context Layer** — Who the model is, what it knows, and what task it faces.
2. **Constraint Layer** — Output format, length limits, tone, and forbidden topics.
3. **Example Layer** — Few-shot and chain-of-thought examples.
4. **Evaluation Layer** — Automated scoring, regression tests, and red-teaming.
5. **Role Prompting** — Defining a persona to shape output style and expertise.
6. **Task Clarity** — Breaking complex requests into atomic instructions.
7. **Format Control** — JSON, Markdown tables, and enumerated lists.
8. **Tone Calibration** — Professional, casual, technical, or empathetic voices.
9. **Guardrails** — Preventing hallucinations, toxicity, and off-topic responses.
10. **Few-Shot Design** — Selecting representative examples.
11. **Chain-of-Thought** — Prompting the model to show its reasoning.
12. **Zero-Shot Techniques** — When and how to avoid examples.
13. **Prompt Templates** — Parameterized prompts for reusable components.
14. **A/B Testing Prompts** — Comparing variants on a held-out test set.
15. **Versioning Prompts** — Tracking changes and performance over time.

## Demo Outline (10 min)

1. Show a weak prompt for a classification task. Run it 3 times. Results vary.
2. Rewrite with the full stack: role + constraints + 3 examples + JSON format.
3. Run the test suite. Show improved consistency and accuracy.

## Challenge (5 min)

> **Stack Upgrade:** Pick a simple task (summarization, classification, or extraction). Write a v1 prompt in one sentence. Then write a v2 prompt using all four layers. Run 10 examples through both. The v2 prompt must score higher on consistency.

## Allternit Connection

- **Internal system:** agui-gateway stores prompts as YAML files with embedded test cases.
- **Reference repo/file:** \\\"prompts/support_classifier_v2.yaml\\\"
- **Key difference from standard approach:** Allternit treats prompt evaluation as a CI step. If a prompt change causes regression on the test suite, the deployment is blocked.
`,
  },
  {
    courseCode: 'ALABS-CORE-PROMPTS',
    moduleIndex: 2,
    fileName: 'module-03-python-openai-api-patterns.md',
    title: 'Python + OpenAI API Patterns',
    content: `# Python + OpenAI API Patterns

**Course:** ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems  
**Tier:** CORE

## Module Overview

This module covers the practical implementation of prompt engineering in Python. You will learn how to call the OpenAI API programmatically, manage message history, handle streaming responses, and build reusable prompt classes that can be tested and versioned.

## Learning Objectives

- [ ] Make structured API calls to OpenAI (and compatible APIs) from Python.
- [ ] Implement conversation memory and context window management.
- [ ] Parse streaming responses and handle API errors gracefully.

## Lecture Guide

**Source:** Prompt Engineering with Python and ChatGPT API (Free Course)

1. **API Setup** — Keys, endpoints, and client libraries (openai, httpx).
2. **Basic Completion** — The chat.completions.create interface.
3. **Message Roles** — System, user, assistant, and function/tool messages.
4. **Temperature & Sampling** — Controlling creativity and determinism.
5. **Structured Output** — JSON mode and function calling.
6. **Streaming** — Processing token-by-token responses.
7. **Error Handling** — Retries, rate limits, and timeouts.
8. **Conversation Memory** — Sliding window and summarization strategies.
9. **Token Counting** — Estimating costs and staying within limits.
10. **Batch Processing** — Running prompts over datasets efficiently.
11. **Prompt Chaining** — Feeding output of one call into the next.
12. **Local LLM APIs** — Using Ollama, LM Studio, and vLLM.
13. **Embedding APIs** — Generating vectors for semantic search.
14. **Evaluation Loops** — Scoring outputs and iterating on prompts.
15. **Production Patterns** — Async clients, connection pooling, and caching.

## Demo Outline (10 min)

1. Write a Python script that sends a structured classification prompt to the API.
2. Show JSON-mode output parsing with Pydantic validation.
3. Add streaming and print tokens as they arrive.

## Challenge (5 min)

> **The Conversation Agent:** Build a Python CLI chatbot that maintains a conversation history, summarizes old context when token limits approach, and always responds with a JSON object containing {response, sentiment, follow_up_suggested}.

## Allternit Connection

- **Internal system:** agui-gateway's Python services use async OpenAI clients with structured output.
- **Reference repo/file:** \\\"services/prompt-engine/openai_client.py\\\"
- **Key difference from standard approach:** Allternit never sends raw user input directly to the API. Every message passes through a sanitization and validation layer first.
`,
  },
  {
    courseCode: 'ALABS-CORE-PROMPTS',
    moduleIndex: 3,
    fileName: 'module-04-system-prompt-design.md',
    title: 'System Prompt Design',
    content: `# System Prompt Design

**Course:** ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems  
**Tier:** CORE

## Module Overview

The system prompt is the most important prompt in any agent conversation. It sets the rules, defines the persona, and constrains behavior for every subsequent turn. This module teaches how to design system prompts that remain effective across long sessions and resist jailbreak attempts.

## Learning Objectives

- [ ] Write a system prompt with clear role, scope, and behavioral boundaries.
- [ ] Design multi-turn prompts that resist context drift and injection attacks.
- [ ] Test system prompt robustness with adversarial user inputs.

## Lecture Guide

**Source:** ChatGPT Prompt Engineering (Free Course) + Anthropic system prompt docs

1. **The System Prompt as Constitution** — Why it matters more than user prompts.
2. **Role Definition** — Specificity beats generality.
3. **Scope Boundaries** — What the agent should and should not do.
4. **Behavioral Rules** — Tone, formatting, and response length.
5. **Multi-Turn Consistency** — Preventing drift over 10+ turns.
6. **Context Injection** — How malicious users try to override system prompts.
7. **Defensive Prompting** — Explicit refusal rules and output validation.
8. **Tiered Instructions** — Primary, secondary, and fallback directives.
9. **Dynamic System Prompts** — Injecting runtime context safely.
10. **Persona Stability** — Keeping the agent in character.
11. **Tool Use Instructions** — When and how to invoke tools.
12. **Cite or Decline** — Requiring evidence for factual claims.
13. **Uncertainty Expression** — Teaching the agent to say \\\"I don't know.\\\"
14. **Prompt Compression** — Maintaining effectiveness within token limits.
15. **A/B Testing System Prompts** — Measuring task success rates.

## Demo Outline (10 min)

1. Show a generic system prompt: \\\"You are a helpful assistant.\\\" Result: inconsistent behavior.
2. Show a structured system prompt with role, scope, rules, and output format.
3. Launch a jailbreak attempt against both. Show how the structured prompt resists.

## Challenge (5 min)

> **The Support Bot Constitution:** Write a system prompt for a customer support agent. It must: (1) never share internal pricing, (2) always offer to escalate technical issues, (3) respond in under 3 sentences, (4) confirm the user's emotion before answering. Test it with 5 adversarial inputs.

## Allternit Connection

- **Internal system:** agui-gateway uses a tiered system prompt with domain-specific constitutions.
- **Reference repo/file:** \\\"prompts/system_prompt_v3.yaml\\\"
- **Key difference from standard approach:** Allternit system prompts include an explicit \\\"veto list\\\" of actions the agent is never allowed to take, regardless of user pressure.
`,
  },
  {
    courseCode: 'ALABS-CORE-PROMPTS',
    moduleIndex: 4,
    fileName: 'module-05-developer-prompt-patterns.md',
    title: 'Developer Prompt Patterns',
    content: `# Developer Prompt Patterns

**Course:** ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems  
**Tier:** CORE

## Module Overview

This module covers prompt patterns specifically for software developers: code generation, debugging, refactoring, documentation, and code review. You will learn how to write prompts that produce maintainable code, accurate explanations, and useful technical documentation.

## Learning Objectives

- [ ] Apply 5 core developer prompt patterns: generation, explanation, refactoring, review, and documentation.
- [ ] Write prompts that produce typed, tested, and documented code.
- [ ] Use chain-of-thought prompting to debug complex issues.

## Lecture Guide

**Source:** FREE Prompt Engineering Masterclass + Prompt Engineering with Python

1. **Generation Pattern** — From spec to implementation.
2. **Explanation Pattern** — Understanding legacy or complex code.
3. **Refactoring Pattern** — Improving structure without changing behavior.
4. **Review Pattern** — Finding bugs, security issues, and style violations.
5. **Documentation Pattern** — Docstrings, READMEs, and architecture diagrams.
6. **Test Generation Pattern** — Unit, integration, and edge-case tests.
7. **Debug Pattern** — Error message → root cause → fix.
8. **Compare Pattern** — Evaluating multiple implementation options.
9. **Translate Pattern** — Porting code between languages or frameworks.
10. **Optimize Pattern** — Performance improvements with trade-off analysis.
11. **Dependency Pattern** — Evaluating and integrating libraries.
12. **API Design Pattern** — Designing interfaces before implementation.
13. **Schema Pattern** — Generating types, SQL, and validation rules.
14. **Commit Pattern** — Summarizing and explaining code changes.
15. **Teaching Pattern** — Explaining concepts to junior developers.

## Demo Outline (10 min)

1. Paste a complex regex into the chat. Use the explanation pattern to break it down.
2. Use the refactoring pattern: \\\"Extract this into a pure function with typed inputs.\\\"
3. Use the review pattern on a piece of code with a subtle bug. Show the AI catching it.

## Challenge (5 min)

> **The Full Cycle:** Pick a small feature (e.g., a password validator). Use exactly 5 prompts to: (1) generate the code, (2) explain it, (3) refactor it, (4) review it for security issues, (5) write tests for it. Submit the final code + test file.

## Allternit Connection

- **Internal system:** Allternit engineers maintain a shared library of developer prompt templates.
- **Reference repo/file:** \\\"prompts/dev-patterns/\\\" in agui-gateway.
- **Key difference from standard approach:** Allternit's review-pattern prompt explicitly asks the AI to check for three things: correctness, security, and project convention adherence.
`,
  },

  // ========== ALABS-AGENTS-ML Source Modules ==========
  {
    courseCode: 'ALABS-AGENTS-ML',
    moduleIndex: 1,
    fileName: 'module-02-when-to-use-ml-vs-llms-vs-rules.md',
    title: 'When to Use ML vs. LLMs vs. Rules',
    content: `# When to Use ML vs. LLMs vs. Rules

**Course:** ALABS-AGENTS-ML — ML as Agent Tools  
**Tier:** AGENTS

## Module Overview

Not every problem needs a neural network. This module teaches the decision framework for choosing between deterministic rules, traditional ML models, and LLMs. You will learn when each approach is appropriate based on data size, interpretability requirements, latency constraints, and cost.

## Learning Objectives

- [ ] Apply a decision matrix to select rules, ML, or LLMs for a given task.
- [ ] Explain why LLMs are poor at precise numerical reasoning on structured data.
- [ ] Identify scenarios where a hybrid approach (rules + ML + LLM) outperforms any single method.

## Lecture Guide

**Source:** Machine Learning Fundamentals [Python] + Machine Learning with Python

1. **The Three Tools** — Rules, ML, and LLMs: strengths and weaknesses.
2. **Rules-Based Systems** — When logic is explicit and unchanging.
3. **ML Systems** — When patterns exist but are too complex to encode manually.
4. **LLM Systems** — When flexibility, language understanding, and reasoning matter.
5. **Data Size Considerations** — Rules need none, ML needs hundreds+, LLMs need context.
6. **Interpretability** — Explaining decisions: rules > ML > LLMs.
7. **Latency & Cost** — Inference speed and API pricing comparison.
8. **Accuracy & Precision** — When exact answers matter vs. good-enough approximations.
9. **Maintenance Overhead** — Updating rules, retraining models, and prompting.
10. **Hybrid Architectures** — Using each tool for what it does best.
11. **Fallback Patterns** — LLM tries first, rule validates; or vice versa.
12. **Tabular Data** — Why ML dominates structured datasets.
13. **Text & Unstructured Data** — Why LLMs dominate documents and conversations.
14. **Edge Cases** — Handling outliers with rules and exceptions.
15. **Production Trade-offs** — Scalability, monitoring, and error recovery.

## Demo Outline (10 min)

1. Present a task: \\\"Flag fraudulent transactions.\\\" Show how rules, ML, and LLM each approach it.
2. Build a simple decision tree: transaction amount > $10K AND location != home → flag.
3. Contrast with an ML model trained on historical fraud data. Compare precision and interpretability.

## Challenge (5 min)

> **The Decision Matrix:** Pick three real-world tasks. Fill out a matrix scoring each on: data availability, interpretability need, latency budget, and flexibility requirement. Recommend rules, ML, or LLM for each. Defend your choices.

## Allternit Connection

- **Internal system:** agui-gateway uses a routing layer that selects rules, ML, or LLM based on query type.
- **Reference repo/file:** \\\"services/intent-router/decision_matrix.yaml\\\"
- **Key difference from standard approach:** Allternit never uses an LLM for financial calculations or compliance decisions. Those are handled by audited rules and ML models with explainable outputs.
`,
  },
  {
    courseCode: 'ALABS-AGENTS-ML',
    moduleIndex: 2,
    fileName: 'module-03-scikit-learn-patterns.md',
    title: 'Scikit-Learn Patterns',
    content: `# Scikit-Learn Patterns

**Course:** ALABS-AGENTS-ML — ML as Agent Tools  
**Tier:** AGENTS

## Module Overview

This module covers the practical patterns for building ML models with scikit-learn: data loading, preprocessing, model selection, cross-validation, and serialization. You will learn to build reliable, reproducible ML pipelines that can be deployed as agent tools.

## Learning Objectives

- [ ] Build a complete scikit-learn pipeline from raw data to serialized model.
- [ ] Apply cross-validation and hyperparameter tuning systematically.
- [ ] Evaluate model performance with appropriate metrics for classification and regression.

## Lecture Guide

**Source:** Machine Learning Fundamentals [Python] + Machine Learning with Python

1. **Data Loading** — Pandas, CSVs, and train/test splits.
2. **Exploratory Analysis** — Understanding distributions and correlations.
3. **Preprocessing** — Scaling, encoding, and imputation.
4. **Pipeline API** — Chaining preprocessors and estimators.
5. **Model Selection** — When to use Linear Regression, Random Forest, or SVM.
6. **Classification Metrics** — Accuracy, precision, recall, F1, and ROC-AUC.
7. **Regression Metrics** — MAE, MSE, RMSE, and R².
8. **Cross-Validation** — K-fold stratification and time-series splits.
9. **Hyperparameter Tuning** — Grid search and randomized search.
10. **Feature Importance** — Understanding what drives predictions.
11. **Overfitting & Underfitting** — Bias-variance trade-off in practice.
12. **Model Serialization** — Saving and loading with joblib/pickle.
13. **Prediction APIs** — Wrapping models in functions for downstream use.
14. **Error Analysis** — Investigating misclassified examples.
15. **Reproducibility** — Random seeds, version pinning, and experiment tracking.

## Demo Outline (10 min)

1. Load a dataset (e.g., Iris or California housing).
2. Build a Pipeline with StandardScaler + RandomForest.
3. Run cross-validation, tune one hyperparameter, and evaluate on the test set.
4. Serialize the best model.

## Challenge (5 min)

> **The Agent-Ready Model:** Train a scikit-learn classifier on a public dataset. Achieve >80% accuracy. Save it as a .joblib file. Write a Python function load_model(path) → model that returns predictions given a dictionary input.

## Allternit Connection

- **Internal system:** mcp-apps-adapter hosts several scikit-learn models for numerical reasoning tasks.
- **Reference repo/file:** \\\"models/sklearn_churn_v2.joblib\\\" in mcp-apps-adapter.
- **Key difference from standard approach:** Allternit requires every model to include a metadata manifest documenting training data, feature schema, and performance metrics. No model is deployed without this manifest.
`,
  },
  {
    courseCode: 'ALABS-AGENTS-ML',
    moduleIndex: 3,
    fileName: 'module-04-feature-engineering-for-structured-data.md',
    title: 'Feature Engineering for Structured Data',
    content: `# Feature Engineering for Structured Data

**Course:** ALABS-AGENTS-ML — ML as Agent Tools  
**Tier:** AGENTS

## Module Overview

Feature engineering is the difference between a mediocre model and a production-grade one. This module covers how to transform raw structured data into features that ML models can exploit: encoding categoricals, creating interactions, handling missing values, and reducing dimensionality.

## Learning Objectives

- [ ] Engineer features from dates, categories, and numerical columns.
- [ ] Handle missing data with imputation strategies that preserve signal.
- [ ] Select the most predictive features using statistical and model-based methods.

## Lecture Guide

**Source:** Machine Learning with Python + scikit-learn documentation

1. **Feature Types** — Numerical, categorical, ordinal, and datetime.
2. **Scaling** — StandardScaler, MinMaxScaler, and when to use each.
3. **Encoding Categories** — One-hot, ordinal, target, and frequency encoding.
4. **Datetime Features** — Extracting day, month, hour, and elapsed time.
5. **Interaction Features** — Polynomials, ratios, and domain-specific combinations.
6. **Binning** — Converting continuous variables into discrete buckets.
7. **Missing Value Imputation** — Mean, median, mode, and model-based imputation.
8. **Indicator Variables** — Tracking which values were originally missing.
9. **Outlier Handling** — Clipping, transformation, and robust scaling.
10. **Feature Selection** — Filter methods, wrapper methods, and embedded methods.
11. **Dimensionality Reduction** — PCA and feature aggregation.
12. **Text as Features** — TF-IDF and count vectors for categorical text.
13. **Pipeline Integration** — Embedding feature engineering in scikit-learn pipelines.
14. **Feature Drift** — Monitoring feature distributions in production.
15. **Domain Knowledge** — Leveraging business rules to create powerful features.

## Demo Outline (10 min)

1. Take a raw dataset with mixed types.
2. Build a ColumnTransformer that scales numerics, one-hot encodes categoricals, and extracts date features.
3. Show how feature engineering improves cross-validation scores compared to raw data.

## Challenge (5 min)

> **The Feature Pipeline:** Starting from a messy CSV with missing values and mixed types, build a scikit-learn Pipeline that handles all preprocessing automatically. Train a model and show that it works on a held-out test row without manual preprocessing.

## Allternit Connection

- **Internal system:** Allternit's ML pipeline uses a feature store to ensure training and inference schemas match.
- **Reference repo/file:** \\\"services/feature-store/schema_registry.py\\\"
- **Key difference from standard approach:** Allternit freezes feature engineering logic at model training time. The exact same ColumnTransformer is bundled with the model artifact to prevent training-serving skew.
`,
  },

  // ========== ALABS-AGENTS-AGENTS Source Modules ==========
  {
    courseCode: 'ALABS-AGENTS-AGENTS',
    moduleIndex: 1,
    fileName: 'module-02-agent-architecture-patterns.md',
    title: 'Agent Architecture Patterns',
    content: `# Agent Architecture Patterns

**Course:** ALABS-AGENTS-AGENTS — Architect Multi-Agent Systems  
**Tier:** AGENTS

## Module Overview

This module introduces the foundational patterns for building agent systems: ReAct, Plan-and-Execute, Tool-Use, and Reflection. You will learn how to structure an agent's decision loop so it can reason about tasks, select tools, observe results, and adapt its plan.

## Learning Objectives

- [ ] Implement a basic ReAct loop (Reason → Act → Observe) in Python.
- [ ] Contrast Plan-and-Execute with reactive agent architectures.
- [ ] Design a tool registry that an LLM can query and invoke.

## Lecture Guide

**Source:** Original content + Anthropic/OpenAI agent documentation

1. **What is an Agent?** — Autonomous systems that perceive, decide, and act.
2. **The ReAct Pattern** — Interleaving reasoning and action.
3. **Plan-and-Execute** — Generating a plan upfront, then executing steps.
4. **Tool-Use Architecture** — Defining tools, schemas, and invocation protocols.
5. **Observation Loop** — How agents incorporate feedback from the environment.
6. **Memory Types** — Short-term working memory vs. long-term retrieval.
7. **Reflection Pattern** — Self-critique and error correction.
8. **Chain-of-Thought Agents** — Explicit reasoning before each action.
9. **State Machines** — Modeling agent behavior as transitions between states.
10. **Event-Driven Agents** — Reacting to external triggers asynchronously.
11. **Human-in-the-Loop** — When and how to pause for human approval.
12. **Failure Recovery** — Retry logic, fallback tools, and graceful degradation.
13. **Agent Observability** — Logging thoughts, actions, and outcomes.
14. **Security Boundaries** — Sandboxing tool execution.
15. **Testing Agents** — Simulated environments and evaluation frameworks.

## Demo Outline (10 min)

1. Build a minimal ReAct agent in Python with 2 tools: \\\"search_web\\\" and \\\"calculator\\\".
2. Give it a multi-step question. Walk through each reasoning → action → observation step.
3. Show how the agent recovers from a tool error by reasoning differently.

## Challenge (5 min)

> **The ReAct Agent:** Implement a ReAct loop for a simple task: \\\"Find the population of France, then calculate what percentage of the world population that is.\\\" Your agent must use at least two distinct tools and show its reasoning trace.

## Allternit Connection

- **Internal system:** agui-gateway's core loop is a ReAct variant with structured tool schemas.
- **Reference repo/file:** \\\"agents/core/react_loop.py\\\" (conceptual).
- **Key difference from standard approach:** Allternit agents are stateless between turns. All memory is externalized to a domain service, making agents horizontally scalable and replayable.
`,
  },
  {
    courseCode: 'ALABS-AGENTS-AGENTS',
    moduleIndex: 2,
    fileName: 'module-03-tool-using-agents.md',
    title: 'Tool-Using Agents',
    content: `# Tool-Using Agents

**Course:** ALABS-AGENTS-AGENTS — Architect Multi-Agent Systems  
**Tier:** AGENTS

## Module Overview

The defining capability of modern agents is tool use. This module covers how to design, register, and invoke tools from an LLM agent. You will learn the Model Context Protocol (MCP), function calling APIs, and how to build agents that extend their capabilities by calling external services.

## Learning Objectives

- [ ] Define tool schemas using JSON Schema or MCP format.
- [ ] Implement an agent that dynamically selects and invokes tools based on user queries.
- [ ] Handle tool errors and format tool outputs for LLM consumption.

## Lecture Guide

**Source:** Build Custom GPT with ChatGPT: Step by Step Free Guide + Anthropic MCP docs

1. **Why Tools Matter** — Extending LLMs beyond their training data.
2. **Function Calling APIs** — OpenAI, Anthropic, and Gemini tool interfaces.
3. **JSON Schema for Tools** — Defining inputs, outputs, and descriptions.
4. **Tool Descriptions** — Writing clear docs so the LLM chooses correctly.
5. **The Tool Registry** — A dynamic catalog of available capabilities.
6. **Invocation Patterns** — Synchronous vs. async tool execution.
7. **Result Formatting** — Converting tool output into LLM-readable context.
8. **Error Handling** — What happens when a tool fails or returns garbage.
9. **Authentication** — Managing API keys and permissions for tool calls.
10. **MCP Deep Dive** — The emerging standard for agent-tool communication.
11. **Local Tools** — Running code, file system access, and database queries.
12. **Remote Tools** — HTTP APIs, SaaS integrations, and microservices.
13. **Tool Chaining** — Using the output of one tool as input to another.
14. **Tool Selection Bias** — Preventing the agent from over-relying on one tool.
15. **Observability** — Tracing which tools were called and why.

## Demo Outline (10 min)

1. Define three tools: get_weather, calculate, and search_news.
2. Build an agent that receives a question and emits a tool call JSON.
3. Execute the tool, feed the result back, and generate the final answer.
4. Show an error case: the weather API is down. The agent falls back to a generic response.

## Challenge (5 min)

> **The MCP Tool:** Implement a simple MCP server with one tool: \\\"get_current_time\\\". Then build a Python client that asks an LLM a question requiring the current time, extracts the tool call, invokes your MCP server, and returns the answer.

## Allternit Connection

- **Internal system:** mcp-apps-adapter is Allternit's central tool registry exposing 20+ MCP tools.
- **Reference repo/file:** github.com/allternit/mcp-apps-adapter
- **Key difference from standard approach:** Allternit tools are self-describing and versioned. The agent receives not just a name, but a full contract including examples, error schemas, and rate limits.
`,
  },
  {
    courseCode: 'ALABS-AGENTS-AGENTS',
    moduleIndex: 3,
    fileName: 'module-04-code-generation-agents.md',
    title: 'Code-Generation Agents',
    content: `# Code-Generation Agents

**Course:** ALABS-AGENTS-AGENTS — Architect Multi-Agent Systems  
**Tier:** AGENTS

## Module Overview

Code-generation agents are specialized agents that write, review, and refactor software. This module covers how to build agents that generate code from natural language specs, iterate based on compiler feedback, and maintain project conventions. We draw from the "How I Made My Own ChatGPT Coder" course and extend it with production-grade guardrails.

## Learning Objectives

- [ ] Build a code-generation agent that writes code from a natural-language spec.
[ ] Implement a feedback loop where compiler/test errors are fed back to the agent for self-correction.
[ ] Enforce project conventions by injecting style rules and lint output into the agent's context.

## Lecture Guide

**Source:** How I Made My Own ChatGPT Coder That Codes ANYTHING! + original content

1. **Spec-to-Code Pipeline** — From user story to implementation.
2. **Context Window Management** — Feeding relevant files to the code agent.
3. **Iterative Generation** — Generating drafts, reviewing, and refining.
4. **Compiler Feedback Loop** — Passing build errors back as observations.
5. **Test-Driven Generation** — Writing tests first, then generating passing code.
6. **Code Review Agents** — A second agent that critiques the first agent's output.
7. **Refactoring Agents** — Restructuring code without changing behavior.
8. **Multi-File Changes** — Planning and executing edits across a codebase.
9. **Documentation Generation** — Keeping code and docs in sync.
10. **Security Guardrails** — Preventing injection of unsafe patterns.
11. **Dependency Management** — Evaluating and adding libraries safely.
12. **Version Control Integration** — Generating commits and pull requests.
13. **Human Review Gates** — When the agent must stop and ask for approval.
14. **Code Style Enforcement** — Integrating linters and formatters.
15. **Evaluation Metrics** — Pass rate, correctness, and maintainability scores.

## Demo Outline (10 min)

1. Give the agent a spec: \\\"Write a FastAPI endpoint that accepts a JSON payload, validates it with Pydantic, and stores it in a SQLite database.\\\"
2. Run the generated code. It fails with a missing import.
3. Feed the error back. The agent fixes it.
4. Run tests. One test fails. The agent updates the implementation.

## Challenge (5 min)

> **The Self-Healing Coder:** Build a loop that: (1) sends a spec to an LLM, (2) writes the code to a file, (3) runs a linter, (4) if errors exist, feeds them back to the LLM, (5) repeats until the linter passes or 3 attempts are exhausted.

## Allternit Connection

- **Internal system:** Allternit's internal code-generation agent uses a validator agent for pre-commit review.
- **Reference repo/file:** \\\"agents/coder/spec_to_code.py\\\" (conceptual).
- **Key difference from standard approach:** Allternit never auto-commits AI-generated code. The generation agent produces a branch; a human or validator agent must approve the pull request.
`,
  },
  {
    courseCode: 'ALABS-AGENTS-AGENTS',
    moduleIndex: 4,
    fileName: 'module-05-multi-agent-orchestration.md',
    title: 'Multi-Agent Orchestration',
    content: `# Multi-Agent Orchestration

**Course:** ALABS-AGENTS-AGENTS — Architect Multi-Agent Systems  
**Tier:** AGENTS

## Module Overview

When multiple agents collaborate, someone needs to coordinate them. This module covers orchestration patterns: centralized routers, hierarchical managers, peer-to-peer networks, and auction-based task allocation. You will learn how to design systems where agents delegate, share state, and resolve conflicts.

## Learning Objectives

- [ ] Compare centralized, hierarchical, and peer-to-peer orchestration patterns.
- [ ] Implement a simple router agent that delegates tasks to specialist agents.
[ ] Design a shared state format that all agents can read and write.

## Lecture Guide

**Source:** Original content + CrewAI/LangGraph documentation

1. **The Orchestration Problem** — Coordination vs. autonomy.
2. **Centralized Router** — One agent decides who does what.
3. **Hierarchical Manager** — A supervisor agent coordinates sub-teams.
4. **Peer-to-Peer** — Agents negotiate and collaborate directly.
5. **Auction-Based Allocation** — Agents bid on tasks based on capability.
6. **Shared State** — Blackboards, message buses, and databases.
7. **Handoff Contracts** — What one agent promises and what the next expects.
8. **Conflict Resolution** — Voting, precedence rules, and human escalation.
9. **Parallel Execution** — Running independent agents simultaneously.
10. **Synchronization Points** — When agents must wait for each other.
11. **Fault Tolerance** — Handling agent crashes and timeouts.
12. **Dynamic Replanning** — Adjusting the plan when an agent fails.
13. **Observability** — Tracing decisions across the entire agent swarm.
14. **Cost Optimization** — Routing simple tasks to cheaper models.
15. **Emergent Behavior** — When the swarm behaves in unexpected ways.

## Demo Outline (10 min)

1. Build a 3-agent system: Router, Researcher, Writer.
2. The Router receives a topic, delegates research to the Researcher, then hands off to the Writer.
3. Show the event log: who did what, when, and what state was shared.
4. Simulate a failure: the Researcher times out. Show the Router retrying with a fallback.

## Challenge (5 min)

> **The Specialist Router:** Build a router agent with 3 specialist agents (e.g., Math, Creative, Technical). The router analyzes the user query and delegates to the correct specialist. If the specialist's confidence is <0.7, escalate to a human. Log every delegation decision.

## Allternit Connection

- **Internal system:** agui-gateway uses a hierarchical orchestrator with domain specialist agents.
- **Reference repo/file:** \\\"services/orchestrator/router.py\\\" (conceptual).
- **Key difference from standard approach:** Allternit's orchestrator does not assume agents are always available. Every delegation includes a timeout, a retry policy, and a fallback to a simpler agent or a human.
`,
  },

  // ========== ALABS-OPS-RAG Source Modules ==========
  {
    courseCode: 'ALABS-OPS-RAG',
    moduleIndex: 1,
    fileName: 'module-02-rag-architecture.md',
    title: 'RAG Architecture',
    content: `# RAG Architecture

**Course:** ALABS-OPS-RAG — Build Private RAG & Document Intelligence  
**Tier:** OPS

## Module Overview

Retrieval-Augmented Generation (RAG) is the dominant pattern for grounding LLMs in private knowledge. This module covers the RAG pipeline architecture: document ingestion, chunking, embedding, vector storage, retrieval, and generation. We focus on local-first implementations using open-source tools.

## Learning Objectives

- [ ] Diagram the complete RAG pipeline and explain each stage's purpose.
- [ ] Implement document chunking strategies that preserve semantic boundaries.
- [ ] Compare dense retrieval (embeddings) with sparse retrieval (BM25, keywords).

## Lecture Guide

**Source:** LLMWare documentation + local-first RAG tutorials

1. **What is RAG?** — Combining retrieval with language generation.
2. **Document Ingestion** — PDFs, Markdown, HTML, and structured files.
3. **Preprocessing** — Cleaning text, removing boilerplate, and normalization.
4. **Chunking Strategies** — Fixed-size, semantic, and hierarchical chunking.
5. **Chunk Overlap** — Balancing context loss with redundancy.
6. **Embedding Models** — Sentence transformers and local embedding options.
7. **Vector Databases** — Chroma, FAISS, Weaviate, and LanceDB.
8. **Dense Retrieval** — Similarity search in embedding space.
9. **Sparse Retrieval** — Keyword-based methods and hybrid search.
10. **Re-ranking** — Improving retrieval quality with cross-encoders.
11. **Context Injection** — Formatting retrieved chunks for the LLM prompt.
12. **Generation Parameters** — Temperature, max tokens, and system prompts.
13. **Citation** — Mapping generated claims back to source chunks.
14. **Evaluation** — Measuring retrieval accuracy and answer relevance.
15. **Scaling Considerations** — Indexing millions of documents locally.

## Demo Outline (10 min)

1. Load a PDF with a local Python script.
2. Chunk it, embed it with a local sentence-transformer model, and store in Chroma.
3. Ask a question. Retrieve top-3 chunks and generate an answer using a local LLM.
4. Show the citations mapping the answer back to PDF pages.

## Challenge (5 min)

> **The Local Indexer:** Build a script that takes a folder of text files, chunks them, embeds them with a local model, and stores them in a FAISS index. Query the index and print the top-3 most relevant chunks for a given question.

## Allternit Connection

- **Internal system:** mcp-apps-adapter hosts a local RAG index over internal documentation.
- **Reference repo/file:** \\\"services/rag-indexer/local_pipeline.py\\\"
- **Key difference from standard approach:** Allternit uses a hybrid retrieval strategy: dense embeddings for semantic similarity, plus BM25 for exact keyword matching. This improves recall on technical terms and product names.
`,
  },
  {
    courseCode: 'ALABS-OPS-RAG',
    moduleIndex: 2,
    fileName: 'module-03-local-llm-inference.md',
    title: 'Local LLM Inference',
    content: `# Local LLM Inference

**Course:** ALABS-OPS-RAG — Build Private RAG & Document Intelligence  
**Tier:** OPS

## Module Overview

Cloud LLMs are powerful but come with privacy risks and latency costs. This module covers how to run language models entirely on local hardware: llama.cpp, Ollama, LM Studio, and llamafile. You will learn model selection, quantization trade-offs, and how to serve a local API that replaces OpenAI in your RAG pipeline.

## Learning Objectives

- [ ] Run a 7B parameter model locally with acceptable inference speed.
- [ ] Explain quantization (Q4_K_M, Q5_K_M, Q8_0) and its impact on quality vs. speed.
- [ ] Expose a local LLM via an OpenAI-compatible API for drop-in replacement.

## Lecture Guide

**Source:** Ollama docs + LM Studio guides + local LLM community resources

1. **Why Local?** — Privacy, cost, latency, and offline access.
2. **Hardware Requirements** — RAM, GPU, and disk space for local models.
3. **Model Families** — Llama, Mistral, Qwen, and Phi.
4. **Quantization Explained** — 4-bit, 5-bit, and 8-bit compression.
5. **Ollama** — The easiest way to run local models.
6. **llama.cpp** — The engine under most local inference tools.
7. **LM Studio** — GUI-based local model management.
8. **llamafile** — Single-file executable models.
9. **OpenAI-Compatible APIs** — Using /v1/chat/completions locally.
10. **Context Windows** — How much text a local model can process.
11. **Inference Speed** — Tokens per second on CPU vs. GPU vs. Apple Silicon.
12. **Model Selection** — Matching model size to hardware constraints.
13. **Fine-Tuning vs. RAG** — When to train and when to retrieve.
14. **Multi-Model Setups** — Using small models for routing and large models for generation.
15. **Production Deployment** — Dockerizing local inference servers.

## Demo Outline (10 min)

1. Install Ollama and pull a 7B model (e.g., llama3.1 or mistral).
2. Run inference locally. Measure tokens/second.
3. Show the OpenAI-compatible endpoint: curl http://localhost:11434/v1/chat/completions
4. Swap the OpenAI client in a Python script for the local endpoint. Run a RAG query with zero cloud calls.

## Challenge (5 min)

> **The Offline Swap:** Take any Python script that uses the OpenAI API. Modify it to call a local Ollama endpoint instead. Run it successfully with Wi-Fi disabled.

## Allternit Connection

- **Internal system:** Allternit's field deployments use local LLMs for fully offline RAG.
- **Reference repo/file:** \\\"infra/docker/ollama/\\\" in the DevOps repo.
- **Key difference from standard approach:** Allternit maintains a curated model registry. Only models that pass accuracy benchmarks on internal tasks are approved for production use.
`,
  },
  {
    courseCode: 'ALABS-OPS-RAG',
    moduleIndex: 3,
    fileName: 'module-04-semantic-search-implementation.md',
    title: 'Semantic Search Implementation',
    content: `# Semantic Search Implementation

**Course:** ALABS-OPS-RAG — Build Private RAG & Document Intelligence  
**Tier:** OPS

## Module Overview

Semantic search is the retrieval engine of RAG. This module dives deep into embedding-based search: how to generate embeddings, index them efficiently, and query them at scale. You will implement semantic search with local vector stores and learn how to optimize recall and relevance.

## Learning Objectives

- [ ] Implement a semantic search pipeline with a local embedding model and vector store.
- [ ] Tune retrieval parameters: top-k, similarity threshold, and chunk size.
- [ ] Evaluate search quality with precision@k and mean reciprocal rank (MRR).

## Lecture Guide

**Source:** Chroma docs + FAISS docs + sentence-transformers documentation

1. **What is Semantic Search?** — Meaning-based retrieval vs. keyword matching.
2. **Embedding Models** — all-MiniLM, mpnet, and domain-specific encoders.
3. **Vector Stores** — Chroma, FAISS, Weaviate, and LanceDB compared.
4. **Indexing Documents** — From raw text to vector embeddings.
5. **Similarity Metrics** — Cosine, dot product, and Euclidean distance.
6. **Query Embeddings** — Converting questions into the same vector space.
7. **Top-K Retrieval** — Selecting the right number of chunks.
8. **Similarity Thresholds** — Filtering out irrelevant results.
9. **Metadata Filtering** — Combining vector search with structured filters.
10. **Hybrid Search** — Merging dense and sparse retrieval scores.
11. **Re-ranking** — Using a second model to improve result ordering.
12. **Chunk Size Impact** — How chunk length affects embedding quality.
13. **Multi-Query Retrieval** — Generating variations of the query for better recall.
14. **Index Updates** — Adding, deleting, and updating documents without rebuilding.
15. **Evaluation Datasets** — Creating ground-truth Q&A pairs for benchmarking.

## Demo Outline (10 min)

1. Index 50 PDF pages into Chroma with a local embedding model.
2. Query with a natural language question. Show the top-5 retrieved chunks.
3. Adjust the chunk size and re-index. Compare retrieval quality.
4. Add a metadata filter: only search documents tagged \\\"architecture.\\\"

## Challenge (5 min)

> **The Search Benchmark:** Create 10 question-answer pairs from a document you index. Test semantic search with two different chunk sizes (200 and 500 tokens). Score how many times the correct chunk appears in the top-3 results. Report which chunk size wins and why.

## Allternit Connection

- **Internal system:** mcp-apps-adapter uses Chroma for semantic search over internal docs.
- **Reference repo/file:** \\\"services/rag-indexer/semantic_search.py\\\"
- **Key difference from standard approach:** Allternit re-ranks initial semantic search results with a lightweight cross-encoder before sending the top chunks to the LLM. This improves answer quality with minimal latency cost.
`,
  },

  // ========== ALABS-OPS-VISION Source Modules ==========
  {
    courseCode: 'ALABS-OPS-VISION',
    moduleIndex: 1,
    fileName: 'module-02-opencv-python-foundations.md',
    title: 'OpenCV + Python Foundations',
    content: `# OpenCV + Python Foundations

**Course:** ALABS-OPS-VISION — Computer Vision for AI Systems  
**Tier:** OPS

## Module Overview

OpenCV is the foundational library for computer vision. This module covers the essential OpenCV operations in Python: image loading, color spaces, geometric transformations, drawing, and basic filtering. These skills form the preprocessing layer for any vision-powered agent system.

## Learning Objectives

- [ ] Load, display, and save images and video streams with OpenCV.
- [ ] Convert between color spaces (BGR, RGB, Grayscale, HSV) and explain when to use each.
- [ ] Apply geometric transformations and basic filters (blur, threshold, edge detection).

## Lecture Guide

**Source:** OpenCV official documentation (docs.opencv.org) + free PyImageSearch guides

1. **Installing OpenCV** — pip install opencv-python and opencv-python-headless.
2. **Reading Images** — cv2.imread, understanding BGR vs. RGB.
3. **Displaying Images** — cv2.imshow and headless alternatives (matplotlib).
4. **Saving Images** — cv2.imwrite and format options.
5. **Color Spaces** — BGR, RGB, Grayscale, and HSV conversions.
6. **Image Properties** — Shape, size, dtype, and pixel access.
7. **Drawing** — Lines, rectangles, circles, and text overlays.
8. **Geometric Transformations** — Resize, rotate, translate, and affine transforms.
9. **Image Arithmetic** — Blending, masking, and bitwise operations.
10. **Smoothing & Blurring** — Gaussian, median, and bilateral filters.
11. **Thresholding** — Binary, adaptive, and Otsu thresholding.
12. **Edge Detection** — Sobel, Laplacian, and Canny edges.
13. **Contours** — Finding and drawing boundaries.
14. **Video Basics** — Reading from webcam and video files.
15. **Performance Tips** — NumPy vectorization and GPU acceleration.

## Demo Outline (10 min)

1. Load an image with OpenCV. Convert it to grayscale and HSV.
2. Apply Gaussian blur and Canny edge detection.
3. Find contours and draw bounding boxes around detected regions.
4. Save the annotated image.

## Challenge (5 min)

> **The Preprocessor:** Write a Python script that takes an image, converts it to grayscale, applies adaptive thresholding, finds contours, and draws red bounding boxes around every contour with an area > 1000 pixels. Save the result.

## Allternit Connection

- **Internal system:** Allternit's vision preprocessor uses OpenCV for every screen capture pipeline.
- **Reference repo/file:** OpenCV official docs: docs.opencv.org
- **Key difference from standard approach:** Allternit runs OpenCV operations on the CPU to minimize dependency complexity. Only heavy inference (e.g., YOLO) is offloaded to GPU if available.
`,
  },
  {
    courseCode: 'ALABS-OPS-VISION',
    moduleIndex: 2,
    fileName: 'module-03-feature-detection-tracking.md',
    title: 'Feature Detection & Tracking',
    content: `# Feature Detection & Tracking

**Course:** ALABS-OPS-VISION — Computer Vision for AI Systems  
**Tier:** OPS

## Module Overview

Features are the salient points in an image that computers can track and match across frames. This module covers classical feature detection (Harris, SIFT, ORB) and object tracking (optical flow, Kalman filters). These techniques are essential for agents that need to monitor changes in visual scenes over time.

## Learning Objectives

- [ ] Detect and describe image features using SIFT and ORB.
[ ] Match features between two images to find correspondences.
[ ] Implement basic object tracking using optical flow and contour tracking.

## Lecture Guide

**Source:** OpenCV official documentation + free computer vision tutorials

1. **What are Features?** — Corners, edges, blobs, and regions of interest.
2. **Harris Corner Detection** — Finding corner points in images.
3. **Shi-Tomasi Corners** — An improved corner detection algorithm.
4. **SIFT** — Scale-Invariant Feature Transform for robust matching.
5. **SURF & ORB** — Faster alternatives to SIFT.
6. **Feature Descriptors** — Representing local patches as vectors.
7. **Feature Matching** — Brute-force and FLANN-based matchers.
8. **Homography** — Finding perspective transforms from feature matches.
9. **Optical Flow** — Tracking pixel movement between frames.
10. **Lucas-Kanade Method** — Sparse optical flow for point tracking.
11. **Dense Optical Flow** — Motion estimation for every pixel.
12. **Object Tracking** — Mean-shift and CAM-shift algorithms.
13. **Background Subtraction** — Detecting moving objects in video.
14. **Multi-Object Tracking** — Assigning detections to tracks over time.
15. **Real-Time Considerations** — Balancing accuracy and frame rate.

## Demo Outline (10 min)

1. Detect ORB features in two images of the same object from different angles.
2. Match the features and draw correspondences.
3. Use optical flow to track a moving object across a short video clip.

## Challenge (5 min)

> **The Feature Matcher:** Write a script that loads two images, detects ORB features in both, matches them using a brute-force matcher, and draws the top 10 matches. Save the output image.

## Allternit Connection

- **Internal system:** Allternit's screen-state analyzer uses feature detection to identify persistent UI elements across frame captures.
- **Reference repo/file:** OpenCV docs on feature detection and optical flow.
- **Key difference from standard approach:** Allternit prefers ORB over SIFT for UI analysis because it is patent-free and fast enough for real-time screen capture at 30 FPS.
`,
  },
  {
    courseCode: 'ALABS-OPS-VISION',
    moduleIndex: 3,
    fileName: 'module-04-face-object-detection-with-deep-learning.md',
    title: 'Face & Object Detection with Deep Learning',
    content: `# Face & Object Detection with Deep Learning

**Course:** ALABS-OPS-VISION — Computer Vision for AI Systems  
**Tier:** OPS

## Module Overview

Classical computer vision is fast and interpretable, but deep learning excels at complex detection tasks. This module introduces pre-trained neural networks for face and object detection: Haar cascades, HOG+SVM, and modern detectors like YOLO and MediaPipe. You will learn when to use classical methods, when to use deep learning, and how to run detectors locally.

## Learning Objectives

- [ ] Detect faces in images using Haar cascades and DNN-based methods.
[ ] Run a pre-trained YOLO model locally for general object detection.
[ ] Compare classical CV speed vs. deep learning accuracy for agent use cases.

## Lecture Guide

**Source:** OpenCV DNN module docs + YOLO documentation + MediaPipe docs

1. **Face Detection History** — From Viola-Jones to deep neural nets.
2. **Haar Cascades** — Fast, lightweight face detection in OpenCV.
3. **HOG + SVM** — Histogram of Oriented Gradients for pedestrian detection.
4. **DNN Face Detectors** — OpenCV's face_detector model (Caffe/TensorFlow).
5. **MediaPipe** — Google's lightweight face and hand tracking.
6. **Object Detection Basics** — Bounding boxes, confidence scores, and NMS.
7. **YOLO Family** — YOLOv5, v8, and v9 for real-time detection.
8. **Running YOLO with OpenCV** — Loading Darknet/ONNX models in cv2.dnn.
9. **Label Parsing** — Mapping class IDs to human-readable names.
10. **Non-Max Suppression** — Filtering overlapping detections.
11. **Performance Optimization** — Quantization and inference engines.
12. **Custom Classes** — Fine-tuning detectors on domain-specific data.
13. **Tracking + Detection** — Combining YOLO with SORT/DeepSORT trackers.
14. **Ethical Considerations** — Privacy, bias, and consent in face detection.
15. **Agent Integration** — Feeding detection results into LLM prompts.

## Demo Outline (10 min)

1. Run OpenCV's DNN face detector on a webcam feed. Draw bounding boxes and confidence scores.
2. Switch to a local YOLO model. Detect common objects (chair, phone, person).
3. Compare frames-per-second between the Haar cascade and the DNN detector.

## Challenge (5 min)

> **The Object Counter:** Write a script that uses a local YOLO or MobileNet model to detect and count the number of people in a video file. Output the count per frame and the total unique appearances.

## Allternit Connection

- **Internal system:** Allternit's GUI automation uses lightweight object detection to identify buttons and form fields.
- **Reference repo/file:** OpenCV DNN module examples.
- **Key difference from standard approach:** Allternit runs all vision models locally. No video frames or screenshots are sent to cloud vision APIs for detection tasks.
`,
  },
];

async function main() {
  for (const mod of sourceModules) {
    const dir = path.join(BASE_DIR, mod.courseCode);
    const filePath = path.join(dir, mod.fileName);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, mod.content);
    console.log(`Wrote ${mod.courseCode}/${mod.fileName} (${Buffer.byteLength(mod.content)} bytes)`);
  }
}

main().catch(console.error);
