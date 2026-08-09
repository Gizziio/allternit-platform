# Swarm B — Agent Runtime Foundation — Map

This is the context map for Swarm B — Agent Runtime Foundation. The master handoff checklist is at:
`/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope for Phase 0
- Scaffold `beta/sessions` CRUD API (create/list/get/archive/update).
- Add child threads with `parent_thread_id`.
- Implement SSE/WebSocket event stream for agent runs with standardized event types (thinking_delta, content_block_delta, tool_calls, refusal).
- Add token/turn/tool-call budget controls and budget events.

## Known starting files
- `cmd/allternit-api/src/`
- `domains/kernel/`
- `services/`

## Constraints
- Do NOT start Phase 1 work yet.
- Do NOT run builds, dev servers, or tests that require external services.
- Match existing repo idioms (naming, module structure, error handling).
- Do NOT mutate the canonical repo; work only in `/Users/joe/Desktop/allternit-parity-swarm-b`.
