# Code Section Triage — Phase 1

## Scope

Re-investigate every open Code item in `docs/SURFACE_AUDIT_SESSION_PROGRESS.md` against the live codebase. Do NOT write implementation code. This phase is verification + classification only.

Items to verify (rows 20–38 in the session tracker):

1. Code workspace (CodeRoot) (PARTIAL → upgrade)
2. Code Explorer (GAP → iOS)
3. Code Git panel (GAP → iOS)
4. Code Skills view (GAP → iOS)
5. Code Project view (PARTIAL → upgrade)
6. Code Canvas (live preview split view) (PARTIAL → iOS)
7. Code Preview Pane (GAP → iOS, gizzi-code)
8. Orchestrator Center (PARTIAL → iOS)
9. Orchestration View (PARTIAL → iOS)
10. Goal Control Center (GAP → iOS)
11. Kanban(+DAG) Board (GAP → iOS)
12. Debug View (PARTIAL → iOS)
13. Logs View (PARTIAL → iOS)
14. Run Inspector (PARTIAL → iOS)
15. Run Replay (GAP → iOS, gizzi-code)
16. Tools Registry (PARTIAL → iOS)
17. Skills Registry (GAP → iOS)
18. Promotion Dashboard (GAP → iOS, gizzi-code)
19. Automation Tasks (Code) (GAP → iOS)

## Investigation method

For each item:
1. Search web (`surfaces/ai.allternit.com/src/views/code/`), iOS (`surfaces/allternit-mobile/ios/Features/Code/`), and gizzi-code (`cmd/gizzi-code/src/`) for the named component/feature.
2. Check whether the feature is implemented, a stub/empty shell, dead registered route with no dispatcher, or missing entirely.
3. Check backend support in `cmd/allternit-api/src/` and `cmd/allternit-cloud-api/`.
4. Classify each item exactly as one of:
   - `REAL` — confirmed live gap.
   - `STALE` — already exists, renamed, dead code, or duplicate.
   - `DEFER` — real but out of scope for this phase.

## Deliverable

Write `docs/CODE_TRIAGE_PHASE_1_NOTES.md` with this exact YAML frontmatter:

```yaml
status: done
files_changed: []
deviations: []
remaining: []
```

Then prose with a subsection for each of the 19 items containing classification, evidence (file paths), and recommended next action.

Also update `docs/SURFACE_AUDIT_SESSION_PROGRESS.md` in-place: set the `Status` column for each Code row to `[x]` and the `Finding` column to your classification + brief evidence.

## Constraints

- Read-only investigation. Do not modify source files.
- Do not run builds, typechecks, or dev servers.
- Do not commit or push.
- Be concise; cite exact file paths.

When finished, `docs/CODE_TRIAGE_PHASE_1_NOTES.md` must exist. That file existing = done.
