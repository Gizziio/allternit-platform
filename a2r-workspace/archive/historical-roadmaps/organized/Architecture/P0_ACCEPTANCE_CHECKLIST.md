# P0_ACCEPTANCE_CHECKLIST (v001)
**Date:** 2026-01-09

This checklist must pass before moving to P1.

## Core UX
- [ ] Capsules open/close/activate as tabs
- [ ] Active tab controls active canvas
- [ ] Canvas renders from CanvasSpec only (no ad-hoc UI)

## Commands
- [ ] `search cats` opens a Search capsule
- [ ] Search canvas renders results placeholder
- [ ] Journal shows: intent → tool_call → tool_result → canvas_update
- [ ] ObserveCapsule artifact exists (mock ok)

- [ ] `note hello` opens Notes capsule
- [ ] Notes canvas shows persisted content
- [ ] Journal records note event

## Contracts
- [ ] `/v1/workspaces/{ws}/frameworks` contract defined and used
- [ ] `/v1/intent/dispatch` returns capsule + events + artifacts + canvas
- [ ] `/v1/journal/stream` contract defined

## Artifacts
- [ ] ObserveCapsule schema defined
- [ ] DistillateCapsule schema defined (even if unused)

## Constraints
- [ ] No repo-wide refactors
- [ ] No new spec systems
- [ ] No skipped Architecture files

## Evidence
- [ ] Demo link or steps included in PR
