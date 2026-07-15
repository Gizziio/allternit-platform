# GC Agents Setup Card — Map

Produced 2026-07-15 by the orchestrating session. Read before the task spec.

## Why

The GC Agents backend (real analyzer, per-project scoping) was wired up and verified live in a
prior task. But there is currently **zero UI** for a user to explain what the feature does or to
connect their own repository — `AgentOpsPanel.tsx`'s GC tab silently no-ops with a toast error if
no project/repo is configured. Eoj: "this needs to have a wizard or explanation to users on how it
works." Scope decision (Eoj, explicit): an inline setup card, not a multi-step wizard modal.

## Confirmed API contract (read directly from source, not assumed)

- `GET /api/v1/cowork/projects` → `{ "projects": ProjectRow[] }`. `POST /api/v1/cowork/projects` →
  `{ "project": { "id": "..." } }` (only the id is returned on create). `PUT
  /api/v1/cowork/projects/:id` → `{ "success": true }`. `GET /api/v1/cowork/projects/:id` →
  `{ "project": ProjectRow }`.
- `ProjectRow` (as of commit `b52e1005b`, just landed) now includes `git_remote: Option<String>`
  and `default_branch: Option<String>` in both `list_projects` and `get_project` responses — this
  was a gap fixed by the orchestrator specifically so this task is possible; do not assume it's
  still missing, it's there.
- `CreateProjectBody` / `UpdateProjectBody` in `cmd/allternit-api/src/cowork_routes.rs`: fields are
  `title` (create only, required), `description`, `instructions`, `metadata`, `git_remote`,
  `default_branch` — all snake_case, **no** `#[serde(rename_all = "camelCase")]` on these structs.
  `UpdateProjectBody`'s fields are all `Option` and use `COALESCE` in the SQL — omitted fields are
  left unchanged server-side, so you only need to send the fields you're setting.
- GC routes under `/api/v1/agents/operations/gc/*` all require `?projectId=` (see
  `agent_operations_routes.rs`); missing it returns `422`; a project with no `git_remote` returns
  `422` with `{"error": "project has no repository configured"}` when a GC agent run is attempted.

## Current frontend state (`surfaces/ai.allternit.com/src/views/settings/AgentOpsPanel.tsx`)

- `resolveGCProject()` calls `api.getCoworkProjects()` and picks `data.projects?.[0]?.id`, storing
  only the id in `gcProjectId` state — the full project object (and therefore whether it has a
  `git_remote`) is discarded.
- `fetchGCData()` only runs `if (gcProjectId)`; if null, or if the project has no `git_remote`, the
  six GC buttons currently just toast `"No Cowork project is available for GC"` — no explanation,
  no path to fix it.
- The `api` object at the top of the file holds all fetch calls in one place, each following the
  same `fetch → if (!res.ok) throw → return res.json()` pattern.

## Primitives to reuse (already in the codebase)

- `surfaces/ai.allternit.com/src/components/settings/EmptyState.tsx` — `icon`, `title?`, `caption`,
  `ctaLabel?`, `onCtaClick?`, `primaryCta?`.
- `surfaces/ai.allternit.com/src/views/settings/SettingsCard.tsx` — exports `SettingsCard`
  (`title?`, `description?`, `action?`, `children`) and `SettingsCardRow` (`label`, `description?`,
  `children?`) with a top-border divider between rows.

## The six agents (real descriptions, for the explanatory copy — not marketing copy)

Source: `spec/governance/gc-agents.md` (`git show 2f7f0f30:spec/governance/gc-agents.md`) cross-
checked against the real implementations in
`domains/governance/garbage-collection/gc-agents/src/lib.rs`.

1. **Duplicate Detector** — finds duplicated code blocks/functions that should be a shared utility.
2. **Boundary Type Checker** — finds untyped error boundaries (e.g. `unwrap()`/`expect()` in Rust)
   that can panic instead of returning a handled error.
3. **Dependency Validator** — flags imports that violate the intended layering/dependency direction.
4. **Observability Checker** — finds code paths with no logging/tracing.
5. **Documentation Sync** — finds docs that no longer match the implementation they describe.
6. **Test Coverage Checker** — finds modules with no test coverage.

Results roll up into an entropy score shown elsewhere in this same panel (history/benchmark views)
— don't restate the scoring formula in this card's copy, a one-line "lower is healthier" is enough.

## Non-goals

- No multi-step wizard/modal — one inline card, per Eoj's explicit choice.
- No repo-URL client-side format validation beyond non-empty — real errors come from the backend
  clone attempt and are already surfaced via the existing toast/error state in this file.
- No changes to any other settings tab or file besides `AgentOpsPanel.tsx`, unless something it
  imports is missing a capability it needs — in which case stop and flag it in NOTES rather than
  editing elsewhere.
