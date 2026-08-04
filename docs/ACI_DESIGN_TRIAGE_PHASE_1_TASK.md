# ACI/Browser + Design/Creative Triage — Phase 1

## Scope

Re-investigate every open ACI/Browser and Design/Creative item in `docs/SURFACE_AUDIT_SESSION_PROGRESS.md` against the live codebase. Do NOT write implementation code. This phase is verification + classification only.

### ACI/Browser items (rows 39–46)

1. ACI Browser surface (GAP → gizzi-code)
2. Mini-apps Store (GAP → iOS)
3. Mini-app frame/runtime (GAP → iOS)
4. Office Add-ins — Word (GAP → iOS, gizzi-code)
5. Office Add-ins — Excel (GAP → iOS, gizzi-code)
6. Office Add-ins — PowerPoint (GAP → iOS, gizzi-code)
7. Office & Extensions view (GAP → iOS, gizzi-code)
8. Operator Browser (GAP → gizzi-code)

### Design/Creative items (rows 47–59)

9. Design Mode — Questions tab (GAP → iOS, gizzi-code)
10. Design Mode — Mobile tab (GAP → iOS, gizzi-code)
11. Design Mode — Docs tab (GAP → iOS, gizzi-code)
12. Design Mode — Handoff tab (GAP → iOS, gizzi-code)
13. Design Mode — Graph tab (GAP → iOS, gizzi-code)
14. Design Mode — Pipeline tab (GAP → iOS, gizzi-code)
15. Design Marketplace/Registry (GAP → iOS)
16. Design Compare (GAP → iOS, gizzi-code)
17. Form Surfaces (GAP → iOS, gizzi-code)
18. Canvas Protocol (PARTIAL → iOS)
19. Design Team Workspace (GAP → iOS, gizzi-code)
20. Content Pipeline (GAP → iOS, gizzi-code)
21. Live Artifact Editor (PARTIAL → upgrade)

## Investigation method

For each item:
1. Search web (`surfaces/ai.allternit.com/src/views/`), iOS (`surfaces/allternit-mobile/ios/Features/`), and gizzi-code (`cmd/gizzi-code/src/`) for the named component/feature.
2. Check for implementations, stubs, dead routes, or missing surfaces.
3. Classify each item exactly as one of:
   - `REAL` — confirmed live gap.
   - `STALE` — already exists, renamed, dead code, or duplicate.
   - `DEFER` — real but out of scope for this phase.

## Deliverable

Write `docs/ACI_DESIGN_TRIAGE_PHASE_1_NOTES.md` with this exact YAML frontmatter:

```yaml
status: done
files_changed: []
deviations: []
remaining: []
```

Then prose with a subsection for each of the 21 items containing classification, evidence (file paths), and recommended next action.

Also update `docs/SURFACE_AUDIT_SESSION_PROGRESS.md` in-place: set the `Status` column for each ACI/Browser + Design/Creative row to `[x]` and the `Finding` column to your classification + brief evidence.

## Constraints

- Read-only investigation. Do not modify source files.
- Do not run builds, typechecks, or dev servers.
- Do not commit or push.
- Be concise; cite exact file paths.

When finished, `docs/ACI_DESIGN_TRIAGE_PHASE_1_NOTES.md` must exist. That file existing = done.
