---
status: done
files_changed:
  - cmd/allternit-api/src/beta_session_routes.rs
  - cmd/allternit-api/src/llm_gateway/translate.rs
  - sdk/allternit-sdk/src/ai-runtime/harness/index.ts
  - sdk/allternit-sdk/src/ai-runtime/index.ts
  - sdk/allternit-sdk/src/ai-runtime/skills/advisor.ts
  - sdk/allternit-sdk/src/ai-runtime/tools/composition.ts
  - sdk/allternit-sdk/src/ai-runtime/tools/programmatic-execution.ts
blockers: []
---

# Tools and Computer Use — Phase 1 Notes

## Summary

Phase 1 of the Tools and Computer Use parity track is complete. `cargo check -p allternit-api` passes.

## Implemented Features

### B6: Streaming Tool-Call Deltas
- Extended `cmd/allternit-api/src/beta_session_routes.rs` and `cmd/allternit-api/src/llm_gateway/translate.rs` to stream tool-call deltas through the existing SSE path.

### B7: Programmatic Tool Execution
- New `sdk/allternit-sdk/src/ai-runtime/tools/programmatic-execution.ts`
- Provides a sandbox bridge protocol so code running inside the executor can invoke registered Allternit tools and receive results via stdout/sidecar JSON.

### B8: Tool Context Budgets
- Added context-window budget helpers in `sdk/allternit-sdk/src/ai-runtime/harness/index.ts` so tool definitions and tool-call results are accounted for before being sent to the model.

### B9: Tool Composition DSL
- New `sdk/allternit-sdk/src/ai-runtime/tools/composition.ts`
- Declarative DSL supporting `sequence`, `parallel`, `condition`, and `loop` primitives over the `ToolRegistry`.

### B10: Advisor Skill
- New `sdk/allternit-sdk/src/ai-runtime/skills/advisor.ts`
- Built-in skill that reads repository context (`AGENTS.md`, `README`, `package.json`, etc.) and produces actionable guidance for agent sessions.

### B12: Video Input API
- Extended `cmd/allternit-api/src/llm_gateway/translate.rs` with `video_url` / `input_video` content-part handling so video payloads are normalized before forwarding to providers.

## Verification

- `cargo check -p allternit-api` passes with only pre-existing warnings.
- SDK files are syntactically well-formed; full SDK typecheck was not run because the worktree `node_modules` are not installed.
- No competitor names remain in code or user-facing strings.

## Phase 2 Remaining Work

- Add end-to-end tests for streaming tool deltas and the programmatic execution bridge.
- Wire the composition DSL into the agent loop.
- Expose advisor skill activation in the Gizzi CLI and web surface.
