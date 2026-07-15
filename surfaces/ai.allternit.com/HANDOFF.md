# Hand-off: Recents Rail + Agent Studio Cleanup

## Current Status

The work is split into two areas:

1. **Recents section in the left rail + Settings/Customize wiring** — mostly done.
2. **Agent Studio cleanup** — low-risk cleanup done; the remaining structural work is documented in `src/views/agent-view/AGENT_STUDIO_DECISIONS.md`.

Type-check and lint are clean for all files touched in this work. The only remaining TypeScript errors in the project are pre-existing and unrelated (`DocumentEditorPack.tsx`, `SheetEditorPack.tsx`).

---

## 1. Recents / Rail / Settings / Rename

### What was changed

- **`src/shell/ShellRail.tsx`**
  - Added `onOpenCustomize?: (tab?: string) => void` prop and wired the **Customize** rail item to open the existing `PluginManagerOverlay`.
  - Refactored the **Recents** list to match the screenshots:
    - Removed per-item date labels.
    - Replaced the hover trash icon with a three-dot menu (`RecentItemMenu`).
    - Added delete confirmation for home-mode recents and code-mode threads.
  - Repositioned the recents filter popover to `side="bottom" align="end"` with `collisionPadding={12}` so it no longer collides with the rail.

- **`src/shell/ShellApp.tsx`**
  - Already had the `PluginManagerOverlay` state and passed `onOpenCustomize` into `<ShellRail />`.
  - `<SettingsOverlay />` now receives an explicit `onClose={() => setSettingsOpen(false)}` prop.

- **`src/views/settings/SettingsView.tsx`**
  - `closeSettings()` now dispatches the close event **and** calls `onClose?.()`, fixing the modal close bug.

- **Renamed "Chats and tasks" → "Recents"**
  - `src/views/ChatsAndTasksView.tsx` → `src/views/RecentsView.tsx`
  - Component renamed to `RecentsView`.
  - View type changed from `'chats-and-tasks'` → `'recents'` in:
    - `src/nav/nav.types.ts`
    - `src/nav/nav.policy.ts`
    - `src/shell/ViewRegistry.tsx`
    - `src/shell/ShellApp.tsx` (`/shell/recents` route)
    - `src/shell/ShellRail.tsx` (open-all recents button)

### Verification

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/surfaces/ai.allternit.com
pnpm exec tsc --project tsconfig.typecheck.json --noEmit
pnpm exec eslint src/shell/ShellRail.tsx src/shell/ShellApp.tsx src/shell/ViewRegistry.tsx src/views/RecentsView.tsx src/views/settings/SettingsView.tsx src/nav/nav.types.ts src/nav/nav.policy.ts
```

### What is intentionally left as-is

- The filter popover content still shows expanded Type/Status/Last activity rows (no "Group by" in the rail). The screenshots show a compact menu, but the user only complained about collision/visibility, so the existing content was kept.
- The full-page `RecentsView` already uses platform shell colors and is titled "Recents".

---

## 2. Agent Studio Cleanup

### What was changed

- **Fixed the Agent Hub crash**
  - `src/views/agent-view/components/CreateAgentForm.tsx`: `orchestrators` was destructured from `useAgentStore()` but the store does not expose it. Now derived from `agents.filter(a => a.type === 'orchestrator')`.

- **Removed dead code**
  - Deleted `src/views/agent-view/components/AgentWorkspacePreview.tsx`.
  - Removed duplicate `agent` view registration in `src/shell/ViewRegistry.tsx` (kept `agent-hub`).
  - Removed dead inner card components (`RunCard`, `TaskCard`, `CheckpointCard`, `CommitCard`) from `AgentDetailView.tsx`.
  - Removed dead state/imports from `AgentGalleryCard.tsx`, `CreateAgentForm.tsx`, and `EditAgentForm.tsx`.

- **Theme-token migration**
  - `src/views/AgentHub.tsx`: replaced hard-coded dark colors with platform tokens; removed unused `STUDIO_THEME` and `hoveredTab` state.
  - `src/views/agent-hub/main/AgentSessionsTab.tsx`: migrated the filter bar to platform tokens.

- **Confirmed Sessions tab is wired**
  - `AgentHubContent.tsx` renders `<AgentSessionsTab />` for the `sessions` tab, so the tab was kept.

- **Documentation created**
  - `src/views/agent-view/AGENT_STUDIO_HANDOFF.md` — state of the studio surface.
  - `src/views/agent-view/AGENT_STUDIO_DECISIONS.md` — decisions and roadmap for finishing the studio.

### Verification

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/surfaces/ai.allternit.com
pnpm exec tsc --project tsconfig.typecheck.json --noEmit
pnpm exec eslint src/views/agent-view/**/*.tsx src/views/AgentHub.tsx src/views/agent-hub/main/*.tsx
```

Both report **0 errors, 0 warnings** for the Agent Studio files.

---

## 3. Decisions Already Made for the Next Agent

The next agent should read `src/views/agent-view/AGENT_STUDIO_DECISIONS.md` first. The headline decisions are:

1. **Broken template/duplicate flow** — replace write-only `sessionStorage.setItem('agentTemplate', …)` with a typed `agentDraft` slice in `useAgentStore`.
2. **`// @ts-nocheck`** — remove it from `AgentView.tsx` first, then from `CreateAgentForm.tsx` after the split.
3. **Agent seeding** — move `useAgentSeeding` out of the hub UI into a one-time app bootstrap in `ShellApp`, guarded by `localStorage`.
4. **Hard-coded dark UI** — migrate `AgentDetailView`, `PerformanceAnalyticsView`, and gallery/avatar/tool sub-components to platform CSS variables.
5. **`CreateAgentForm.tsx` monolith** — split it into step components under `src/views/agent-view/steps/`.
6. **Fake analytics trends** — remove the hard-coded `+12%`/`-8%` trend strings until real historical data exists.
7. **Memory Kernel "View Details"** — remove the non-functional button.
8. **Global `[data-shell-card]` override** — remove the `!important` `<style>` block from `AgentHub.tsx`.
9. **Console logs** — replace with the module logger or inline UI feedback.
10. **Unused `messageCount`** — remove it from `AgentSessionsTab` until it is displayed.

---

## 4. Suggested Order for the Next Agent

1. **Tiny wins** (Memory Kernel button, `[data-shell-card]` override, fake trends, `messageCount`, console logs).
2. **Fix template/duplicate flow** with `agentDraft` store slice.
3. **Move agent seeding** to app-level bootstrap.
4. **Theme migration** for remaining hard-coded surfaces.
5. **Remove `// @ts-nocheck`** from `AgentView.tsx`, then later from `CreateAgentForm.tsx`.
6. **Split `CreateAgentForm.tsx`** into step components.

---

## Key Files for the Next Agent

- `src/views/agent-view/AGENT_STUDIO_DECISIONS.md` — full decision rationale and implementation notes.
- `src/views/agent-view/AGENT_STUDIO_HANDOFF.md` — cleaned-up state of the studio.
- `src/views/agent-view/components/CreateAgentForm.tsx` — main monolith to split.
- `src/views/agent-view/components/AgentDetailView.tsx` — biggest hard-coded dark UI offender.
- `src/components/agents/PerformanceAnalyticsView.tsx` — fake trends + dark UI.
- `src/lib/agents/agent.store.ts` — where the `agentDraft` slice should live.
- `src/shell/ShellApp.tsx` — where the agent bootstrap hook should be called.

---

## Commands That Should Stay Green

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/surfaces/ai.allternit.com
pnpm exec tsc --project tsconfig.typecheck.json --noEmit
pnpm exec eslint src/shell/ShellRail.tsx src/shell/ShellApp.tsx src/shell/ViewRegistry.tsx src/views/RecentsView.tsx src/views/settings/SettingsView.tsx src/nav/nav.types.ts src/nav/nav.policy.ts src/views/agent-view/**/*.tsx src/views/AgentHub.tsx src/views/agent-hub/main/*.tsx
```

After the next agent’s changes, these commands should still report no errors/warnings in the touched files.
