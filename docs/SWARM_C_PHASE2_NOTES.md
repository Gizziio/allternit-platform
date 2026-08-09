---
status: done
files_changed:
  - sdk/allternit-sdk/src/ai-runtime/tools/bash.ts
  - sdk/allternit-sdk/src/ai-runtime/tools/code-execution.ts
  - sdk/allternit-sdk/src/ai-runtime/tools/memory.ts
  - sdk/allternit-sdk/src/ai-runtime/tools/search.ts
  - sdk/allternit-sdk/src/ai-runtime/index.ts
  - sdk/allternit-sdk/src/ai-runtime/__tests__/tool-belt.test.ts
  - cmd/allternit-api/src/session_memory_service.rs
  - cmd/allternit-api/src/memory_routes.rs
  - cmd/allternit-api/src/tool_routes.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/migrations/V41__session_memory.sql
deviations:
  - The default `code_execution` runner in the SDK is a local subprocess fallback rather than a true WebVM/WASM sandbox. The API `tool_routes.rs` implementation also uses a subprocess fallback because the VM driver (`state.vm_driver`) is optional and not guaranteed to be available in offline tests. The runner is fully injectable, so callers can swap in the WebVM/cloud runtime driver when it is ready.
  - The `bash` tool in the SDK is registered separately from the existing `capabilities/bash.ts` `BashCapability`/`BASH_TOOL`. The new tool uses the WebVM contract (`command`, `timeout`, `restart`) and an injectable `BashRunner`.
remaining:
  - Wire the SDK `code_execution` and `bash` tools to call the `/sandbox/execute` or `/tools/execute` API endpoints when running against the allternit-api server instead of the local subprocess fallback.
  - Provide a default API-backed `MemoryStore` implementation in the SDK that talks to the new `/api/v1/memory/session` endpoints.
  - Add integration tests that exercise the memory routes through the axum router with a real `AppState`/`DbHandle`.
  - Implement WebVM/WASM sandbox execution backend and swap the default runners to use it.
---

# Swarm C — Phase 2 Completion Notes

## What changed

### TypeScript SDK (`sdk/allternit-sdk/src/ai-runtime`)

- **`tools/bash.ts`**: New model-facing `bash` tool with schema `command`, `timeout`, `restart`. It accepts an injectable `BashRunner` so tests and future sandbox backends can control execution without touching `child_process`.
- **`tools/code-execution.ts`**: New `code_execution` tool with schema `language`, `code`, `timeout_seconds`, `dependencies`. It accepts an injectable `CodeExecutionRunner`. The default fallback runs code through local interpreters (`python3`, `node`, `bash`) for offline testing; the real WebVM/cloud sandbox can be supplied via the constructor.
- **`tools/memory.ts`**: New `memory` tool supporting `operation: read|write|delete`, `key`, and `value`. It accepts an injectable `MemoryStore`; the default implementation is an in-memory store scoped to the tool instance.
- **`tools/search.ts`**: `NativeToolBelt` now registers `bash`, `code_execution`, and `memory` alongside the existing web, text-editor, search, and MCP tools.
- **`index.ts`**: Exported the new tool classes and their option types.
- **`__tests__/tool-belt.test.ts`**: Added tests verifying registration schemas and injectable runner/store behavior for all three new tools.

### Rust API (`cmd/allternit-api`)

- **`migrations/V41__session_memory.sql`**: New `session_memory` table keyed by `(user_id, session_id, memory_key)` with indexes on `(user_id, session_id)` and `memory_key`.
- **`src/session_memory_service.rs`**: New SQLite-backed service with `read_session_memory`, `list_session_memory`, `write_session_memory`, and `delete_session_memory`. Values are stored as JSON.
- **`src/memory_routes.rs`**: Added REST endpoints:
  - `GET /api/v1/memory/session` — read one key
  - `GET /api/v1/memory/session/list` — list session keys
  - `POST /api/v1/memory/session` — write a key
  - `DELETE /api/v1/memory/session` — delete a key
- **`src/tool_routes.rs`**: Added `bash` and `code_execution` to the unified tool execution dispatcher. `bash` reuses shell execution with timeout/restart handling. `code_execution` runs code through local interpreters with a timeout.
- **`src/lib.rs`**: Declared `pub mod session_memory_service`.

## Test results

- `cargo check -p allternit-api`: passed (pre-existing warnings only).
- `cargo test -p allternit-api --lib`: **142 passed; 0 failed**. New tests cover session memory CRUD, scoping, bash execution, and code execution validation.
- `npx vitest run sdk/allternit-sdk/src/ai-runtime/__tests__/tool-belt.test.ts`: **17 passed; 0 failed**. New tests cover tool registration and injectable runners/store.

## Blockers

- No true WebVM/WASM sandbox runtime is wired as the default executor. The existing `sandbox_routes.rs` uses an optional VM driver (`vm_driver`) that requires Firecracker on Linux or Apple VF on macOS. The new tools use an injectable runner pattern so the sandbox can be swapped in without changing tool schemas.
- `node_modules` was not installed in the worktree, so TypeScript type checking via `tsc` could not be run. The SDK test file was exercised through `vitest`, which transpiles the source.

## What remains for Phase 3

- Connect SDK tools to the API by default (e.g. `fetch`-based runners for `bash` and `code_execution`, and a `MemoryStore` that calls `/api/v1/memory/session`).
- Add axum integration tests for the new memory routes and tool execution endpoints using `axum-test` and a temporary `DbHandle`.
- Implement and integrate the actual WebVM/WASM or cloud sandbox runtime as the default `CodeExecutionRunner`.
