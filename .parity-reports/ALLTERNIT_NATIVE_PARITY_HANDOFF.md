# Allternit Native Parity Handoff

**Purpose:** Internal single source of truth for turning competitor parity analysis into native Allternit-branded features. This document is **not** public-facing. Public docs must be rewritten from this map with zero competitor names.

**Repo:** `/Users/joe/Desktop/allternit-workspace/allternit` (canonical `main`, commit `e3c7fa284`)

**How to use this file:**
- Each row is one native Allternit feature.
- `Source concept` is internal context only.
- `Allternit native name` is what users see.
- `Status` is one of: DONE, PARTIAL, MISSING.
- `Code location` is where the feature already lives (or should live).
- `Swarm` is the owning executor.
- `[ ]` is the completion checkbox for the swarm lead.

---

## Legend

- **DONE** — implemented and wired end-to-end in the canonical codebase.
- **PARTIAL** — backend or SDK exists but surface/UX/docs incomplete.
- **MISSING** — no production implementation; docs-only or idea-only.

---

## Track A — Core LLM API parity

| # | Source concept (internal) | Allternit native name | Status | Code location | Swarm | Done |
|---|---------------------------|----------------------|--------|---------------|-------|------|
| A1 | OpenAI `/v1/chat/completions` | Chat Completions API | DONE | `cmd/allternit-api/src/llm_gateway/` | A | [x] |
| A2 | OpenAI `/v1/batches` | Batch Inference API | DONE | `cmd/allternit-api/src/llm_gateway/batches.rs` | A | [x] |
| A3 | OpenAI batch worker polish | Batch worker execution & results | PARTIAL | `cmd/allternit-api/src/llm_gateway/batches.rs:789+` | A | [ ] |
| A4 | OpenAI `/v1/images/generations` | Image Generation API | MISSING | `cmd/allternit-api/src/llm_gateway/` (new) | A | [ ] |
| A5 | OpenAI `/v1/images/edits` | Image Edit API | MISSING | `cmd/allternit-api/src/llm_gateway/` (new) | A | [ ] |
| A6 | OpenAI `/v1/embeddings` | Embeddings API | PARTIAL | `sdk/allternit-sdk/src/ai-runtime/embeddings.ts` | A | [ ] |
| A7 | OpenAI vector stores / file search | Vector Store & Semantic Search API | PARTIAL | `cmd/allternit-api/src/memory_routes.rs`, `surfaces/ai.allternit.com/src/lib/ai/` | A | [ ] |
| A8 | OpenAI `/v1/files` purpose-driven uploads | Files API with purpose metadata | PARTIAL | `cmd/allternit-api/src/file_routes.rs` | A | [ ] |
| A9 | OpenAI token/cost estimation | Token & Cost Estimation API | PARTIAL | `cmd/gizzi-code/src/cli/ui/ink-app/services/tokenEstimation.ts` | A | [ ] |
| A10 | OpenAI fine-tuning API | Fine-Tuning API | MISSING | `cmd/allternit-api/src/` (new) | A | [ ] |
| A11 | OpenAI realtime / WebRTC audio | Realtime Audio API | MISSING | `cmd/allternit-api/src/` (new) | A | [ ] |
| A12 | OpenAI Responses API | Responses API | PARTIAL | `cmd/allternit-api/src/beta_session_routes.rs` | A | [ ] |
| A13 | Anthropic `cache_control` | Prompt Caching | DONE | `sdk/allternit-sdk/src/ai-runtime/harness/provider-request.ts` | A | [x] |
| A14 | Anthropic `thinking` | Reasoning Mode | DONE | `sdk/allternit-sdk/src/ai-runtime/harness/provider-request.ts` | A | [x] |
| A15 | Kimi context caching | Context Caching | MISSING | `cmd/allternit-api/src/llm_gateway/` (new) | A | [ ] |
| A16 | Kimi batch API native execution | Native Batch Execution | MISSING | `cmd/allternit-api/src/llm_gateway/batches.rs` | A | [ ] |
| A17 | Kimi partial / best-of mode | Partial / Best-of Sampling | MISSING | `cmd/allternit-api/src/llm_gateway/` (new) | A | [ ] |
| A18 | Content moderation endpoint | Content Safety API | MISSING | `cmd/allternit-api/src/` (new) | A | [ ] |

---

## Track B — Tools & Computer Use

| # | Source concept (internal) | Allternit native name | Status | Code location | Swarm | Done |
|---|---------------------------|----------------------|--------|---------------|-------|------|
| B1 | Anthropic `computer_20250124` | Allternit Computer Interface (ACI) Desktop Tool | DONE | `sdk/allternit-sdk/src/ai-runtime/capabilities/computer-use.ts` | B | [x] |
| B2 | Anthropic `text_editor_20250124` | ACI Text Editor Tool | DONE | `sdk/allternit-sdk/src/ai-runtime/tools/text-editor.ts` | B | [x] |
| B3 | Anthropic Bash / BashTool | ACI Bash Tool | DONE | `sdk/allternit-sdk/src/ai-runtime/tools/bash.ts` | B | [x] |
| B4 | Anthropic web search | ACI Web Search Tool | DONE | `sdk/allternit-sdk/src/ai-runtime/tools/search.ts` | B | [x] |
| B5 | Anthropic strict tool use | Strict Tool Schemas | DONE | `sdk/allternit-sdk/src/ai-runtime/tools/schema.ts` | B | [x] |
| B6 | Anthropic fine-grained tool streaming | Streaming Tool-Call Deltas | PARTIAL | `sdk/allternit-sdk/src/ai-runtime/harness/` | B | [ ] |
| B7 | Anthropic programmatic tool calling | Programmatic Tool Execution | PARTIAL | `sdk/allternit-sdk/src/ai-runtime/tools/code-execution.ts` | B | [ ] |
| B8 | Anthropic tool context management | Tool Context Budgets & Window | MISSING | `cmd/allternit-api/src/beta_session_routes.rs` | B | [ ] |
| B9 | Anthropic tool combinations | Tool Composition DSL | MISSING | `sdk/allternit-sdk/src/ai-runtime/tools/` (new) | B | [ ] |
| B10 | Anthropic Advisor tool | Allternit Advisor Skill | MISSING | `sdk/allternit-sdk/src/ai-runtime/skills/` (new) | B | [ ] |
| B11 | Kimi `walle` / official tools | Tool Belt Official Tools | DONE | `sdk/allternit-sdk/src/ai-runtime/tools/` | B | [x] |
| B12 | Kimi video base64 input | Video Input API | MISSING | `cmd/allternit-api/src/llm_gateway/translate.rs` | B | [ ] |
| B13 | MCP tool attachment | MCP Tool Registry | DONE | `sdk/allternit-sdk/src/ai-runtime/tools/mcp.ts` | B | [x] |

---

## Track C — Agents, Sessions & Memory

| # | Source concept (internal) | Allternit native name | Status | Code location | Swarm | Done |
|---|---------------------------|----------------------|--------|---------------|-------|------|
| C1 | OpenAI agent surfaces | Allternit Agent Runtime | DONE | `cmd/allternit-api/src/agents_v1_routes.rs` | C | [x] |
| C2 | OpenAI Responses / sessions | Allternit Sessions | DONE | `cmd/allternit-api/src/beta_session_routes.rs` | C | [x] |
| C3 | OpenAI memory / ChatGPT memory | Allternit Brain & Memory Store | DONE | `cmd/allternit-api/src/beta_memory_store_routes.rs`, `brain_routes.rs` | C | [x] |
| C4 | OpenAI local memory storage | Session Memory Search | PARTIAL | `cmd/gizzi-code/src/cli/ui/ink-app/services/SessionMemory/` | C | [ ] |
| C5 | Anthropic Dreams API | Memory Reconstruction Jobs | MISSING | `cmd/allternit-api/src/` (new) | C | [ ] |
| C6 | OpenAI evals / graders | Allternit Evals & Graders | PARTIAL | `cmd/allternit-api/src/eval_routes.rs`, `eval_metrics.rs` | C | [ ] |
| C7 | Kimi Playground debugging | Allternit Playground | MISSING | `surfaces/ai.allternit.com/` (new view) | C | [ ] |
| C8 | Anthropic Console prototyping | Allternit Agent Studio | MISSING | `surfaces/ai.allternit.com/` (new view) | C | [ ] |

---

## Track D — Gizzi Code CLI surfaces

| # | Source concept (internal) | Allternit native name | Status | Code location | Swarm | Done |
|---|---------------------------|----------------------|--------|---------------|-------|------|
| D1 | Codex CLI interactive TUI | Gizzi Code TUI | DONE | `cmd/gizzi-code/src/ui/`, `src/ink/` | D | [x] |
| D2 | Codex `codex run` | `gizzi-code run` | DONE | `cmd/gizzi-code/src/cli/ui/ink-app/screens/REPL.tsx` | D | [x] |
| D3 | Codex config profiles | Gizzi Code Profiles | MISSING | `cmd/gizzi-code/src/config/` (extend) | D | [ ] |
| D4 | Codex filesystem permission profiles | Gizzi Code Permission Profiles | MISSING | `cmd/gizzi-code/src/runtime/tools/` (new) | D | [ ] |
| D5 | Codex AGENTS.md guidance | `AGENTS.md` / `SKILL.md` Guidance | MISSING | `cmd/gizzi-code/src/context/` (new) | D | [ ] |
| D6 | Codex shell completions | Gizzi Code Shell Completions | MISSING | `cmd/gizzi-code/` (new) | D | [ ] |
| D7 | Codex themes / syntax highlighting | Gizzi Code Themes | MISSING | `cmd/gizzi-code/src/ui/` (extend) | D | [ ] |
| D8 | Codex non-interactive / CI mode | Gizzi Code CI Mode | PARTIAL | `cmd/gizzi-code/src/cli/` | D | [ ] |
| D9 | Kimi Code CLI settings.json | Gizzi Code `config.toml` | DONE | `cmd/gizzi-code/src/config/` | D | [x] |
| D10 | Claude Code / Codex remote | Gizzi Code Remote Mode | PARTIAL | `cmd/gizzi-code/src/runtime/` | D | [ ] |

---

## Track E — Web & Desktop Surfaces

| # | Source concept (internal) | Allternit native name | Status | Code location | Swarm | Done |
|---|---------------------------|----------------------|--------|---------------|-------|------|
| E1 | ChatGPT web app | ai.allternit.com | DONE | `surfaces/ai.allternit.com/` | E | [x] |
| E2 | Codex App Server | Gizzi Code App Server | MISSING | `cmd/gizzi-code/src/self-hosted-runner/` (extend) | E | [ ] |
| E3 | ChatGPT desktop app (macOS) | Allternit Desktop | DONE | `surfaces/allternit-desktop/` | E | [x] |
| E4 | ChatGPT desktop app (Windows) | Allternit Desktop for Windows | MISSING | `surfaces/allternit-desktop/` (extend) | E | [ ] |
| E5 | ChatGPT browser extension | Allternit Browser Extension | PARTIAL | `surfaces/allternit-extensions/allternit-extension/` | E | [ ] |
| E6 | ChatGPT WSL / integrated terminal | Allternit Windows Terminal Integration | MISSING | `surfaces/allternit-desktop/` (extend) | E | [ ] |
| E7 | ChatGPT appshots | Allternit Appshots | MISSING | `surfaces/allternit-extensions/` (new) | E | [ ] |
| E8 | ChatGPT Voice | Allternit Voice | MISSING | `surfaces/ai.allternit.com/src/components/ai-elements/speech-input.tsx` (extend) | E | [ ] |
| E9 | Codex IDE extension | Gizzi Code IDE Extension | MISSING | new repo/folder | E | [ ] |
| E10 | Codex GitHub Action | Gizzi Code GitHub Action | MISSING | new repo/folder | E | [ ] |
| E11 | ACI web sidecar | ACI Browser Sidecar | DONE | `surfaces/ai.allternit.com/src/capsules/browser/ACIComputerUseSidecar.tsx` | E | [x] |

---

## Track F — Auth, Orgs, Billing & Enterprise

| # | Source concept (internal) | Allternit native name | Status | Code location | Swarm | Done |
|---|---------------------------|----------------------|--------|---------------|-------|------|
| F1 | OpenAI API keys | Allternit Virtual Keys | DONE | `cmd/allternit-api/src/provider_routes.rs` | F | [x] |
| F2 | OpenAI service accounts | Allternit Service Accounts | DONE | `cmd/allternit-api/src/admin_service_account_routes.rs` | F | [x] |
| F3 | OpenAI spend limits | Allternit Spend Limits | DONE | `cmd/allternit-api/src/admin_spend_limit_routes.rs` | F | [x] |
| F4 | OpenAI organization workspaces | Allternit Workspaces | DONE | `cmd/allternit-api/src/admin_workspace_routes.rs` | F | [x] |
| F5 | Anthropic data residency | Region Pinning / Data Residency | MISSING | `cmd/allternit-api/src/` (new) | F | [ ] |
| F6 | Anthropic WIF providers | Workload Identity Federation | MISSING | `cmd/allternit-api/src/enterprise_auth.rs` (extend) | F | [ ] |
| F7 | Anthropic App Attest | Device Attestation | MISSING | `cmd/allternit-api/src/` (new) | F | [ ] |
| F8 | Anthropic retention / ZDR | Retention & Zero Data Residence | MISSING | `cmd/allternit-api/src/compliance_routes.rs` (extend) | F | [ ] |
| F9 | Kimi IP allowlisting | Workspace IP Allowlisting | MISSING | `cmd/allternit-api/src/admin_workspace_routes.rs` (extend) | F | [ ] |
| F10 | OpenAI compliance API | Allternit Compliance API | PARTIAL | `cmd/allternit-api/src/compliance_routes.rs` | F | [ ] |
| F11 | Vault encrypted credentials | Allternit Vault | DONE | `cmd/allternit-api/src/allternit_vault.rs` | F | [x] |

---

## Track G — Plugin Marketplace

| # | Source concept (internal) | Allternit native name | Status | Code location | Swarm | Done |
|---|---------------------------|----------------------|--------|---------------|-------|------|
| G1 | OpenAI plugins / MCP apps | Allternit Capabilities / Plugins | PARTIAL | `surfaces/ai.allternit.com/src/views/plugins/CapabilitiesManager.tsx` | G | [ ] |
| G2 | OpenAI plugin marketplace | Allternit Capability Marketplace | MISSING | `surfaces/ai.allternit.com/` (new) | G | [ ] |
| G3 | OpenAI plugin SDK / creator | Allternit Capability SDK | MISSING | `sdk/allternit-sdk/src/ai-runtime/plugins/` (new) | G | [ ] |
| G4 | OpenAI plugin checkout / monetization | Marketplace Payments | MISSING | `cmd/allternit-api/src/` (new) | G | [ ] |
| G5 | OpenAI plugin UI components | Capability UI Components | MISSING | `surfaces/ai.allternit.com/src/components/` (new) | G | [ ] |
| G6 | OpenAI Docs MCP | Allternit Docs MCP Server | MISSING | `tools/mcp-servers/` (new) | G | [ ] |

---

## Track K — Kimi-specific gaps

| # | Source concept (internal) | Allternit native name | Status | Code location | Swarm | Done |
|---|---------------------------|----------------------|--------|---------------|-------|------|
| K1 | Kimi video base64 input | Video Input API | MISSING | `cmd/allternit-api/src/llm_gateway/translate.rs` | K | [ ] |
| K2 | Kimi context caching | Context Caching | MISSING | `cmd/allternit-api/src/llm_gateway/` | K | [ ] |
| K3 | Kimi partial mode | Partial / Best-of Sampling | MISSING | `cmd/allternit-api/src/llm_gateway/` | K | [ ] |
| K4 | Kimi batch API native | Native Batch Execution | MISSING | `cmd/allternit-api/src/llm_gateway/batches.rs` | K | [ ] |
| K5 | Kimi token estimation | Token Estimation Endpoint | MISSING | `cmd/allternit-api/src/llm_gateway/` | K | [ ] |
| K6 | Kimi IP allowlisting | Workspace IP Allowlisting | MISSING | `cmd/allternit-api/src/admin_workspace_routes.rs` | K | [ ] |
| K7 | Kimi Playground | Allternit Playground | MISSING | `surfaces/ai.allternit.com/` | K | [ ] |
| K8 | Kimi error code taxonomy | Allternit Error Codes | PARTIAL | `docs/public/providers/parity-matrix.md` | K | [ ] |

---

## Track Q — Qwen / Local Model Runtime

| # | Source concept (internal) | Allternit native name | Status | Code location | Swarm | Done |
|---|---------------------------|----------------------|--------|---------------|-------|------|
| Q1 | Qwen local inference | Bonsai WebGPU Runtime | PARTIAL | `surfaces/ai.allternit.com/src/lib/local-models/bonsai-runtime/` | Q | [ ] |
| Q2 | Qwen tokenizer | Bonsai Tokenizer | PARTIAL | `surfaces/ai.allternit.com/src/lib/local-models/bonsai-runtime/qwen-tokenizer.ts` | Q | [ ] |
| Q3 | Qwen kernels | Bonsai Compute Kernels | PARTIAL | `surfaces/ai.allternit.com/src/lib/local-models/bonsai-runtime/qwen-kernels.ts` | Q | [ ] |
| Q4 | MLX memory agent provider | MLX Memory Provider | DONE | `.steering/spec.md` (accepted) | Q | [x] |
| Q5 | Apple MLX local adapter | Apple MLX Adapter | MISSING | `sdk/allternit-sdk/src/ai-runtime/providers/` (new) | Q | [ ] |
| Q6 | Ollama local adapter | Ollama Provider | DONE | `sdk/allternit-sdk/src/ai-runtime/providers/ollama/` | Q | [x] |

---

## Track Docs — Public docs migration

| # | Task | Status | Code location | Swarm | Done |
|---|------|--------|---------------|-------|------|
| Z1 | Move public docs from hardcoded React to MDX/markdown-driven | MISSING | `surfaces/docs/` or `docs.allternit.com/source` | Z | [ ] |
| Z2 | API reference auto-generated from OpenAPI / Rust routes | MISSING | `docs.allternit.com/source/` | Z | [ ] |
| Z3 | Rewrite all parity docs as Allternit-branded guides | MISSING | `docs/public/` (internal) | Z | [ ] |
| Z4 | Gizzi Code comprehensive docs | MISSING | `docs.allternit.com/source/` | Z | [ ] |
| Z5 | ACI / Computer Use docs | MISSING | `docs.allternit.com/source/` | Z | [ ] |
| Z6 | Enterprise / security docs | MISSING | `docs.allternit.com/source/` | Z | [ ] |
| Z7 | Cookbooks (Allternit-native recipes) | PARTIAL | `surfaces/ai.allternit.com/src/views/code/` + docs site | Z | [ ] |

---

## Swarm assignment summary

| Swarm | Focus | Lead agent | Worktree branch |
|-------|-------|------------|-----------------|
| A | Core LLM API parity | codex | `ao/parity-core-api` |
| B | Tools & Computer Use | claude | `ao/parity-tools-aci` |
| C | Agents, Sessions & Memory | kimi | `ao/parity-agents-memory` |
| D | Gizzi Code CLI surfaces | codex | `ao/parity-gizzi-cli` |
| E | Web & Desktop Surfaces | claude | `ao/parity-surfaces` |
| F | Auth, Orgs, Billing & Enterprise | kimi | `ao/parity-enterprise` |
| G | Plugin Marketplace | codex | `ao/parity-marketplace` |
| K | Kimi-specific gaps | kimi | `ao/parity-kimi` |
| Q | Qwen / Local Model Runtime | claude | `ao/parity-qwen` |
| Z | Docs migration & content | codex | `ao/parity-docs` |

---

## Completion rules for swarm leads

1. Work in your worktree branch. Do not touch `main` directly.
2. Update this file in your worktree as you complete items (`[x]`).
3. Write a `docs/PARITY_<SWARM>_PHASE_1_NOTES.md` sentinel when each phase is done.
4. Follow `.steering/spec.md` or the per-swarm spec file; steering reviews every checkpoint.
5. No competitor names in code comments, docs, or user-facing strings.
6. Match repo conventions; do not add speculative dependencies.

---

*Last updated: 2026-08-13*
