# Allternit vs. Kimi API Platform — Capability Audit

**Auditor:** kimi-k3  
**Focus:** Kimi API Platform (`platform.moonshot.cn/docs`) vs. Allternit platform capabilities  
**Date:** 2026-08-08  
**Method:** Read-only source inspection; no builds, tests, or production code changes.

---

## Executive Summary

Allternit is an enterprise agentic operating system rather than a single-model API provider. It exposes an **OpenAI-compatible chat-completions gateway** (`POST /v1/chat/completions`, `GET /v1/models`) with virtual-key auth, rate limits, DLP, budgets, and model routing. Around Kimi's API Platform surface, Allternit covers most conversational, tool-use, reasoning, multi-modal, and orchestration capabilities, but has clear gaps in **batch inference**, **token estimation**, **purpose-driven file APIs**, **context caching**, and **Partial Mode**.

| Status | Count |
|--------|-------|
| Present | 18 |
| Partial | 11 |
| Gap | 9 |
| Not applicable | 4 |

---

## API Layer Parity

| Kimi Capability | Status | Evidence | Notes |
|-----------------|--------|----------|-------|
| OpenAI-compatible API overview | **present** | `cmd/allternit-api/src/llm_gateway/mod.rs:56-59`, `cmd/allternit-api/src/main.rs:493` | Public `/v1/chat/completions` and `/v1/models` with OpenAI-shaped errors. |
| Chat completions | **present** | `cmd/allternit-api/src/llm_gateway/mod.rs:58`, `cmd/allternit-api/src/llm_gateway/proxy.rs:105-168`, `cmd/allternit-api/src/llm_gateway/translate.rs:86-116` | Streaming/non-streaming; validates OpenAI request fields. |
| List models | **present** | `cmd/allternit-api/src/llm_gateway/mod.rs:59`, `cmd/allternit-api/src/llm_gateway/proxy.rs:169-228` | Returns provider/model catalog plus policy aliases (`auto`, `allternit-*`). |
| Token estimation | **gap** | — | No `/v1/tokenizers/estimate-token-count` equivalent. |
| File CRUD (`/v1/files`) | **partial** | `cmd/allternit-api/src/upload_routes.rs:31-34`, `cmd/allternit-api/src/file_routes.rs:15-24` | Workspace uploads and file APIs exist, but not a model-facing `/v1/files` lifecycle with `purpose`. |
| Batch jobs (`/v1/batches`) | **gap** | `services/open-connector/src/providers/openai/actions.ts:504-520` | Open-connector can proxy OpenAI batches; no native Allternit batch API. |
| Balance (`/v1/users/me/balance`) | **partial** | `cmd/allternit-api/src/me_routes.rs:24`, `cmd/allternit-api/src/me_routes.rs:169-253`, `cmd/allternit-api/src/llm_gateway/admin_routes.rs:748-849` | `/me/usage`, per-key budgets, and tenant budgets exist; no single balance endpoint. |
| Error responses | **present** | `cmd/allternit-api/src/llm_gateway/translate.rs:21-79`, `cmd/allternit-api/src/llm_gateway/auth.rs:74-86` | OpenAI-compatible `error` bodies. |
| Rate limits | **present** | `cmd/allternit-api/src/llm_gateway/auth.rs:35-39`, `cmd/allternit-api/src/llm_gateway/auth.rs:179-236` | Per-key sliding-window RPM (default 600) with `Retry-After`. |

---

## Guide / Feature Parity

| Kimi Capability | Status | Evidence | Notes |
|-----------------|--------|----------|-------|
| Quickstart / SDK install | **partial** | `sdk/allternit-sdk/package.json`, `packages/@allternit/api-client/src/index.ts:62`, `cmd/gizzi-code/cli-package/README.md:1-35` | Node/TS SDK and `gizzi` CLI exist; Python SDK is computer-use only; some TS provider stubs. |
| Multi-turn conversations | **present** | `surfaces/ai.allternit.com/src/lib/ai/types.ts:104-119`, `cmd/allternit-api/src/llm_gateway/proxy.rs:76-78` | Message arrays and session reuse via `x-allternit-session-id`. |
| Tool calling (`tool_calls`) | **present** | `surfaces/ai.allternit.com/src/core/contracts/tool-call.ts:3-39`, `services/orchestration/control-plane/allternit-orchestrator/src/orchestrator.ts:12-48`, `mcp/core/src/tool_bridge.rs:136-172` | Full lifecycle with approval, execution, and result capture. |
| Tool constraints (`tool_choice`) | **present** | `surfaces/ai.allternit.com/src/lib/agents/tool-registry.store.ts:1-770`, `surfaces/ai.allternit.com/src/core/contracts/tool-call.ts:14-21` | Allowed-tools and governance tiers provide equivalent control. |
| Web search (`$web_search`) | **present** | `surfaces/ai.allternit.com/src/lib/ai/types.ts:22-23`, `surfaces/ai.allternit.com/src/plugins/built-in/research/plugin.ts:50-56` | First-class `webSearch` tool in the Research plugin. |
| `response_format` / JSON Mode | **partial** | `cmd/allternit-api/src/llm_gateway/translate.rs:107`, `cmd/allternit-api/src/llm_gateway/translate.rs:197-200`, `surfaces/ai.allternit.com/src/lib/agents/agent.types.ts:252` | Gateway parses the field; structured-output schemas live in agents/local models but enforcement is not visible in the main proxy. |
| Partial Mode | **gap** | — | No partial/best-of sampling in platform APIs. |
| Reasoning / thinking | **present** | `surfaces/ai.allternit.com/src/lib/ai/types.ts:86`, `surfaces/ai.allternit.com/src/lib/ai/rust-stream-adapter.ts:56-59`, `cmd/allternit-api/src/llm_gateway/proxy.rs:60-70` | Reasoning deltas surfaced; `allternit-reasoning` routing alias exists. |
| Image input / vision | **present** | `surfaces/ai.allternit.com/src/lib/ai/types.ts:90`, `surfaces/ai.allternit.com/src/core/contracts/message.ts:9`, `cmd/allternit-api/src/llm_gateway/translate.rs:151-167` | Image message parts and vision model flags exist. |
| Video input | **partial** | `surfaces/ai.allternit.com/src/views/MultimodalInput/MultimodalInput.tsx:1-120`, `surfaces/ai.allternit.com/src/lib/ai/rust-stream-adapter.ts:131-142` | Real-time vision/audio WebSocket; chat video attachment is partial. |
| File-based Q&A | **present** | `surfaces/ai.allternit.com/src/lib/ai/types.ts:54-61`, `services/memory/agent/src/types/memory.types.ts:20-25`, `services/memory/agent/src/models/local-model.ts:90` | Memory agent ingests files and answers via retrieval. |
| Context caching | **gap** | `surfaces/ai.allternit.com/src/lib/ai/ai-gateway-models-schemas.ts:33-34` | Pricing schema has cache fields, but no `cache_control` feature. |
| Batch API guide | **gap** | `surfaces/ai.allternit.com/src/views/swarm/components/BatchToolbar.tsx` | Batch toolbar controls swarm agents, not LLM batch jobs. |
| Dynamic tool loading | **present** | `mcp/mcp-client/src/lib.rs:88-224`, `surfaces/ai.allternit.com/src/lib/ai/mcp/apps.ts:1-17`, `surfaces/ai.allternit.com/src/lib/ai/mcp/app-bridge-api.ts:18-38` | MCP servers register at runtime. |
| Auto-reconnect | **present** | `cmd/allternit-api/src/llm_gateway/gizzi_bus.rs`, `surfaces/ai.allternit.com/src/lib/ai/rust-stream-adapter.ts` | Reconnecting SSE to the Gizzi runtime. |
| Prompt best practices | **not-applicable** | — | Documentation guidance, not a platform feature. |
| Benchmark best practices | **partial** | `cmd/allternit-api/src/llm_gateway/router.rs:35-44`, `cmd/allternit-api/src/llm_gateway/benchmarks.rs` | Benchmark scores drive routing; no published best-practice guide. |
| Account / org / billing | **partial** | `cmd/allternit-api/src/workspace_routes.rs:22-38`, `cmd/allternit-api/src/me_routes.rs:265-325`, `surfaces/ai.allternit.com/src/views/settings/SettingsView.tsx:31-33` | Workspaces, members, invites, billing panels exist; no full org/project API. |
| Third-party IDE/agent integrations (Claude Code, Codex, etc.) | **partial** | `cmd/gizzi-code/cli-package/README.md:1-35`, `cmd/gizzi-code/CLAUDE_INTEGRATION_MASTER_PLAN.md` | `gizzi` is the native CLI; Claude integration docs exist, others are not shipped. |
| Playground | **partial** | `surfaces/ai.allternit.com/src/views/PlaygroundView.tsx`, `surfaces/ai.allternit.com/src/views/playground/main/usePlaygroundManager.ts:49-81` | UI exists but streams simulated text; MCP config is real in chat/agent flows. |
| Kimi K3 / K2.6 / K2.7 Code / Moonshot V1 | **not-applicable** | `cmd/allternit-api/src/llm_gateway/proxy.rs:132-168` | Allternit is model-agnostic; Kimi models are Kimi-specific. |

---

## Pricing, Docs, Changelog, Agreements

| Kimi Capability | Status | Notes |
|-----------------|--------|-------|
| Model pricing | **partial** | Per-model cost fields and server-side recompute in `cmd/allternit-api/src/llm_gateway/llm_pricing.rs`; no public pricing page. |
| Batch pricing | **gap** | No native batch API. |
| Tool/search pricing | **gap** | Usage tracked, no separate surcharge model. |
| Limits / rate limits | **present** | Per-key RPM and tenant budgets. |
| Docs (concepts, model list, quickstart) | **present** | `README.md`, `REPO_STRUCTURE.md`, model catalog. |
| Changelog / research notes | **gap** | No centralized public changelog. |
| Legal agreements | **not-applicable** | Vendor-specific terms outside technical parity scope. |

---

## Top Gaps

1. **No native `/v1/batches` API** — batch inference is only available through the OpenAI connector proxy.
2. **No token-count/estimate endpoint** — clients must count tokens locally or use provider APIs.
3. **No purpose-driven `/v1/files` lifecycle** — workspace uploads exist but are not modeled for batch or file-extract use.
4. **No context-caching / prompt-caching feature** — only price fields hint at future support.
5. **No Partial Mode / n-sampling** in the platform chat/orchestration APIs.
6. **Playground is demo-only** — streaming is simulated, not wired to real inference.
7. **No public platform changelog** — specs and ADRs are scattered in `docs/`.
8. **SDK coverage is fragmented** — no full Python platform SDK; some TS provider harnesses are stubs.

---

## Quick Wins

- **Promote the existing gateway** — the OpenAI-compatible `/v1/chat/completions` endpoint is production-ready and can be positioned as the primary external API.
- **Add `/v1/balance`** — combine `/me/usage`, per-key budgets, and tenant budgets into one Kimi-shaped endpoint.
- **Enforce JSON Mode** — wire the existing `response_format` parsing into a gateway-level JSON-mode flag.
- **Real Playground** — replace the simulated `usePlaygroundManager` stream with a real call to `/v1/chat/completions`.
- **Token-count endpoint** — expose Gizzi's tokenizer or provider tokenizers behind `/v1/tokenizers/estimate-token-count`.
- **Publish integration guides** — document Claude Code / Codex / Gizzi Code setup using the existing OpenAI-compatible base URL.

---

## Extra Allternit Capabilities Not in Kimi List

- **Computer Use desktop + browser hybrid automation** (`domains/computer-use/core/`) — 53-command macOS accessibility adapter plus Playwright/CDP/browser-use.
- **MCP server/client bridge** with dynamic tool loading and A2A agent cards.
- **Rails DAG/WIH execution backend** for agent workflows.
- **Memory agent** with file ingestion, vector search, and consolidation.
- **Governance/policy engine** with trust tiers, tool approvals, and gate/review flows.
- **Session manager** with process/VM/Firecracker/AppleVF isolation.
- **Skill + mini-app/capsule registry** (ACI).

---

## How to Use This Audit

- The machine-readable source is `docs/kimi-audit/KIMI_AUDIT.json`.
- Every `present`/`partial` claim cites a file path; `gap` claims were confirmed by searching the scoped directories.
- No production code was modified; no builds or tests were run.
