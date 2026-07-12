# Task: Settings UI Parity — Phase D (final)

Phase C is reviewed and approved with no fixes needed. Implement Phase D per `docs/CLAUDE_DESKTOP_SETTINGS_PARITY_MAP.md` and the "Left for Phase D" list in your `docs/SETTINGS_PARITY_PHASE_C_NOTES.md`, scoped as below.

## Scope

1. **Extract the dashboards out of the monolith.** Move the agent-ops content (evaluation / factory / GC: their state, `api` helper object, sub-components, and render functions) and the security panel internals from `SettingsView.tsx` into new files `surfaces/ai.allternit.com/src/views/settings/AgentOpsPanel.tsx` and `SecurityPanel.tsx`. Pure mechanical move — identical behavior, props for anything they need from the view (e.g. toast helpers), SettingsView imports them. Also move `StatCard`/`MetricBar`/GC types if they move with their only consumers. Target: SettingsView.tsx drops well under 1,500 lines.
2. **Quiet-style pass on the two extracted panels**: sentence-case 16px semibold headings via `SectionHeading`, loud accent-filled buttons → `QUIET_BUTTON_CLASS` (export it or move it somewhere shared like `src/components/settings/buttonStyles.ts`), keep StatCard/MetricBar where the content is genuinely dashboard-like.
3. **Persist the migrated settings state.** The toggles/selects/inputs you migrated in Phases A–C (general, appearance, privacy, gizziio-code, cowork, extensions sections) are local `useState` and reset on close. First check `src/hooks/useRuntimeSettings.ts` and the `ThemeStore` zustand-persist pattern — if one of those fits, use it; otherwise add a small `useSettingsState(key, initial)` hook persisting to localStorage under `allternit.settings.v1.<key>`, and swap the migrated sections onto it. Do not touch state owned by external components.
4. **Idiom sweep on the external settings panels** `InfrastructureSettings.tsx`, `EnvironmentSettings.tsx`, `VPSConnectionsPanel.tsx`, `ServiceUrlSettings.tsx`: replace ad-hoc loading text/spinners with `SkeletonRow`, bare "no data" text with `EmptyState`, loud headings with `SectionHeading`, loud buttons with the quiet style. Do NOT restructure their logic or APIs.
   - **Explicitly excluded:** `ModelManagementView.tsx` (has unrelated uncommitted changes — do not touch it), `LabsSettingsTab`, anything outside the settings folders.

## Constraints (same as before)
- NEVER run builds/typechecks/dev servers (no tsc, npm/pnpm/bun build, cargo). Verify by reading code.
- No git operations.
- Match repo idiom: Tailwind + CSS vars, `cn()`, phosphor icons, named exports.
- Preserve the reviewer's content-pane structure (pinned ×, inner scroller).
- Files you may touch: `views/settings/*` (except ModelManagementView.tsx), `components/settings/*`, and the new hook file if needed under `src/hooks/`.

## Deliverable
When finished, write `docs/SETTINGS_PARITY_PHASE_D_NOTES.md`: files changed, what moved where (with line counts before/after for SettingsView), persistence approach chosen and why, deviations, anything remaining. That file existing = done.
