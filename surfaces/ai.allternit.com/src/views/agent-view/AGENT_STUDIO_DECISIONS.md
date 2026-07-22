# Agent Studio — Engineering Decisions

## Summary

Most of the original decisions have been implemented. Remaining work is small quality clean-ups and documentation.

| # | Decision | Status |
|---|----------|--------|
| 1 | Remove `// @ts-nocheck` from `AgentView.tsx` and `CreateAgentForm.tsx` | ✅ Done — both files are typed; `AgentView.tsx` was never nocheck and `CreateAgentForm.tsx` no longer uses the pragma |
| 2 | Replace broken `agentTemplate` sessionStorage flow with typed `agentDraft` store slice | ✅ Done — `draftAgent`, `setDraftAgent`, `clearDraftAgent` live in `useAgentStore` and are wired in `AgentView.tsx` and `AgentGalleryCard.tsx` |
| 3 | Move agent seeding to app-level bootstrap | ✅ Done — `useAgentBootstrap` in `src/lib/agents/useAgentBootstrap.ts` is called once from `ShellApp.tsx` with a `localStorage` guard |
| 4 | Migrate hard-coded dark UI to platform CSS variables | ✅ Done — `AgentDetailView.tsx`, `PerformanceAnalyticsView.tsx`, gallery/avatar/tool sub-components now use platform tokens; `STUDIO_THEME` in `AgentView.constants.ts` is backed by CSS variables |
| 5 | Split `CreateAgentForm.tsx` into step components | ✅ Done — form is now a thin shell routing `IdentityStep`, `CharacterStep`, `AvatarStep`, `RuntimeStep`, `HarnessStep`, `ReviewStep` |
| 6 | Remove dead UI affordances | ✅ Done — Memory Kernel "View Details" removed, `[data-shell-card]` override removed from `AgentHub.tsx`, fake analytics trends removed, `messageCount` removed from `AgentSessionsTab.tsx`, console logs replaced with module logger |

## Decisions

### 1. Broken template / duplicate flow

**Status:** ✅ Implemented

**Decision:** Replace `sessionStorage.setItem('agentTemplate', …)` with a typed `agentDraft` slice in `useAgentStore`.

**Rationale:**
- `sessionStorage` is not type-safe, is invisible to React, and was write-only (nothing read the key).
- Other platform surfaces communicate via props or stores, not session storage, except for cross-page settings breadcrumbs.
- A store slice keeps the create flow deterministic and testable.

**Implementation:**
- Added `draftAgent?: Partial<CreateAgentInput>` and `setDraftAgent` / `clearDraftAgent` to `useAgentStore`.
- `AgentView` empty-state "Create from template" calls `setDraftAgent(template)` then `setIsCreating(true)`.
- `AgentGalleryCard` "Duplicate" calls `setDraftAgent({ ...agent, name: `${agent.name} (Copy)`, source: 'personal' })` then `setIsCreating(true)`.
- `CreateAgentForm` reads `draftAgent` on mount to prefill the form, then `clearDraftAgent()`.

**Files:** `src/lib/agents/agent.store.ts`, `src/views/AgentView.tsx`, `src/views/agent-view/components/AgentGalleryCard.tsx`, `src/views/agent-view/components/CreateAgentForm.tsx`.

**Effort:** Small.

---

### 2. `// @ts-nocheck` in `AgentView.tsx` and `CreateAgentForm.tsx`

**Status:** ✅ Implemented

**Decision:** Remove both pragmas and fix the resulting errors.

**Rationale:**
- Disabling TypeScript is the main reason bugs like the `orchestrators` crash slip through.
- `AgentView.tsx` is small (~186 lines) and was easy to type.
- `CreateAgentForm.tsx` was large, but after splitting into step components the file-wide pragma was removed.

**Files:** `src/views/AgentView.tsx`, `src/views/agent-view/components/CreateAgentForm.tsx`.

**Effort:** Medium.

---

### 3. Agent seeding runs on every AgentHub mount

**Status:** ✅ Implemented

**Decision:** Move seeding to an app-level bootstrap that runs once per app launch, guarded by a localStorage flag and backend existence checks.

**Rationale:**
- Seeding Gizzi/vendor/org agents is a platform-initialization concern, not a UI concern.
- Running it every time the user opens Agent Hub causes unnecessary API calls and duplicate-risk races.
- Other platform bootstraps (e.g., mini-app seeding) use a localStorage guard (`SEED_KEY` pattern in `src/views/aci/mini-app-registry.ts`).

**Implementation:**
- `useAgentBootstrap` lives in `src/lib/agents/useAgentBootstrap.ts`.
- Called once inside `ShellApp` (after auth loads) via `useAgentBootstrap({ enabled: authLoaded && ... })`.
- Uses `localStorage.getItem('allternit:agent-bootstrap:v1')` guard.
- Fetches agents before create/delete and dedupes Gizzi, vendor, and organization seeds.

**Files:** `src/lib/agents/useAgentBootstrap.ts`, `src/shell/ShellApp.tsx`.

**Effort:** Small–medium.

---

### 4. Hard-coded dark UI / `STUDIO_THEME` constants

**Status:** ✅ Implemented

**Decision:** Migrate all Agent Studio UI surfaces to platform CSS variables. Keep only data-oriented color constants (mascot template defaults) in `AgentView.constants.ts`.

**Rationale:**
- The platform already has a light/dark token contract (`--text-primary`, `--surface-panel`, `--border-subtle`, etc.).
- Hard-coded dark values break light mode and make the hub look out of place.

**Implementation:**
- `src/views/agent-view/components/AgentDetailView.tsx` uses a local `STUDIO_THEME` object that maps to CSS variables.
- `src/components/agents/PerformanceAnalyticsView.tsx` uses platform tokens exclusively.
- `src/views/agent-view/components/AgentGalleryCard.tsx` uses platform tokens.
- `src/views/agent-view/AgentView.constants.ts` exports a `STUDIO_THEME` object backed by CSS variables for components that still import it.
- `src/views/agent-view/useStudioTheme.ts` reads live CSS variables and returns a typed theme object.

**Effort:** Medium (mostly mechanical).

---

### 5. `CreateAgentForm.tsx` monolith

**Status:** ✅ Implemented

**Decision:** Split it into step components under `src/views/agent-view/steps/`, leaving the parent as a thin state/router shell.

**Rationale:**
- A monolithic component is unmaintainable and blocks TypeScript enablement.
- The form already had a step concept; each step now has its own component.
- Shared UI (section headers, navigation buttons, error/success banners) is handled by the parent shell.

**Step components:**
- `IdentityStep`
- `CharacterStep`
- `AvatarStep`
- `RuntimeStep`
- `HarnessStep`
- `ReviewStep`

**Files:** `src/views/agent-view/steps/*.tsx`, refactored `src/views/agent-view/components/CreateAgentForm.tsx`.

**Effort:** Large, but high ROI.

---

### 6. `PerformanceAnalyticsView` fake trends

**Status:** ✅ Implemented

**Decision:** Remove the hard-coded `trend` strings (`+12%`, `-8%`, etc.) until real historical data is available.

**Rationale:**
- Fake data is worse than no data; it misleads users.
- The view already shows real totals from `summary`.
- When backend supports period-over-period metrics, compute trends from that.

**Implementation:**
- `MetricCard` no longer accepts a `trend` prop.
- KPI cards show plain totals only.

**Files:** `src/components/agents/PerformanceAnalyticsView.tsx`.

**Effort:** Tiny.

---

### 7. Memory Kernel "View Details" button

**Status:** ✅ Implemented

**Decision:** Remove the button until a detail panel/route exists.

**Rationale:**
- A non-functional button looks like a bug.
- Building a detail panel is a separate feature; the button can be re-added when that feature is ready.

**Files:** `src/views/MemoryKernelView.tsx`.

**Effort:** Tiny.

---

### 8. Global `[data-shell-card]` override in `AgentHub.tsx`

**Status:** ✅ Implemented

**Decision:** Remove the `<style>` block and make the hub canvas transparent through `ShellFrame`/container props instead.

**Rationale:**
- Global `!important` CSS leaks hub styling into every `[data-shell-card]` element in the React tree.
- It is brittle and will break if the shell card styling changes.
- A local container style or a shell-level mode is the correct place for this.

**Files:** `src/views/AgentHub.tsx`.

**Effort:** Tiny.

---

### 9. Console logs in production code

**Status:** ✅ Implemented

**Decision:** Replace `console.warn`/`console.error` with the module logger or surface errors in the UI.

**Rationale:**
- The project already has `createModuleLogger` from `@/lib/logger`.
- User-facing failures (workspace init, agent update) should show inline feedback, not just logs.

**Files:** `src/views/agent-view/components/CreateAgentForm.tsx`, `src/views/agent-view/components/EditAgentForm.tsx`.

**Effort:** Tiny.

---

### 10. Unused `messageCount` in `AgentSessionsTab`

**Status:** ✅ Implemented

**Decision:** Remove the field from the item type and mapping until the UI displays it.

**Rationale:**
- Dead data adds noise and a maintenance burden.
- It can be re-added when sessions show a message count.

**Files:** `src/views/agent-hub/main/AgentSessionsTab.tsx`.

**Effort:** Tiny.

---

## Remaining Follow-ups

All architectural decisions from the original audit are implemented. The only remaining follow-ups are:

1. **ESLint warnings in unrelated files** — `src/shell/ShellRail.tsx` and `src/shell/ViewRegistry.tsx` have pre-existing unused-variable warnings that are outside Agent Studio scope.
2. **Long-term tests** — Add unit/integration tests for agent creation, editing, and bootstrapping flows.
3. **Store reorganization** — If the agent surface keeps growing, consider moving agent-related stores/hooks under a dedicated `src/lib/agents/studio/` module.

## Verification

```bash
cd /Users/joe/Desktop/allternit-workspace/allternit/surfaces/ai.allternit.com
pnpm exec tsc --project tsconfig.typecheck.json --noEmit
pnpm exec eslint src/views/agent-view/**/*.tsx src/views/AgentHub.tsx src/views/agent-hub/main/*.tsx
```

Agent Studio files should report **0 errors**. Pre-existing warnings in `src/shell/ShellRail.tsx` and `src/shell/ViewRegistry.tsx` are unrelated to the studio surface.
