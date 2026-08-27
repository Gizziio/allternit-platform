# Swarm D — Phase 4 Docs / GTM Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-d`  
**Branch:** `ao/p4-swarm-d`  
**Base:** `parity/swarm-sprint`

## Goal
Document `gizzi-code`, the TypeScript SDK, config profiles, and admin CLI built in Phases 0–3.

## Deliverables (all under `docs/public/` unless noted)

1. `docs/public/gizzi/index.md` — gizzi-code overview:
   - What gizzi-code is (unified CLI brand, not "Allternit CLI")
   - `gizzi auth login --api-key`, `gizzi auth status`
   - `gizzi auth profile list|add|remove|set-active`
   - `gizzi config profile list|add|remove|set-active`
   - `gizzi exec` headless command
   - credential store (`file`/`keyring`/`auto`)

2. `docs/public/gizzi/configuration.md` — `config.toml` reference:
   - auth profiles / default model / sandbox prefs
   - named permission profiles
   - approval policy and sandbox preset config

3. `docs/public/sdk/typescript-quickstart.md` — `@allternit/sdk` quickstart:
   - install
   - first chat completion with `AllternitHarness`
   - tool use example
   - streaming example

4. `docs/public/sdk/examples/` — add at least 3 runnable examples:
   - `chat-with-tools.ts`
   - `stream-events.ts`
   - `run-batch.ts`

5. `docs/public/cli/admin.md` — `allternit admin` commands:
   - workspace/key/budget CRUD
   - `allternit admin mcp-tunnels list|create|rotate|delete`

6. Update `package.json` `scripts` if any docs-related script is missing; add `pnpm docs:lint` that runs a simple markdown link check (if feasible) or at least a script that lists `docs/public/` files.

## Validation
- `bun test cmd/gizzi-code/test/config/config.test.ts test/config/permission-profiles.test.ts test/config/credential-store.test.ts` must pass.
- `npx tsx --test cmd/cli/src/api-client.test.ts src/commands/admin.test.ts` must pass.
- SDK examples must be syntactically valid TypeScript (`tsc --noEmit` against them if possible, or at least no obvious syntax errors).

## Commit
Commit on `ao/p4-swarm-d` with message: `docs(p4): Swarm D gizzi-code, SDK, and CLI documentation`.
