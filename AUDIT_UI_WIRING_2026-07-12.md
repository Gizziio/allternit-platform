# Allternit Platform — UI / Wiring Audit
**Date:** 2026-07-12  
**Scope:** `surfaces/ai.allternit.com/src/shell`, `src/views`, `src/design/theme.css`, settings, agent-mode UI, mode pills/tabs  
**Auditor:** Kimi Code CLI  

---

## 1. Executive Summary

The platform has a consistent **Sand Nude** token system in `src/design/theme.css`, but the shell and several views are overriding or ignoring those tokens. The result is a patchwork where the rail, canvas, floating controls, and per-mode surfaces do not align in either light or dark mode. Below are the concrete bugs, grouped by the areas you asked about, plus a ranked fix plan.

| Area | Severity | Files |
|------|----------|-------|
| Shell rail / view background mismatch | High | `shell/ShellFrame.tsx`, `shell/ShellRail.tsx`, `design/theme.css` |
| Floating widgets / top-bar mode clutter | High | `shell/FloatingWidgets.tsx`, `shell/ShellHeader.tsx`, `shell/ModeSwitcher.tsx`, `shell/ShellApp.tsx` |
| Settings options unwired or dead | Medium | `shell/SettingsDrilldown.tsx`, `views/settings/SettingsView.tsx` |
| Agent On / Off visual state bugs | Medium | `views/chat/components/AgentModeButton.tsx`, `views/chat/ChatComposer.tsx`, `lib/agents/surface-agent-context.ts` |
| Mode pill tabs poorly themed / inconsistent | Medium | `views/cowork/CoworkModeTabs.tsx`, `views/code/CodeSessionBar.tsx`, `views/design/DesignRegistryView.tsx` |
| Labs & Promotions view issues | Low-Medium | `views/LabsView.tsx`, `views/code/PromotionDashboardView.tsx` |
| Token / context usage popover | Medium | `components/ai-elements/ContextWindowCard.tsx` |
| General code-health drift | Medium | 47 failed test files, 233 lint issues in audited dirs |

---

## 2. Shell Rail / View Background Color Mismatch

### Current behavior
- `ShellFrame` sets the rail container background to `var(--shell-panel-bg)`, which resolves to `--surface-panel` → `--bg-secondary`.
- The canvas/main area uses `var(--shell-frame-bg)` (`--surface-canvas` → `--bg-primary`) plus an optional agent glow gradient.
- In `ShellRail`, a `useBlendedRail` flag tries to force `--shell-panel-bg` to `var(--bg-primary)` for `chat | cowork | code | browser | design`, but it is scoped only inside the rail element and is inconsistent with `ShellFrame`'s rail container.
- `theme.css` declares `--view-chat-bg`, `--view-code-bg`, etc. as `#ffffff` in light mode and `#100e0b` in dark mode, but almost no view consumes them.

### Why it looks wrong
- **Light mode:** rail is `#F5EDE3`, canvas is `#FDF8F3`. You asked for a unified white background; instead the rail stays cream while the view warms to a different cream.
- **Dark mode:** rail is `#2A211A`, canvas is `#1A1612`. Some views (`CoworkRoot`, `LabsView`, `PromotionDashboardView`) add their own hardcoded dark tints or gradients, so the seam is even more obvious.

### Root cause
There is no single source of truth for "the current view background." The shell frame, the rail, and individual views each pick their own token (or hardcoded color), and the "blended rail" hack only covers a subset of modes.

### Fix direction
1. Decide the contract: **rail and active view share one background** (`--view-bg` or `--surface-canvas`).
2. Add a CSS custom property `--shell-rail-bg` / `--shell-view-bg` that is set per mode in `theme.css`.
3. Make `ShellFrame` consume it for the rail container and the canvas fallback.
4. Remove the `useBlendedRail` local override in `ShellRail` and the hardcoded `rgba(...)` backgrounds in views.
5. Delete the unused `--view-*-bg` tokens or actually wire them up.

---

## 3. Floating Widgets & Top-Bar Clutter

### Current controls
| Widget | File | Role | Problem |
|--------|------|------|---------|
| `RailControls` | `shell/FloatingWidgets.tsx` | Fixed top-left bar with collapse, new-session menu, integrations, labs, search, and **mode tabs** | Occupies title-bar space; duplicates mode switching |
| `ShellHeader` | `shell/ShellHeader.tsx` | Glass header with nav, **ModeSwitcher (segmented)**, automation hub, environment, status, sidecar toggle, theme | Has its own copy of mode tabs, so there are two mode switchers on screen |
| `FloatingOrb` | `shell/FloatingOrb.tsx` | Bottom-center orb | No click handler; purely decorative |
| `LegacyWidgetsLayer` | `shell/LegacyWidgets.tsx` | Returns `null` | Dead code kept around |
| `ModeSwitcher` | `shell/ModeSwitcher.tsx` | Reusable pill/tabs/segmented switcher | Used twice, with different variants |

### Evidence of clutter
- `ShellApp.tsx:482` renders `<RailControls .../>` unconditionally.
- `ShellHeader.tsx:116` renders `<ModeSwitcher ... variant="segmented" .../>`.
- Both handle `chat | cowork | code | browser | design`, so the user sees mode tabs twice.

### What "moving away from floating widgets" should mean
1. Pick **one** canonical location for mode switching (header is the natural home).
2. Remove the mode tabs from `RailControls`; keep only window/chrome actions there (collapse rail, new session, search, labs) or collapse them into the header.
3. Delete or repurpose `FloatingOrb`.
4. Remove `LegacyWidgetsLayer` entirely.
5. Consolidate on a single `ModeSwitcher` instance with a consistent variant.

### Cowork / Code / Browser / Design access
Right now these modes are reachable from:
- The rail's own section items (e.g., `CODE_RAIL_CONFIG`, `BROWSER_RAIL_CONFIG`).
- The `RailControls` mode tabs.
- The `ShellHeader` mode tabs.
- Custom events (`allternit:switch-mode`).

That is four different paths. The fix is to centralize mode changes through `useMode` / `handleModeChange` and expose them from **the header + rail sections only**.

---

## 4. Settings Widget Wiring

### `SettingsDrilldown.tsx` (rail footer popover)
Many items are no-ops or only close the menu:
- `Language` submenu: selecting a language just closes the submenu; no locale change is applied.
- `Get help` submenu: Documentation / Contact Support / Send Feedback are no-ops.
- `Learn more` submenu: API Console, Tutorials, Courses, Usage Policy are no-ops.
- `Upgrade plan` opens Settings to billing, but `SettingsView` billing panel is static text.
- `Gift Allternit` opens an external URL.

### `SettingsView.tsx` panels
| Section | Status | Issue |
|---------|--------|-------|
| General | Partially wired | Language/timezone saved to localStorage; `defaultMode`, font size, animation toggles are declared but unused |
| Appearance | Wired | Theme, compact density, sidebar labels work |
| Models | Partially wired | `LocalModelManager` renders; streaming toggle is local state only; model/temp/token selectors are dead |
| API Keys | Wired-ish | `BrainsPanel` shows detected providers |
| Billing | **Unwired** | "Manage billing portal" button has no `onClick`; subscription text is hardcoded |
| Usage | **Fake data** | `sessionRows` / `weeklyRows` are hardcoded percentages; only the label updates on refresh |
| Privacy | Partially wired | Toggles saved; "How we protect/use your data" buttons do nothing |
| Cowork | Partially wired | Dispatch toggle saved; Files location / Trusted folders / Global instructions are disabled |
| Connectors | Partially wired | List loads from `listOwnedConnectors`; Add / Search are disabled |
| Plugins / Skills | Wired | Toggles persist disabled skill IDs and plugin IDs |
| Gizziio Code | Mostly wired | Service URLs, themes, toggles persist; PR branch prefix persists; auto-PR/autofix toggles are local only |
| Infrastructure / Environment / Security / VPS | Delegated to separate panels | Need spot-checking |
| About | Mostly decorative | Terms / Privacy / GitHub buttons are no-ops |

### Fix direction
1. Remove or wire every disabled "Not wired yet" button.
2. Replace hardcoded usage numbers with real stats or a "not yet available" honest state.
3. Either remove dead state variables or connect them to actual behavior.
4. Make `SettingsDrilldown` items dispatch real actions or remove them.

---

## 5. Agent On / Off Visual Bugs

### Current implementation
- `AgentModeButton.tsx` displays:
  - `"Agent Off"` when `agentModeEnabled === false`
  - `"Agent On"` when enabled but no `selectedModeId`
  - `"Agent | <label>"` when enabled with a mode
- `agentModeEnabled` is derived in `ChatComposer.tsx` from `hasEmbeddedSession || locallyEnabled`.
- `useSurfaceAgentModeEnabled()` in `lib/agents/surface-agent-context.ts` derives it from the active session's `sessionMode === 'agent'`.

### Bugs observed
1. **Two sources of truth.** `ChatComposer` has its own `locallyEnabled` state, while the session store has the real session mode. They can disagree, so the button can say "Agent On" while the backend/session is not agent-mode, or vice versa.
2. **No selected-agent feedback.** The button uses `selectedModeId` for the label, but agent selection is actually stored in `useAgentSurfaceModeStore.selectedAgentIdBySurface`. If a mode is selected but no agent is allowed on the surface, the button still glows.
3. ** abrupt text swap.** The label changes instantly between "Agent Off" / "Agent On" / "Agent | Mode" with no transition.
4. **Glow color drift.** `AgentModeButton` mixes `MODE_COLORS` (hardcoded hexes) with `surfaceTheme` from `agentModeSurfaceTheme.tsx`; in light mode the glows can clash with the Sand Nude palette.
5. **Missing in other surfaces.** Cowork, Code, Design, and Browser each implement their own agent-active indicator (or none), so the same agent state is visualized differently.

### Fix direction
1. Single source of truth: `useSurfaceAgentModeEnabled(surface)` everywhere.
2. Unify selected-agent/mode state; show agent avatar/name when active, not just a generic mode label.
3. Add a smooth transition between states.
4. Use theme-derived colors, not hardcoded hexes.
5. Provide a shared `AgentStatusIndicator` used by all surfaces.

---

## 6. Mode Pill Tabs

### Cowork tabs (`views/cowork/CoworkModeTabs.tsx`)
- Two variants: `top-pills` and `bottom-dock`.
- Hardcoded fallback colors (`#A78BFA`, `rgba(167,139,250,...)`) when `surfaceTheme` is undefined.
- Uses `var(--ui-text-muted)` / `var(--ui-text-primary)` but overrides background with `surfaceTheme?.soft`, which may not exist for all surfaces.
- `CoworkRoot` only consumes `isAgents | isWeb | isSync | isRoutines | isLoops`; other modes like `plan`, `review`, `report`, `automate` fall through to chat but the tabs still show them.

### Code pills (`views/code/CodeSessionBar.tsx`)
- `fieldShellStyle` uses hardcoded `rgba(17, 20, 24, 0.26)` background and `rgba(255,255,255,0.08)` border — broken in light mode.
- `pillStyle` uses raw hex colors (`#ffb24c`, `#7db8ff`) instead of theme tokens.
- Test `CodeSessionBar.test.tsx:54` fails because the state pill text is rendered but the `data-testid="code-sessionbar-state-pill"` is missing from the rendered element (it wraps the pill in `ContextWindowCard` without passing the test id).

### Design / other pills
- `DesignRegistryView.tsx` has `FilterPill` with local styling.
- `ContentPipelineView.tsx` has format pills with hardcoded styles.
- There is no shared `Pill` component, so each view reinvents the shape, hover, active, and focus styles.

### Fix direction
1. Create a shared `Pill` / `FilterPill` / `ModePill` component in the design system.
2. Replace all hardcoded `rgba(...)` pill backgrounds with `--surface-*` tokens.
3. Fix `CodeSessionBar` light-mode colors and the missing test id.
4. Remove modes from `CoworkModeTabs` that do not have implemented views.

---

## 7. Labs & Promotions Views

### `views/LabsView.tsx`
- Uses `bg-[var(--surface-canvas)]` which is correct, but it is rendered inside `ShellCanvas` which also has a background, so double-layering can occur.
- The view hides the rail via `shouldHideRail = active.viewType === 'labs'`, but `LabsViewHeader` provides its own tab navigation. That is a deliberate full-screen experience, but it means Labs does not follow the unified shell background contract.
- Sub-components (`LabsTracksTab`, `LabsClassroomTab`, etc.) need spot-checking for hardcoded colors.

### `views/code/PromotionDashboardView.tsx`
- Hardcoded stat colors (`#ffa500`, `#34c759`, `#ff3b30`) instead of status tokens.
- `bg-white/5` on affected files rows is invisible in light mode.
- The `fetch('/api/v1/promotion/proposals')` endpoint silently fails (`.catch(() => {})`), leaving an empty list with no feedback.
- Filter buttons use `bg-[var(--accent-chat)]` for active state — acceptable but not using a semantic active token.

### Fix direction
1. Use status tokens for stat colors.
2. Replace `bg-white/5` with `bg-[var(--surface-hover)]` or similar.
3. Add empty/error states for the proposals fetch.
4. Verify Labs sub-components against theme tokens.

---

## 8. Token / Context Usage Popover

### Current behavior
- `components/ai-elements/ContextWindowCard.tsx` wraps triggers in a Radix `Popover` that shows a 300 px-wide "Context Architecture" panel.
- Used in:
  - `views/code/CodeSessionBar.tsx` (state pill)
  - `runner/AgentRunner.tsx` (mascot button)
  - `capsules/browser/ACIComputerUseSidecar.tsx` ("Computer Use" label)
  - `views/UIForge/UIForge.tsx` (tab trigger)
  - `components/agents/AgentTestingPlayground.tsx`

### Visual / layout problems
1. **No viewport fitting.** `side="top" align="start"` with a fixed `width: 300px` means the popover can overflow the left/right/top edge of the screen, especially on smaller widths or when the trigger is near an edge.
2. **Hardcoded dark theme.** Background is `#161616` and text is `#fff`, so in light mode it looks like a black hole punched into the UI.
3. **No max-height / scroll.** The content is tall (context bar, neural breakdown, sovereignty metrics) and will be clipped if the viewport is short.
4. **Obscures content.** Because it is large, unanchored, and lacks collision avoidance, it sits on top of the main workspace and blocks the view the user is trying to inspect.
5. **Low-value density.** "Sovereignty" metrics are hardcoded (`98%`, `100%`) and the breakdown uses made-up math (`Messages = usedContext * 0.7`, `System prompt = 8600`), so the popover is mostly decoration rather than real feedback.

### Root cause
The component was built as a fixed-size dark tooltip without Radix's collision/avoidance props, without theme tokens, and without a data contract for real context usage.

### Fix direction
1. **Shrink and anchor.** Reduce width to `240-260px`, add `maxHeight`, `overflow: auto`, and use Radix's `avoidCollisions` / `collisionPadding` props.
2. **Theme it.** Replace `#161616` and `#fff` with `--surface-floating` / `--text-primary` so it works in both themes.
3. **Make it optional / dismissible.** Add an `Esc` close, click-outside, and consider a non-modal summary inline instead of a giant popover.
4. **Honest data.** Either pull real token usage from the backend/analytics store, or show a compact honest state until real data is available.
5. **Don't wrap unrelated triggers.** `UIForge` wraps a `TabsTrigger` inside `ContextWindowCard`; that coupling should be removed.

---

## 9. Objective Quality Metrics

### Tests
```
Test Files  47 failed | 43 passed (90)
Tests       148 failed | 397 passed | 10 skipped (570)
Duration    62.48s
```
Targeted UI tests:
- `CodeSessionBar.test.tsx` — FAIL (missing `data-testid="code-sessionbar-state-pill"`)
- `SettingsView.test.tsx` — FAIL (`PlatformAuthProvider is missing` in test setup)
- `ControlCenter.test.tsx` — PASS
- `AgentModeGizzi.test.tsx` — PASS
- `CodeCanvas.test.tsx` — PASS

### Lint (audited dirs only: `src/shell`, `src/views/settings`, `src/views/cowork`, `src/views/code`)
```
✖ 233 problems (24 errors, 209 warnings)
20 errors fixable with --fix
```
Notable errors:
- `CoworkRoot.tsx:15` unused import `getAgentSessionStatusLabel`
- `CronView.tsx:7` unused import `useIsClient`
- `LoopMonitor.tsx:9` unused import `runLoop`
- `SecurityPanel.tsx:10` unused import `ArrowsClockwise`
- `SettingsView.tsx:174` `@typescript-eslint/no-explicit-any` plugin rule missing
- Several `react-hooks/exhaustive-deps` plugin rule missing (config issue, not code issue)

### Missing tooling
- `package.json` declares `"audit:theme:shell": "node scripts/audit-shell-theme.mjs"`, but the script file does not exist.

---

## 10. Recommended Fix Order

### Phase A — Shell consistency (highest visual impact)
1. Establish a single `--shell-view-bg` / `--shell-rail-bg` contract in `theme.css` per mode.
2. Remove `useBlendedRail` override from `ShellRail`; make `ShellFrame` consume the contract.
3. Fix `CoworkRoot`, `LabsView`, and `PromotionDashboardView` hardcoded backgrounds.

### Phase B — Clean up mode switching clutter
4. Remove mode tabs from `RailControls`; keep only collapse/new/search/labs.
5. Keep `ModeSwitcher` in `ShellHeader` as the canonical switcher; pick one variant.
6. Delete `LegacyWidgetsLayer` and either wire or remove `FloatingOrb`.

### Phase C — Settings honesty
7. Wire or remove every disabled "Not wired yet" option.
8. Replace fake usage stats with real data or an honest placeholder.
9. Make `SettingsDrilldown` menu items do real work.

### Phase D — Agent-mode polish
10. Use `useSurfaceAgentModeEnabled` as the single source of truth.
11. Build a shared `AgentStatusIndicator` and replace per-surface one-offs.
12. Smooth transitions and theme-safe colors.

### Phase E — Pill tabs & mode functionality
13. Create a shared `Pill` component and migrate `CodeSessionBar`, `CoworkModeTabs`, `DesignRegistryView`.
14. Fix `CodeSessionBar` test id and light-mode colors.
15. Hide Cowork tab modes that have no implemented view.

### Phase F — Context / token usage popover
16. Add collision avoidance (`avoidCollisions`, `collisionPadding`) and `maxHeight` to `ContextWindowCard`.
17. Replace hardcoded `#161616` / `#fff` with theme tokens.
18. Remove `ContextWindowCard` from unrelated triggers (e.g., `UIForge` `TabsTrigger`).
19. Show real context data or a compact honest placeholder.

### Phase G — Labs / Promotions / test hygiene
20. Fix PromotionDashboard hardcoded colors and empty-state feedback.
21. Wrap `SettingsView` tests in `PlatformAuthProvider`.
22. Fix `CodeSessionBar` test.
23. Remove or restore the missing `audit:theme:shell` script.

---

## 11. Files to Touch (short list)

- `surfaces/ai.allternit.com/src/design/theme.css`
- `surfaces/ai.allternit.com/src/shell/ShellFrame.tsx`
- `surfaces/ai.allternit.com/src/shell/ShellRail.tsx`
- `surfaces/ai.allternit.com/src/shell/ShellHeader.tsx`
- `surfaces/ai.allternit.com/src/shell/FloatingWidgets.tsx`
- `surfaces/ai.allternit.com/src/shell/ShellApp.tsx`
- `surfaces/ai.allternit.com/src/shell/LegacyWidgets.tsx`
- `surfaces/ai.allternit.com/src/shell/FloatingOrb.tsx`
- `surfaces/ai.allternit.com/src/shell/SettingsDrilldown.tsx`
- `surfaces/ai.allternit.com/src/views/settings/SettingsView.tsx`
- `surfaces/ai.allternit.com/src/views/chat/components/AgentModeButton.tsx`
- `surfaces/ai.allternit.com/src/views/chat/ChatComposer.tsx`
- `surfaces/ai.allternit.com/src/views/chat/agentModeSurfaceTheme.tsx`
- `surfaces/ai.allternit.com/src/lib/agents/surface-agent-context.ts`
- `surfaces/ai.allternit.com/src/views/cowork/CoworkModeTabs.tsx`
- `surfaces/ai.allternit.com/src/views/cowork/CoworkRoot.tsx`
- `surfaces/ai.allternit.com/src/views/code/CodeSessionBar.tsx`
- `surfaces/ai.allternit.com/src/views/code/PromotionDashboardView.tsx`
- `surfaces/ai.allternit.com/src/views/LabsView.tsx`
- `surfaces/ai.allternit.com/src/views/design/DesignRegistryView.tsx`
- `surfaces/ai.allternit.com/src/components/ai-elements/ContextWindowCard.tsx`

---

## 12. Open Questions Before Coding

1. **Mode switcher home:** Do you want the mode tabs in the header (as `ShellHeader` currently has them) or back in the rail? Pick one.
2. **Agent mode single source of truth:** Should "Agent On" mean (a) an agent is selected for this surface, or (b) the current session is an agent session? They currently diverge.
3. **Settings scope:** Should we remove unwired options entirely, or wire them to localStorage/state even if the backend feature is not ready?
4. **Cowork mode tabs:** Which of `plan | execute | review | report | automate | routines | loops | web | agents | sync` should stay visible? Several have no view implementation.
5. **Labs full-screen:** Do you want Labs to keep hiding the rail, or should it follow the normal shell background contract?
6. **Context usage popover:** Do you want to keep it as a popover, or replace it with an inline status chip / sidebar panel that doesn't obscure content?
