# LibreChat Agents Integration Todo

Date: 2026-04-30
Status: In progress

Reference:
- [LIBRECHAT_AGENTS_ALLTERNIT_INTEGRATION.md](./LIBRECHAT_AGENTS_ALLTERNIT_INTEGRATION.md)

## Execution checklist

- [x] Review LibreChat Agents, Agents API, and agents configuration docs
- [x] Map LibreChat concepts onto Allternit platform and SDK surfaces
- [x] Write architecture and integration review
- [x] Add canonical `AgentProfile` contract to platform agent types
- [x] Add canonical remote-agent/profile types to `@allternit/sdk`
- [x] Add platform helper(s) to normalize `Agent -> AgentProfile`
- [x] Add `GET /api/agents/v1/models`
- [x] Add `POST /api/agents/v1/chat/completions`
- [x] Add `POST /api/agents/v1/responses`
- [x] Resolve `model=<agentId>` into a real Allternit agent profile
- [x] Route remote agent requests through the existing runtime/session execution path
- [x] Add SDK client helpers for remote agents
- [x] Update platform agent service to persist new profile-oriented fields
- [x] Define deferred MCP tool-loading follow-up contract
- [x] Define artifact/event-stream follow-up contract
- [x] Run targeted verification for types, routes, and SDK exports
- [x] Summarize remaining blockers and next phases

## Phases

### Phase 1

- Canonical type layer
- Remote API route scaffold
- Basic agent-profile resolution

### Phase 2

- Runtime execution wiring
- SDK helpers
- Builder/service persistence updates

### Phase 3

- Deferred MCP tool loading
- Artifact stream support
- Additional capability enforcement
- Persist deferred-tool session activation in gateway agent-session metadata
- Reuse runtime `session_id` as the persisted remote-agent session key

Reference:
- [LIBRECHAT_AGENTS_PHASE2_CONTRACTS.md](./LIBRECHAT_AGENTS_PHASE2_CONTRACTS.md)

## Notes

- The compatibility target is LibreChat's remote agent model, not a direct LibreChat embed.
- The main deliverable is a clean `AgentProfile` contract shared across platform and SDK layers.
- Source-validated against LibreChat code, not only docs:
  - `packages/data-provider/src/types/assistants.ts`
  - `packages/data-provider/src/config.ts`
  - `packages/api/src/tools/classification.ts`
  - `packages/api/src/agents/run.ts`
  - `api/server/routes/agents/openai.js`
  - `api/server/routes/agents/responses.js`
  - `api/server/controllers/agents/openai.js`
  - `api/server/controllers/agents/responses.js`
- Focused verification completed:
  - `git diff --check -- <touched files>` passed
  - SDK AI-runtime typecheck passed
  - gateway Python syntax check passed
  - full platform typecheck remains heavier than this quick integration pass
