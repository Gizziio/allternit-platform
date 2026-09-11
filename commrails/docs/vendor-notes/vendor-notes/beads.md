# Beads Harvest Notes

Goal: reimplement dependency graph and issue state mechanics inside Allternit rails.

Initial scan pointers (vendor repo):
- `beads.go` (core entry)
- `cmd/bd/*` (CLI behavior for graph, list, ready)
- `docs/` and `CHANGELOG.md` (behavioral notes)

Planned extractions:
- Cycle detection for dependency edges
- Ready-list computation (blocked_by only)
- Graph traversal utilities

Next step: map exact functions/algorithms to port once we settle on the Allternit DAG API surface.
