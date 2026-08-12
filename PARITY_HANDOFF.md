# Allternit Parity Swarm Handoff

**Date:** 2026-08-09
**Canonical repo:** `/Users/joe/Desktop/allternit-workspace/allternit`
**Worktree (do all work here):** `/Users/joe/Desktop/allternit-parity-workspace`
**Branch:** `parity/swarm-sprint`
**Handoff doc:** `/Users/joe/Desktop/allternit-parity-handoff.md`

## Swarm assignments

| Swarm | Focus | Lead competencies |
|---|---|---|
| **Swarm A** | Core API / Harness / Meter / Batch / Files | Rust, API gateway, provider adapters |
| **Swarm B** | Agent Runtime / Memory / Sessions / Threads | Rust/TS, distributed systems, event streaming |
| **Swarm C** | Tools / Sandbox / MCP / Search / ACI | Rust/TS, WebVM, browser automation, security |
| **Swarm D** | gizzi-code / IDE / SDKs / surfaces | TypeScript, Python, CLI, editor extensions |
| **Swarm E** | Enterprise / Admin / Vault / Budgets / Compliance | Rust, auth, RBAC, audit, infra |

## Rules for this doc
- Check a box only when the item is implemented, tested, and committed to `parity/swarm-sprint`.
- If an item is not applicable, strike it through and note why.
- Update the **Status** column in the top summary when major sections complete.
- Do not edit the canonical repo directly. Merge back only through PR from `parity/swarm-sprint`.

## Overall status

| Phase | Status | % Done |
|---|---|---|
| Phase 0 — Core request/response parity | Not started | 0% |
| Phase 1 — Agent runtime & tools | Not started | 0% |
| Phase 2 — User surfaces & distribution | Not started | 0% |
| Phase 3 — Enterprise control plane | Not started | 0% |
| Phase 4 — Docs / GTM | Not started | 0% |

## Anthropic parity tasks

Source: `/Users/joe/Desktop/anthropic-docs/gap_implementation_plan.md`

### Quick Wins (Can ship in days)

- [ ] **Prompt caching (`cache_control`)** — PARTIAL | Equivalent: `AllternitHarness` Anthropic provider | Path: Add `cacheControl` field to message blocks; pass through to Anthropic SDK; add equivalent for OpenAI cached tokens | Effort: S | Priority: P0
  - Consensus: All audits agree. Table-stakes for cost/latency.
- [ ] **Extended thinking / reasoning** — MISSING | Equivalent: `AllternitHarness` model params | Path: Add `thinking`/`reasoning_effort` parameter; map per-provider (Anthropic `thinking`, OpenAI `reasoning_effort`, etc.) | Effort: S | Priority: P0
  - Consensus: All audits agree.
- [ ] **Effort parameter** — MISSING | Equivalent: Model request options | Path: Add `effort` enum to `StreamRequest`; provider-specific mapping | Effort: S | Priority: P0
  - Consensus: All audits agree.
- [ ] **Structured outputs / JSON schema** — PARTIAL | Equivalent: Tool Registry schemas / `response_format` | Path: Add native `response_format: { type: 'json_schema', schema: ... }` across providers | Effort: S | Priority: P0
  - Consensus: All audits agree.
- [ ] **Stop reason taxonomy** — PARTIAL | Equivalent: Agent run events | Path: Standardize stop reasons in `AllternitAgent` events (end_turn, max_tokens, stop_sequence, tool_use, pause_turn, refusal) | Effort: S | Priority: P0
  - Consensus: Added refusal/pause_turn from agent audits.
- [ ] **Streaming event types** — PARTIAL | Equivalent: `HarnessStreamChunk` | Path: Add `thinking_delta`, `signature_delta`, `content_block_delta`, `citation_delta` events | Effort: S | Priority: P0
  - Consensus: Added citation_delta from agent audits.
- [ ] **System prompt caching** — PARTIAL | Equivalent: `injectSystemPrompt` | Path: Add `cache_control` to system blocks; support cached system prompts | Effort: S | Priority: P0
  - Consensus: All audits agree.
- [ ] **Idempotency keys** — MISSING | Equivalent: API gateway | Path: Add `Idempotency-Key` header support in `allternit-api` and gateway | Effort: S | Priority: P0
  - Consensus: All audits agree.
- [ ] **Retry/backoff guidance** — PARTIAL | Equivalent: SDK client | Path: Add built-in retry interceptor with exponential backoff and jitter | Effort: S | Priority: P0
  - Consensus: All audits agree.
- [ ] **Native function calling format** — PARTIAL | Equivalent: Tool Registry | Path: Add Anthropic-compatible `functions` array output format | Effort: S | Priority: P0
  - Consensus: All audits agree.
- [ ] **Model-specific output limits** — MISSING | Equivalent: Provider registry | Path: Add per-model `maxOutputTokens` and context-window metadata to provider registry | Effort: XS | Priority: P0
  - Consensus: Agent audits identified this as missing.
- [ ] **Task budgets** — MISSING | Equivalent: No equivalent | Path: Add token/turn/tool-call budget controls for autonomous loops | Effort: S | Priority: P0
  - Consensus: Agent audits identified this as missing and urgent.
- [ ] **Admin API keys** — MISSING | Equivalent: No equivalent | Path: Add admin-scoped API keys with RBAC in `allternit-api` | Effort: S | Priority: P1
  - Consensus: All audits agree.
- [ ] **Rate limits API** — PARTIAL | Equivalent: `budgetCalculator` / quotas | Path: Expose `/rate-limits` endpoint from quota service | Effort: S | Priority: P1
  - Consensus: All audits agree.

### SDK & Harness Enhancements (weeks)

- [ ] **Citations** — MISSING | Equivalent: No equivalent | Path: Add `citations` option to Anthropic provider; design provider-agnostic citation object; fallback to RAG-attribution for other providers; support PDF page-level citations | Effort: M | Priority: P0
  - Consensus: All audits agree this is a major enterprise gap.
- [ ] **Batch Messages API** — **MISSING** | Equivalent: Rails batch / workflows | Path: Build `BatchesService` in `allternit-api`; store jobs; poll providers; expose `/v1/batches` with CRUD + results. **Rails batch is task orchestration, not provider-side bulk inference.** | Effort: M | Priority: P0
  - Consensus: **Corrected from PARTIAL.** All agent audits strongly disagreed with original assessment.
- [ ] **Batch error handling** — MISSING | Equivalent: No equivalent | Path: Define batch error schema; add batch retry/cancellation | Effort: S | Priority: P1
  - Consensus: All audits agree.
- [ ] **Token counting API** — MISSING | Equivalent: No equivalent | Path: Add `/v1/tokens` endpoint using provider tokenizers / tiktoken | Effort: S | Priority: P1
  - Consensus: All audits agree.
- [ ] **PDF support in messages** — PARTIAL | Equivalent: Document generator / file uploads | Path: Add PDF content block type (base64/URL/file-ID); extract text/images; pass to providers that support it | Effort: M | Priority: P1
  - Consensus: Agent audits emphasized file-ID support.
- [ ] **Tool use with images** — MISSING | Equivalent: Tool Registry | Path: Extend tool input schema to accept image content blocks | Effort: S | Priority: P1
  - Consensus: All audits agree.
- [ ] **Long-context optimizations / Context editing** — PARTIAL | Equivalent: Memory / compaction | Path: Add context-window management; automatic truncation strategies; server-side context editing | Effort: M | Priority: P1
  - Consensus: Agent audits noted context editing as distinct gap.
- [ ] **Native Computer use tool** — PARTIAL | Equivalent: `computer-use` capability | Path: Align Allternit computer-use tool schema with Anthropic's `computer_20250124` | Effort: M | Priority: P1
  - Consensus: All audits agree.
- [ ] **Vision input / Vision coordinates** — PARTIAL | Equivalent: Vision service | Path: Add vision content block normalization across providers; support model-returned pointing coordinates | Effort: S | Priority: P1
  - Consensus: Agent audits added vision coordinates.
- [ ] **Embeddings model usage** — PARTIAL | Equivalent: Via providers (OpenAI, etc.) | Path: Add `AllternitEmbeddings` harness method with provider fallback | Effort: S | Priority: P1
  - Consensus: All audits agree.
- [ ] **Search results content block** — MISSING | Equivalent: No equivalent | Path: Add typed content block for pre-retrieved RAG passages with automatic citation | Effort: M | Priority: P1
  - Consensus: Agent audits identified this as distinct from citations.
- [ ] **Python SDK** — **MISSING** | Equivalent: No Python SDK | Path: Build `@allternit/sdk` Python equivalent; generate from TypeScript or hand-write | Effort: L | Priority: P1
  - Consensus: **Corrected from EXISTS.** This is the largest SDK gap.
- [ ] **Go SDK** — MISSING | Equivalent: No SDK | Path: Generate from OpenAPI spec or build wrapper | Effort: L | Priority: P2
  - Consensus: Agent audits added Go.
- [ ] **Java SDK** — MISSING | Equivalent: No SDK | Path: Generate from OpenAPI spec or build wrapper | Effort: L | Priority: P2
  - Consensus: Agent audits added Java.
- [ ] **C# SDK** — MISSING | Equivalent: No SDK | Path: Generate from OpenAPI spec or build wrapper | Effort: L | Priority: P2
  - Consensus: Agent audits added C#.
- [ ] **PHP SDK** — MISSING | Equivalent: No SDK | Path: Generate from OpenAPI spec or build wrapper | Effort: L | Priority: P2
  - Consensus: Claude audit identified PHP.
- [ ] **Ruby SDK** — MISSING | Equivalent: No SDK | Path: Generate from OpenAPI spec or build wrapper | Effort: L | Priority: P2
  - Consensus: Claude audit identified Ruby.
- [ ] **SDK middleware** — PARTIAL | Equivalent: `@allternit/sdk` interceptors | Path: Formalize middleware hook system incl. refusal-fallback middleware | Effort: S | Priority: P1
  - Consensus: Agent audits emphasized refusal-fallback middleware.
- [ ] **OpenAI SDK compatibility** — PARTIAL | Equivalent: Existing compat layer | Path: Extend OpenAI SDK shim to cover missing endpoints (batches, citations) | Effort: S | Priority: P1
  - Consensus: **Downgraded from P0.** Allternit's multi-provider abstraction already solves migration differently.
- [ ] **Apple Foundation Models** — MISSING | Equivalent: Local runtime / Ollama | Path: Add Apple MLX adapter for local inference | Effort: L | Priority: P2
  - Consensus: Agent audits agree low priority.
- [ ] **Official Anthropic CLI (`ant`)** — PARTIAL | Equivalent: `gizzi-code` / `rails` | Path: Build `allternit` platform resource/admin CLI with auth profiles, workspace binding, headless scripting | Effort: M | Priority: P1
  - Consensus: Agent audits clarified this is not the same as `gizzi-code`/`rails`.

### Agent Runtime & Tools (weeks to months)

- [ ] **Anthropic-managed Agent Skills / SKILL.md format** — PARTIAL | Equivalent: Plugin SDK / skill registry | Path: Build canonical skill library (PDF, PowerPoint, web search); define `SKILL.md` package format with progressive disclosure; package as `@allternit/skills` | Effort: L | Priority: P1
  - Consensus: Agent audits emphasized this is different from plugins.
- [ ] **PDF processing skill** — MISSING | Equivalent: No equivalent | Path: Build `PdfSkill` using pdf-parse + vision; register in skill registry | Effort: M | Priority: P1
  - Consensus: All audits agree.
- [ ] **PowerPoint skill** — MISSING | Equivalent: No equivalent | Path: Build `PowerPointSkill` using pptxgenjs or python-pptx via WebVM | Effort: M | Priority: P1
  - Consensus: All audits agree.
- [ ] **Web search tool** — MISSING | Equivalent: No equivalent | Path: Add `web_search` tool to Native Tool Belt; configurable provider (Tavily/Perplexity/Bing) | Effort: M | Priority: P0
  - Consensus: All audits agree.
- [ ] **Web fetch tool** — MISSING | Equivalent: No equivalent | Path: Add `web_fetch` tool for specific URL content extraction | Effort: M | Priority: P0
  - Consensus: Agent audits identified as distinct from web search.
- [ ] **Code execution tool** — PARTIAL | Equivalent: WebVM / WASM sandbox | Path: Productize WebVM as a containerized code-execution tool with persistent container + file outputs | Effort: L | Priority: P1
  - Consensus: Agent audits identified this as distinct from self-hosted WebVM.
- [ ] **Text editor tool** — PARTIAL | Equivalent: filesystem tools | Path: Add Anthropic-compatible `text_editor_20250124` tool (view/str_replace/insert) | Effort: S | Priority: P1
  - Consensus: All audits agree.
- [ ] **Bash tool** — PARTIAL | Equivalent: WebVM / shell execution | Path: Define model-trained bash execution tool contract | Effort: S | Priority: P1
  - Consensus: Agent audits identified this gap.
- [ ] **Advisor tool** — MISSING | Equivalent: No equivalent | Path: Add coding advisor tool with repo context | Effort: L | Priority: P2
  - Consensus: All audits agree low priority.
- [ ] **Memory tool** — PARTIAL | Equivalent: Agent memory | Path: Add explicit `memory` tool for model-facing read/write memory | Effort: S | Priority: P1
  - Consensus: Agent audits identified this gap.
- [ ] **Strict tool use** — MISSING | Equivalent: Tool Registry | Path: Add grammar-constrained JSON Schema validation for tool inputs | Effort: M | Priority: P2
  - Consensus: Agent audits identified.
- [ ] **Fine-grained tool streaming** — MISSING | Equivalent: Tool Registry | Path: Add incremental JSON streaming per tool call | Effort: M | Priority: P2
  - Consensus: Agent audits identified.
- [ ] **Parallel tool use** — MISSING | Equivalent: Tool Registry | Path: Add parallel tool-call semantics and ordering | Effort: S | Priority: P1
  - Consensus: Agent audits identified.
- [ ] **Programmatic tool calling** — MISSING | Equivalent: Tool Registry / WebVM | Path: Model emits code that invokes tools directly inside sandboxed execution context | Effort: L | Priority: P2
  - Consensus: Claude audit emphasized this as architectural difference.
- [ ] **Tool context management** — PARTIAL | Equivalent: Tool Registry | Path: Add tool context tokens / active tool window; clearing tool results | Effort: M | Priority: P2
  - Consensus: All audits agree.
- [ ] **Tool combinations** — PARTIAL | Equivalent: Workflow engine | Path: Add tool-composition DSL in workflow engine | Effort: M | Priority: P2
  - Consensus: All audits agree.
- [ ] **Tool use with prompt caching** — MISSING | Equivalent: Tool Registry + cache | Path: Enable `cache_control` on tool definitions and results | Effort: S | Priority: P1
  - Consensus: All audits agree.
- [ ] **Server tools** — PARTIAL | Equivalent: Tool Registry | Path: Add server-side tool execution mode (run in WebVM/cloud) | Effort: M | Priority: P1
  - Consensus: All audits agree.
- [ ] **MCP connector** — PARTIAL | Equivalent: MCP crates in `mcp/` | Path: Complete MCP client/server connector; expose via SDK as model-facing tool attachment | Effort: M | Priority: P1
  - Consensus: Agent audits emphasized model-facing attachment.
- [ ] **MCP tunnels** — MISSING | Equivalent: No equivalent | Path: Build MCP tunnel proxy (SSE/WebSocket); Docker Compose + Helm charts; console management; security model; troubleshooting | Effort: L | Priority: P1
  - Consensus: Agent audits said this is a full subsystem, not one row.
- [ ] **MCP tunnel security** — MISSING | Equivalent: Vault | Path: Add mTLS + OAuth for tunnels | Effort: M | Priority: P2
  - Consensus: All audits agree.
- [ ] **Remote MCP servers directory** — MISSING | Equivalent: No equivalent | Path: Add directory/pattern for connecting to third-party hosted MCP servers | Effort: S | Priority: P2
  - Consensus: Agent audits identified.
- [ ] **Define your agent / Agent setup** — PARTIAL | Equivalent: Agent creation checklist | Path: Formalize agent definition schema; UI wizard | Effort: M | Priority: P1
  - Consensus: All audits agree.
- [ ] **Outcome rubrics** — PARTIAL | Equivalent: Rails gates / WIH | Path: Add evaluation rubric DSL; score agent runs against rubrics | Effort: L | Priority: P1
  - Consensus: All audits agree.
- [ ] **Cloud sandboxes** — PARTIAL | Equivalent: WebVM / WASM sandbox | Path: Productize WebVM as managed cloud sandbox with networking; **also usable for self-hosted sandbox product** | Effort: L | Priority: P1
  - Consensus: Reframed for self-host + optional packaging.
- [ ] **Session event stream** — PARTIAL | Equivalent: Agent run events | Path: Standardize SSE/WebSocket event stream for agent sessions; message previews; child threads; user interrupts | Effort: M | Priority: P1
  - Consensus: Agent audits emphasized threads/interrupts.
- [ ] **Dreams** — MISSING | Equivalent: No equivalent | Path: Implement memory reconstruction / dream session replay | Effort: L | Priority: P2
  - Consensus: All audits agree low priority.
- [ ] **Managed GitHub access** — PARTIAL | Equivalent: GitHub integration | Path: Add OAuth GitHub connector for agents | Effort: M | Priority: P1
  - Consensus: All audits agree.
- [ ] **Agent files (add/list/download)** — PARTIAL | Equivalent: File attachments | Path: Add session-scoped file store API | Effort: M | Priority: P1
  - Consensus: All audits agree.
- [ ] **Permission policies** — PARTIAL | Equivalent: Rails gates | Path: Add agent-level permission policy DSL with approval/deny events | Effort: M | Priority: P1
  - Consensus: Agent audits emphasized approval/deny event semantics.
- [ ] **Managed agent quickstart** — MISSING | Equivalent: Docs / onboarding | Path: Build quickstart flow in platform UI | Effort: S | Priority: P1
  - Consensus: All audits agree.

### Managed Agents / Agent-as-a-Service Primitives

- [ ] **Agent definition + versioning** — PARTIAL | Equivalent: Agent creation checklist | Path: Build `beta/agents` CRUD + archive + versions | Effort: M | Priority: P1
  - Consensus: Agent audits identified this as core primitive.
- [ ] **Session lifecycle API** — PARTIAL | Equivalent: Agent storage | Path: Build `beta/sessions` create/list/archive/update; per-session agent overrides; seeded initial events | Effort: M | Priority: P1
  - Consensus: Agent audits emphasized this is missing product surface.
- [ ] **Session Threads** — MISSING | Equivalent: No equivalent | Path: Add child threads with `parent_thread_id` | Effort: S | Priority: P1
  - Consensus: Agent audits identified.
- [ ] **Session Resources** — MISSING | Equivalent: No equivalent | Path: Add session-scoped resources (GitHub tokens, vault credentials) | Effort: M | Priority: P1
  - Consensus: Agent audits identified.
- [ ] **Session event stream** — PARTIAL | Equivalent: Agent run events | Path: Standardize SSE/WebSocket event stream; user interrupt events | Effort: M | Priority: P1
  - Consensus: All audits agree.
- [ ] **Scheduled deployments** — MISSING | Equivalent: No equivalent | Path: Build `beta/deployments` + `deployment_runs` with cron-style runs and history | Effort: L | Priority: P1
  - Consensus: Agent audits identified.
- [ ] **Work queue / Self-hosted sandboxes** — PARTIAL | Equivalent: Rails leases | Path: Document external-facing poll/heartbeat/ack/stop protocol for self-hosted workers | Effort: L | Priority: P1
  - Consensus: Agent audits identified this as distinct from internal Rails leases.
- [ ] **Vaults & Credentials API** — PARTIAL | Equivalent: OAuth Vault | Path: Build `beta/vaults` + `vaults/credentials` scoped per-agent/session with validation | Effort: M | Priority: P1
  - Consensus: Agent audits emphasized per-agent credential API.
- [ ] **Memory Stores API** — PARTIAL | Equivalent: Memory service | Path: Build memory store CRUD + memory versions with redaction | Effort: L | Priority: P1
  - Consensus: Agent audits emphasized redaction.
- [ ] **Dreams API** — MISSING | Equivalent: No equivalent | Path: Build `beta/dreams` memory-reconstruction jobs | Effort: L | Priority: P2
  - Consensus: All audits agree low priority.
- [ ] **Webhooks** — MISSING | Equivalent: No equivalent | Path: Add event push subscriptions for sessions/deployments | Effort: M | Priority: P1
  - Consensus: Agent audits identified as missing.
- [ ] **User Profiles + enrollment URLs** — MISSING | Equivalent: No equivalent | Path: Add end-user identity/consent flows for agents acting on behalf of a human | Effort: M | Priority: P1
  - Consensus: Agent audits identified.
- [ ] **Prototype in Console** — MISSING | Equivalent: No equivalent | Path: Build interactive agent prototyping UI before API promotion | Effort: M | Priority: P2
  - Consensus: Agent audits identified.
- [ ] **Security model documentation** — MISSING | Equivalent: No equivalent | Path: Publish threat model / trust boundary docs for managed agents | Effort: S | Priority: P2
  - Consensus: Agent audits identified docs gap.

### Enterprise Compliance & Admin (months)

- [ ] **Admin API — Workspaces** — MISSING | Equivalent: No equivalent | Path: Add `admin/workspaces` with members and rate limits | Effort: M | Priority: P1
  - Consensus: Agent audits identified as distinct sub-product.
- [ ] **Admin API — RBAC** — MISSING | Equivalent: No equivalent | Path: Add `admin/rbac_groups`, `admin/rbac_roles`, permissions listing, group membership CRUD | Effort: M | Priority: P1
  - Consensus: Agent audits identified.
- [ ] **Admin API — Federation** — MISSING | Equivalent: No equivalent | Path: Add `admin/federation_issuers`, `admin/federation_rules` with workspace scoping | Effort: L | Priority: P1
  - Consensus: Agent audits identified.
- [ ] **Admin API — External Keys** — MISSING | Equivalent: No equivalent | Path: Add BYO cloud KMS key registration at org level (create/list/retrieve/update/delete/validate) | Effort: M | Priority: P1
  - Consensus: Agent audits identified.
- [ ] **Admin API — Service Accounts** — MISSING | Equivalent: No equivalent | Path: Add non-human API identities scoped to workspaces | Effort: M | Priority: P1
  - Consensus: Agent audits identified.
- [ ] **Admin API — Spend Limits** — PARTIAL | Equivalent: `budgetCalculator` | Path: Add spend caps with increase-request approval workflow | Effort: M | Priority: P1
  - Consensus: Agent audits identified as distinct from metering.
- [ ] **Admin API — MCP Tunnels management** — MISSING | Equivalent: No equivalent | Path: Add `admin/mcp_tunnels`, certificates, token reveal/rotate | Effort: M | Priority: P2
  - Consensus: Agent audits identified.
- [ ] **SCIM provisioning** — MISSING | Equivalent: No equivalent | Path: Implement SCIM v2 `/Users` and `/Groups` endpoints | Effort: L | Priority: P2
  - Consensus: All audits agree.
- [ ] **Access Transparency** — **MISSING** | Equivalent: Vault / ledger | Path: Build customer-visible audit feed of Allternit-operator/system access to customer data | Effort: L | Priority: P2
  - Consensus: **Corrected from PARTIAL.** Agent audits said this is a different trust boundary.
- [ ] **CMEK (AWS KMS)** — MISSING | Equivalent: No equivalent | Path: Add envelope encryption with AWS KMS in secrets service | Effort: L | Priority: P2
  - Consensus: All audits agree.
- [ ] **CMEK (Azure Key Vault)** — MISSING | Equivalent: No equivalent | Path: Add envelope encryption with Azure Key Vault | Effort: L | Priority: P2
  - Consensus: All audits agree.
- [ ] **CMEK (Google Cloud KMS)** — MISSING | Equivalent: No equivalent | Path: Add envelope encryption with GCP KMS | Effort: L | Priority: P2
  - Consensus: Agent audits added GCP.
- [ ] **Data residency** — MISSING | Equivalent: No equivalent | Path: Add region pinning / data-locality controls with inference-geo verification | Effort: L | Priority: P2
  - Consensus: All audits agree.
- [ ] **Compliance API** — **MISSING** | Equivalent: Vault / ledger | Path: Build compliance activity feed + per-app retrieve/delete (chats, projects, artifacts, generated files, code artifacts) + org/role/group/settings | Effort: L | Priority: P2
  - Consensus: **Corrected scope.** Agent audits said this is ~50 endpoints.
- [ ] **Compliance org data** — MISSING | Equivalent: No equivalent | Path: Add org-level compliance data endpoints | Effort: M | Priority: P2
  - Consensus: All audits agree.
- [ ] **Compliance content data** — MISSING | Equivalent: No equivalent | Path: Add content-level compliance data endpoints | Effort: M | Priority: P2
  - Consensus: All audits agree.
- [ ] **WIF providers (AWS/Azure/GCP/GitHub/K8s/Okta/SPIFFE)** — MISSING | Equivalent: No equivalent | Path: Implement workload identity federation for cloud auth | Effort: L | Priority: P2
  - Consensus: Agent audits said this is 7+ integrations.
- [ ] **App Attest (iOS/macOS)** — MISSING | Equivalent: No equivalent | Path: Add Apple App Attest verification in API | Effort: M | Priority: P2
  - Consensus: All audits agree.
- [ ] **Inference hooks** — **MISSING** | Equivalent: Rails hooks | Path: Add pre/post-inference HTTP hook system to `allternit-api` | Effort: M | Priority: P1
  - Consensus: **Corrected from PARTIAL.** Agent audits said these are external hooks around model inference, not Rails orchestration hooks.
- [ ] **API and data retention** — MISSING | Equivalent: No equivalent | Path: Add retention policies, ZDR arrangements, automated deletion | Effort: L | Priority: P2
  - Consensus: Agent audits identified ZDR.
- [ ] **Claude Code Analytics API** — MISSING | Equivalent: No equivalent | Path: Add usage analytics for `gizzi-code`/TUI | Effort: L | Priority: P2
  - Consensus: All audits agree low priority.
- [ ] **Analytics: Artifact Activity** — MISSING | Equivalent: No equivalent | Path: Add artifact usage analytics | Effort: M | Priority: P2
  - Consensus: All audits agree.
- [ ] **Analytics: Chat Project Usage** — MISSING | Equivalent: No equivalent | Path: Add project-level chat analytics | Effort: M | Priority: P2
  - Consensus: All audits agree.
- [ ] **Analytics: Connector Usage** — MISSING | Equivalent: No equivalent | Path: Add connector usage analytics | Effort: M | Priority: P2
  - Consensus: All audits agree.
- [ ] **Analytics: Cost Over Time** — PARTIAL | Equivalent: budgetCalculator | Path: Persist cost metrics; time-series API | Effort: M | Priority: P1
  - Consensus: All audits agree.
- [ ] **Analytics: Per-User Cost** — PARTIAL | Equivalent: budgetCalculator | Path: Add user attribution to budget calculator | Effort: M | Priority: P1
  - Consensus: All audits agree.
- [ ] **Analytics: Plugin Usage** — MISSING | Equivalent: Plugin SDK telemetry | Path: Add plugin usage metrics | Effort: M | Priority: P2
  - Consensus: All audits agree.
- [ ] **Analytics: Skill Usage** — MISSING | Equivalent: No equivalent | Path: Add skill usage metrics | Effort: M | Priority: P2
  - Consensus: Agent audits identified.
- [ ] **Analytics: Active Users** — MISSING | Equivalent: No equivalent | Path: Add DAU/MAU tracking | Effort: S | Priority: P2
  - Consensus: All audits agree.
- [ ] **Analytics: Token Usage** — PARTIAL | Equivalent: budgetCalculator | Path: Expose token usage time-series | Effort: S | Priority: P1
  - Consensus: All audits agree.
- [ ] **Analytics: Request Volume** — MISSING | Equivalent: No equivalent | Path: Add request count metrics | Effort: S | Priority: P1
  - Consensus: All audits agree.
- [ ] **Service tiers** — MISSING | Equivalent: No equivalent | Path: Add priority/standard/batch tier selection per request | Effort: M | Priority: P2
  - Consensus: Agent audits identified.
- [ ] **Supported regions / IP ranges** — MISSING | Equivalent: No equivalent | Path: Publish endpoints for allow-listing | Effort: S | Priority: P2
  - Consensus: Agent audits identified.

### Cloud Distribution & Model Ecosystem (strategic)

- [ ] **Vertex AI provider** — MISSING | Equivalent: Provider registry | Path: Add Google Vertex AI as a provider | Effort: M | Priority: P2
  - Consensus: Agent audits noted provider gap.
- [ ] **Model IDs and versioning** — PARTIAL | Equivalent: Provider registry | Path: Add stable model aliases and deprecation tracking across all 10+ providers | Effort: M | Priority: P2
  - Consensus: All audits agree.
- [ ] **Model migration guide** — MISSING | Equivalent: Docs | Path: Build migration guides for model changes across providers | Effort: S | Priority: P2
  - Consensus: All audits agree.
- [ ] **Model deprecations** — MISSING | Equivalent: Provider registry | Path: Add deprecation notices and recommended replacements per provider | Effort: S | Priority: P2
  - Consensus: All audits agree.
- [ ] **Choosing the right model** — PARTIAL | Equivalent: Provider registry | Path: Add cross-provider model recommendation engine (cost/capability/latency) | Effort: M | Priority: P2
  - Consensus: Agent audits said this is more valuable for Allternit than Anthropic.
- [ ] **Pricing docs / cost calculator** — MISSING | Equivalent: No equivalent | Path: Publish cross-provider cost calculator / pricing docs | Effort: S | Priority: P2
  - Consensus: Agent audits noted this should be cross-provider.

### Evaluation & Safety (near-term)

- [ ] **Define success criteria / evaluations** — PARTIAL | Equivalent: Rails outcomes / rubrics | Path: Add evaluation framework and test harness | Effort: L | Priority: P1
  - Consensus: All audits agree.
- [ ] **Develop tests** — PARTIAL | Equivalent: Test suites | Path: Build agent evaluation test runner | Effort: M | Priority: P1
  - Consensus: All audits agree.
- [ ] **Handle streaming refusals** — MISSING | Equivalent: Agent run events | Path: Add normalized cross-provider refusal detection and handling | Effort: S | Priority: P1
  - Consensus: Agent audits emphasized cross-provider normalization.
- [ ] **Refusals and fallback / Fallback credit** — MISSING | Equivalent: No equivalent | Path: Add automatic model-fallback mechanism and credit-back policy | Effort: M | Priority: P1
  - Consensus: Agent audits identified as missing subsystem.
- [ ] **Increase output consistency** — PARTIAL | Equivalent: System prompts / rubrics | Path: Add consistency scoring and retry logic | Effort: M | Priority: P2
  - Consensus: All audits agree.
- [ ] **Mitigate jailbreaks** — PARTIAL | Equivalent: Governance / WIH | Path: Add safety classifier hooks and input validation screens | Effort: L | Priority: P2
  - Consensus: All audits agree.
- [ ] **Reduce hallucinations** — PARTIAL | Equivalent: RAG / citations | Path: Add groundedness checks; cite sources | Effort: M | Priority: P1
  - Consensus: All audits agree.
- [ ] **Reducing latency** — PARTIAL | Equivalent: Pool manager / caching | Path: Add latency optimization guide + caching | Effort: M | Priority: P1
  - Consensus: All audits agree.
- [ ] **Reduce prompt leak** — MISSING | Equivalent: Vault / secrets | Path: Add prompt leak detection | Effort: M | Priority: P2
  - Consensus: All audits agree.
- [ ] **Evaluation metrics library** — MISSING | Equivalent: No equivalent | Path: Add built-in eval metrics (exact match, cosine, ROUGE, LLM-as-judge) | Effort: M | Priority: P2
  - Consensus: Agent audits identified.
- [ ] **Task fidelity criteria** — PARTIAL | Equivalent: Outcome rubrics | Path: Add fidelity rubric templates | Effort: S | Priority: P1
  - Consensus: All audits agree.

### Documentation & Release (ongoing)

- [ ] **Official release notes** — MISSING | Equivalent: No equivalent | Path: Start `CHANGELOG.md` + release notes site | Effort: S | Priority: P1
  - Consensus: All audits agree.
- [ ] **System Prompts changelogs** — MISSING | Equivalent: No equivalent | Path: Track per-provider model system prompt versions | Effort: S | Priority: P2
  - Consensus: Agent audits reframed as per-provider.
- [ ] **Resources overview** — PARTIAL | Equivalent: Docs surface | Path: Build docs resource library | Effort: S | Priority: P2
  - Consensus: All audits agree.
- [ ] **Glossary** — MISSING | Equivalent: No equivalent | Path: Build Allternit terminology glossary | Effort: S | Priority: P2
  - Consensus: All audits agree.
- [ ] **Migration guides** — MISSING | Equivalent: No equivalent | Path: Write provider/model migration guides | Effort: S | Priority: P1
  - Consensus: All audits agree.
- [ ] **Use-case playbooks** — MISSING | Equivalent: No equivalent | Path: Build reference implementations (classification, support, legal summarization, etc.) | Effort: M | Priority: P2
  - Consensus: Agent audits identified as content/marketing gap.
- [ ] **Multilingual support guidance** — MISSING | Equivalent: No equivalent | Path: Add i18n/localization guidance for prompts and docs | Effort: S | Priority: P2
  - Consensus: Agent audits identified.

## Kimi parity tasks

Source: `/Users/joe/Desktop/kimi-docs/kimi_gap_implementation_plan.md`

### P0 — Core API parity: api (13 items)

- [ ] **Kimi K2.6 — thinking 参数** — partial | API area not explicitly covered; likely partial or missing.
- [ ] **Kimi K2.7 Code 系列 — thinking 参数** — partial | API area not explicitly covered; likely partial or missing.
- [ ] **400 — 请求错误** — partial | Allternit returns HTTP/API errors but error-code taxonomy may differ.
- [ ] **401 — 认证错误** — partial | Allternit returns HTTP/API errors but error-code taxonomy may differ.
- [ ] **403 — 权限错误** — partial | Allternit returns HTTP/API errors but error-code taxonomy may differ.
- [ ] **404 — 资源不存在** — partial | Allternit returns HTTP/API errors but error-code taxonomy may differ.
- [ ] **429 — 速率限制 / 额度不足** — partial | Allternit returns HTTP/API errors but error-code taxonomy may differ.
- [ ] **499 / 500 / 503 / 504 — 连接与服务端错误** — partial | Allternit returns HTTP/API errors but error-code taxonomy may differ.
- [ ] **API 概述** — partial | API area not explicitly covered; likely partial or missing.
- [ ] **OpenAPI** — partial | Workspace file/budget endpoints exist but not as a Kimi-shaped /v1/files or /v1/users/me/balance surface.
- [ ] **SDK 安装** — partial | API area not explicitly covered; likely partial or missing.
- [ ] **取消批处理任务** — partial | API area not explicitly covered; likely partial or missing.
- [ ] **计算 Token** — gap | No equivalent Kimi-style API surface found in Allternit.

### P3 — Release-notes/changelog (editorial): changelog (1 items)

- [ ] **平台新功能发布记录** — gap | Individual specs and ADRs exist in docs/, but no equivalent to Kimi's public changelog page.

### P2 — Docs surface parity: docs (1 items)

- [ ] **生成模型 Moonshot V1** — partial | Top-level docs/overview pages; Allternit has docs but not this exact structure.

### P1 — Developer-guide/UX parity: guide (73 items)

- [ ] **Batch 状态说明** — gap | No native Allternit batch inference API or guide surface.
- [ ] **使用 Batch API 批量处理任务** — gap | BatchToolbar is for restarting/stopping multiple swarm agents, not LLM batch jobs.
- [ ] **1M 上下文与自动缓存** — gap | No cache_control / context-caching feature exposed.
- [ ] **Context Caching 与 RAG 怎么选** — gap | No cache_control / context-caching feature exposed.
- [ ] **使用 Kimi API 的 Context Caching 功能** — gap | Allternit models price fields for prompt caching but does not expose a context-caching feature.
- [ ] **上传文件还是base64** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **使用 Kimi API 进行文件问答** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **在这里，你需要将 kimi.mp4 文件替换为你想让 Kimi 识别的视频的地址** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **在这里，你需要将 kimi.png 文件替换为你想让 Kimi 识别的图片的地址** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **在这里，你需要将 video.mp4 文件替换为你想让 Kimi 识别的图片或视频的地址** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **K2-Thinking 系列模型基准测试推荐参数** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **K3：用 `reasoning_effort` 调节推理强度** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **Q1: 为什么需要保留 `reasoning_content`？** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **使用 Kimi API 完成工具调用（tool_calls）** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **使用 Kimi API 的 JSON Mode** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **使用 response_format 控制模型输出格式** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **保证每个 tool\_call 都有对应的 tool 消息** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **关于 reasoning\_content** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **在多轮对话中保留思考（Preserved Thinking）** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **处理流式输出中的 tool\_calls** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **开启 Thinking** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **我们使用标准库 base64.b64encode 函数将图片编码成 base64 格式的 image_url** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **我们使用标准库 base64.b64encode 函数将视频编码成 base64 格式的 video_url** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **排查 tool\_call\_id not found 错误** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **排查被截断的 JSON 输出** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **方式二：写入 settings.json（长期生效）** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **用 JSON Schema 定义工具** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **用 response\_format 启用 JSON Mode** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **用 thinking 参数控制 kimi-k2.6 的思考行为** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **用 tool\_calls 代替 function\_call** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **用动态加载实现 Tool Search** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **自定义工具与 `tool_choice`** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **调用 kimi-k2.7-code：无需传 thinking 参数** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] ****填写 IP / CIDR 列表**** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] ****配置 IP 白名单**** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **API 推荐参数与注意事项** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **Agentic 能力的提升** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **K2.5 模型基准测试推荐参数** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **K2.6 模型基准测试推荐参数** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **K3 API 配置** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **Show Case1：今日新闻报告** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **Show Case2：表格分析工具** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **Structured Output 的优势** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **`strict` 模式说明** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **不用 SDK 直接处理 SSE** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **准备 API Key** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **出现 429 错误** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **在 Chat Completions 中接入官方工具** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **处理 Fiber 执行结果并继续对话** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **多个回复（`n` 参数）** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **如何校验 schema 是否符合 MFJS** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **字段类型不匹配 / 输出 Markdown 代码块** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **安装 OpenAI SDK** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **安装 walle 工具** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **完整 Agent Loop** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **完整示例：调用 `web_search` 官方工具** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **强制模型调用工具：`"required"`** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **接入 Kimi API Platform** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **校验你的 schema** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **用 `name` 字段固定角色身份** — gap | No partial/best-of sampling mode in Allternit platform APIs.
- [ ] **用 messages 列表为模型补上记忆** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **由于 body 信息过于冗长，这里不再完整展示 body 详细内容** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **禁止工具调用：`"none"`** — gap | No platform endpoint for estimating token usage/cost.
- [ ] **第三方工具：cc-switch** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **解析 SSE 响应体** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **让模型自行决定：`"auto"`（默认）** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **输出可能是 version = 1.10.0，表示 OpenAI SDK 已经安装成功，当前 python 实际使用了 openai 的 v1.10.0 的库** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **输出被截断（`finish_reason="length"`）** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **Partial Mode** — gap | No partial/best-of sampling mode in Allternit platform APIs.
- [ ] **使用 Kimi API 的 Partial Mode** — gap | Only found in gizzi-code SDK provider code, not exposed as a platform capability.
- [ ] **使用 Playground 调试模型** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **在 Playground 中配置 ModelScope MCP 服务器** — partial | Allternit has related building blocks but not this exact Kimi guide/feature.
- [ ] **Q2: `reasoning_content` 会消耗额外的 token 吗？** — gap | No platform endpoint for estimating token usage/cost.

### P2 — Billing/pricing surface parity: pricing (1 items)

- [ ] **批量推理定价** — partial | Pricing is provider/model-specific and recomputed server-side; no unified public pricing page was found.

## OpenAI ChatGPT + Codex parity tasks

Source: `/Users/joe/Desktop/openai-docs/OPENAI_CHATGPT_CODEX_GAPS_INLINE.md`

### Category: chatgpt-codex

#### Access tokens
- Original docs: <https://learn.chatgpt.com/docs/enterprise/access-tokens.md>
- [ ] [GAP] **Create an access token**
- [ ] [GAP] **Enable access token creation**
- [ ] [GAP] **How access tokens work**
- [ ] [GAP] **Permission model**
- [ ] [GAP] **Rotate or revoke a token**
- [ ] [GAP] **Set an access token expiration limit**
- [ ] [GAP] **The access tokens page returns 404 or forbidden**
- [ ] [GAP] **Use an access token with Codex CLI**
- [ ] [GAP] **`codex login --with-access-token` fails**

#### Administration
- Original docs: <https://learn.chatgpt.com/docs/administration.md>
- [ ] [GAP] **Administration**

#### Advanced Configuration
- Original docs: <https://learn.chatgpt.com/docs/config-file/config-advanced.md>
- [ ] [GAP] **Add custom file handlers**
- [ ] [GAP] **Amazon Bedrock provider**
- [ ] [GAP] **Approval policies and sandbox modes**
- [ ] [GAP] **ChatGPT customers using data residency**
- [ ] [GAP] **Clickable citations**
- [ ] [GAP] **Config and state locations**
- [ ] [GAP] **Feedback controls**
- [ ] [GAP] **Hide or surface reasoning events**
- [ ] [GAP] **History persistence**
- [ ] [GAP] **Metrics**
- [ ] [GAP] **Named permission profiles**
- [ ] [GAP] **OSS mode (local providers)**
- [ ] [GAP] **OTel metrics emitted**
- [ ] [GAP] **Observability and telemetry**
- [ ] [GAP] **One-off overrides from the CLI**
- [ ] [GAP] **Project instructions discovery**
- [ ] [GAP] **Project root detection**
- [ ] [GAP] **Shell environment policy**
- [ ] [GAP] **TUI options**
- [ ] [GAP] **What gets emitted**

#### Agent approvals & security
- Original docs: <https://learn.chatgpt.com/docs/agent-approvals-security.md>
- [ ] [GAP] **Agent approvals & security**
- [ ] [GAP] **Always ask for approval mode**
- [ ] [GAP] **Automatic approval reviews**
- [ ] [GAP] **Common sandbox and approval combinations**
- [ ] [GAP] **Defaults and recommendations**
- [ ] [GAP] **Enable OTel (opt-in)**
- [ ] [GAP] **Event categories**
- [ ] [GAP] **Managed configuration**
- [ ] [GAP] **Monitoring and telemetry**
- [ ] [GAP] **Network access <ElevatedRiskBadge class="ml-2" />**
- [ ] [GAP] **Network isolation**
- [ ] [GAP] **OS-level sandbox**
- [ ] [GAP] **Optional: Allow network in workspace-write mode**
- [ ] [GAP] **Optional: granular approval policy**
- [ ] [GAP] **Overview**
- [ ] [GAP] **Protected paths in writable roots**
- [ ] [GAP] **Run Codex in Dev Containers**
- [ ] [GAP] **Run without approval prompts**
- [ ] [GAP] **Sandbox and approvals**
- [ ] [GAP] **Security and privacy guidance**
- [ ] [GAP] **Test the sandbox locally**
- [ ] [GAP] **Version control**
- [ ] [GAP] **Windows**
- [ ] [GAP] **approval_policy = { granular = {**
- [ ] [GAP] **mcp_elicitations = true,**
- [ ] [GAP] **request_permissions = false,**
- [ ] [GAP] **rules = true,**
- [ ] [GAP] **sandbox_approval = true,**
- [ ] [GAP] **sandbox_private_desktop = true  # default; set false only for compatibility**
- [ ] [GAP] **skill_approval = false**
- [ ] [GAP] **web_search = "disabled"**
- [ ] [GAP] **web_search = "live"  # same as --search**

#### Agent internet access
- Original docs: <https://learn.chatgpt.com/docs/cloud/internet-access.md>
- [ ] [GAP] **Allowed HTTP methods**
- [ ] [GAP] **Bug with script**
- [ ] [GAP] **Common dependencies**
- [ ] [GAP] **Preset domain lists**

#### Analytics API
- Original docs: <https://learn.chatgpt.com/docs/enterprise/analytics-api.md>
- [ ] [GAP] **Confirm the administration boundaries**
- [ ] [GAP] **When to use the Analytics API**

#### Appshots
- Original docs: <https://learn.chatgpt.com/docs/appshots.md>
- [ ] [GAP] **Limits and troubleshooting**
- [ ] [GAP] **Permissions and safety**
- [ ] [GAP] **Take an appshot**
- [ ] [GAP] **What appshots capture**
- [ ] [GAP] **When to use appshots**

#### Authentication
- Original docs: <https://learn.chatgpt.com/docs/auth.md>
- [ ] [GAP] **ChatGPT web**
- [ ] [GAP] **Check authentication or sign out**
- [ ] [GAP] **Credential storage**
- [ ] [GAP] **Custom CA bundles**
- [ ] [GAP] **Enforce a login method or workspace**
- [ ] [GAP] **Fallback: Authenticate locally and copy your auth cache**
- [ ] [GAP] **Fallback: Forward the localhost callback over SSH**
- [ ] [GAP] **Login caching**
- [ ] [GAP] **Login diagnostics**
- [ ] [GAP] **Login on headless devices**
- [ ] [GAP] **Only allow ChatGPT login or only allow API key login.**
- [ ] [GAP] **OpenAI authentication**
- [ ] [GAP] **Preferred: Device code authentication (beta)**
- [ ] [GAP] **Replace MY_CONTAINER with the name or ID of your container.**
- [ ] [GAP] **Sign in with ChatGPT**
- [ ] [GAP] **Sign in with an API key**
- [ ] [GAP] **When using ChatGPT login, restrict users to a specific workspace.**
- [ ] [GAP] **file | keyring | auto**

#### Auto-review
- Original docs: <https://learn.chatgpt.com/docs/sandboxing/auto-review.md>
- [ ] [GAP] **Denials and failure behavior**
- [ ] [GAP] **Reduce review volume without weakening security**
- [ ] [GAP] **What the reviewer sees**
- [ ] [GAP] **When it triggers**

#### Browser
- Original docs: <https://learn.chatgpt.com/docs/browser.md>
- [ ] [GAP] **Browser data**
- [ ] [GAP] **Comment on the page**
- [ ] [GAP] **Keep browser tasks scoped**
- [ ] [GAP] **Limitations**
- [ ] [GAP] **Manage browsing history**
- [ ] [GAP] **Preview a page**
- [ ] [GAP] **Search from the address bar**
- [ ] [GAP] **Start browser work**
- [ ] [GAP] **Styling feedback**
- [ ] [GAP] **Website permissions and confirmations**

#### Build plugins
- Original docs: <https://learn.chatgpt.com/docs/build-plugins.md>
- [ ] [GAP] **Build plugins**
- [ ] [GAP] **Continue with the builder documentation**
- [ ] [GAP] **Create a plugin with `@plugin-creator`**
- [ ] [GAP] **Create a skills-only plugin manually**

#### Build skills
- Original docs: <https://learn.chatgpt.com/docs/build-skills.md>
- [ ] [GAP] **Best practices**
- [ ] [GAP] **Create a skill**
- [ ] [GAP] **Enable or disable local Codex skills**
- [ ] [GAP] **Optional metadata**
- [ ] [GAP] **Where Codex loads local skills**

#### CLI customization
- Original docs: <https://learn.chatgpt.com/docs/cli-customization.md>
- [ ] [GAP] **Syntax highlighting and themes**

#### ChatGPT Voice
- Original docs: <https://learn.chatgpt.com/docs/features/voice.md>
- [ ] [GAP] **Delegate and coordinate work**
- [ ] [GAP] **Have a conversation**
- [ ] [GAP] **Show ChatGPT what you see**
- [ ] [GAP] **Start talking**

#### ChatGPT Work admin FAQ
- Original docs: <https://learn.chatgpt.com/docs/enterprise/work-admin-faq.md>
- [ ] [GAP] **Additional resources for your teams**
- [ ] [GAP] **Are prompts, outputs, files, actions, or tool calls logged?**
- [ ] [GAP] **Can access be scoped by group, role, workspace, or capability?**
- [ ] [GAP] **Can unusual behavior, failures, or usage spikes be detected quickly?**
- [ ] [GAP] **Compliance**
- [ ] [GAP] **Core administrative controls**
- [ ] [GAP] **How are access to data, systems, and user actions protected?**
- [ ] [GAP] **How are runtime and network boundaries governed?**
- [ ] [GAP] **How can admins control access, permissions, and policies?**
- [ ] [GAP] **How can admins stop access or activity?**
- [ ] [GAP] **How does ChatGPT Work access data and context?**
- [ ] [GAP] **How does ChatGPT Work support enterprise privacy and data commitments?**
- [ ] [GAP] **How does ChatGPT Work usage translate into spend over time?**
- [ ] [GAP] **Incident and revocation controls**
- [ ] [GAP] **Observability**
- [ ] [GAP] **Recommended admin actions**
- [ ] [GAP] **Usage and cost**
- [ ] [GAP] **What data is stored, retained, or deleted?**
- [ ] [GAP] **What high-impact actions are restricted or require review?**
- [ ] [GAP] **What usage data is available to admins or owners?**
- [ ] [GAP] **What usage limits, alerts, or caps are available?**

#### ChatGPT desktop app
- Original docs: <https://learn.chatgpt.com/docs/app.md>
- [ ] [GAP] **See what the app can do**
- [ ] [GAP] **Your command center for complex work**

#### ChatGPT desktop app for Windows
- Original docs: <https://learn.chatgpt.com/docs/windows/windows-app.md>
- [ ] [GAP] **Customize for your dev setup**
- [ ] [GAP] **Git features are unavailable**
- [ ] [GAP] **Git isn't detected for projects opened from `\\wsl$`**
- [ ] [GAP] **Local environment scripts on Windows**
- [ ] [GAP] **Native sandbox**
- [ ] [GAP] **PowerShell execution policy blocks commands**
- [ ] [GAP] **Preferred editor**
- [ ] [GAP] **Run commands with elevated permissions**
- [ ] [GAP] **Share config, auth, and sessions with WSL**
- [ ] [GAP] **Troubleshooting and FAQ**
- [ ] [GAP] **Useful developer tools**
- [ ] [GAP] **Windows Subsystem for Linux (WSL)**
- [ ] [GAP] **`Cmder` isn't listed in the open dialog**

#### ChatGPT on the web
- Original docs: <https://learn.chatgpt.com/docs/web.md>
- [ ] [GAP] **Research, analyze, and create in your browser**
- [ ] [GAP] **See what you can do on the web**
- [ ] [GAP] **Use ChatGPT on the web when…**
- [ ] [GAP] **Why use ChatGPT on the web**

#### ChatGPT usage limits and spend controls
- Original docs: <https://learn.chatgpt.com/docs/enterprise/usage-limits.md>
- [ ] [GAP] **Know when these controls apply**

#### Chrome extension
- Original docs: <https://learn.chatgpt.com/docs/chrome-extension.md>
- [ ] [GAP] **Ask about a YouTube video**
- [ ] [GAP] **Bring tabs and selected text into a chat**
- [ ] [GAP] **Control website access**
- [ ] [GAP] **Data and security**
- [ ] [GAP] **Manage allowed and blocked websites**
- [ ] [GAP] **Set up the Chrome extension**
- [ ] [GAP] **Start a Chrome task from ChatGPT**
- [ ] [GAP] **Upload files**
- [ ] [GAP] **Use ChatGPT from Chrome**
- [ ] [GAP] **What OpenAI stores from browsing**

#### Chronicle
- Original docs: <https://learn.chatgpt.com/docs/customization/chronicle.md>
- [ ] [GAP] **Enable Chronicle**
- [ ] [GAP] **Fill in missing context**
- [ ] [GAP] **How Chronicle helps**
- [ ] [GAP] **How do I enable Chronicle?**
- [ ] [GAP] **Pause or disable Chronicle at any time**
- [ ] [GAP] **Privacy and security**
- [ ] [GAP] **Prompt injection risk**
- [ ] [GAP] **Remember tools and workflows**
- [ ] [GAP] **Use what’s on screen**
- [ ] [GAP] **What data gets shared with OpenAI?**
- [ ] [GAP] **Where does Chronicle store my data?**
- [ ] [GAP] **Which model is used for generating the Chronicle memories?**

#### Cloud environments
- Original docs: <https://learn.chatgpt.com/docs/environments/cloud-environment.md>
- [ ] [GAP] **Automatic setup**
- [ ] [GAP] **Container caching**
- [ ] [GAP] **Default universal image**
- [ ] [GAP] **Environment variables and secrets**
- [ ] [GAP] **Manual setup**

#### Code review
- Original docs: <https://learn.chatgpt.com/docs/code-review.md>
- [ ] [GAP] **Choose a review scope**
- [ ] [GAP] **Inline comments for feedback**
- [ ] [GAP] **Navigating the review pane**
- [ ] [GAP] **Pull request reviews**
- [ ] [GAP] **Review multiple repositories**
- [ ] [GAP] **Staged and unstaged states**
- [ ] [GAP] **Staging and reverting files**
- [ ] [GAP] **Start a review**
- [ ] [GAP] **What changes it shows**
- [ ] [GAP] **Work with review results**

#### Codex App Server
- Original docs: <https://learn.chatgpt.com/docs/app-server.md>
- [ ] [GAP] **3b) Log in with ChatGPT (device-code flow)**
- [ ] [GAP] **3c) Log in with externally managed ChatGPT tokens (`chatgptAuthTokens`)**
- [ ] [GAP] **API overview**
- [ ] [GAP] **Approvals**
- [ ] [GAP] **Apps (connectors)**
- [ ] [GAP] **Archive a thread**
- [ ] [GAP] **Auth endpoints**
- [ ] [GAP] **Authentication modes**
- [ ] [GAP] **Clean background terminals**
- [ ] [GAP] **Command execution**
- [ ] [GAP] **Command execution approvals**
- [ ] [GAP] **Config RPC examples for app settings**
- [ ] [GAP] **Core primitives**
- [ ] [GAP] **Delete a thread**
- [ ] [GAP] **Detect and import external agent config**
- [ ] [GAP] **Dynamic tool calls (experimental)**
- [ ] [GAP] **Errors**
- [ ] [GAP] **Experimental API opt-in**
- [ ] [GAP] **File change approvals**
- [ ] [GAP] **Fuzzy file search events (experimental)**
- [ ] [GAP] **Getting started**
- [ ] [GAP] **Initialization**
- [ ] [GAP] **Inject items into a thread**
- [ ] [GAP] **Inspect an execution environment (experimental)**
- [ ] [GAP] **Interrupt a turn**
- [ ] [GAP] **Item deltas**
- [ ] [GAP] **Lifecycle overview**
- [ ] [GAP] **List experimental features (`experimentalFeature/list`)**
- [ ] [GAP] **List loaded threads**
- [ ] [GAP] **List models (`model/list`)**
- [ ] [GAP] **List thread turns**
- [ ] [GAP] **List threads (with pagination & filters)**
- [ ] [GAP] **MCP server elicitation requests**
- [ ] [GAP] **MCP tool-call approvals (apps)**
- [ ] [GAP] **Manage a thread goal**
- [ ] [GAP] **Notification opt-out**
- [ ] [GAP] **Permission requests**
- [ ] [GAP] **Process execution**
- [ ] [GAP] **Protocol**
- [ ] [GAP] **Read a stored thread (without resuming)**
- [ ] [GAP] **Read admin requirements (`configRequirements/read`)**
- [ ] [GAP] **Roll back recent turns**
- [ ] [GAP] **Run a thread shell command**
- [ ] [GAP] **Sandbox read access (`ReadOnlyAccess`)**
- [ ] [GAP] **Start a turn**
- [ ] [GAP] **Start a turn (invoke a skill)**
- [ ] [GAP] **Start or resume a thread**
- [ ] [GAP] **Steer an active turn**
- [ ] [GAP] **Track thread status changes**
- [ ] [GAP] **Trigger thread compaction**
- [ ] [GAP] **Turn events**
- [ ] [GAP] **Unarchive a thread**
- [ ] [GAP] **Unsubscribe from a loaded thread**
- [ ] [GAP] **Update stored thread metadata**
- [ ] [GAP] **Warning events**
- [ ] [GAP] **Windows sandbox setup (`windowsSandbox/setupStart`)**
- [ ] [GAP] **Windows sandbox setup events**

#### Codex CLI
- Original docs: <https://learn.chatgpt.com/docs/codex/cli.md>
- [ ] [GAP] **Inspect, edit, and run code from your terminal**

#### Codex GitHub Action
- Original docs: <https://learn.chatgpt.com/docs/github-action.md>
- [ ] [GAP] **Capture outputs**
- [ ] [GAP] **Example workflow**
- [ ] [GAP] **Manage privileges**
- [ ] [GAP] **Prerequisites**
- [ ] [GAP] **Security checklist**

#### Codex IDE extension
- Original docs: <https://learn.chatgpt.com/docs/codex/ide.md>
- [ ] [GAP] **Build with the context already in your editor**
- [ ] [GAP] **See what Codex can do in your IDE**

#### Codex Micro
- Original docs: <https://learn.chatgpt.com/docs/features/codex-micro.md>
- [ ] [GAP] **Add more layers**
- [ ] [GAP] **Adjust lighting**
- [ ] [GAP] **Fix Input Monitoring on macOS**
- [ ] [GAP] **Fix connection interference**
- [ ] [GAP] **Get a compatible Micro**
- [ ] [GAP] **Get more Work Louder help**
- [ ] [GAP] **Pair with Bluetooth**
- [ ] [GAP] **Read and switch chats with Agent Keys**
- [ ] [GAP] **Set up Codex Micro**
- [ ] [GAP] **Use and customize Command Keys**
- [ ] [GAP] **Use the analog stick and dial**

#### Codex Remote
- Original docs: <https://learn.chatgpt.com/docs/remote.md>
- [ ] [GAP] **Explore setup and security**
- [ ] [GAP] **Get started with Remote**
- [ ] [GAP] **Keep work moving from anywhere**

#### Codex SDK
- Original docs: <https://learn.chatgpt.com/docs/codex-sdk.md>
- [ ] [GAP] **Installation**
- [ ] [GAP] **Sandbox presets**
- [ ] [GAP] **TypeScript library**

#### Codex Security
- Original docs: <https://learn.chatgpt.com/docs/security.md>
- [ ] [GAP] **Explore plugin use cases**

#### Codex Security CLI FAQ
- Original docs: <https://learn.chatgpt.com/docs/security/cli/faq.md>
- [ ] [GAP] **Automation and cost**
- [ ] [GAP] **Can an interrupted bulk scan resume**
- [ ] [GAP] **Can another application run scans directly**
- [ ] [GAP] **Can scans check commits and pull requests**
- [ ] [GAP] **Findings and coverage**
- [ ] [GAP] **How can a scan use architecture and security policies**
- [ ] [GAP] **How can a team confirm that a fix worked**
- [ ] [GAP] **How do scan cost limits work**
- [ ] [GAP] **How do scans distinguish new and known findings**
- [ ] [GAP] **How does bulk repository scanning work**
- [ ] [GAP] **How does false-positive feedback work**
- [ ] [GAP] **Repository scans**
- [ ] [GAP] **What does incomplete coverage mean**
- [ ] [GAP] **What if the CLI can't save scan history**
- [ ] [GAP] **Where can teams find earlier scan results**
- [ ] [GAP] **Who can use the CLI**
- [ ] [GAP] **Why can repeat scans return different findings**
- [ ] [GAP] **Why does a scan use an API key after sign-in**

#### Codex Security CLI quickstart
- Original docs: <https://learn.chatgpt.com/docs/security/cli.md>
- [ ] [GAP] **Add architecture and security context**
- [ ] [GAP] **Check the prerequisites**
- [ ] [GAP] **Choose the next scan**
- [ ] [GAP] **Prepare a scan**
- [ ] [GAP] **Review the results**
- [ ] [GAP] **Revisit a saved scan**
- [ ] [GAP] **Run your first scan**
- [ ] [GAP] **Scan changes before each commit**
- [ ] [GAP] **Scan repositories in bulk**
- [ ] [GAP] **Set a scan budget**
- [ ] [GAP] **Set up and verify the CLI**
- [ ] [GAP] **Sign in**

#### Codex Security CLI reference
- Original docs: <https://learn.chatgpt.com/docs/security/cli/reference.md>
- [ ] [GAP] **Add scan instructions**
- [ ] [GAP] **Add security context**
- [ ] [GAP] **Authentication and prerequisites**
- [ ] [GAP] **Completion summary**
- [ ] [GAP] **Configure deep scans**
- [ ] [GAP] **Configure the runtime**
- [ ] [GAP] **Discover commands and connect agents**
- [ ] [GAP] **Exit codes and signals**
- [ ] [GAP] **Find saved scans**
- [ ] [GAP] **Inspect or repeat a scan**
- [ ] [GAP] **Match and compare findings**
- [ ] [GAP] **Read scan output**
- [ ] [GAP] **Scan artifacts**
- [ ] [GAP] **Select scan authentication**
- [ ] [GAP] **Select the scan target**
- [ ] [GAP] **Set output and policy options**
- [ ] [GAP] **Use OpenRouter or Fireworks**
- [ ] [GAP] **Verbose diagnostics**

#### Codex Security TypeScript SDK
- Original docs: <https://learn.chatgpt.com/docs/security/sdk.md>
- [ ] [GAP] **Add a security knowledge base**
- [ ] [GAP] **Add scan and follow-up instructions**
- [ ] [GAP] **Check inputs with preflight**
- [ ] [GAP] **Choose a scan target**
- [ ] [GAP] **Handle scan errors**
- [ ] [GAP] **Run a scan**
- [ ] [GAP] **Scan committed changes**
- [ ] [GAP] **Scan selected paths**
- [ ] [GAP] **Scan the working tree**
- [ ] [GAP] **Select deep mode**
- [ ] [GAP] **Set up the SDK**
- [ ] [GAP] **Track or cancel a scan**
- [ ] [GAP] **Work with scan results**

#### Codex Security cloud FAQ
- Original docs: <https://learn.chatgpt.com/docs/security/faq.md>
- [ ] [GAP] **Can I edit the threat model?**
- [ ] [GAP] **Do I need to configure a scan before using threat modeling?**
- [ ] [GAP] **Does Codex Security auto-apply patches?**
- [ ] [GAP] **Does it replace SAST?**
- [ ] [GAP] **Does it replace manual security review?**
- [ ] [GAP] **Does the patch directly modify my PR branch?**
- [ ] [GAP] **Does the project need to be built for scanning?**
- [ ] [GAP] **How does Codex Security reduce false positives and avoid broken patches?**
- [ ] [GAP] **How does Codex Security work?**
- [ ] [GAP] **How is a threat model generated?**
- [ ] [GAP] **How is customer code isolated?**
- [ ] [GAP] **How long do initial scans take, and what happens after that?**
- [ ] [GAP] **Validation**
- [ ] [GAP] **What business problem does Codex Security solve?**
- [ ] [GAP] **What does the proposed patch contain?**
- [ ] [GAP] **What happens if validation fails?**
- [ ] [GAP] **What is Codex Security?**
- [ ] [GAP] **What is a threat model?**
- [ ] [GAP] **What is auto-validation?**
- [ ] [GAP] **What is the analysis pipeline?**
- [ ] [GAP] **What languages are supported?**
- [ ] [GAP] **What outputs do I get after the scan completes?**
- [ ] [GAP] **Why does it matter?**

#### Codex Security plugin changelog
- Original docs: <https://learn.chatgpt.com/docs/security/plugin/changelog.md>
- [ ] [GAP] **0.1.10 (June 23, 2026)**
- [ ] [GAP] **0.1.11 (July 10, 2026)**
- [ ] [GAP] **0.1.12 (July 23, 2026)**
- [ ] [GAP] **0.1.13 (July 25, 2026)**
- [ ] [GAP] **0.1.14 (July 28, 2026)**
- [ ] [GAP] **0.1.15 (July 30, 2026)**
- [ ] [GAP] **0.1.16 (August 4, 2026)**
- [ ] [GAP] **0.1.17 (August 5, 2026)**
- [ ] [GAP] **0.1.7 (June 4, 2026)**
- [ ] [GAP] **0.1.9 (June 18, 2026)**
- [ ] [GAP] **Apply repository guidance and coverage consistently**
- [ ] [GAP] **Configure scans with fewer interruptions**
- [ ] [GAP] **Define repository security policy**
- [ ] [GAP] **Export portable, verifiable results**
- [ ] [GAP] **Export results for existing security workflows**
- [ ] [GAP] **Follow scan progress as it happens**
- [ ] [GAP] **Give feedback and recover findings**
- [ ] [GAP] **Handle more repository layouts and paths**
- [ ] [GAP] **Improve Jira and Linear ticket intake**
- [ ] [GAP] **Keep scan guidance and repository targets accurate**
- [ ] [GAP] **Keep scans accurate as projects change**
- [ ] [GAP] **Produce detailed finding and hardening reports**
- [ ] [GAP] **Reduce unnecessary scan work**
- [ ] [GAP] **Resume interrupted deep scans**
- [ ] [GAP] **Review and remediate validated findings**
- [ ] [GAP] **Review and rerun previous scans**
- [ ] [GAP] **Review findings across more environments**
- [ ] [GAP] **Review findings before tracking them**
- [ ] [GAP] **Review scan history and recurring findings**
- [ ] [GAP] **Run deeper scans with clearer progress**
- [ ] [GAP] **Run deeper scans with consistent results**
- [ ] [GAP] **Run evidence-backed security reviews**
- [ ] [GAP] **Run reporting workflows directly**
- [ ] [GAP] **Run scans with less setup**
- [ ] [GAP] **Run standard scans with a simpler workflow**
- [ ] [GAP] **Start and complete scans with less overhead**
- [ ] [GAP] **Track measured scan usage**
- [ ] [GAP] **Triage and track existing findings**
- [ ] [GAP] **Write clearer vulnerability reports**

#### Codex Security plugin quickstart
- Original docs: <https://learn.chatgpt.com/docs/security/plugin.md>
- [ ] [GAP] **Choose your next workflow**
- [ ] [GAP] **Install the plugin**
- [ ] [GAP] **What the scan creates**

#### Codex cloud
- Original docs: <https://learn.chatgpt.com/docs/cloud.md>
- [ ] [GAP] **Run coding tasks in parallel cloud environments**
- [ ] [GAP] **Start here**

#### Commands
- Original docs: <https://learn.chatgpt.com/docs/reference/commands.md>
- [ ] [GAP] **Deep links**
- [ ] [GAP] **Keyboard shortcuts**
- [ ] [GAP] **Search past chats and find in a chat**
- [ ] [GAP] **See also**
- [ ] [GAP] **Settings**
- [ ] [GAP] **Supported links**

#### Compliance API and audit events
- Original docs: <https://learn.chatgpt.com/docs/enterprise/compliance-api.md>
- [ ] [GAP] **Get started**
- [ ] [GAP] **When to use the Compliance API**

#### Computer Use
- Original docs: <https://learn.chatgpt.com/docs/computer-use.md>
- [ ] [GAP] **Permissions and approvals**
- [ ] [GAP] **Safety guidance**

#### Config basics
- Original docs: <https://learn.chatgpt.com/docs/config-file/config-basic.md>
- [ ] [GAP] **Common configuration options**
- [ ] [GAP] **Common feature flags**
- [ ] [GAP] **Configuration precedence**
- [ ] [GAP] **Enabling features**

#### Custom Prompts
- Original docs: <https://learn.chatgpt.com/docs/custom-prompts.md>
- [ ] [GAP] **Add metadata and arguments**

#### Custom instructions with AGENTS.md
- Original docs: <https://learn.chatgpt.com/docs/agent-configuration/agents-md.md>
- [ ] [GAP] **Create global guidance**
- [ ] [GAP] **Customize fallback filenames**
- [ ] [GAP] **Experiment cohorts**
- [ ] [GAP] **How Codex discovers guidance**
- [ ] [GAP] **Layer project instructions**
- [ ] [GAP] **Troubleshoot discovery issues**
- [ ] [GAP] **Verify your setup**

#### Customization
- Original docs: <https://learn.chatgpt.com/docs/customization/overview.md>
- [ ] [GAP] **AGENTS Guidance**
- [ ] [GAP] **Skills + MCP together**

#### Cyber Safety
- Original docs: <https://learn.chatgpt.com/docs/cyber-safety.md>
- [ ] [GAP] **False positives**
- [ ] [GAP] **Trusted Access for Cyber**
- [ ] [GAP] **Why we’re doing this**

#### Deploy the Windows app
- Original docs: <https://learn.chatgpt.com/docs/enterprise/windows-deployment.md>
- [ ] [GAP] **Deploy the app with an enterprise management tool**
- [ ] [GAP] **Install without Microsoft distribution services**
- [ ] [GAP] **Let users install and update the app**

#### Developer commands
- Original docs: <https://learn.chatgpt.com/docs/developer-commands.md>
- [ ] [GAP] **Archive the current session with `/archive`**
- [ ] [GAP] **Ask for a working tree review with `/review`**
- [ ] [GAP] **Assign a key binding**
- [ ] [GAP] **Browse apps with `/apps`**
- [ ] [GAP] **Browse plugins with `/plugins`**
- [ ] [GAP] **Check background terminals with `/ps`**
- [ ] [GAP] **Choose a syntax theme with `/theme`**
- [ ] [GAP] **Choose a terminal pet with `/pets`**
- [ ] [GAP] **Clear the terminal and start a new chat with `/clear`**
- [ ] [GAP] **Command details**
- [ ] [GAP] **Command overview**
- [ ] [GAP] **Configure footer items with `/statusline`**
- [ ] [GAP] **Configure memories with `/memories`**
- [ ] [GAP] **Configure terminal title items with `/title`**
- [ ] [GAP] **Copy the latest response with `/copy`**
- [ ] [GAP] **Delete the current session with `/delete`**
- [ ] [GAP] **Developer commands**
- [ ] [GAP] **Exit the CLI with `/quit` or `/exit`**
- [ ] [GAP] **Flag combinations and safety tips**
- [ ] [GAP] **Fork the current chat with `/fork`**
- [ ] [GAP] **Global flags**
- [ ] [GAP] **Grant sandbox read access with `/sandbox-add-read-dir`**
- [ ] [GAP] **Highlight files with `/mention`**
- [ ] [GAP] **How to read this reference**
- [ ] [GAP] **Include IDE context with `/ide`**
- [ ] [GAP] **Inspect config layers with `/debug-config`**
- [ ] [GAP] **Inspect the session with `/status`**
- [ ] [GAP] **Interactive shortcuts**
- [ ] [GAP] **Keep transcripts lean with `/compact`**
- [ ] [GAP] **List MCP tools with `/mcp`**
- [ ] [GAP] **Related resources**
- [ ] [GAP] **Remap TUI shortcuts with `/keymap`**
- [ ] [GAP] **Rename the current chat with `/rename`**
- [ ] [GAP] **Resume a saved chat with `/resume`**
- [ ] [GAP] **Review changes with `/diff`**
- [ ] [GAP] **Send feedback with `/feedback`**
- [ ] [GAP] **Set a communication style with `/personality`**
- [ ] [GAP] **Set or view a task goal with `/goal`**
- [ ] [GAP] **Set up the elevated Windows sandbox with `/setup-default-sandbox`**
- [ ] [GAP] **Sign out with `/logout`**
- [ ] [GAP] **Start a new chat with `/new`**
- [ ] [GAP] **Start a side chat with `/side`**
- [ ] [GAP] **Stop background terminals with `/stop`**
- [ ] [GAP] **Switch agent threads with `/agent`**
- [ ] [GAP] **Switch to plan mode with `/plan`**
- [ ] [GAP] **Toggle Fast mode with `/fast`**
- [ ] [GAP] **Toggle Vim mode with `/vim`**
- [ ] [GAP] **Toggle experimental features with `/experimental`**
- [ ] [GAP] **Toggle raw scrollback with `/raw`**
- [ ] [GAP] **Update permissions with `/permissions`**
- [ ] [GAP] **Use a slash command**
- [ ] [GAP] **View account usage with `/usage`**
- [ ] [GAP] **View and manage lifecycle hooks with `/hooks`**

#### Developer settings
- Original docs: <https://learn.chatgpt.com/docs/developer-settings.md>
- [ ] [GAP] **Change an editor setting**
- [ ] [GAP] **Change settings for one run**
- [ ] [GAP] **Configuration layers**
- [ ] [GAP] **Developer settings**
- [ ] [GAP] **Editor settings reference**
- [ ] [GAP] **Inspect your settings**
- [ ] [GAP] **Integrations and MCP**
- [ ] [GAP] **Project and terminal behavior**
- [ ] [GAP] **Settings references**

#### Environment variables
- Original docs: <https://learn.chatgpt.com/docs/config-file/environment-variables.md>
- [ ] [GAP] **Authentication and network**
- [ ] [GAP] **Core locations**
- [ ] [GAP] **Diagnostics**
- [ ] [GAP] **Installer variables**

#### Export and track security findings
- Original docs: <https://learn.chatgpt.com/docs/security/plugin/export-findings.md>
- [ ] [GAP] **Export a portable artifact**
- [ ] [GAP] **Review the proposed write**
- [ ] [GAP] **Track selected findings**
- [ ] [GAP] **Verify the tracked item**

#### Fix and verify security findings
- Original docs: <https://learn.chatgpt.com/docs/security/plugin/fix-findings.md>
- [ ] [GAP] **Fix a finding from the CLI**
- [ ] [GAP] **Scan and fix findings in CI/CD**

#### Get started with ChatGPT Work
- Original docs: <https://learn.chatgpt.com/docs/get-started-with-work.md>
- [ ] [GAP] **Add plugins for more context and better outputs**
- [ ] [GAP] **Best practices for using ChatGPT Work**
- [ ] [GAP] **Choose local or cloud work**
- [ ] [GAP] **Create a comparison spreadsheet**
- [ ] [GAP] **Create a presentation**
- [ ] [GAP] **Introducing ChatGPT Work**
- [ ] [GAP] **Set up a recurring update**
- [ ] [GAP] **Use ChatGPT Work efficiently**
- [ ] [GAP] **What to try first**

#### Governance
- Original docs: <https://learn.chatgpt.com/docs/enterprise/governance.md>
- [ ] [GAP] **Analytics dashboard**
- [ ] [GAP] **Compliance API**
- [ ] [GAP] **Open the administration surfaces**
- [ ] [GAP] **Related ChatGPT usage controls**

#### Groups and provisioning
- Original docs: <https://learn.chatgpt.com/docs/enterprise/groups-and-provisioning.md>
- [ ] [GAP] **Compare membership sources**
- [ ] [GAP] **Understand the access boundary**
- [ ] [GAP] **Use current setup procedures**

#### Hooks
- Original docs: <https://learn.chatgpt.com/docs/hooks.md>
- [ ] [GAP] **Common input fields**
- [ ] [GAP] **Common output fields**
- [ ] [GAP] **Config shape**
- [ ] [GAP] **Large hook output**
- [ ] [GAP] **Managed hooks from `requirements.toml`**
- [ ] [GAP] **Matcher patterns**
- [ ] [GAP] **PermissionRequest**
- [ ] [GAP] **Plain-text aliases**
- [ ] [GAP] **Plugin-bundled hooks**
- [ ] [GAP] **PostCompact**
- [ ] [GAP] **PostToolUse**
- [ ] [GAP] **PreCompact**
- [ ] [GAP] **PreToolUse**
- [ ] [GAP] **Review and trust hooks**
- [ ] [GAP] **Schemas**
- [ ] [GAP] **SessionEnd**
- [ ] [GAP] **SessionStart**
- [ ] [GAP] **SubagentStart**
- [ ] [GAP] **SubagentStop**
- [ ] [GAP] **Tool coverage**
- [ ] [GAP] **Turn hooks off**
- [ ] [GAP] **UserPromptSubmit**
- [ ] [GAP] **Where Codex looks for hooks**

#### Image generation
- Original docs: <https://learn.chatgpt.com/docs/image-generation.md>
- [ ] [GAP] **Add text to an image**
- [ ] [GAP] **Additional considerations**
- [ ] [GAP] **Create infographics and dense layouts**
- [ ] [GAP] **Generate or edit an image**
- [ ] [GAP] **Refine the result**
- [ ] [GAP] **Review and edit generated images**
- [ ] [GAP] **Use multiple reference images**
- [ ] [GAP] **Write effective image prompts**

#### Image inputs
- Original docs: <https://learn.chatgpt.com/docs/image-inputs.md>
- [ ] [GAP] **Use the right image feature**
- [ ] [GAP] **Write the prompt around the image**

#### Import from another agent
- Original docs: <https://learn.chatgpt.com/docs/import.md>
- [ ] [GAP] **Finish setup after importing**
- [ ] [GAP] **How importing works**
- [ ] [GAP] **Start an import**
- [ ] [GAP] **What ChatGPT can import**
- [ ] [GAP] **What to review after importing**

#### Improving the threat model
- Original docs: <https://learn.chatgpt.com/docs/security/threat-model.md>
- [ ] [GAP] **Improving and revisiting the threat model**
- [ ] [GAP] **What a threat model is**
- [ ] [GAP] **Where to edit**

#### Integrated terminal
- Original docs: <https://learn.chatgpt.com/docs/integrated-terminal.md>
- [ ] [GAP] **Create reusable actions**
- [ ] [GAP] **Run and validate your project**

#### Local environments
- Original docs: <https://learn.chatgpt.com/docs/environments/local-environment.md>
- [ ] [GAP] **Setup scripts**
- [ ] [GAP] **Use built-in Git tools**

#### Long-running work
- Original docs: <https://learn.chatgpt.com/docs/long-running-work.md>
- [ ] [GAP] **Define what done means**
- [ ] [GAP] **Run goals in parallel**
- [ ] [GAP] **Start a goal**
- [ ] [GAP] **Steer a running goal**
- [ ] [GAP] **Steer running work**

#### Manage app updates
- Original docs: <https://learn.chatgpt.com/docs/enterprise/manage-app-updates.md>
- [ ] [GAP] **Deploy approved app versions**
- [ ] [GAP] **Troubleshoot common issues**
- [ ] [GAP] **Turn in-app updates back on**
- [ ] [GAP] **Turn off in-app updates**
- [ ] [GAP] **Understand security and support responsibilities**
- [ ] [GAP] **Verify the managed setting**

#### Managed configuration
- Original docs: <https://learn.chatgpt.com/docs/enterprise/managed-configuration.md>
- [ ] [GAP] **Cloud-managed requirements**
- [ ] [GAP] **Configure automatic review policy**
- [ ] [GAP] **Configure network access requirements**
- [ ] [GAP] **Control available permission profiles**
- [ ] [GAP] **Control plugin availability**
- [ ] [GAP] **Disable Appshots**
- [ ] [GAP] **Disable device remote control**
- [ ] [GAP] **Enforce command rules from requirements**
- [ ] [GAP] **Enforce deny-read requirements**
- [ ] [GAP] **Enforce managed hooks from requirements**
- [ ] [GAP] **Example managed_config.toml**
- [ ] [GAP] **Example requirements.toml**
- [ ] [GAP] **Locations**
- [ ] [GAP] **Locations and precedence**
- [ ] [GAP] **MDM setup workflow**
- [ ] [GAP] **Managed defaults (`managed_config.toml`)**
- [ ] [GAP] **Override sandbox requirements by host**
- [ ] [GAP] **Pin feature flags**
- [ ] [GAP] **Precedence and layering**
- [ ] [GAP] **Recommended guardrails**
- [ ] [GAP] **Restrict plugin marketplace sources**
- [ ] [GAP] **macOS managed preferences (MDM)**

#### Memories
- Original docs: <https://learn.chatgpt.com/docs/customization/memories.md>
- [ ] [GAP] **Configure local memories**
- [ ] [GAP] **How local Codex memories work**
- [ ] [GAP] **Local memory storage**
- [ ] [GAP] **Review local memories**

#### Model Context Protocol
- Original docs: <https://learn.chatgpt.com/docs/extend/mcp.md>
- [ ] [GAP] **Configure with config.toml**
- [ ] [GAP] **Configure with the CLI**
- [ ] [GAP] **Examples of useful MCP servers**
- [ ] [GAP] **Plugin-provided MCP servers**
- [ ] [GAP] **Supported MCP features**
- [ ] [GAP] **Use MCP-backed tools in ChatGPT web**

#### Models
- Original docs: <https://learn.chatgpt.com/docs/models.md>
- [ ] [GAP] **Choose a model**
- [ ] [GAP] **Choose a model for cloud chats**
- [ ] [GAP] **Configure your default local model**
- [ ] [GAP] **Know when to use Max or Ultra**
- [ ] [GAP] **Other models**
- [ ] [GAP] **Where each model shines**

#### Non-interactive mode
- Original docs: <https://learn.chatgpt.com/docs/non-interactive-mode.md>
- [ ] [GAP] **Advanced stdin piping**
- [ ] [GAP] **Authenticate in automation**
- [ ] [GAP] **Basic usage**
- [ ] [GAP] **Common automation patterns**
- [ ] [GAP] **Create structured outputs with a schema**
- [ ] [GAP] **Draft a pull request comment from CI logs**
- [ ] [GAP] **Example: Autofix CI failures in GitHub Actions**
- [ ] [GAP] **Git repository required**
- [ ] [GAP] **Inspect TLS or HTTP issues**
- [ ] [GAP] **Make output machine-readable**
- [ ] [GAP] **Prepare a Slack-ready update**
- [ ] [GAP] **Resume a non-interactive session**
- [ ] [GAP] **Summarize logs**
- [ ] [GAP] **Use API key auth**
- [ ] [GAP] **Use `codex exec -` when stdin is the prompt**
- [ ] [GAP] **Use prompt-plus-stdin**

#### Notifications
- Original docs: <https://learn.chatgpt.com/docs/notifications.md>
- [ ] [GAP] **Configure CLI notifications**
- [ ] [GAP] **Configure desktop notifications**
- [ ] [GAP] **Follow chat activity with a pet**
- [ ] [GAP] **Follow chats in Activity view**

#### Open Source
- Original docs: <https://learn.chatgpt.com/docs/open-source.md>
- [ ] [GAP] **Open-source components**
- [ ] [GAP] **Where to report issues and request features**

#### Permissions
- Original docs: <https://learn.chatgpt.com/docs/permissions.md>
- [ ] [GAP] **Common profiles**
- [ ] [GAP] **Configuration spec**
- [ ] [GAP] **Define and select a profile**
- [ ] [GAP] **Deny reads with exact paths or globs**
- [ ] [GAP] **Enable modes**
- [ ] [GAP] **Extend a profile**
- [ ] [GAP] **File access limited to workspace**
- [ ] [GAP] **Filesystem permissions**
- [ ] [GAP] **How enforcement works**
- [ ] [GAP] **How permissions work**
- [ ] [GAP] **Local and private networks**
- [ ] [GAP] **Migrate from older sandbox settings**
- [ ] [GAP] **Network permissions**
- [ ] [GAP] **Operational guidance**
- [ ] [GAP] **Permission modes**
- [ ] [GAP] **Read-only with network allowlist**
- [ ] [GAP] **Scope and enforcement**
- [ ] [GAP] **Unix sockets**
- [ ] [GAP] **What profiles control**
- [ ] [GAP] **Workspace write without network**

#### Personalize ChatGPT
- Original docs: <https://learn.chatgpt.com/docs/personalize.md>
- [ ] [GAP] **Carry context forward with memories**
- [ ] [GAP] **Choose a personality**
- [ ] [GAP] **Manage personalization**

#### Pets
- Original docs: <https://learn.chatgpt.com/docs/pets.md>
- [ ] [GAP] **Choose a pet on the web**
- [ ] [GAP] **Choose a terminal pet**
- [ ] [GAP] **Choose and wake a pet**
- [ ] [GAP] **Create a custom pet**
- [ ] [GAP] **Reduce animation**
- [ ] [GAP] **Understand pet status**
- [ ] [GAP] **Upload a custom pet**
- [ ] [GAP] **Use a floating pet**

#### Plugin controls
- Original docs: <https://learn.chatgpt.com/docs/enterprise/apps-and-connectors.md>
- [ ] [GAP] **Choose a starting set of plugins**
- [ ] [GAP] **Connector-backed capability controls**
- [ ] [GAP] **Plugin availability controls**
- [ ] [GAP] **Understand data flow and security**
- [ ] [GAP] **Understand the capability chain**

#### Plugins
- Original docs: <https://learn.chatgpt.com/docs/plugins.md>
- [ ] [GAP] **API key availability**
- [ ] [GAP] **Build your own plugin**
- [ ] [GAP] **Connect supported partners with Sign in with ChatGPT**
- [ ] [GAP] **How permissions and data sharing work**
- [ ] [GAP] **Install and use a plugin**
- [ ] [GAP] **Plugin guides**
- [ ] [GAP] **Remove a plugin**
- [ ] [GAP] **Universal plugin directory**
- [ ] [GAP] **Use and install plugins**
- [ ] [GAP] **Use plugins from a supported surface**

#### Pricing
- Original docs: <https://learn.chatgpt.com/docs/pricing.md>
- [ ] [GAP] **How does image generation count toward usage limits?**
- [ ] [GAP] **How much does Sites cost?**
- [ ] [GAP] **Invite friends and coworkers**
- [ ] [GAP] **What are the usage limits for my plan?**
- [ ] [GAP] **What are tokens and credits?**
- [ ] [GAP] **What can I do to make my usage limits last longer?**
- [ ] [GAP] **What happens when you hit usage limits?**
- [ ] [GAP] **Where can I see my current usage limits?**

#### Prisma AIRS
- Original docs: <https://learn.chatgpt.com/docs/enterprise/prisma-airs.md>
- [ ] [GAP] **Choose an endpoint**
- [ ] [GAP] **Choose how to handle prompts**
- [ ] [GAP] **Connect Prisma AIRS**
- [ ] [GAP] **Manage the connection**
- [ ] [GAP] **Understand what gets scanned**

#### Projects and chats
- Original docs: <https://learn.chatgpt.com/docs/projects.md>
- [ ] [GAP] **Bring in other tools and context**
- [ ] [GAP] **Choose a project or chat without one**
- [ ] [GAP] **Choose a project or start without one**
- [ ] [GAP] **Organize projects and chats**
- [ ] [GAP] **Start a chat without a project**
- [ ] [GAP] **Use Quick chat for a quick question**
- [ ] [GAP] **Use local projects for folders and codebases**
- [ ] [GAP] **Work in a project**
- [ ] [GAP] **Work in a project directory**
- [ ] [GAP] **Work in a workspace**

#### Prompting
- Original docs: <https://learn.chatgpt.com/docs/prompting.md>
- [ ] [GAP] **Add useful context**
- [ ] [GAP] **Compare options**
- [ ] [GAP] **Coordinate a launch**
- [ ] [GAP] **Describe the result you need**
- [ ] [GAP] **Draft and refine writing**
- [ ] [GAP] **Explain a codebase**
- [ ] [GAP] **Fix a bug**
- [ ] [GAP] **How to read these examples**
- [ ] [GAP] **Improve the result with follow-up messages**
- [ ] [GAP] **Iterate on UI with live updates**
- [ ] [GAP] **Make a practical plan**
- [ ] [GAP] **Make the result ready to use**
- [ ] [GAP] **Prompting examples for Chat**
- [ ] [GAP] **Prompting for ChatGPT Work**
- [ ] [GAP] **Prompting overview**
- [ ] [GAP] **Prototype from a screenshot**
- [ ] [GAP] **Put the pieces together**
- [ ] [GAP] **Research a decision**
- [ ] [GAP] **Review a GitHub pull request**
- [ ] [GAP] **Set boundaries that prevent real problems**
- [ ] [GAP] **Steering and queuing**
- [ ] [GAP] **Turn source material into finished files**
- [ ] [GAP] **Understand a topic**
- [ ] [GAP] **Update documentation**
- [ ] [GAP] **Write a test**

#### Propose security hardening
- Original docs: <https://learn.chatgpt.com/docs/security/plugin/security-hardening.md>
- [ ] [GAP] **Prepare the evidence**
- [ ] [GAP] **Review the portfolio**
- [ ] [GAP] **Run the workflow**
- [ ] [GAP] **Use hardening guidance from a scan**

#### Quickstart
- Original docs: <https://learn.chatgpt.com/docs/quickstart.md>
- [ ] [GAP] **Where to use ChatGPT**

#### Record & Replay
- Original docs: <https://learn.chatgpt.com/docs/extend/record-and-replay.md>
- [ ] [GAP] **I don't see Record & Replay**
- [ ] [GAP] **Replay the workflow**
- [ ] [GAP] **Start a recording**
- [ ] [GAP] **Tips for better recordings**
- [ ] [GAP] **When to build another plugin**

#### Remote connections
- Original docs: <https://learn.chatgpt.com/docs/remote-connections.md>
- [ ] [GAP] **Authentication and network exposure**
- [ ] [GAP] **Authentication blocks setup**
- [ ] [GAP] **Choose what to connect**
- [ ] [GAP] **Connect to an SSH host**
- [ ] [GAP] **Hand off a chat between hosts**
- [ ] [GAP] **Pick up work from another device**
- [ ] [GAP] **Remote Control is off after you sign back in**
- [ ] [GAP] **Set up Remote**
- [ ] [GAP] **The approval request doesn't appear**
- [ ] [GAP] **The remote session disconnects**
- [ ] [GAP] **What comes from the connected host**
- [ ] [GAP] **What you can do remotely**
- [ ] [GAP] **You don't see the host on your phone**

#### Review GitHub pull requests with Codex
- Original docs: <https://learn.chatgpt.com/docs/third-party/github.md>
- [ ] [GAP] **Act on review findings**
- [ ] [GAP] **Customize what Codex reviews**
- [ ] [GAP] **Enable automatic reviews**
- [ ] [GAP] **Request a Codex review**
- [ ] [GAP] **Request a Security Review**
- [ ] [GAP] **Set up Security Review**

#### Review code changes for security
- Original docs: <https://learn.chatgpt.com/docs/security/plugin/code-changes.md>
- [ ] [GAP] **Act on findings**
- [ ] [GAP] **Automate reviews in CI/CD**
- [ ] [GAP] **Run a manual review**

#### Roles and workspace permissions
- Original docs: <https://learn.chatgpt.com/docs/enterprise/roles-and-workspace-permissions.md>
- [ ] [GAP] **Apply local runtime policy**
- [ ] [GAP] **Assign workspace access**
- [ ] [GAP] **Understand the control boundaries**

#### Rules
- Original docs: <https://learn.chatgpt.com/docs/agent-configuration/rules.md>
- [ ] [GAP] **Create a rules file**
- [ ] [GAP] **Shell wrappers and compound commands**
- [ ] [GAP] **Test a rule file**
- [ ] [GAP] **Understand rule fields**
- [ ] [GAP] **Understand the rules language**
- [ ] [GAP] **When Codex can safely split the script**
- [ ] [GAP] **When Codex does not split the script**

#### Run Codex Security in CI
- Original docs: <https://learn.chatgpt.com/docs/security/cli/ci.md>
- [ ] [GAP] **Add the GitHub Actions workflow**
- [ ] [GAP] **Add the GitLab CI/CD pipeline**
- [ ] [GAP] **Choose a severity policy**
- [ ] [GAP] **Prepare the workflow**
- [ ] [GAP] **Retry with an existing result directory**
- [ ] [GAP] **Troubleshoot a CI scan**

#### Run a Codex Security scan
- Original docs: <https://learn.chatgpt.com/docs/security/plugin/scans.md>
- [ ] [GAP] **Choose the scan area**
- [ ] [GAP] **Let the phases complete**
- [ ] [GAP] **Reopen a previous scan**
- [ ] [GAP] **Review the completed scan**

#### Run a deep security scan
- Original docs: <https://learn.chatgpt.com/docs/security/plugin/deep-scans.md>
- [ ] [GAP] **Choose between standard and deep scans**
- [ ] [GAP] **Configure deep-scan runtime**
- [ ] [GAP] **Review the result**
- [ ] [GAP] **Start the deep scan**

#### Run bulk security scans
- Original docs: <https://learn.chatgpt.com/docs/security/cli/bulk-scans.md>
- [ ] [GAP] **Choose a repository source**
- [ ] [GAP] **Create a repository CSV**
- [ ] [GAP] **Discover GitHub repositories**
- [ ] [GAP] **Resume a campaign**
- [ ] [GAP] **Retry repository errors**
- [ ] [GAP] **Review campaign results**
- [ ] [GAP] **Run a campaign from CSV**
- [ ] [GAP] **Run bulk scans in Docker**
- [ ] [GAP] **Share security context and instructions**

#### Sample Configuration
- Original docs: <https://learn.chatgpt.com/docs/config-file/config-sample.md>
- [ ] [GAP] **bearer_token_env_var = "GITHUB_TOKEN" # optional; Authorization: Bearer <token>**
- [ ] [GAP] **model = "<bedrock-model-id>"**

#### Sandbox
- Original docs: <https://learn.chatgpt.com/docs/sandboxing.md>
- [ ] [GAP] **Configure defaults**
- [ ] [GAP] **What the sandbox does**
- [ ] [GAP] **Why it matters**

#### Scheduled tasks
- Original docs: <https://learn.chatgpt.com/docs/automations.md>
- [ ] [GAP] **Ask ChatGPT to create or update scheduled tasks**
- [ ] [GAP] **Automatically create new skills**
- [ ] [GAP] **Combining scheduled tasks with skills to fix your own bugs**
- [ ] [GAP] **Permissions and security model**
- [ ] [GAP] **Recent Code Bugfix**
- [ ] [GAP] **Schedule a task inside a chat**
- [ ] [GAP] **Stay up-to-date with your project**
- [ ] [GAP] **Workflow**

#### Security Review
- Original docs: <https://learn.chatgpt.com/docs/security/security-review.md>
- [ ] [GAP] **Add threat-model context**
- [ ] [GAP] **Configure Codex Security Review**
- [ ] [GAP] **Request a Codex Security Review**
- [ ] [GAP] **Set reporting thresholds**

#### Settings
- Original docs: <https://learn.chatgpt.com/docs/reference/settings.md>
- [ ] [GAP] **Appearance**
- [ ] [GAP] **Archived chats**
- [ ] [GAP] **General**
- [ ] [GAP] **Keep a chat near your work**
- [ ] [GAP] **Personalization**
- [ ] [GAP] **Suggested prompts**

#### Sites
- Original docs: <https://learn.chatgpt.com/docs/sites.md>
- [ ] [GAP] **Add Sign in with ChatGPT**
- [ ] [GAP] **Choose a supported site shape**
- [ ] [GAP] **Configure runtime environment values**
- [ ] [GAP] **Connect a custom domain**
- [ ] [GAP] **Control access and secrets**
- [ ] [GAP] **Get started with Sites**
- [ ] [GAP] **Prompt Sites for common tasks**
- [ ] [GAP] **Related documentation**
- [ ] [GAP] **Review Site analytics**
- [ ] [GAP] **Review before you share**
- [ ] [GAP] **Take down or delete a Site**
- [ ] [GAP] **Understand limits and unsupported uses**
- [ ] [GAP] **Understand projects, versions, and deployments**

#### Skill controls
- Original docs: <https://learn.chatgpt.com/docs/enterprise/skills.md>
- [ ] [GAP] **Owning controls**
- [ ] [GAP] **Skill distribution and administration**

#### Skills & Plugins
- Original docs: <https://learn.chatgpt.com/docs/skills-and-plugins.md>
- [ ] [GAP] **Choose between a skill and a plugin**
- [ ] [GAP] **Use plugins for tools and shared workflows**
- [ ] [GAP] **Use skills for repeatable work**

#### Speed
- Original docs: <https://learn.chatgpt.com/docs/agent-configuration/speed.md>
- [ ] [GAP] **Fast mode**

#### Subagents
- Original docs: <https://learn.chatgpt.com/docs/agent-configuration/subagents.md>
- [ ] [GAP] **Approvals and sandbox controls**
- [ ] [GAP] **Availability**
- [ ] [GAP] **Choosing models and reasoning**
- [ ] [GAP] **Core terms**
- [ ] [GAP] **Custom agent file schema**
- [ ] [GAP] **Global settings**
- [ ] [GAP] **Managing subagents**
- [ ] [GAP] **Orchestration and thread controls**
- [ ] [GAP] **Triggering subagent workflows**
- [ ] [GAP] **Why subagent workflows help**

#### Triage a backlog
- Original docs: <https://learn.chatgpt.com/docs/security/plugin/triage-backlog.md>
- [ ] [GAP] **Choose the findings to triage**
- [ ] [GAP] **Run read-only triage**

#### Troubleshooting
- Original docs: <https://learn.chatgpt.com/docs/reference/troubleshooting.md>
- [ ] [GAP] **App doesn't pick up a teammate's shared local environment**
- [ ] [GAP] **Code doesn't run on a worktree**
- [ ] [GAP] **Feedback and logs**
- [ ] [GAP] **Files appear in the side panel that Codex didn't edit**
- [ ] [GAP] **Find archived chats**
- [ ] [GAP] **Only some chats appear in the sidebar**
- [ ] [GAP] **Recover a prompt after selecting the wrong target**
- [ ] [GAP] **Remove a project from the sidebar**
- [ ] [GAP] **Stuck states and recovery patterns**
- [ ] [GAP] **Terminal issues**

#### Use ChatGPT
- Original docs: <https://learn.chatgpt.com/docs/use-chatgpt.md>
- [ ] [GAP] **Attach files**
- [ ] [GAP] **Bring the right context into ChatGPT**
- [ ] [GAP] **Choose cloud or local work**
- [ ] [GAP] **Choose how you want to work**
- [ ] [GAP] **Connect tools with plugins**
- [ ] [GAP] **Go from idea to useful result**
- [ ] [GAP] **Keep related work in a project**
- [ ] [GAP] **Talk to ChatGPT naturally**
- [ ] [GAP] **What ChatGPT Work can do**

#### Use ChatGPT Work and Codex with Amazon Bedrock
- Original docs: <https://learn.chatgpt.com/docs/amazon-bedrock.md>
- [ ] [GAP] **Authentication options**
- [ ] [GAP] **Configure the provider**
- [ ] [GAP] **Feature availability**
- [ ] [GAP] **How it works**
- [ ] [GAP] **Option 1: Bedrock API key**
- [ ] [GAP] **Option 2: AWS SDK credentials**
- [ ] [GAP] **Support boundaries**
- [ ] [GAP] **Supported models**
- [ ] [GAP] **Troubleshooting**
- [ ] [GAP] **Use ChatGPT Work and Codex with Amazon Bedrock**
- [ ] [GAP] **Verify setup**

#### Use Codex in Linear
- Original docs: <https://learn.chatgpt.com/docs/third-party/linear.md>
- [ ] [GAP] **Configure manually**
- [ ] [GAP] **Connect Linear for local work (MCP)**
- [ ] [GAP] **Data usage, privacy, and security**
- [ ] [GAP] **How Codex chooses an environment and repo**
- [ ] [GAP] **Mention `@Codex` in comments**
- [ ] [GAP] **Set up the Linear integration**
- [ ] [GAP] **Tips and troubleshooting**
- [ ] [GAP] **Use the CLI (recommended)**

#### Use Codex in Slack
- Original docs: <https://learn.chatgpt.com/docs/third-party/slack.md>
- [ ] [GAP] **Set up the Slack app**
- [ ] [GAP] **Start a chat**

#### Use Codex with the Agents SDK
- Original docs: <https://learn.chatgpt.com/docs/mcp-server.md>
- [ ] [GAP] **Build a single-agent workflow**
- [ ] [GAP] **Initialize Codex CLI as an MCP server**
- [ ] [GAP] **Running Codex as an MCP server**
- [ ] [GAP] **Trace the workflow**

#### Use the Codex Security workbench
- Original docs: <https://learn.chatgpt.com/docs/security/plugin/workbench.md>
- [ ] [GAP] **Follow scan progress**
- [ ] [GAP] **Inspect repository history**
- [ ] [GAP] **Review findings across scans**
- [ ] [GAP] **Start a scan from a conversation**

#### Visualizations
- Original docs: <https://learn.chatgpt.com/docs/visualizations.md>
- [ ] [GAP] **Check availability**
- [ ] [GAP] **Choose when a visualization helps**
- [ ] [GAP] **Improve accessibility**
- [ ] [GAP] **Prompt with an outcome and controls**
- [ ] [GAP] **Recover from a failed result**
- [ ] [GAP] **Refine and continue**
- [ ] [GAP] **Share or reuse a result**

#### WSL
- Original docs: <https://learn.chatgpt.com/docs/windows/wsl.md>
- [ ] [GAP] **Confirm you're connected to WSL**
- [ ] [GAP] **Launch VS Code from inside WSL**
- [ ] [GAP] **Open VS Code from a WSL terminal**
- [ ] [GAP] **Work on code inside WSL**

#### Web search
- Original docs: <https://learn.chatgpt.com/docs/web-search.md>
- [ ] [GAP] **Configure local web search**

#### What's new
- Original docs: <https://learn.chatgpt.com/docs/whats-new.md>
- [ ] [GAP] **April 13–17, 2026**
- [ ] [GAP] **April 20–24, 2026**
- [ ] [GAP] **April 6–10, 2026**
- [ ] [GAP] **Automate trusted workflows**
- [ ] [GAP] **Branch earlier and choose tools from the composer**
- [ ] [GAP] **Build and deploy websites with Sites** — No managed site-deploy product surface identified in the audited slices.
- [ ] [GAP] **Collaborate in a dedicated academic research workspace**
- [ ] [GAP] **Compare security scans and manage findings**
- [ ] [GAP] **Connect partner tools with Sign in with ChatGPT**
- [ ] [GAP] **Continue a chat on another host**
- [ ] [GAP] **Control parallel Codex work with Codex Micro**
- [ ] [GAP] **February 2–6, 2026**
- [ ] [GAP] **February 9–13, 2026**
- [ ] [GAP] **Find chats that need your attention**
- [ ] [GAP] **Find useful context across your browser and open tabs**
- [ ] [GAP] **Follow long-running goals**
- [ ] [GAP] **Give Codex context from any Mac app with Appshots**
- [ ] [GAP] **July 13–17, 2026**
- [ ] [GAP] **July 20–24, 2026**
- [ ] [GAP] **July 27–31, 2026**
- [ ] [GAP] **July 6–10, 2026**
- [ ] [GAP] **June 15–19, 2026**
- [ ] [GAP] **June 1–5, 2026**
- [ ] [GAP] **June 8–12, 2026**
- [ ] [GAP] **Keep Work conversations and Projects together on desktop**
- [ ] [GAP] **Let Codex operate the browser and review approvals**
- [ ] [GAP] **March 16–20, 2026**
- [ ] [GAP] **March 23–27, 2026**
- [ ] [GAP] **March 2–6, 2026**
- [ ] [GAP] **March 9–13, 2026**
- [ ] [GAP] **May 11–15, 2026**
- [ ] [GAP] **May 18–22, 2026**
- [ ] [GAP] **May 25–29, 2026**
- [ ] [GAP] **May 4–8, 2026**
- [ ] [GAP] **Move chats between Local and Worktree**
- [ ] [GAP] **Organize sessions and extend Codex CLI 0.146.0**
- [ ] [GAP] **Package workflows as plugins**
- [ ] [GAP] **Preview and operate work in one place**
- [ ] [GAP] **Refine generated images in your conversation**
- [ ] [GAP] **Review and ship pull requests in the app**
- [ ] [GAP] **Review changes across repositories**
- [ ] [GAP] **Run Codex natively on Windows**
- [ ] [GAP] **Run security scans from the terminal, CI, or TypeScript**
- [ ] [GAP] **Schedule work with the right environment**
- [ ] [GAP] **Start with a chat and keep it moving**
- [ ] [GAP] **Steer active work and add files**
- [ ] [GAP] **Take on ambitious work in ChatGPT**
- [ ] [GAP] **Talk through work with ChatGPT Voice**
- [ ] [GAP] **Turn demonstrated workflows into reusable skills**
- [ ] [GAP] **Use Codex with Amazon Bedrock**
- [ ] [GAP] **Use Windows apps and control Codex remotely**
- [ ] [GAP] **Work across browser tabs with the Chrome extension**
- [ ] [GAP] **Work across multiple folders in one local project**

#### Windows sandbox
- Original docs: <https://learn.chatgpt.com/docs/windows/windows-sandbox.md>
- [ ] [GAP] **Configure the Windows sandbox**
- [ ] [GAP] **Grant sandbox read access**
- [ ] [GAP] **Sandbox permissions**
- [ ] [GAP] **Windows version matrix**

#### Work with files
- Original docs: <https://learn.chatgpt.com/docs/artifacts-viewer.md>
- [ ] [GAP] **Create files for review**
- [ ] [GAP] **Refine files with annotations**
- [ ] [GAP] **Related docs**
- [ ] [GAP] **Review and refine files**
- [ ] [GAP] **Review and refine files on the web**
- [ ] [GAP] **Work with files**

#### Workspace analytics
- Original docs: <https://learn.chatgpt.com/docs/enterprise/workspace-analytics.md>
- [ ] [GAP] **Choose a reporting surface**
- [ ] [GAP] **Interpret reporting data**
- [ ] [GAP] **Review ChatGPT workspace analytics**

#### Workspace model availability
- Original docs: <https://learn.chatgpt.com/docs/enterprise/workspace-model-availability.md>
- [ ] [GAP] **Current sources**
- [ ] [GAP] **Identify the model boundary**
- [ ] [GAP] **Separate access from runtime permissions**
- [ ] [GAP] **Troubleshoot model access**

#### Worktrees
- Original docs: <https://learn.chatgpt.com/docs/environments/git-worktrees.md>
- [ ] [GAP] **Advanced details**
- [ ] [GAP] **Branch limitations**
- [ ] [GAP] **Codex-managed and permanent worktrees**
- [ ] [GAP] **Copy ignored local files into managed worktrees**
- [ ] [GAP] **Frequently asked questions**
- [ ] [GAP] **How Codex manages worktrees for you**
- [ ] [GAP] **Option 1: Working on the worktree**
- [ ] [GAP] **Option 2: Handing a chat off to Local**
- [ ] [GAP] **Terminology**
- [ ] [GAP] **What's a worktree**
- [ ] [GAP] **Why use a worktree**
- [ ] [GAP] **Working between Local and Worktree**
- [ ] [GAP] **Worktree cleanup**

#### Write vulnerability reports
- Original docs: <https://learn.chatgpt.com/docs/security/plugin/vulnerability-reports.md>
- [ ] [GAP] **Review each report**
- [ ] [GAP] **Use reports from a scan**

#### codex-manual
- Original docs: <https://learn.chatgpt.com/docs/codex-manual.md>
- [ ] [GAP] **"/absolute/path/to/secrets" = "deny"**
- [ ] [GAP] **"/var/run/docker.sock" = "allow"**
- [ ] [GAP] **":workspace_roots" = { "." = "write", "\*\*/\*.env" = "deny" }**
- [ ] [GAP] **"\*" allows any public host that is not denied, so prefer scoped rules when possible.**
- [ ] [GAP] **"\*.example.com" matches subdomains only; "\*\*.example.com" matches the apex plus subdomains.**
- [ ] [GAP] **"api.openai.com" = "allow"**
- [ ] [GAP] **"example.com" = "deny"**
- [ ] [GAP] **"x-otlp-api-key" = "${OTLP_TOKEN}"**
- [ ] [GAP] **"~/code/app" = true**
- [ ] [GAP] **"~/code/shared-lib" = true**
- [ ] [GAP] **--- Example: Azure/OpenAI-compatible provider ---**
- [ ] [GAP] **--- Example: Local OSS (e.g., Ollama-compatible) ---**
- [ ] [GAP] **--- Example: OpenAI data residency with explicit base URL or headers ---**
- [ ] [GAP] **--- Example: STDIO transport ---**
- [ ] [GAP] **--- Example: Streamable HTTP transport ---**
- [ ] [GAP] **--- Example: built-in Amazon Bedrock provider options ---**
- [ ] [GAP] **--- Example: command-backed bearer token auth ---**
- [ ] [GAP] **.worktreeinclude**
- [ ] [GAP] **Add an exact local IP literal or `localhost` allow rule for one target, or set it to true only when broader local access is required.**
- [ ] [GAP] **Additional writable roots beyond the workspace (cwd). Default: []**
- [ ] [GAP] **Advanced Configuration**
- [ ] [GAP] **Allow login-shell semantics for shell-based tools when they request `login = true`.**
- [ ] [GAP] **Allow outbound network access inside the sandbox. Default: false**
- [ ] [GAP] **Allowed values: chatgpt | api**
- [ ] [GAP] **Analytics API**
- [ ] [GAP] **Append one JSON argument with the path and editor context.**
- [ ] [GAP] **Append the opened path directly after the command.**
- [ ] [GAP] **Approval & Sandbox**
- [ ] [GAP] **Approvals, Sandboxing, and Security**
- [ ] [GAP] **Apps / Connectors**
- [ ] [GAP] **Authentication & Login**
- [ ] [GAP] **Authentication and sessions**
- [ ] [GAP] **Available IDs include app-name, project, spinner, status, thread, git-branch, model,**
- [ ] [GAP] **Base URL for ChatGPT auth flow (not OpenAI API).**
- [ ] [GAP] **Brainstorm plugin use cases**
- [ ] [GAP] **Breaking changes**
- [ ] [GAP] **Built-ins include:**
- [ ] [GAP] **By default, deny read access to all files on disk.**
- [ ] [GAP] **By extending the :workspace profile, :tmpdir and :slash_tmp are "write" by**
- [ ] [GAP] **By extending the :workspace profile, you get Codex's safeguards to ensure**
- [ ] [GAP] **CLI command reference**
- [ ] [GAP] **CLI, IDE, App, and Cloud Behavior**
- [ ] [GAP] **Canonical case-insensitive filters. "include" entries create an allowlist.**
- [ ] [GAP] **Centralized Feature Flags (preferred)**
- [ ] [GAP] **ChatGPT Voice**
- [ ] [GAP] **ChatGPT Work admin FAQ**
- [ ] [GAP] **ChatGPT on the web**
- [ ] [GAP] **ChatGPT usage limits and spend controls**
- [ ] [GAP] **Check for updates on startup. Default: true**
- [ ] [GAP] **Cloud environments**
- [ ] [GAP] **Code mode namespaces. This feature is under development and off by default.**
- [ ] [GAP] **Codex Security TypeScript SDK**
- [ ] [GAP] **Codex Security plugin changelog**
- [ ] [GAP] **Codex Security plugin quickstart**
- [ ] [GAP] **Codex appends a server-specific callback ID before OAuth login.**
- [ ] [GAP] **Communication style for supported models. Allowed values: none | friendly | pragmatic**
- [ ] [GAP] **Compliance API and audit events**
- [ ] [GAP] **Config Profiles (separate files)**
- [ ] [GAP] **Config basics**
- [ ] [GAP] **Configuration, Authentication, and Models**
- [ ] [GAP] **Connect and test your plugin**
- [ ] [GAP] **Control alternate screen usage (auto skips it in Zellij to preserve scrollback).**
- [ ] [GAP] **Control whether users can submit feedback from `/feedback`. Default: true**
- [ ] [GAP] **Custom callback paths are supported. `mcp_oauth_callback_port` still controls the listener port.**
- [ ] [GAP] **Custom key bindings. Selected composer actions fall back to matching [tui.keymap.global] bindings.**
- [ ] [GAP] **Customization, Skills, Rules, MCP, and Integrations**
- [ ] [GAP] **Cyber Safety**
- [ ] [GAP] **Default OSS provider for --oss sessions. When unset, Codex prompts. Default: unset.**
- [ ] [GAP] **Default local provider used with `--oss`**
- [ ] [GAP] **Default model for spawned agents. An explicit spawn model takes precedence.**
- [ ] [GAP] **Default reasoning effort for spawned agents. An explicit spawn effort takes precedence.**
- [ ] [GAP] **Default: true. Set false to force non-login shells and reject explicit login-shell requests.**
- [ ] [GAP] **Define MCP servers under this table. Leave empty to disable.**
- [ ] [GAP] **Define tools**
- [ ] [GAP] **Deploy the Windows app**
- [ ] [GAP] **Desktop notifications from the TUI: boolean or filtered list. Default: true**
- [ ] [GAP] **Developers**
- [ ] [GAP] **Disable burst-paste detection in the TUI. Default: false**
- [ ] [GAP] **Disable or re-enable a specific skill without deleting it.**
- [ ] [GAP] **Disable surface-specific features when needed.**
- [ ] [GAP] **Don't combine filters with legacy exclude or**
- [ ] [GAP] **Enable memories with [features].memories, then tune memory behavior here.**
- [ ] [GAP] **Enable or disable analytics for this machine. When unset, Codex uses its default behavior.**
- [ ] [GAP] **Enable or disable multi-agent tools. Default: true**
- [ ] [GAP] **Enable the feature before configuring sandboxed networking rules.**
- [ ] [GAP] **Enables welcome/status/spinner animations. Default: true**
- [ ] [GAP] **Environment Profile**
- [ ] [GAP] **Environment label applied to telemetry. Default: "dev"**
- [ ] [GAP] **Environment variables**
- [ ] [GAP] **Exact hosts match only themselves.**
- [ ] [GAP] **Example OTLP/HTTP exporter configuration**
- [ ] [GAP] **Example OTLP/gRPC trace exporter configuration**
- [ ] [GAP] **Example additional workspace roots that inherit this profile's**
- [ ] [GAP] **Example filesystem profile. Use `"deny"` to deny reads for exact paths or**
- [ ] [GAP] **Example granular approval policy:**
- [ ] [GAP] **Example granular policy:**
- [ ] [GAP] **Examples: false | ["agent-turn-complete", "approval-requested"]**
- [ ] [GAP] **Exclude $TMPDIR from writable roots. Default: false**
- [ ] [GAP] **Exclude /tmp from writable roots. Default: false**
- [ ] [GAP] **Excludes apply before explicit set values and the include allowlist.**
- [ ] [GAP] **Execution Model and Workflows**
- [ ] [GAP] **Experimental: run via user shell profile. Default: false**
- [ ] [GAP] **Explicit key/value overrides. Include filters can still remove them. Default: {}**
- [ ] [GAP] **Export and track security findings**
- [ ] [GAP] **Exporter: none (default) | otlp-http | otlp-grpc**
- [ ] [GAP] **External notifier program (argv array). When unset: disabled.**
- [ ] [GAP] **Feature Maturity**
- [ ] [GAP] **Find By Topic**
- [ ] [GAP] **Fix and verify security findings**
- [ ] [GAP] **For example, a CI profile could live at $CODEX_HOME/ci.config.toml:**
- [ ] [GAP] **Force enable or disable reasoning summaries for current model.**
- [ ] [GAP] **Force login mechanism when Codex would normally auto-select. Default: unset.**
- [ ] [GAP] **From your WSL shell**
- [ ] [GAP] **Get started with ChatGPT Work**
- [ ] [GAP] **Glossary**
- [ ] [GAP] **Governance**
- [ ] [GAP] **Groups and provisioning**
- [ ] [GAP] **History & File Opener**
- [ ] [GAP] **History (table)**
- [ ] [GAP] **If you use --yolo or another full access sandbox setting, web search defaults to live.**
- [ ] [GAP] **Image generation**
- [ ] [GAP] **Import from another agent**
- [ ] [GAP] **Improving the threat model**
- [ ] [GAP] **In-product notices (mostly set automatically by Codex).**
- [ ] [GAP] **Include user prompt text in logs. Default: false**
- [ ] [GAP] **Inline override for the history compaction prompt. Default: unset.**
- [ ] [GAP] **Install and run Codex in WSL**
- [ ] [GAP] **Install default Linux distribution (like Ubuntu)**
- [ ] [GAP] **Install dependencies**
- [ ] [GAP] **Install type checker**
- [ ] [GAP] **Instruction Overrides**
- [ ] [GAP] **Integrated terminal**
- [ ] [GAP] **Internal tooltip state keyed by model slug. Usually managed by Codex.**
- [ ] [GAP] **Leave this table empty to accept defaults. Set explicit booleans to opt in/out.**
- [ ] [GAP] **Leave unset to choose when the current and saved session directories differ.**
- [ ] [GAP] **Lifecycle hooks can be configured here inline or in a sibling hooks.json.**
- [ ] [GAP] **Load the compact prompt override from a file. Default: unset.**
- [ ] [GAP] **Local environments**
- [ ] [GAP] **Long-running work**
- [ ] [GAP] **MCP server and UI quickstart**
- [ ] [GAP] **MCP server review requirements**
- [ ] [GAP] **Manage app updates**
- [ ] [GAP] **Mark specific worktrees as trusted or untrusted.**
- [ ] [GAP] **Max bytes from AGENTS.md to embed into first-turn instructions. Default: 32768**
- [ ] [GAP] **Maximum bytes for history file; oldest entries are trimmed when exceeded. Example: 5242880**
- [ ] [GAP] **Maximum concurrently open spawned-agent threads, excluding the primary thread. When unset, Codex chooses the default.**
- [ ] [GAP] **Memories (table)**
- [ ] [GAP] **Metrics exporter: none | statsig | otlp-http | otlp-grpc**
- [ ] [GAP] **Model Context Protocol**
- [ ] [GAP] **Named permissions profile to apply by default. Built-ins:**
- [ ] [GAP] **Native Windows sandbox mode (Windows only): unelevated | elevated**
- [ ] [GAP] **Non-interactive mode**
- [ ] [GAP] **Noninteractive and Programmatic Interfaces**
- [ ] [GAP] **Notification mechanism for terminal alerts: auto | osc9 | bel. Default: "auto"**
- [ ] [GAP] **Open Source**
- [ ] [GAP] **OpenAI Developers plugin**
- [ ] [GAP] **OpenTelemetry (OTEL) - disabled by default**
- [ ] [GAP] **Optimize Metadata**
- [ ] [GAP] **Optional MCP OAuth callback overrides (used by `codex mcp login`)**
- [ ] [GAP] **Optional base URL override for the built-in OpenAI provider.**
- [ ] [GAP] **Optional fixed port for MCP OAuth callback: 1-65535. Default: unset.**
- [ ] [GAP] **Optional manual model metadata. When unset, Codex uses model or preset defaults.**
- [ ] [GAP] **Optional model override for /review. Default: unset (uses current session model).**
- [ ] [GAP] **Optional override used when Codex runs in plan mode: none | minimal | low | medium | high | xhigh**
- [ ] [GAP] **Optional per-app controls.**
- [ ] [GAP] **Optional redirect URI override for MCP OAuth login (for example, remote devbox ingress).**
- [ ] [GAP] **Optional reminder_interval_tokens defaults to 10% of limit_tokens.**
- [ ] [GAP] **Ordered fallbacks when AGENTS.md is missing at a directory level. Default: []**
- [ ] [GAP] **Ordered list of footer status-line item IDs. When unset, Codex uses:**
- [ ] [GAP] **Ordered list of terminal window/tab title item IDs. When unset, Codex uses:**
- [ ] [GAP] **Override built-in base instructions with a file path. Default: unset.**
- [ ] [GAP] **Package your plugin**
- [ ] [GAP] **Permissions** — Fine-tuning appears only in outbound third-party connectors (e.g. services/open-connector Mistral executors).
- [ ] [GAP] **Personalize ChatGPT**
- [ ] [GAP] **Place fixed arguments before the opened path.**
- [ ] [GAP] **Platform, Enterprise, and Caveats**
- [ ] [GAP] **Plugin architecture**
- [ ] [GAP] **Plugin controls**
- [ ] [GAP] **Plugin submission errors**
- [ ] [GAP] **Preferred service tier. Use fast or another tier supported by the active model.**
- [ ] [GAP] **Preferred store for MCP OAuth credentials: auto (default) | file | keyring**
- [ ] [GAP] **Pricing**
- [ ] [GAP] **Prisma AIRS**
- [ ] [GAP] **Project Documentation Controls**
- [ ] [GAP] **Project root marker filenames used when searching parent directories. Default: [".git"]**
- [ ] [GAP] **Projects (trust levels)**
- [ ] [GAP] **Projects and chats**
- [ ] [GAP] **Prompting**
- [ ] [GAP] **Propose security hardening**
- [ ] [GAP] **Provider id selected from [model_providers]. Default: "openai".**
- [ ] [GAP] **Quickstart**
- [ ] [GAP] **Reasoning & Verbosity (Responses API capable models)**
- [ ] [GAP] **Reasoning effort: minimal | low | medium | high | xhigh**
- [ ] [GAP] **Reasoning summary: auto | concise | detailed | none**
- [ ] [GAP] **Record & Replay**
- [ ] [GAP] **Record a model-visible message when an agent turn is interrupted. Default: true**
- [ ] [GAP] **Register the full derived URI with your provider, not just the base host or unsuffixed path.**
- [ ] [GAP] **Remote connections**
- [ ] [GAP] **Resources**
- [ ] [GAP] **Restrict ChatGPT login to a specific workspace id. Default: unset.**
- [ ] [GAP] **Review GitHub pull requests with Codex**
- [ ] [GAP] **Roles and workspace permissions**
- [ ] [GAP] **Rollout budget tracking. This feature is under development and off by default.**
- [ ] [GAP] **Run Codex Security in CI**
- [ ] [GAP] **Run a Codex Security scan**
- [ ] [GAP] **Run a deep security scan**
- [ ] [GAP] **Sample Configuration**
- [ ] [GAP] **Sandbox settings (tables)**
- [ ] [GAP] **Sandboxed networking settings**
- [ ] [GAP] **Security & Privacy**
- [ ] [GAP] **Security Review**
- [ ] [GAP] **Select it with codex --profile ci.**
- [ ] [GAP] **Set `default_permissions = "workspace"` before enabling this profile.**
- [ ] [GAP] **Set conservative defaults**
- [ ] [GAP] **Set false to remove those variables before applying explicit filters.**
- [ ] [GAP] **Set to [] to hide the footer.**
- [ ] [GAP] **Shell Environment Policy for spawned processes (table)**
- [ ] [GAP] **Show onboarding tooltips in the welcome screen. Default: true**
- [ ] [GAP] **Show raw reasoning content when available. Default: false**
- [ ] [GAP] **Skill controls**
- [ ] [GAP] **Skills & Plugins**
- [ ] [GAP] **Skills (per-skill overrides)**
- [ ] [GAP] **Skip automatic filtering for names containing KEY/SECRET/TOKEN. Default: true.**
- [ ] [GAP] **Start a shell inside Windows Subsystem for Linux**
- [ ] [GAP] **Submit plugins**
- [ ] [GAP] **Suppress internal reasoning events from output. Default: false**
- [ ] [GAP] **Suppress the warning shown when under-development feature flags are enabled.**
- [ ] [GAP] **Surfaces and experiences**
- [ ] [GAP] **Syntax-highlighting theme (kebab-case). Use /theme in the TUI to preview and save.**
- [ ] [GAP] **Tenant Risk Taxonomy and Allow/Deny Rules**
- [ ] [GAP] **These IDs are reserved. Use a different ID for custom providers.**
- [ ] [GAP] **This file lists the main keys Codex reads from config.toml, along with default**
- [ ] [GAP] **Though in practice, a software agent needs to be able to read folders that**
- [ ] [GAP] **To create a config profile, put overrides in a separate profile file under $CODEX_HOME.**
- [ ] [GAP] **Token weights default to 1.0.**
- [ ] [GAP] **Trace exporter: none (default) | otlp-http | otlp-grpc**
- [ ] [GAP] **Track Windows onboarding acknowledgement (Windows only). Default: false**
- [ ] [GAP] **Treat a directory as the project root when it contains any of these markers.**
- [ ] [GAP] **Triage a backlog**
- [ ] [GAP] **TypeScript**
- [ ] [GAP] **UI guidelines**
- [ ] [GAP] **UI, Notifications, and Misc**
- [ ] [GAP] **UI, Notifications, and Misc (tables)**
- [ ] [GAP] **URI scheme for clickable citations: vscode (default) | vscode-insiders | windsurf | cursor | none**
- [ ] [GAP] **Use Codex in Linear**
- [ ] [GAP] **Use Codex in Slack**
- [ ] [GAP] **Use [] to unbind an action.**
- [ ] [GAP] **Use a custom name such as "workspace" only when you also define [permissions.workspace].**
- [ ] [GAP] **Use the Codex Security workbench**
- [ ] [GAP] **Visualizations**
- [ ] [GAP] **Web search mode: disabled | cached | indexed | live. Default: "cached"**
- [ ] [GAP] **What's new**
- [ ] [GAP] **When notifications fire: unfocused (default) | always**
- [ ] [GAP] **When to ask for command approval:**
- [ ] [GAP] **Where to persist CLI login credentials: file (default) | keyring | auto**
- [ ] [GAP] **Who reviews eligible approval prompts: user (default) | auto_review**
- [ ] [GAP] **Windows app**
- [ ] [GAP] **Windows sandbox**
- [ ] [GAP] **Working directory for resumed or forked sessions: current | session.**
- [ ] [GAP] **Workspace analytics**
- [ ] [GAP] **Workspace model availability**
- [ ] [GAP] **Worktrees**
- [ ] [GAP] **Write vulnerability reports**
- [ ] [GAP] **You can also add custom .tmTheme files under $CODEX_HOME/themes.**
- [ ] [GAP] **["model-with-reasoning", "context-remaining", "current-dir"].**
- [ ] [GAP] **["spinner", "project"]. Set to [] to clear the title.**
- [ ] [GAP] **[[hooks.PreToolUse.hooks]]**
- [ ] [GAP] **[[hooks.PreToolUse]]**
- [ ] [GAP] **[_default] applies to all apps unless overridden per app.**
- [ ] [GAP] **[agents.reviewer]**
- [ ] [GAP] **[apps._default]**
- [ ] [GAP] **[apps.google_drive.tools."files/delete"]**
- [ ] [GAP] **[apps.google_drive]**
- [ ] [GAP] **[features.code_mode]**
- [ ] [GAP] **[features.network_proxy]**
- [ ] [GAP] **[features.rollout_budget]**
- [ ] [GAP] **[mcp_servers.docs]**
- [ ] [GAP] **[mcp_servers.github]**
- [ ] [GAP] **[otel.exporter."otlp-http".headers]**
- [ ] [GAP] **[otel.exporter."otlp-http".tls]**
- [ ] [GAP] **[otel.exporter."otlp-http"]**
- [ ] [GAP] **[otel.trace_exporter."otlp-grpc"]**
- [ ] [GAP] **[permissions.workspace.filesystem]**
- [ ] [GAP] **[permissions.workspace.network.domains]**
- [ ] [GAP] **[permissions.workspace.network.unix_sockets]**
- [ ] [GAP] **[permissions.workspace.network]**
- [ ] [GAP] **[permissions.workspace.workspace_roots]**
- [ ] [GAP] **[projects."/absolute/path/to/project"]**
- [ ] [GAP] **[tool_suggest]**
- [ ] [GAP] **[tui.keymap.chat]**
- [ ] [GAP] **[tui.keymap.composer]**
- [ ] [GAP] **[tui.keymap.global]**
- [ ] [GAP] **[tui.model_availability_nux]**
- [ ] [GAP] **`:workspace_roots` filesystem rules.**
- [ ] [GAP] **`allow_local_binding = false` blocks loopback and private destinations by default.**
- [ ] [GAP] **admin_url = "http://127.0.0.1:43129"**
- [ ] [GAP] **allow_local_binding = false**
- [ ] [GAP] **allow_upstream_proxy = false**
- [ ] [GAP] **alternate_screen = "auto"**
- [ ] [GAP] **and task-progress.**
- [ ] [GAP] **approval_mode = "approve"**
- [ ] [GAP] **approvals_reviewer = "user"**
- [ ] [GAP] **apps = true**
- [ ] [GAP] **args = ["--port", "4000"] # optional**
- [ ] [GAP] **background_terminal_max_timeout = 300000 # ms; max empty write_stdin poll window (default 5m)**
- [ ] [GAP] **base_url = "http://localhost:11434/v1"**
- [ ] [GAP] **base_url = "https://YOUR_PROJECT_NAME.openai.azure.com/openai"**
- [ ] [GAP] **base_url = "https://proxy.example.com/v1"**
- [ ] [GAP] **base_url = "https://us.api.openai.com/v1" # example with 'us' domain prefix**
- [ ] [GAP] **bearer_token_env_var = "GITHUB_TOKEN" # optional; Authorization: Bearer**
- [ ] [GAP] **behaviors, recommended examples, and concise explanations. Adjust as needed.**
- [ ] [GAP] **ca-certificate = "certs/otel-ca.pem"**
- [ ] [GAP] **cached returns pre-indexed results; indexed gates external web access through**
- [ ] [GAP] **cached serves results from a web search cache (an OpenAI-maintained index).**
- [ ] [GAP] **client-certificate = "/etc/codex/certs/client.pem"**
- [ ] [GAP] **client-private-key = "/etc/codex/certs/client-key.pem"**
- [ ] [GAP] **command = "/usr/local/bin/fetch-codex-token"**
- [ ] [GAP] **command = "docs-server" # required**
- [ ] [GAP] **command = 'python3 "/absolute/path/to/pre_tool_use_policy.py"'**
- [ ] [GAP] **compact_prompt = ""**
- [ ] [GAP] **config_file = "./agents/reviewer.toml" # relative to the config.toml that defines it**
- [ ] [GAP] **contain common tools, such as `/usr/bin`, to get work done, so grant access**
- [ ] [GAP] **cwd = "/path/to/server" # optional working directory override**
- [ ] [GAP] **dangerously_allow_all_unix_sockets = false**
- [ ] [GAP] **dangerously_allow_non_loopback_admin = false**
- [ ] [GAP] **dangerously_allow_non_loopback_proxy = false**
- [ ] [GAP] **default, though you can deny access to them altogether, if desired.**
- [ ] [GAP] **default_permissions = ":workspace"**
- [ ] [GAP] **default_tools_approval_mode = "auto" # auto | prompt | writes | approve**
- [ ] [GAP] **default_tools_approval_mode = "prompt" # auto | prompt | writes | approve**
- [ ] [GAP] **default_tools_enabled = true**
- [ ] [GAP] **description = "Find correctness, security, and test risks in code."**
- [ ] [GAP] **destructive_enabled = false # block destructive-hint tools for this app**
- [ ] [GAP] **destructive_enabled = true**
- [ ] [GAP] **developer_instructions = ""**
- [ ] [GAP] **direct_only_tool_namespaces = ["mcp__history"]**
- [ ] [GAP] **disable_on_external_context = false # legacy alias: no_memories_if_mcp_or_web_search**
- [ ] [GAP] **disabled_tools = [**
- [ ] [GAP] **disabled_tools = ["delete_issue"] # optional deny-list**
- [ ] [GAP] **disabled_tools = ["slow-tool"] # optional deny-list (applied after allow-list)**
- [ ] [GAP] **discoverables = [**
- [ ] [GAP] **domains = { "api.openai.com" = "allow", "example.com" = "deny" }**
- [ ] [GAP] **enable_request_compression = true**
- [ ] [GAP] **enable_socks5 = false**
- [ ] [GAP] **enable_socks5_udp = false**
- [ ] [GAP] **enabled = false**
- [ ] [GAP] **enabled = true**
- [ ] [GAP] **enabled = true # optional; default true**
- [ ] [GAP] **enabled_tools = ["list_issues"] # optional allow-list**
- [ ] [GAP] **enabled_tools = ["search", "summarize"] # optional allow-list**
- [ ] [GAP] **endpoint = "https://otel.example.com/v1/logs"**
- [ ] [GAP] **endpoint = "https://otel.example.com:4317"**
- [ ] [GAP] **env = { "API_KEY" = "value" } # optional key/value pairs copied as-is**
- [ ] [GAP] **env_http_headers = { "X-Auth" = "AUTH_ENV" } # optional headers populated from env vars**
- [ ] [GAP] **env_key = "AZURE_OPENAI_API_KEY"**
- [ ] [GAP] **env_key_instructions = "Set AZURE_OPENAI_API_KEY in your environment"**
- [ ] [GAP] **env_vars = ["ANOTHER_SECRET"] # optional: forward local parent env vars**
- [ ] [GAP] **env_vars = ["LOCAL_TOKEN", { name = "REMOTE_TOKEN", source = "remote" }]**
- [ ] [GAP] **excluded_tool_namespaces = ["mcp__codex_apps"]**
- [ ] [GAP] **experimental_compact_prompt_file = "./compact_prompt.txt"**
- [ ] [GAP] **experimental_compact_prompt_file = "/absolute/or/relative/path/to/compact_prompt.txt"**
- [ ] [GAP] **experimental_environment = "remote" # experimental: run stdio via a remote executor**
- [ ] [GAP] **exporter details live under exporter tables; see Monitoring and telemetry above**
- [ ] [GAP] **fast_mode = true**
- [ ] [GAP] **features = { unified_exec = false }**
- [ ] [GAP] **forced_chatgpt_workspace_id = "00000000-0000-0000-0000-000000000000"**
- [ ] [GAP] **forced_login_method = "chatgpt"**
- [ ] [GAP] **generate_memories = true**
- [ ] [GAP] **glob patterns. On platforms that need pre-expanded glob matches, set**
- [ ] [GAP] **glob_scan_max_depth = 3**
- [ ] [GAP] **glob_scan_max_depth when using unbounded patterns such as `\*\*`.**
- [ ] [GAP] **headers = { "x-otlp-meta" = "abc123" }**
- [ ] [GAP] **hide_full_access_warning = true**
- [ ] [GAP] **hide_gpt5_1_migration_prompt = true**
- [ ] [GAP] **hide_rate_limit_model_nudge = true**
- [ ] [GAP] **hide_world_writable_warning = true**
- [ ] [GAP] **hooks = false**
- [ ] [GAP] **http_headers = { "X-Example" = "value" } # optional static headers**
- [ ] [GAP] **include_only arrays in the same configuration layer.**
- [ ] [GAP] **inherit: all (default) | core | none**
- [ ] [GAP] **interrupt_message = true**
- [ ] [GAP] **interrupt_turn = "f12"**
- [ ] [GAP] **limit_tokens = 100000**
- [ ] [GAP] **limit_tokens is required when enabled.**
- [ ] [GAP] **log_dir = "/absolute/path/to/codex-logs" # log directory; setting explicitly enables codex-tui.log; default: "$CODEX_HOME/log"**
- [ ] [GAP] **matcher = "^Bash$"**
- [ ] [GAP] **max_bytes = 5242880**
- [ ] [GAP] **max_concurrent_threads_per_session = 6**
- [ ] [GAP] **mcp_oauth_callback_port = 4321**
- [ ] [GAP] **mcp_oauth_callback_url = "https://devbox.example.internal/callback"**
- [ ] [GAP] **mode = "limited" # limited | full**
- [ ] [GAP] **model_auto_compact_token_limit = 64000 # tokens; unset uses model defaults**
- [ ] [GAP] **model_auto_compact_token_limit_scope = "total" # total | body_after_prefix; default: total**
- [ ] [GAP] **model_catalog_json = "./models.json"**
- [ ] [GAP] **model_catalog_json = "/absolute/path/to/models.json" # optional startup-only model catalog override**
- [ ] [GAP] **model_context_window = 128000 # tokens; default: auto for model**
- [ ] [GAP] **model_instructions_file = "/absolute/or/relative/path/to/instructions.txt"**
- [ ] [GAP] **model_provider = "amazon-bedrock"**
- [ ] [GAP] **model_verbosity = "medium"**
- [ ] [GAP] **name = "Azure"**
- [ ] [GAP] **name = "Ollama"**
- [ ] [GAP] **name = "OpenAI Data Residency"**
- [ ] [GAP] **name = "OpenAI using LLM proxy"**
- [ ] [GAP] **network_proxy = false**
- [ ] [GAP] **notification_condition = "unfocused"**
- [ ] [GAP] **notification_method = "auto"**
- [ ] [GAP] **oauth_resource = "https://docs.example.com/" # optional OAuth resource**
- [ ] [GAP] **open_external_editor = []**
- [ ] [GAP] **open_transcript = "ctrl-t"**
- [ ] [GAP] **open_world_enabled = true**
- [ ] [GAP] **openai_base_url = "https://us.api.openai.com/v1"**
- [ ] [GAP] **oss_provider = "ollama"**
- [ ] [GAP] **path = "/path/to/skill/SKILL.md"**
- [ ] [GAP] **personality = "pragmatic"**
- [ ] [GAP] **personality = "pragmatic" # or "friendly" or "none"**
- [ ] [GAP] **personality = true**
- [ ] [GAP] **prefill_token_weight = 1.0**
- [ ] [GAP] **prevent_idle_sleep = false**
- [ ] [GAP] **profile = "default"**
- [ ] [GAP] **project_root_markers = [".git"]**
- [ ] [GAP] **protocol = "binary" # "binary" | "json"**
- [ ] [GAP] **proxy_url = "http://127.0.0.1:43128"**
- [ ] [GAP] **query_params = { api-version = "2025-04-01-preview" }**
- [ ] [GAP] **refresh_interval_ms = 300000**
- [ ] [GAP] **region = "eu-central-1"**
- [ ] [GAP] **reminder_interval_tokens = 10000**
- [ ] [GAP] **remote_plugin = true**
- [ ] [GAP] **required = true # optional; fail startup/resume if this server cannot initialize**
- [ ] [GAP] **resume_cwd = "session"**
- [ ] [GAP] **sampling_token_weight = 1.0**
- [ ] [GAP] **sandbox = "unelevated" # Fallback if admin permissions/setup are unavailable**
- [ ] [GAP] **sandbox_mode = "read-only"**
- [ ] [GAP] **save-all (default) | none**
- [ ] [GAP] **scopes = ["read:docs"] # optional OAuth scopes**
- [ ] [GAP] **scopes = ["repo"] # optional OAuth scopes**
- [ ] [GAP] **service_tier = "fast"**
- [ ] [GAP] **service_tier = "fast" # or another supported service tier id**
- [ ] [GAP] **shell_snapshot = true**
- [ ] [GAP] **shell_tool = true**
- [ ] [GAP] **skill_mcp_dependency_install = true**
- [ ] [GAP] **socks_url = "http://127.0.0.1:43130"**
- [ ] [GAP] **sqlite_home = "/absolute/path/to/codex-state" # optional SQLite-backed runtime state directory**
- [ ] [GAP] **startup_timeout_sec = 10.0 # optional**
- [ ] [GAP] **startup_timeout_sec = 10.0 # optional; default 10.0 seconds**
- [ ] [GAP] **statusMessage = "Checking Bash command"**
- [ ] [GAP] **status_line = ["model", "context-remaining", "git-branch"]**
- [ ] [GAP] **subfolders such as .codex/ and .git/ within a workspace root are read-only**
- [ ] [GAP] **submit = ["enter", "ctrl-m"]**
- [ ] [GAP] **suppress_unstable_features_warning = true**
- [ ] [GAP] **terminal_title = ["spinner", "project"]**
- [ ] [GAP] **the search index; live fetches the most recent data.**
- [ ] [GAP] **theme = "catppuccin-mocha"**
- [ ] [GAP] **timeout = 30**
- [ ] [GAP] **timeout_ms = 5000**
- [ ] [GAP] **to a "minimal" set of files and folders, as determined by Codex.**
- [ ] [GAP] **tool_output_token_limit = 12000 # tokens stored per tool output**
- [ ] [GAP] **tool_timeout_sec = 60.0 # optional**
- [ ] [GAP] **tool_timeout_sec = 60.0 # optional; default 60.0 seconds**
- [ ] [GAP] **tools_view_image = true**
- [ ] [GAP] **trust_level = "trusted" # or "untrusted"**
- [ ] [GAP] **type = "command"**
- [ ] [GAP] **unified_exec = true**
- [ ] [GAP] **url = "https://github-mcp.example.com/mcp" # required**
- [ ] [GAP] **view_image = true**
- [ ] [GAP] **web_search = "indexed" # gate external web access through the search index**
- [ ] [GAP] **web_search = "live"  # fetch the most recent data from the web (same as --search)**
- [ ] [GAP] **while the rest of the folder is writable.**
- [ ] [GAP] **wire_api = "responses"**
- [ ] [GAP] **wire_api = "responses" # only supported value**
- [ ] [GAP] **{ type = "connector", id = "connector_googlecalendar" },**
- [ ] [GAP] **{ type = "connector", id = "gmail" },**
- [ ] [GAP] **{ type = "plugin", id = "figma@openai-curated" },**
- [ ] [GAP] **{ type = "plugin", id = "slack@openai-curated" },**
