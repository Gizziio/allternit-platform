# Agent Studio — Engineering Decisions

## Summary

After auditing the code, the highest-leverage fixes are:

1. Remove the two `// @ts-nocheck` files and fix the TypeScript errors they hide.
2. Replace the broken `agentTemplate` sessionStorage flow with a typed store-based draft.
3. Move agent seeding out of the hub UI into a one-time app bootstrap.
4. Migrate the remaining hard-coded dark UI (`AgentDetailView`, `PerformanceAnalyticsView`, `CreateAgentForm` sub-components) to platform CSS variables.
5. Split `CreateAgentForm.tsx` into step components.
6. Remove dead UI affordances (Memory Kernel "View Details", global `[data-shell-card]` override, fake analytics trends).

## Decisions

### 1. Broken template / duplicate flow

**Decision:** Replace `sessionStorage.setItem('agentTemplate', …)` with a typed `agentDraft` slice in `useAgentStore`.

**Rationale:**
- `sessionStorage` is not type-safe, is invisible to React, and is currently write-only (nothing reads the key).
- Other platform surfaces communicate via props or stores, not session storage, except for cross-page settings breadcrumbs.
- A store slice keeps the create flow deterministic and testable.

**Implementation:**
- Add `draftAgent?: Partial<CreateAgentInput>` and `setDraftAgent` / `clearDraftAgent` to `useAgentStore`.
- `AgentView` empty-state "Create from template" calls `setDraftAgent(template)` then `setIsCreating(true)`.
- `AgentGalleryCard` "Duplicate" calls `setDraftAgent({ ...agent, name: `${agent.name} (Copy)`, source: 'personal' })` then `setIsCreating(true)`.
- `CreateAgentForm` reads `draftAgent` on mount to prefill the form, then `clearDraftAgent()`.

**Files:** `src/lib/agents/agent.store.ts`, `src/views/AgentView.tsx`, `src/views/agent-view/components/AgentGalleryCard.tsx`, `src/views/agent-view/components/CreateAgentForm.tsx`.

**Effort:** Small.

---

### 2. `// @ts-nocheck` in `AgentView.tsx` and `CreateAgentForm.tsx`

**Decision:** Remove both pragmas and fix the resulting errors.

**Rationale:**
- Disabling TypeScript is the main reason bugs like the `orchestrators` crash slip through.
- `AgentView.tsx` is small (~186 lines) and should be easy to type.
- `CreateAgentForm.tsx` is large, but the first pass can just add `any` escapes for the worst spots and tighten them later; the file-wide pragma must go.

**Implementation order:**
1. Remove `// @ts-nocheck` from `AgentView.tsx` first.
2. After `CreateAgentForm.tsx` is split into step components (Decision 5), remove the pragma from the parent form file.

**Files:** `src/views/AgentView.tsx`, `src/views/agent-view/components/CreateAgentForm.tsx`.

**Effort:** Medium.

---

### 3. Agent seeding runs on every AgentHub mount

**Decision:** Move seeding to an app-level bootstrap that runs once per app launch, guarded by a localStorage flag and backend existence checks.

**Rationale:**
- Seeding Gizzi/vendor/org agents is a platform-initialization concern, not a UI concern.
- Running it every time the user opens Agent Hub causes unnecessary API calls and duplicate-risk races.
- Other platform bootstraps (e.g., mini-app seeding) use a localStorage guard (`SEED_KEY` pattern in `src/views/aci/mini-app-registry.ts`).

**Implementation:**
- Rename `useAgentSeeding` to `useAgentBootstrap` and move it to `src/lib/agents/useAgentBootstrap.ts`.
- Call it once inside `ShellApp` (after auth loads).
- Add `localStorage.getItem('allternit:agent-bootstrap:v1')` guard.
- Keep the existing dedup logic, but fetch agents before any create/delete so the guard is based on live state.

**Files:** new `src/lib/agents/useAgentBootstrap.ts`, `src/views/agent-hub/main/useAgentSeeding.ts` (delete), `src/views/AgentHub.tsx`, `src/shell/ShellApp.tsx`.

**Effort:** Small–medium.

---

### 4. Hard-coded dark UI / `STUDIO_THEME` constants

**Decision:** Migrate all Agent Studio UI surfaces to platform CSS variables. Keep only data-oriented color constants (mascot template defaults) in `AgentView.constants.ts`.

**Rationale:**
- The platform already has a light/dark token contract (`--text-primary`, `--surface-panel`, `--border-subtle`, etc.).
- Hard-coded dark values break light mode and make the hub look out of place.
- `STUDIO_THEME` in `AgentDetailView.tsx` is a duplicated, local theme that conflicts with the global contract.

**Implementation priority:**
1. `src/views/agent-view/components/AgentDetailView.tsx` — biggest offender, rewrite inline styles to Tailwind + CSS vars.
2. `src/components/agents/PerformanceAnalyticsView.tsx` — replace `text-white`, `bg-white/5`, etc.
3. `src/views/agent-view/components/AgentGalleryCard.tsx` — replace `SOURCE_COLORS`/`AVATAR_PALETTE` hex codes with semantic tokens or preset classes.
4. `src/views/agent-view/components/CreateAgentForm.tsx` sub-components after the split.

**Effort:** Medium (mostly mechanical).

---

### 5. `CreateAgentForm.tsx` 2,100-line monolith

**Decision:** Split it into step components under `src/views/agent-view/steps/`, leaving the parent as a thin state/router shell.

**Rationale:**
- A 2,100-line component is unmaintainable and blocks TypeScript enablement.
- The form already has a step concept (`CREATE_FLOW_STEPS`). Each step should be a component.
- Shared UI (section headers, navigation buttons, error/success banners) can become small shared components.

**Step components:**
- `IdentityStep`
- `AvatarStep`
- `ModelStep`
- `CapabilitiesStep`
- `ToolsStep`
- `WorkspaceStep`
- `VoiceStep`
- `ReviewStep`

**Files:** new `src/views/agent-view/steps/*.tsx`, refactored `src/views/agent-view/components/CreateAgentForm.tsx`.

**Effort:** Large, but high ROI.

---

### 6. `PerformanceAnalyticsView` fake trends

**Decision:** Remove the hard-coded `trend` strings (`+12%`, `-8%`, etc.) until real historical data is available.

**Rationale:**
- Fake data is worse than no data; it misleads users.
- The view already shows real totals from `summary`.
- When backend supports period-over-period metrics, compute trends from that.

**Implementation:**
- Drop the `trend` prop from `MetricCard`.
- Remove the `isPositive` helper and trend UI.
- Keep the KPI cards as plain totals.

**Files:** `src/components/agents/PerformanceAnalyticsView.tsx`.

**Effort:** Tiny.

---

### 7. Memory Kernel "View Details" button

**Decision:** Remove the button until a detail panel/route exists.

**Rationale:**
- A non-functional button looks like a bug.
- Building a detail panel is a separate feature; the button can be re-added when that feature is ready.

**Files:** `src/views/MemoryKernelView.tsx`.

**Effort:** Tiny.

---

### 8. Global `[data-shell-card]` override in `AgentHub.tsx`

**Decision:** Remove the `<style>` block and make the hub canvas transparent through `ShellFrame`/container props instead.

**Rationale:**
- Global `!important` CSS leaks hub styling into every `[data-shell-card]` element in the React tree.
- It is brittle and will break if the shell card styling changes.
- A local container style or a shell-level mode is the correct place for this.

**Files:** `src/views/AgentHub.tsx`.

**Effort:** Tiny.

---

### 9. Console logs in production code

**Decision:** Replace `console.warn`/`console.error` with the module logger or surface errors in the UI.

**Rationale:**
- The project already has `createModuleLogger` from `@/lib/logger`.
- User-facing failures (workspace init, agent update) should show inline feedback, not just logs.

**Files:** `src/views/agent-view/components/CreateAgentForm.tsx`, `src/views/agent-view/components/EditAgentForm.tsx`.

**Effort:** Tiny.

---

### 10. Unused `messageCount` in `AgentSessionsTab`

**Decision:** Remove the field from the item type and mapping until the UI displays it.

**Rationale:**
- Dead data adds noise and a maintenance burden.
- It can be re-added when sessions show a message count.

**Files:** `src/views/agent-hub/main/AgentSessionsTab.tsx`.

**Effort:** Tiny.

---

## Recommended Implementation Order

1. **Tiny cleanup first** (low risk, immediate quality win)
   - Remove Memory Kernel "View Details" button.
   - Remove global `[data-shell-card]` override.
   - Remove fake analytics trends.
   - Remove `messageCount` dead field.
   - Replace console logs with logger / UI feedback.

2. **Fix the broken template/duplicate flow**
   - Add `agentDraft` to `useAgentStore` and wire it up.

3. **Move agent seeding to app bootstrap**
   - `useAgentBootstrap` in `ShellApp`, guarded by localStorage.

4. **Theme migration**
   - `AgentDetailView.tsx` first, then `PerformanceAnalyticsView.tsx`, then gallery/avatar/tool sub-components.

5. **TypeScript enablement**
   - Remove `// @ts-nocheck` from `AgentView.tsx`.
   - After step 6, remove it from `CreateAgentForm.tsx`.

6. **Component split**
   - Split `CreateAgentForm.tsx` into step components.

## Verification

After each batch:

```bash
pnpm exec tsc --project tsconfig.typecheck.json --noEmit
pnpm exec eslint src/views/agent-view/**/*.tsx src/views/AgentHub.tsx src/views/agent-hub/main/*.tsx
```

Both should remain at **0 errors, 0 warnings**.
