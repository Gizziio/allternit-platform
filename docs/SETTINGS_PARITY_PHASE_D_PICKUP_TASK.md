# Task: Settings UI Parity — Phase D pickup (finish an interrupted run)

A previous agent (kimi) executed most of Phase D (`docs/SETTINGS_PARITY_PHASE_D_TASK.md` — read it for full context and constraints) but hit a usage limit mid-way. You are finishing the remainder. Already DONE on disk — do not redo:

- `views/settings/AgentOpsPanel.tsx` + `SecurityPanel.tsx` extracted from SettingsView.tsx (now 1,187 lines)
- `src/hooks/useSettingsState.ts` persistence hook, wired into SettingsView
- Idiom sweep completed on `EnvironmentSettings.tsx`, `ServiceUrlSettings.tsx`, `VPSConnectionsPanel.tsx`

## Your scope

1. **`views/settings/InfrastructureSettings.tsx`** — the sweep agent for this file died mid-task (file may be partially edited). Complete its idiom sweep per Phase D task item 4: ad-hoc loading text/spinners → `SkeletonRow`, bare no-data text → `EmptyState`, loud headings → `SectionHeading`, loud/accent-filled buttons → the quiet style (see `src/components/settings/buttonStyles.ts` if it exists, else the QUIET_BUTTON_CLASS pattern in SettingsView.tsx). Do NOT restructure logic or APIs. First check whether the file is half-edited (mixed styles, broken syntax) and repair coherently.
2. **Sanity-check the other 3 swept panels** (Environment/ServiceUrl/VPS) — they were edited by parallel subagents and never verified: imports resolve, primitives used correctly, no syntax errors, no leftover half-replaced blocks.
3. **Verify SettingsView wiring**: imports of `AgentOpsPanel`/`SecurityPanel` correct, `renderContent` covers every id in `SETTINGS_NAV_ITEMS` (settings.config.ts), no dangling references to moved symbols, `useSettingsState` usage consistent.
4. **Write the deliverable**: `docs/SETTINGS_PARITY_PHASE_D_NOTES.md` per the original Phase D task spec — cover the ENTIRE phase (kimi's completed work summarized from disk + your work), files changed, SettingsView line counts before (2,369) / after, persistence approach, deviations, anything remaining.

## Constraints (identical to the original task)
- NEVER run builds/typechecks/dev servers (no tsc, npm/pnpm/bun build, cargo). Verify by reading code.
- No git operations.
- Match repo idiom: Tailwind + CSS vars, `cn()`, phosphor icons, named exports.
- Do NOT touch: `ModelManagementView.tsx`, anything under `views/code/`, anything outside `views/settings/*`, `components/settings/*`, `src/hooks/useSettingsState.ts`, and the notes doc.

The notes file existing = you are done.
