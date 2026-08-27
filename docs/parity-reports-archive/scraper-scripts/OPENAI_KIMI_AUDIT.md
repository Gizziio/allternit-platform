# Allternit vs OpenAI — Capability Audit (Kimi k3)

**Scope:** `api`, `chatgpt-codex`, `plugins`, `workspace-agents`, `cookbook`, `codex` categories of the OpenAI docs crawl (`openai_capability_areas.md`, 16,275 headings condensed to major features). `ads`, `commerce`, `blog`, `learn`, `platform` are OpenAI-business/editorial categories and are grouped as `not-applicable` / `partial` (learning).

**Method:** Read-only audit. Five parallel codebase sweeps covered `api/`, `cmd/`, `services/`, `sdk/`, `platform/`, `packages/@allternit/`, `domains/`, `infrastructure/`, `drivers/`, `mcp/`, `rails/`, `surfaces/`, `worktree-manager/`. Every `present`/`partial` claim cites file paths in `KIMI_AUDIT.json` (95 findings: **54 present, 31 partial, 7 gap, 3 not-applicable**). No builds or tests were run; runtime behavior was not verified.

## Headline

Allternit's agentic surface is **broadly at or beyond parity** with OpenAI's ChatGPT/Codex product surface — sandboxing, approvals, worktrees, MCP, skills, computer use, scheduling, and governance are all implemented, often more deeply (microVM isolation, tiered safety model T0–T4, hash-locked policy bundles, append-only decision ledgers). The genuine gaps cluster around **OpenAI's hosted model-serving APIs**: embeddings, fine-tuning, moderations, realtime speech-to-speech, and managed batch/evals.

## Where Allternit is strong (present, often beyond parity)

- **OpenAI-compatible LLM gateway** — `/v1/chat/completions` + `/v1/models` with SSE streaming, virtual API keys, per-key rate limiting, budget middleware, DLP secret scanning, and benchmark/cost-weighted cross-provider routing with persisted routing decisions (`cmd/allternit-api/src/llm_gateway/`).
- **Agent runtime (Codex CLI equivalent)** — `cmd/gizzi-code` ink TUI: ~100 slash commands, skills, cron automations, subagents/swarms, code review, worktree isolation, session fork/compact/resume/rewind, OTel telemetry, multi-provider models (OpenAI, Anthropic, Google, Mistral, Kimi, Qwen, GLM, Ollama…).
- **Governance** — deny-by-default policy engine with `allow/deny/ask`, two-man-rule approvals, orgs/roles/groups/scoped tokens with mTLS, purpose-binding retention limits, identity revocation, workspace kill switch, hash-verified execution receipts (`domains/governance/`, `rails/`).
- **Sandboxing/execution isolation** — Firecracker microVMs (jailer, cgroups, tc/iptables netpolicy), Apple Virtualization.framework, Docker executor, and a deny-by-default WASM capability sandbox (`drivers/`, `domains/kernel/core/wasm-runtime/`).
- **Computer use & browser** — plan→act→observe→reflect loop with multi-provider vision grounding, Playwright tools, WebRTC Chrome streaming with CDP sidecar (`domains/computer-use/`, `infrastructure/chrome-stream/`).
- **Plugin/MCP ecosystem** — full MCP client (stdio/SSE/streamable-HTTP/WS, OAuth 2.1+PKCE, elicitation), plugin SDK with manifest + lifecycle + multi-transport adapters, MCP Apps widget rendering in chat, marketplace with submission/review/kill-switch, ~800 SaaS connectors exposed as MCP tools (`services/open-connector/`).
- **Workspace agents** — token provisioning, `POST /api/v1/runs` trigger, status polling + SSE run events + checkpoints (`cmd/allternit-cloud-api/`).

## Top gaps (nothing equivalent)

1. **Embeddings API** — no served `/v1/embeddings`; semantic search degrades to keyword fallback when Ollama is absent. Blocks RAG parity.
2. **Fine-tuning** — no training-job surface at all (only outbound connector calls).
3. **Moderations** — no content-safety classifier endpoint; DLP covers secrets/injection only.
4. **Realtime speech-to-speech** — voice service has stub streaming routes; no bidirectional audio session layer, no ephemeral client secrets.
5. **Plugin monetization/checkout** — marketplace has no pricing/purchase flow.
6. **Multipart/resumable Uploads API** — only base64 uploads (20MB cap).
7. **Managed "Sites" deploy product** — no build-and-deploy-websites surface found.

## Significant partials (exist but not equivalent)

- **Responses API** — replies-runtime has stateful replies/runs with SSE, but no input-items CRUD or hosted tool outputs.
- **Structured outputs** — used internally (`generateObject`); the gateway only shape-validates `response_format`.
- **Vector stores / file search** — memory fabric does vector recall, but no vector-store CRUD resources or managed file-search tool.
- **Evals/graders** — benchmark scores drive routing, but there is no user-defined eval CRUD; `services/self-improve/src/eval.rs` is explicitly a scaffold.
- **Batch** — general job infra exists; no discounted async LLM batch endpoint.
- **IDE extension** — ACP protocol client + deep links, but no first-party VS Code/JetBrains extension.
- **Codex Security** — LLM-driven `/security-review` exists; no deterministic SAST, threat-model artifacts, or bulk scan management.
- **Audit persistence** — standalone audit service is in-memory (10k-event cap); durable trail only via rails ledger.
- **Secrets at rest** — OAuth vault stores tokens as plaintext JSON; no KMS/encryption.
- **Outbound webhooks** — inbound receivers only (Clerk/Stripe/Slack); `webhook_secret` is a `None` stub.

## Quick wins (highest value / lowest effort)

1. **Serve `/v1/embeddings` as a proxy** to the already-integrated Ollama embedding sidecar — the gateway pattern and provider plumbing already exist; this closes the biggest API gap with a thin route.
2. **Moderations endpoint** backed by a small classifier (or passthrough to a provider) to complete the safety surface alongside DLP.
3. **Real streaming on the voice service** — the Rust routes exist and Chatterbox Turbo already supports streaming TTS; wire the WebSocket route instead of returning placeholder `websocket_url`.
4. **Outbound webhook subscriptions** — the event bus and audit ledger already exist; add a subscription table + delivery worker.
5. **Structured-output enforcement in the gateway** — plumb `response_format` through to providers that support JSON-schema mode instead of shape-validation only.
6. **Consolidated config reference doc** — config is spread across `config/allternit.json`, brain presets, and policy bundles; a single reference page would match Codex's config docs at zero code cost.

## Caveats

- `cmd/gizzi-code` is heavily Claude-Code-derived; some "present" agent features are upstream inheritance rather than Allternit-built.
- Several entry-point commands (`/mobile`, `/teleport`) are 0-byte stubs even where the underlying subsystem exists; `cmd/cli` is largely stubbed ("Agent runtime not yet implemented").
- The Rust `mcp/core` client supports only stdio+SSE; the TypeScript client is the full-featured one.
- The gateway-mirrored agent-runs route (`services/gateway`) is a stub that returns `pending` forever; use `cmd/allternit-cloud-api`.
- Statuses reflect code presence, not verified runtime behavior (audit constraints prohibited builds/dev servers).
