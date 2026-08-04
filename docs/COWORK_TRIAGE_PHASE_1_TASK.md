# Cowork Section Triage — Phase 1

## Scope

Re-investigate every open Cowork item in `docs/SURFACE_AUDIT_SESSION_PROGRESS.md` against the live codebase. Do NOT write implementation code. This phase is verification + classification only.

Items to verify (rows 4–19 in the session tracker):

1. Cowork workspace (CoworkRoot) (PARTIAL → iOS)
2. Cowork Runs view (PARTIAL → iOS)
3. Cowork Drafts view (GAP → iOS)
4. Cowork Cron view (GAP → iOS)
5. Cowork Project view (GAP → gizzi-code)
6. Cowork Documents view (GAP → iOS)
7. Cowork Tables view (GAP → iOS)
8. Cowork Files view (GAP → iOS)
9. Cowork Exports view (PARTIAL → iOS)
10. Cowork Insights panel (GAP → iOS, gizzi-code)
11. Cowork Activity panel (GAP → iOS, gizzi-code)
12. Cowork Goals panel (PARTIAL → iOS)
13. Cowork Wiki section viewer (PARTIAL → iOS)
14. Cowork Audit log viewer (GAP → iOS, gizzi-code)
15. Intelli-Schedule panel (GAP → iOS)
16. Harness Config panel (GAP → iOS)

## Investigation method

For each item:
1. Search the relevant surface directories for the named feature/component (e.g., `CoworkRoot`, `CoworkRunsView`, `CoworkDraftsView`, `cowork/projects`, `cowork/tasks`, etc.).
2. Check web (`surfaces/ai.allternit.com/src/views/cowork/`), iOS (`surfaces/allternit-mobile/ios/Features/Cowork/`), and gizzi-code (`cmd/gizzi-code/src/`) for existing implementations, dead registered-but-empty components, or zero-dispatch routes.
3. Check backend routes in `cmd/allternit-api/src/cowork_routes.rs` and `cmd/allternit-cloud-api/` to confirm whether the data endpoint exists.
4. Classify each item exactly as one of:
   - `REAL` — confirmed live gap; a surface lacks a feature the others have, and the backend/data exists or is plausible.
   - `STALE` — audit claim is wrong: feature already exists, was renamed, is dead code (registered but never shipped), or is a duplicate of another item.
   - `DEFER` — real but intentionally out of scope for this phase (state why).

## Deliverable

Write `docs/COWORK_TRIAGE_PHASE_1_NOTES.md` with this exact YAML frontmatter:

```yaml
status: done
files_changed: []
deviations: []
remaining: []
```

Then prose with a subsection for each of the 16 items containing:
- Classification (`REAL` / `STALE` / `DEFER`)
- Evidence (file paths and 1–2 sentence findings)
- Recommended next action (`build`, `close`, `defer to <phase>`)

Also update `docs/SURFACE_AUDIT_SESSION_PROGRESS.md` in-place: set the `Status` column for each Cowork row to `[x]` and the `Finding` column to your classification + brief evidence.

## Constraints

- Read-only investigation. Do not create, delete, or modify source files.
- Do not run builds, typechecks, or dev servers.
- Do not commit or push.
- Be concise; cite exact file paths.

When finished, the `docs/COWORK_TRIAGE_PHASE_1_NOTES.md` file must exist. That file existing = done.
