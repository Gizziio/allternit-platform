# Terminal-control validation task: review status UI

Modify only these files:

- `surfaces/ai.allternit.com/src/views/code/OrchestratorCenter.tsx`
- `docs/TERMINAL_CONTROL_REVIEW_UI_NOTES.md`

In each executor session card, show the persisted review status when present (`pending`, `accepted`, or `rejected`) alongside the execution state. In the selected-session header, show the review status and decision reason when present. Preserve the existing design tokens and compact visual style. Do not change orchestration behavior or any other file.

Do not run builds, typechecks, dev servers, tests, or git commands.

When complete, write `docs/TERMINAL_CONTROL_REVIEW_UI_NOTES.md` with this exact frontmatter shape and an honest prose summary:

```yaml
---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/views/code/OrchestratorCenter.tsx
  - docs/TERMINAL_CONTROL_REVIEW_UI_NOTES.md
deviations: []
remaining: []
---
```
