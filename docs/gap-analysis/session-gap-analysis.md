# Gap Analysis: Agent Wizard Restructure + Theme + Draggable Avatars

## Grade: B+ (Solid implementation, 6 gaps to close)

---

## What Was Built

### 1. Wizard Restructure
- Collapsed 8 → 6 steps (removed welcome, merged personality into identity)
- Removed 6-second fake forge animation
- Expanded workspace document generation from 2 stubs → 8 real files
- Runtime step already uses real `AgentToolConfigurator` wired to `useToolRegistryStore`

### 2. Theme System
- `ThemeProvider` connects `ThemeStore` to DOM via `data-theme`
- `STUDIO_THEME` converted to CSS-variable getters — all consumers auto-theme-aware
- Theme toggle (sun/moon) added to CreateAgentForm header
- `layout.tsx` no longer hardcodes dark mode

### 3. Draggable Avatars
- `FloatingAvatar` fully rewritten: pointer-event drag, localStorage persistence, viewport clamping
- Renders real `<AgentAvatar>` SVG instead of generic icon
- Status derives from actual `agent.status` instead of `Math.random()`
- `AgentGalleryCard` shows real designed avatar (SVG → mascot → fallback)

---

## Critical Gaps

### Gap 1: Theme Default is Wrong (UX Regression)
**Severity: HIGH**

`ThemeStore` defaults to `'light'`, but the app was previously hardcoded to dark mode (`#0F0C0A`). Every existing user will now open the app to a light theme they never chose, which may feel broken since most UI was designed for dark.

**Fix:** Change default to `'dark'` in `ThemeStore.ts` or detect system preference on first visit.

### Gap 2: Position Not Persisted to Backend
**Severity: MEDIUM**

`FloatingAvatar` position is stored in `localStorage` only. Clearing storage or switching devices resets position. The plan mentioned adding `position?: { x, y }` to `AvatarConfig` / `Agent` model, but this was skipped.

**Fix:** Add `position` to `AvatarConfig` type, update Prisma schema, persist via `useAgentStore` update on drag end.

### Gap 3: Light Mode Will Look Broken in Places
**Severity: MEDIUM**

The dynamic `STUDIO_THEME` getters handle the agent-view components, but several areas still have hardcoded dark-mode assumptions:

| File | Hardcoded Dark Value |
|------|---------------------|
| `AgentTemplateSelector.tsx` | Menu dropdown uses `#1a1a2e` background |
| `AvatarCreatorStep.tsx` + tabs | Import `STUDIO_THEME` from `../AgentView` (now dynamic) BUT may have additional hardcoded rgba values |
| `AllternitSystemPromptEditor.tsx` | Unknown — may assume dark background |
| `WorkspaceLayerConfigurator.tsx` | Unknown — theme prop was passed but values may not flip |

**Fix:** Audit each file for `rgb(0`, `#0f`, `#1a`, `#000` hardcodes and replace with `STUDIO_THEME` references.

### Gap 4: No Drag Discoverability
**Severity: MEDIUM**

The floating avatar is draggable but there's no visual cue — no grab cursor, no drag handle icon, no tooltip. Users won't know they can move it.

**Fix:** Add `cursor: grab` / `cursor: grabbing`, a small drag-handle indicator, or a first-time tooltip.

### Gap 5: `getComputedStyle` Layout Thrashing
**Severity: MEDIUM**

`STUDIO_THEME` uses getters that call `getComputedStyle(document.documentElement)` on every access. In a component with 100+ inline style references (like `CreateAgentForm`), this triggers 100+ style recalculations per render.

**Fix:** Cache computed styles in a ref or use a `useStudioTheme()` hook that reads once per render and passes the object down.

### Gap 6: Gallery Avatar at 40px May Be Unreadable
**Severity: LOW**

The full `AgentAvatar` SVG (eyes, antennas, body details) is rendered at 40px in `AgentGalleryCard`. At this size, intricate SVG details may become a blurry blob.

**Fix:** Use `AgentAvatar` at 40px for simple shapes, but render `MascotPreview` (Phosphor icon) at 40px for mascot-type avatars since icons scale better at small sizes. Or add a `size={40}` optimized render path to `AgentAvatar`.

---

## Minor Gaps

### Gap 7: Theme Toggle Only in Wizard
The rest of the app (shell, dashboard, cowork view) has no visible theme toggle. Users must find the wizard to switch themes.

### Gap 8: Floating Avatar Status Colors Are Tailwind Defaults
`bg-emerald-500`, `bg-amber-400`, `bg-cyan-400` don't match the Allternit brand palette. Should use `--accent-chat`, `--accent-code`, etc.

### Gap 9: No Keyboard Alternative for Drag
Dragging requires a pointing device. Keyboard users cannot reposition the avatar.

### Gap 10: Missing `position` in Prisma Schema
Even if we add `position` to `AvatarConfig` TypeScript type, the Prisma `Agent` model doesn't have an `avatarPosition` field. Backend persistence requires a schema migration.

### Gap 11: Identity Step is Now Very Long
Name + description + type + parent orchestrator + template selector + 4 personality sliders + 3 style dropdowns + traits + backstory = potentially overwhelming.

### Gap 12: No Visual Feedback on Theme Switch
When toggling light/dark, the transition is instant. A smooth CSS transition on `background-color` and `color` would feel more polished.

---

## Recommendations (Priority Order)

1. **Fix Gap 1** — Change `ThemeStore` default to `'dark'` (1 line)
2. **Fix Gap 5** — Add `useStudioTheme()` hook and cache computed styles (prevents perf regression)
3. **Fix Gap 4** — Add drag handle / cursor indicator to `FloatingAvatar`
4. **Fix Gap 3** — Audit `AgentTemplateSelector`, `AvatarCreatorStep`, and other wizard tabs for hardcoded dark values
5. **Fix Gap 2** — Add `position` to `AvatarConfig` and sync to agent store on drag end
6. **Fix Gap 6** — Optimize small-size avatar rendering in gallery cards
