# Comprehensive Gap List: Allternit vs Anthropic Platform Docs

**Date:** 2026-08-07  
**Anthropic docs analyzed:** 553 English pages, 5,359 feature headings  
**Allternit platform audited:** `~/Desktop/allternit-workspace/allternit-session-7d581442-d796-4e0e-bdac-2fec641c3677/`

This list covers every significant capability described in Anthropic's docs that Allternit does **not** currently have or has only partially.

---

## 1. API Surface Gaps

### Messages API capabilities
- **Citations** — Native document citations with `citations` enabled
- **Prompt caching** — `cache_control` blocks for long-context cost reduction
- **Cache diagnostics** — Cache hit/miss metrics and debugging
- **Extended thinking / reasoning** — Claude reasoning models with thinking budget
- **Thinking mode controls** — `thinking.type`, `thinking.budget_tokens`
- **Batch Messages API** — Async batch processing of message requests
- **Message Batches API error handling** — Batch-level error semantics
- **Structured outputs** — JSON schema-constrained generation (`response_format`)
- **Computer use** — Native computer-use tool (Allternit has capability but not Claude-native integration)
- **Function calling** — Anthropic's native function-calling format
- **Tool use with images** — Multimodal tool inputs
- **Tool result formatting** — Specific tool result content block types
- **Vision / image understanding** — Native image content blocks (Allternit has vision via providers)
- **PDF support in messages** — Native PDF document input
- **Long-context window optimizations** — Beyond basic context length
- **Streaming event types** — `content_block_delta`, `thinking_delta`, `signature_delta`
- **Stop reason handling** — `stop_reason` taxonomy and handling guide
- **Max tokens / output limits per model** — Model-specific output limits
- **System prompt caching** — Cache system prompts across turns
- **Ephemeral cache control** — One-shot cache blocks

### Admin API
- **List organization members** — Admin member management API
- **Update member role** — Role assignment API
- **Get member details** — Per-member metadata
- **Remove organization member** — Member deletion
- **Create SCIM user** — SCIM provisioning
- **Update SCIM user** — SCIM user updates
- **Delete SCIM user** — SCIM deprovisioning
- **List SCIM groups** — Group management
- **Analytics: Get Artifact Activity** — Artifact usage analytics
- **Analytics: Get Chat Project Usage** — Project-level chat usage
- **Analytics: Get Connector Usage** — Connector usage metrics
- **Analytics: Get Cost Over Time** — Time-series cost data
- **Analytics: Get Per-User Cost** — User-level cost attribution
- **Analytics: Get Plugin Usage** — Plugin usage analytics
- **Analytics: Get Active Users** — DAU/MAU metrics
- **Analytics: Get Token Usage** — Token consumption metrics
- **Analytics: Get Request Volume** — Request count metrics
- **Admin API keys** — Programmatic admin key management

### Compliance API
- **Get Compliance Artifact** — Retrieve compliance artifacts
- **List Compliance Artifacts** — Artifact listing
- **Get Compliance Organization Data** — Org compliance data
- **Get Compliance Content Data** — Content-level compliance data
- **List Compliance Organizations** — Organization enumeration
- **Compliance code artifacts** — Code-specific compliance records
- **Compliance artifact versions** — Versioned artifact retrieval

### Beta APIs
- **Sessions API** — Multi-turn session management
- **Session events stream** — Streaming session events
- **Session memory stores** — Persistent session memory
- **Deployments API** — Deploy model deployments
- **Deployments archive** — Deployment lifecycle
- **Memory stores beta** — External memory store integration
- **Advisor tool beta** — Advisory tool for coding
- **Token counting API** — Token count endpoint

### Other API features
- **Rate limits API** — Programmatic rate limit queries
- **API key management API** — Create/delete/revoke keys
- **Authentication methods** — OAuth, JWT, API key patterns
- **API retries and idempotency** — Idempotency key support
- **Error code taxonomy** — Structured error codes
- **Webhooks** — Event delivery (Allternit may have partial)
- **Request signing** — Signed requests
- **Streaming timeout behavior** — Documented streaming semantics
- **Max retries and backoff** — Client retry guidance

---

## 2. Build with Claude Gaps

### Model behavior and controls
- **Effort parameter** — Control reasoning effort (`low`/`medium`/`high`)
- **Mid-conversation effort changes** — Change effort mid-chat
- **Compaction** — Automatic context compaction block
- **Context editing** — Edit the model's context window
- **Contextual embedding** — Use embeddings for context retrieval
- **Custom routes** — Route requests to specific model variants
- **Handling stop reasons** — Comprehensive stop reason guide
- **Refusals and fallback** — Handle refusals gracefully
- **Fallback credit** — Automatic model fallback

### Output and generation features
- **Citations** — Generate source citations
- **Structured outputs** — JSON mode / JSON schema
- **JSON mode** — Force JSON output
- **Function calling** — Native function calling patterns
- **Tool use** — Anthropic tool-use patterns
- **Text and code generation** — Best practices
- **Streaming** — Streaming implementation patterns
- **Streaming refusals** — Handle refusal streams
- **Long document content** — Long doc input patterns

### Multimodal
- **Images** — Image input best practices
- **Vision** — Vision capabilities guide
- **PDFs** — PDF input handling
- **Computer use** — Computer-use integration

### RAG and search
- **Retrieval & search** — RAG patterns
- **Search results tool** — Anthropic search tool
- **Web search tool** — Built-in web search
- **Long-context retrieval** — Retrieve from long docs

### Prompt engineering
- **Prompt engineering guide** — Comprehensive prompting guide
- **Prompting Claude Opus 4.8** — Model-specific prompts
- **System prompts** — System prompt design
- **Roles and personas** — Persona design
- **Few-shot prompting** — Example-based prompting
- **Chain of thought** — Reasoning prompts

### Cloud integrations
- **Claude in Amazon Bedrock** — AWS Bedrock integration
- **Claude in Microsoft Foundry** — Azure Foundry integration
- **Claude on Google Cloud / Vertex AI** — GCP integration
- **Claude Platform on AWS** — Dedicated AWS deployment
- **Claude on Amazon Bedrock legacy** — Legacy Bedrock support

### Other build features
- **Batch processing** — Batch API usage
- **Cache diagnostics** — Cache debugging
- **Prompt caching guide** — Prompt caching patterns
- **Embeddings** — Embedding model usage
- **Migration guide** — Claude 3→4 migration
- **Model deprecations** — Deprecation notices
- **Model IDs and versioning** — Model ID scheme
- **Choosing a model** — Model selection guide

---

## 3. Agents & Tools Gaps

### Agent Skills
- **Anthropic-managed Agent Skills** — PowerPoint, PDF, etc.
- **PDF processing skill** — Native PDF extraction skill
- **PowerPoint skill** — PowerPoint creation/editing skill
- **Claude API skill** — Skill for Claude API calls
- **Skill authoring best practices** — Anthropic skill framework
- **Skills for enterprise** — Enterprise skill deployment
- **List Anthropic-managed Skills** — Skill marketplace
- **Create a message with the PowerPoint Skill** — Skill invocation

### MCP
- **MCP connector** — Model Context Protocol connector
- **MCP tunnels** — Remote MCP server tunnels
- **Deploy MCP tunnels with Docker Compose** — Tunnel deployment
- **Deploy MCP tunnels with Helm** — K8s tunnel deployment
- **Manage tunnels in the Console** — Tunnel management UI
- **Architecture and components** — MCP tunnel architecture
- **MCP tunnel security** — Tunnel security model
- **MCP connector as content block** — Message-based MCP invocation
- **MCP connector as file upload** — File-based MCP invocation

### Tools
- **Advisor tool** — Coding advisor tool
- **Text editor tool** — Native text editor tool
- **Web search tool** — Built-in web search
- **Memory tool** — Tool for agent memory
- **Manage tool context** — Tool context management
- **Tool combinations** — Multi-tool orchestration
- **Tool use with prompt caching** — Cached tool prompts
- **Server tools** — Server-side tool execution
- **How tool use works** — Anthropic tool-use mechanics
- **Tool use with streaming** — Streaming tool calls

---

## 4. Managed Agents Gaps

### Agent definition and setup
- **Define your agent** — Agent definition framework
- **Agent setup** — Managed agent setup
- **Define outcomes** — Outcome specification
- **Outcome rubrics** — Evaluation rubrics for agents
- **Tips for writing effective rubrics** — Rubric authoring
- **DCF Model Rubric example** — Example rubric

### Runtime and execution
- **Cloud sandboxes** — Managed cloud sandbox environments
- **Cloud environment setup** — Sandbox provisioning
- **Session event stream** — Real-time agent session events
- **Session operations** — Session lifecycle management
- **Dreams** — Memory reconstruction / dream sessions

### Integrations
- **GitHub access** — Managed GitHub integration
- **MCP connector for managed agents** — MCP in managed agents
- **Agent memory** — Persistent agent memory

### Files and artifacts
- **Adding files** — File attachment to sessions
- **List files associated with a session** — Session file listing
- **Download a file** — File download from session

### Governance
- **Permission policies** — Agent permission policies
- **Agent quickstart** — Managed agent quickstart

---

## 5. Manage Claude Gaps

### Authentication and access
- **Authentication** — Auth patterns
- **Admin API keys** — Admin key management
- **App Attest for iOS and macOS apps** — Device attestation
- **Workforce Identity Federation (WIF)** — WIF overview
- **WIF providers: AWS** — AWS WIF
- **WIF providers: Azure** — Azure WIF
- **WIF providers: GCP** — Google WIF
- **WIF admin API** — WIF management API

### Security and compliance
- **Access Transparency** — Admin access logging
- **API and data retention** — Data retention policies
- **Configure AWS KMS for CMEK** — Customer-managed keys on AWS
- **Configure Azure Key Vault for CMEK** — Customer-managed keys on Azure
- **Data residency** — Data residency controls
- **Compliance API** — Compliance data API
- **Compliance org data** — Organization compliance data
- **Compliance content data** — Content compliance data
- **Compliance API access** — Compliance API access control

### Analytics and administration
- **Admin API** — Organization admin API
- **Analytics APIs** — Usage analytics APIs
- **Claude Code Analytics API** — Claude Code usage analytics
- **Rate limits API** — Programmatic rate limits
- **Create an Admin API key** — Admin key creation

### Other management
- **Inference hooks** — Inference hook system
- **Organization member management** — Member CRUD
- **SCIM provisioning** — SCIM user provisioning
- **Audit logs** — Security audit logs

---

## 6. CLI, SDKs, and Libraries Gaps

### CLI
- **Anthropic CLI** — Official command-line interface
- **CLI authentication options** — CLI auth methods
- **CLI quickstart** — Getting started with CLI
- **CLI scripting and automation** — CLI scripting
- **Using the CLI** — CLI usage guide

### SDKs
- **Anthropic Python SDK** — Official Python SDK
- **Anthropic TypeScript SDK** — Official TypeScript SDK
- **Java SDK** — Java SDK
- **Go SDK** — Go SDK
- **C# SDK** — C# SDK
- **SDK middleware** — Middleware patterns

### Compatibility
- **OpenAI SDK compatibility** — Drop-in OpenAI SDK replacement
- **Apple Foundation Models** — Apple Silicon local models

---

## 7. Test and Evaluate Gaps

- **Define success criteria and build evaluations** — Evaluation framework
- **Develop tests** — Test development guide
- **Handle streaming refusals** — Refusal handling in streams
- **Increase output consistency** — Consistency techniques
- **Mitigate jailbreaks and prompt injections** — Security hardening
- **Reduce hallucinations** — Hallucination mitigation
- **Reducing latency** — Latency optimization
- **Reduce prompt leak** — Prompt leak prevention
- **Example metrics and measurement methods** — Evaluation metrics
- **Example task fidelity criteria** — Fidelity criteria examples

---

## 8. About Claude / Model Gaps

- **Claude model family** — Opus, Sonnet, Haiku, Fable, Mythos
- **Claude Opus 5** — Latest Opus model
- **Claude Sonnet 5** — Latest Sonnet model
- **Claude Haiku 4.5** — Latest Haiku model
- **Claude Fable 5** — Fable model
- **Claude Mythos 5** — Mythos model
- **What's new in Claude Opus 5** — Opus 5 features
- **What's new in Claude Sonnet 5** — Sonnet 5 features
- **Model IDs and versioning** — Anthropic model ID scheme
- **Migration guide** — Migrating between Claude versions
- **Model deprecations** — Model deprecation notices
- **Choosing the right model** — Model selection guide
- **Pricing** — Claude pricing model
- **Glossary** — Claude terminology

---

## 9. Release Notes / Resources Gaps

- **Claude Platform release notes** — Official release notes
- **System Prompts** — System prompt changelogs
- **Resources overview** — Resource library

---

## Summary Count

| Category | Gap Count |
|---|---|
| API Surface | ~75 |
| Build with Claude | ~50 |
| Agents & Tools | ~35 |
| Managed Agents | ~20 |
| Manage Claude | ~35 |
| CLI, SDKs, Libraries | ~15 |
| Test and Evaluate | ~10 |
| About Claude / Models | ~15 |
| Release Notes / Resources | ~3 |
| **Total distinct gaps** | **~260** |

---

## Files

- This report: `~/Desktop/anthropic-docs/all_gaps_comprehensive.md`
- Anthropic catalog: `~/Desktop/anthropic-docs/anthropic_catalog.json`
- Machine-classified gaps: `~/Desktop/anthropic-docs/all_gaps_v2.json`
