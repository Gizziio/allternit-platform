# Steering checkpoint

## Goal

Complete Swarm A Phase 0 core API and harness parity items.

## Just did

- Added normalized reasoning/thinking, cache-control, JSON Schema response, and tool-control contracts to AllternitHarness.
- Added OpenAI, Anthropic, and Kimi request adapters and focused unit tests.
- Added Tool Belt strict/cache metadata propagation.
- Added gateway Idempotency-Key validation middleware and stable `allternit.*` error codes.
- Forwarded JSON Schema output and reasoning variants to Gizzi.
- Enriched `/v1/models` with catalog context-window and maximum-output metadata.
- Verified 7 targeted harness/tool-belt tests pass; `git diff --check` passes.

## Next

Write the Phase 0 notes and commit the scoped changes to `ao/swarm-a` if the worktree git metadata is writable.

## Open questions

- The sandbox exposes the linked worktree's external git directory read-only, so staging/commit may be blocked even though the worktree branch is correct.
