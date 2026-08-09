---
status: done
files_changed:
  - cmd/gizzi-code/src/runtime/context/config/config.ts
  - cmd/gizzi-code/src/cli/main.ts
  - cmd/gizzi-code/src/cli/commands/config.ts
  - cmd/gizzi-code/src/runtime/context/config/permission-profiles.ts
  - cmd/gizzi-code/test/config/config.test.ts
  - cmd/gizzi-code/test/config/permission-profiles.test.ts
  - cmd/cli/src/commands/admin.ts
  - cmd/cli/src/commands/admin.test.ts
deviations:
  - The existing npm test glob in cmd/cli/package.json (src/**/*.test.ts) only matches src/commands/admin.test.ts under the default shell globstar settings; I ran the admin and api-client tests explicitly with npx tsx --test src/api-client.test.ts src/commands/admin.test.ts instead of relying on npm test.
  - pnpm install required --ignore-scripts because better-sqlite3 fails to build against Node v26 in this environment. This did not affect the TypeScript-only tests that were run.
remaining:
  - Phase 3 should wire the mcp-tunnels CLI commands to real platform API endpoints once they exist; currently they call placeholder /api/v1/mcp-tunnels paths.
  - Phase 3 should add end-to-end validation of approval_policy and sandbox defaults through the actual permission enforcement layer (currently only config loading is tested).
  - Phase 3 may want to expose gizzi config profile commands in the TUI or shell completion metadata.
---

# Swarm D Phase 2 Completion Notes

## What changed

### gizzi-code config surfaces

- Extended `Config.Info` schema in `cmd/gizzi-code/src/runtime/context/config/config.ts` with:
  - `approval_policy` (mode preset + granular rules for skill/web_search/sandbox approvals).
  - `sandbox.mode` presets (`read-only`, `workspace-write`, `danger-full-access`).
  - `permission_profiles` block for named permission profiles.
- Implemented default application logic in `Config.state`:
  - Sandbox mode presets fill in `enabled` and `allow_network` defaults; explicit values always win.
  - Approval policy mode presets (`untrusted`, `on-request`, `on-failure`, `never`) set a default `*` permission action.
  - Granular approval policy rules override/augment the default permission object.
  - The active named permission profile's rules are merged as defaults, with explicit `permission` rules winning.
- Added `cmd/gizzi-code/src/runtime/context/config/permission-profiles.ts` to read/write named profiles directly from `config.toml` while preserving unrelated config sections.
- Added `cmd/gizzi-code/src/cli/commands/config.ts` exposing `gizzi config profile list|add|remove|set-active`.
- Wired the new `ConfigCommand` into `cmd/gizzi-code/src/cli/main.ts`.
- Added/updated unit tests in `config.test.ts` (approval policy, sandbox presets, active profile) and new `permission-profiles.test.ts` (CRUD and TOML round-tripping).

### allternit admin CLI

- Added `admin mcp-tunnels` command tree in `cmd/cli/src/commands/admin.ts`:
  - `list` -> `GET /api/v1/mcp-tunnels`
  - `create --name <name>` -> `POST /api/v1/mcp-tunnels`
  - `rotate --id <id>` -> `POST /api/v1/mcp-tunnels/:id/rotate`
  - `delete --id <id>` -> `DELETE /api/v1/mcp-tunnels/:id`
- Refactored the admin command tree behind `createAdminCommand()` so tests get isolated command instances; `adminCommand` remains exported as a singleton for existing callers.
- Added `cmd/cli/src/commands/admin.test.ts` covering all four mcp-tunnels operations plus validation-error handling, using a mocked `fetch` so no external services are required.

## Verification

- `bun test test/config/config.test.ts test/config/permission-profiles.test.ts --timeout 30000` in `cmd/gizzi-code`: **70 pass, 0 fail**.
- `npx tsx --test src/api-client.test.ts src/commands/admin.test.ts` in `cmd/cli`: **7 pass, 0 fail**.
- No Rust files were touched, so `cargo check` was not required.

## Blockers

- Native dependency `better-sqlite3` does not compile against Node v26 in this environment, so the workspace install had to use `--ignore-scripts`. This only affects packages with postinstall build steps; the TypeScript tests for the touched modules pass.
- The `cmd/cli` `npm test` glob does not reliably discover `src/api-client.test.ts` under default shell globstar behavior, so tests were invoked explicitly.

## What remains for Phase 3

- Implement the actual `/api/v1/mcp-tunnels` platform endpoints and remove the CLI scaffold placeholder.
- Add integration tests that verify `approval_policy` and sandbox defaults propagate into the runtime permission/sandbox enforcement paths, not just config loading.
- Consider surfacing permission profile management in the gizzi TUI or generating shell completions for the new `gizzi config profile` commands.
