# Agent Studio — Hand-off / Cleanup Notes

## Scope

"Agent Studio" is the agent-creation and management surface inside the platform. It is reachable from:

- **Agent Hub** (`src/views/AgentHub.tsx`) — the top-level hub with tabs (Studio, Registry, Sessions, Memory, Analytics, Workspace).
- **Agent View** (`src/views/AgentView.tsx`) — the standalone registry/list/detail view reused inside the hub and elsewhere.
- **Create / Edit / Detail forms** under `src/views/agent-view/components/`.

## Files of Note

| File | Lines | Role |
|------|-------|------|
| `src/views/AgentHub.tsx` | ~160 | Hub shell, tab navigation, mobile dropdown, theme toggle. |
| `src/views/agent-hub/main/AgentHubContent.tsx` | 54 | Tab router for the hub. |
| `src/views/agent-hub/main/AgentSessionsTab.tsx` | 190 | "Sessions" tab content (agent-mode sessions across surfaces). |
| `src/views/AgentView.tsx` | 186 | Standalone agent registry/list/detail controller. |
| `src/views/agent-view/components/CreateAgentForm.tsx` | ~2,090 | Multi-step agent creation wizard (monolith). |
| `src/views/agent-view/components/EditAgentForm.tsx` | ~315 | Edit existing agent. |
| `src/views/agent-view/components/AgentDetailView.tsx` | ~875 | Agent detail / run history. |
| `src/views/agent-view/components/AgentGalleryGrid.tsx` | 132 | Gallery grid used by AgentView. |
| `src/views/agent-view/components/AgentGalleryCard.tsx` | 339 | Card rendered in the gallery. |
| `src/views/agent-view/components/AgentToolConfigurator.tsx` | 363 | Tool selection UI. |
| `src/views/agent-view/components/AgentAvatarPicker.tsx` | 236 | Avatar / mascot picker. |
| `src/views/agent-view/components/AgentTemplateSelector.tsx` | 330 | Template selector. |
| `src/views/agent-view/components/AgentMascotPreview.tsx` | 97 | Used by `AgentGalleryCard`. |

## What Has Been Cleaned

1. **Fixed Agent Hub crash in `CreateAgentForm`** (`src/views/agent-view/components/CreateAgentForm.tsx`)
   - The form destructured `orchestrators` from `useAgentStore()`, but the store does not expose it.
   - Changed to derive it from `agents`:
     ```ts
     const { createAgent, agents, isCreating } = useAgentStore();
     const orchestrators = agents.filter((a) => a.type === 'orchestrator');
     ```
   - This was causing `orchestrators.length` to throw when opening the **Agent Studio** tab.

2. **Removed dead code**
   - Deleted `src/views/agent-view/components/AgentWorkspacePreview.tsx` (exported but never imported).
   - Removed unused inner card components from `AgentDetailView.tsx` (`RunCard`, `TaskCard`, `CheckpointCard`, `CommitCard`) and their now-unused imports.
   - Removed unused state/imports from `AgentGalleryCard.tsx` (`agents`, `initial`).
   - Removed dead state from `CreateAgentForm.tsx` (`isForging`/`setIsForging`, `isCapabilitiesLoading`, `setWorkspaceLayers`, local `workspaceCreated`, `setBrowserCompatibility`).
   - Removed unused `logger` from `EditAgentForm.tsx`.

3. **Agent Hub now follows platform theme tokens**
   - Replaced hard-coded dark values (`#1a1714`, `bg-black/20`, `text-white`, `text-zinc-400`, `border-white/10`, etc.) with `var(--surface-panel)`, `var(--surface-hover)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--border-subtle)`, etc.
   - Removed dead `STUDIO_THEME` and `hoveredTab` state from `AgentHub.tsx`.

4. **Confirmed the Sessions tab is wired up**
   - `AgentHubContent.tsx` already renders `<AgentSessionsTab />` for the `sessions` tab.
   - `AgentHub.constants.ts` keeps the tab.
   - Migrated the Sessions tab filter bar from `bg-black/20`/`border-white/5` to platform tokens.

5. **Removed duplicate view registration**
   - `ViewRegistry.tsx` previously had both `agent` and `agent-hub` entries pointing to `<AgentHub />`; only `agent-hub` remains.

## Current Lint / Type Status

```bash
pnpm exec eslint src/views/agent-view/**/*.tsx src/views/AgentHub.tsx src/views/agent-hub/main/AgentHubContent.tsx src/views/agent-hub/main/AgentSessionsTab.tsx
```

**0 errors, 0 warnings.**

```bash
pnpm exec tsc --project tsconfig.typecheck.json --noEmit
```

**No type errors in Agent Studio files.** (The only existing errors are in `DocumentEditorPack.tsx` / `SheetEditorPack.tsx`, unrelated to Agent Studio.)

## Remaining Architectural Debt

1. **`CreateAgentForm.tsx` is still a ~2,100-line monolith**
   - Contains identity, avatar, model, capabilities, tools, workspace layers, harness, voice, review, and forge animation logic.
   - **Recommendation:** split each step into its own component under `src/views/agent-view/steps/` and keep the parent form as a thin state/router shell.

2. **Heavy use of `// @ts-nocheck`**
   - `AgentView.tsx` and `CreateAgentForm.tsx` disable TypeScript. The studio surface would be safer and easier to refactor with types enabled incrementally.

3. **Mixed styling languages**
   - Some components still rely on `STUDIO_THEME` constants and inline styles from `AgentView.constants.ts`. A full pass to replace those with CSS variables would make the studio fully theme-aware.

4. **Shared form logic between Create and Edit**
   - `CreateAgentForm` and `EditAgentForm` duplicate model/harness/surface/trust/etc. UI. Extracting a shared `AgentFormFields` component would reduce duplication.

## Suggested Next Steps

1. **Short-term (low risk)**
   - Enable TypeScript in `AgentView.tsx` (remove `// @ts-nocheck`) and fix the resulting errors.
   - Audit remaining `STUDIO_THEME` usages and migrate to platform tokens.

2. **Medium-term**
   - Break `CreateAgentForm.tsx` into step components (Identity, Avatar, Model, Capabilities, Tools, Workspace, Voice, Review).
   - Extract shared form fields into a reusable `AgentFormFields` component used by both create and edit flows.

3. **Long-term**
   - Add tests for agent creation / editing flows.
   - Move agent-related stores/hooks under a dedicated `src/lib/agents/studio/` module if the surface keeps growing.
