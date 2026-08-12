# Parity docs swarm task spec

## Context

- Handoff doc: `/Users/joe/Desktop/allternit-parity-handoff.md`
- Worktree: `/Users/joe/Desktop/allternit-parity-workspace`
- Branch: `parity/swarm-sprint`
- Report dir: `/Users/joe/Desktop/allternit-parity-workspace/.parity-reports`
- Output docs dir: `/Users/joe/Desktop/allternit-parity-workspace/docs/public/parity/`

## Goal

Close as many unchecked parity gaps as possible by creating accurate, Allternit-branded documentation pages that map each original concept to an Allternit equivalent.

## Instructions

1. Read the assigned section(s) of the handoff doc.
2. For each unchecked `- [ ] **...**` item:
   - Search the Allternit codebase and existing docs to see if the capability exists.
   - If it exists, document the Allternit way (CLI command, API endpoint, config option, tool, workflow).
   - If it is not applicable to Allternit's self-host/BYOC model, document it as **Not applicable / roadmap** and explain why.
   - If it is a genuine missing feature that should be implemented, document the gap and the planned path; do **not** mark it as done.
3. Create new docs pages under `docs/public/parity/<category-slug>.md` (or update an existing page when the category clearly maps to one). Match the style of `docs/public/api/reference.md` and other existing docs.
4. Do **not** edit `/Users/joe/Desktop/allternit-parity-handoff.md`.
5. Do **not** run `git commit`, `git push`, or other git mutations.
6. Run `cargo check -p allternit-api` only if you changed Rust code; docs-only changes do not need builds.
7. When finished, write a report file in `.parity-reports/<report-name>.md` with YAML frontmatter:

```yaml
---
status: done
files_changed: []
items_covered: []
items_missing: []
notes: ""
---
```

- `files_changed`: list every new or modified docs file.
- `items_covered`: list the handoff items you covered (copy the bold text).
- `items_missing`: list items that remain gaps, with a brief reason.
- `notes`: anything the reviewer should know.

## Research starting points

- API gateway / chat completions: `cmd/allternit-api/src/llm_gateway/`, `docs/public/api/reference.md`
- CLI / config: `cmd/gizzi-code/`, `docs/public/gizzi/`, `docs/public/cli/`
- Tools / MCP: `packages/@allternit/plugin-sdk/`, `docs/public/tools/`
- Sessions / memory / deployments: `cmd/allternit-api/src/beta_session_routes.rs`, `docs/public/api/sessions.md`
- Admin / RBAC / vault: `cmd/allternit-api/src/admin_*.rs`, `docs/public/admin/`, `docs/public/security/`
- ACI / computer use: `docs/public/aci/`
- Existing parity docs: `docs/public/parity/`
