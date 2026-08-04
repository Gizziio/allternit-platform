# Terminal/Infra + DAG Suite Triage — Phase 1

## Scope

Re-investigate every open Terminal/Infra and DAG suite item in `docs/SURFACE_AUDIT_SESSION_PROGRESS.md` against the live codebase. Do NOT write implementation code. This phase is verification + classification only.

### Terminal/Infra items (rows 60–70)

1. Monitor (GAP → iOS)
2. Runtime Operations (GAP → iOS, gizzi-code)
3. Budget Dashboard (PARTIAL → iOS)
4. Replay Manager (GAP → iOS, gizzi-code)
5. Prewarm Manager (GAP → iOS, gizzi-code)
6. Nodes (GAP → iOS, gizzi-code)
7. Cloud Deploy (GAP → iOS, gizzi-code)
8. Capsule Manager (GAP → iOS)
9. VPS & Servers panel (GAP → iOS, gizzi-code)
10. Cloud Instances panel (GAP → iOS, gizzi-code)
11. Enterprise BYOC panel (GAP → iOS, gizzi-code)

### DAG suite items (rows 71–86)

12. DAG Integration Page (PARTIAL → upgrade)
13. Ontology Viewer (GAP → gizzi-code)
14. Directive Compiler (GAP → gizzi-code)
15. GC Agents (GAP → gizzi-code)
16. Receipts Viewer (GAP → gizzi-code)
17. Security Dashboard (GAP → gizzi-code)
18. Purpose Binding (GAP → gizzi-code)
19. Observability Dashboard (PARTIAL → upgrade)
20. Multimodal Input (GAP → gizzi-code)
21. Evolution Layer (GAP → gizzi-code)
22. Context Control Plane (GAP → gizzi-code)
23. Swarm ADE (PARTIAL → iOS)
24. H5I panel — Audit (GAP → gizzi-code)
25. H5I panel — Commit (PARTIAL → upgrade)
26. H5I panel — Context (GAP → gizzi-code)
27. H5I panel — Diff (PARTIAL → upgrade)

## Investigation method

For each item:
1. Search web (`surfaces/ai.allternit.com/src/views/`), iOS (`surfaces/allternit-mobile/ios/`), and gizzi-code (`cmd/gizzi-code/src/`) for the named component/feature.
2. Check for implementations, stubs, dead routes, or missing surfaces.
3. Check backend support where relevant.
4. Classify each item exactly as one of:
   - `REAL` — confirmed live gap.
   - `STALE` — already exists, renamed, dead code, or duplicate.
   - `DEFER` — real but out of scope for this phase.

## Deliverable

Write `docs/INFRA_TRIAGE_PHASE_1_NOTES.md` with this exact YAML frontmatter:

```yaml
status: done
files_changed: []
deviations: []
remaining: []
```

Then prose with a subsection for each of the 27 items containing classification, evidence (file paths), and recommended next action.

Also update `docs/SURFACE_AUDIT_SESSION_PROGRESS.md` in-place: set the `Status` column for each Terminal/Infra + DAG row to `[x]` and the `Finding` column to your classification + brief evidence.

## Constraints

- Read-only investigation. Do not modify source files.
- Do not run builds, typechecks, or dev servers.
- Do not commit or push.
- Be concise; cite exact file paths.

When finished, `docs/INFRA_TRIAGE_PHASE_1_NOTES.md` must exist. That file existing = done.
