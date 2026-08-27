# Swarm C — Phase 4 Docs / GTM Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-c`  
**Branch:** `ao/p4-swarm-c`  
**Base:** `parity/swarm-sprint`

## Goal
Document the Tool Belt, MCP, search, sandbox, and Allternit Computer Interface (ACI) capabilities built in Phases 0–3.

## Deliverables (all under `docs/public/` unless noted)

1. `docs/public/tools/tool-belt.md` — Native Tool Belt reference:
   - `web_search` (Tavily/Perplexity/Bing adapters)
   - `web_fetch`
   - `bash`, `code_execution`, `memory` (model-facing SDK tools)
   - `text_editor_20250124` (Anthropic-compatible)
   - computer-use schema aligned to `computer_20250124`
   - Include JSON schema snippets for inputs/outputs.

2. `docs/public/tools/mcp.md` — MCP integration:
   - Attaching an MCP server to the Tool Belt
   - Server-side tool execution mode
   - MCP tunnel security (mTLS + OAuth issuer/audience)
   - Remote MCP servers directory pattern

3. `docs/public/tools/strict-tool-use.md` — explain strict-mode JSON Schema validation and grammar-constrained inputs.

4. `docs/public/aci/index.md` — Allternit Computer Interface overview:
   - What ACI is vs. managed cloud sandboxes
   - Self-hosted WebVM/cloud sandbox product positioning
   - Browser automation and vision coordinates

5. `docs/public/guides/build-a-tool.md` — step-by-step guide to registering a custom tool in the Tool Belt.

6. Update `AGENTS.md` if it references old tool paths; add a short section pointing to the new `docs/public/tools/` docs.

## Validation
- `cargo check -p allternit-api` must pass.
- `vitest run sdk/allternit-sdk/src/ai-runtime/__tests__/tool-belt.test.ts` must still pass.
- Every doc has H1 and at least one JSON example.

## Commit
Commit on `ao/p4-swarm-c` with message: `docs(p4): Swarm C Tool Belt, MCP, and ACI documentation`.
