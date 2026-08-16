# Model Lab Reorganization — Phase 1

## Goal
Reorganize the Model Lab top-level navigation so it is not a flat row of 9+ tabs. Combine overlapping Engine / Local Runtime / Status concepts into a single landing view, and promote Local Studio to its own main tab.

## Current state
- `surfaces/ai.allternit.com/src/views/model-lab/ModelLabView.tsx` defines 5 top tabs: Engine, Explore, Train, Cloud, Playground.
- `surfaces/ai.allternit.com/src/views/model-lab/StatusPanel.tsx` adds 4 sub-tabs inside the Engine tab: Overview, Inference Engine, Local Runtime, Local Studio.
- `surfaces/ai.allternit.com/src/views/model-lab/LocalRuntimePanel.tsx` already contains telemetry + operations (Models / Quantize / Merge / Evaluate / Logs).
- `surfaces/ai.allternit.com/src/views/model-lab/EnginePanel.tsx` duplicates some telemetry and adds Sidecar Models + Deploy-from-job + Brain registration.
- `surfaces/ai.allternit.com/src/views/model-lab/LocalStudioPanel.tsx` is hidden behind the StatusPanel › Local Studio sub-tab.

## Desired final navigation
Top tabs in `ModelLabView.tsx` (left-to-right):
1. **Engine** — telemetry + local cache + runtimes + operations (quantize/merge/evaluate) + sidecar models + deploy from completed training jobs + brain registration. This is the landing tab.
2. **Catalog** — rename from Explore; keep Discover + Catalog sub-tabs.
3. **Train** — keep existing TrainingPanel.
4. **Studio** — promote `LocalStudioPanel` to a main tab.
5. **Cloud** — keep existing CloudPanel.
6. **Playground** — keep existing PlaygroundPanel.

## Files to modify
- `surfaces/ai.allternit.com/src/views/model-lab/ModelLabView.tsx`
- `surfaces/ai.allternit.com/src/views/model-lab/LocalRuntimePanel.tsx` (or create a new `EnginePanel.tsx` replacement)
- `surfaces/ai.allternit.com/src/views/model-lab/StatusPanel.tsx` (remove sub-tabs; keep only as a lightweight telemetry card component if useful, or delete if unused)
- `surfaces/ai.allternit.com/src/views/model-lab/EnginePanel.tsx` (delete; merge useful pieces into the new Engine view)
- `surfaces/ai.allternit.com/src/views/model-lab/index.ts` (ensure exports are correct)

## Detailed requirements

### ModelLabView.tsx
- Update `TABS` array to: `engine`, `catalog`, `train`, `studio`, `cloud`, `playground`.
- Rename Explore to Catalog in labels.
- Keep active tab default as `engine`.
- Render: `activeTab === 'engine' && <LocalRuntimePanel />` (or new combined Engine panel).
- Render Studio using `LocalStudioPanel`.

### Engine view (use LocalRuntimePanel as base)
LocalRuntimePanel already has:
- Overview status cards (Health, CPU, RAM, GPU, Disk, Models, Runtimes)
- Models tab (import/download/cache list/launch)
- Quantize / Merge / Evaluate / Logs tabs

Add the missing pieces from EnginePanel:
- **Sidecar Models** section (list tags, size, delete, refresh, Add Sidecar to Brain button).
- **Deploy from training job** section (select completed job, import output path).
- **Brain registration** buttons: "Add Local Engine to Brain" and "Add Sidecar to Brain".
- Keep the Apple Silicon unified memory detection logic already present.
- Keep all existing `useModelLabStore` hooks.

Remove the separate `EnginePanel.tsx` file and any imports of it.

### StatusPanel.tsx
- Remove the sub-tab bar and the rendering of EnginePanel/LocalRuntimePanel/LocalStudioPanel inside it.
- Either convert it into a simple reusable telemetry-card component used by the new Engine view, or delete it if no longer imported.
- Do not leave dead imports or unused components.

### Visual consistency
- Match existing Tailwind styling: `bg-[var(--bg-elevated)]`, `border-[var(--border-subtle)]`, `text-[var(--text-primary)]`, etc.
- Use Phosphor icons (`@phosphor-icons/react`) and `lucide-react` where already used.
- Use existing components: `Button`, `Badge`, `Input`, `Label`, `Select` from `@/components/ui/*`.
- Use `cn()` from `@/lib/utils` for conditional classes.

## Constraints
- Do NOT run builds, typechecks, dev servers, or git operations.
- Do NOT touch bot code, ACI code, or model-picker code.
- Do NOT add new dependencies.
- Keep changes scoped to the Model Lab view directory.
- Preserve all existing functionality (downloads, launches, brain registration, jobs, etc.).

## Deliverable
When finished, write `docs/agent-tasks/MODEL_LAB_REORG_PHASE_1_NOTES.md` with YAML frontmatter:

```yaml
status: done
files_changed:
  - surfaces/ai.allternit.com/src/views/model-lab/ModelLabView.tsx
  - surfaces/ai.allternit.com/src/views/model-lab/LocalRuntimePanel.tsx
  # plus any other files changed
deviations: []
remaining: []
```

Then prose notes summarizing what changed and any issues.
