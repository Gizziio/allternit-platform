# Swarm D — gizzi-code / Admin CLI — Phase 1 Map

Master handoff: `/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope

1. **Admin CLI update/delete flows** — Extend `cmd/cli/src/commands/admin.ts` with:
   - `allternit admin workspaces update <id>`
   - `allternit admin workspaces delete <id>`
   - `allternit admin keys update <id>`
   - `allternit admin keys delete <id>` (same as revoke, alias acceptable)
   - `allternit admin budgets reset`

2. **Interactive auth profile management** — Add a `gizzi auth profile` subcommand tree in `cmd/gizzi-code/src/cli/commands/` to:
   - `list` profiles from `config.toml`
   - `add <name>` interactively or via flags
   - `remove <name>`
   - `set-active <name>`

3. **Tests** — Add/update focused tests for the admin CLI client and gizzi config profile mutations.

## Known starting files
- `cmd/cli/src/commands/admin.ts`
- `cmd/cli/src/api-client.ts`
- `cmd/gizzi-code/src/runtime/context/config/config.ts`
- `cmd/gizzi-code/src/cli/commands/run.ts`
- `cmd/gizzi-code/test/config/config.test.ts`

## Constraints
- Do NOT start Phase 2 work.
- Do NOT run builds, dev servers, or tests that require external services.
- Match existing repo idioms.
- Work only in `/Users/joe/Desktop/allternit-parity-p1-swarm-d`.
