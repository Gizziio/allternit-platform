# Swarm D — gizzi-code CLI & Admin CLI — Map

This is the context map for Swarm D — gizzi-code CLI & Admin CLI. The master handoff checklist is at:
`/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope for Phase 0
- Extend gizzi-code with a `config.toml` config layer (auth profiles, default model, sandbox prefs).
- Add non-interactive / headless execution mode to gizzi-code.
- Create a separate `allternit` admin CLI scaffold for platform/resource operations (workspaces, keys, budgets).

## Known starting files
- `cmd/gizzi-code/`
- `cmd/allternit-api/src/`

## Constraints
- Do NOT start Phase 1 work yet.
- Do NOT run builds, dev servers, or tests that require external services.
- Match existing repo idioms (naming, module structure, error handling).
- Do NOT mutate the canonical repo; work only in `/Users/joe/Desktop/allternit-parity-swarm-d`.
