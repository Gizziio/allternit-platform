# Phase 2 Task: Integrate and polish creation surfaces

**Worktree:** `~/Desktop/allternit-workspace/allternit-session-7d581442-d796-4e0e-bdac-2fec641c3677`  
**Branch:** `session/7d581442-d796-4e0e-bdac-2fec641c3677`  
**Do NOT start Phase 3.**

## Background

Phase 1 cleaned the branch. The unique work on this branch is the creation-surfaces feature:
- `surfaces/ai.allternit.com/src/views/create/FormatPicker.tsx`, `presets.ts`, `enrich-prompt.ts` + tests
- Image/video provider settings panels and auth hooks (`ImageProvidersPanel.tsx`, `VideoProvidersPanel.tsx`, `useImageProviderAuth.ts`, etc.)
- `creation-engines.ts`, `artifact-smoke.test.ts`
- Chat composer / ModeDock wiring for format selection

## Scope

1. Review the Phase 1 commits and the current diff vs `origin/main`.
2. Find and fix incomplete wiring, TODOs, missing imports, or broken integrations in the creation feature.
3. Ensure the format picker and creation modes are wired end-to-end:
   - Format selection flows from `ModeDock` → `ChatComposer` → `creation-engines`.
   - Image/video provider auth hooks are used by the settings panels correctly.
   - Settings navigation entries (`settings.config.ts`) route to the new panels.
4. Add or fix tests where the implementation has changed.
5. Run cheap syntax checks on changed TS/TSX files (no full builds/typechecks/dev servers).
6. Commit your changes in coherent commits and push to `origin/session/7d581442-d796-4e0e-bdac-2fec641c3677`.

## Constraints

- Stay in the provided worktree.
- Do not run builds, typechecks, or dev servers.
- Do not start unrelated feature work.
- Match existing repo conventions.
- Preserve all Phase 1 work.

## Deliverable

When finished, write `docs/IOS_LOCAL_MODELS_MARKETPLACE_PHASE_2_NOTES.md` with this exact YAML frontmatter:

```yaml
---
status: done|blocked
files_changed:
  - path/to/file1
  - path/to/file2
deviations:
  - "what changed and why"
remaining:
  - "anything left for Phase 3"
---
```

Then add prose notes summarizing integration fixes, tests added, and current state.
