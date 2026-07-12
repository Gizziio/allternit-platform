# Settings UI Parity — Phase A + B Notes

Completed per `docs/SETTINGS_PARITY_PHASE_AB_TASK.md`, implementing Phases A and B of
`docs/CLAUDE_DESKTOP_SETTINGS_PARITY_MAP.md` only. No build/typecheck was run (per task
constraints); all verification was by reading code. No git operations.

## Files changed

### Phase A — Shell

**`surfaces/ai.allternit.com/src/views/settings/SettingsView.tsx`**
- **Modal overlay shell** (layout block, now ~lines 2043–2119): root changed from a full-screen
  `h-screen` route view to a centered modal — `fixed inset-0 z-50` dimmed backdrop
  (`bg-black/60` + slight blur), modal `max-w-[1000px]`, `h-[80vh]`, `rounded-2xl`,
  `shadow-2xl`, `role="dialog"`/`aria-modal`. Backdrop click and the `×` button (top-right of
  the content pane) both dispatch `allternit:close-settings`, so existing close wiring in
  `ShellApp.tsx` is untouched and still works. Click inside the modal stops propagation.
- **Sidebar search**: rounded search input with a `MagnifyingGlass` icon at the top of the
  sidebar; filters `SETTINGS_NAV_ITEMS` by label (case-insensitive substring) as you type,
  hides empty groups, shows "No matching settings" when nothing matches. Replaces the old
  back-caret + "SYSTEM SETTINGS" header.
- **Group labels**: rendered from the new `SETTINGS_NAV_GROUPS` (see config change) as 12px
  medium sentence-case muted labels; the old 10px font-black uppercase `tracking-[0.2em]`
  style and the hairline group dividers are gone.
- **NavButton** (~line 279): now renders the icon from `settings.config.ts` (shrink-0) plus a
  14px label truncated with ellipsis (`title` attr preserves the full label on hover). Active
  state is the soft neutral pill `bg-[var(--bg-secondary)]`; the 3px accent bar was removed.
- **Content pane**: scrolls inside the pane only (`overflow-y-auto` on the pane, `h-[80vh]`
  modal); content column `max-w-[740px]` with `p-10` padding; the uppercase tracking-widest
  `h1` is now a 16px semibold sentence-case heading.
- **Import fix (pre-existing bug)**: line 3 was `import React, { useIsClient } from 'react'`
  — commit `f2afa34c` had replaced the real hooks import with `useIsClient`, which React does
  not export, while the file calls bare `useState`/`useEffect`/`useCallback` ~48 times. The
  view would `ReferenceError` on render. Restored to
  `import React, { useState, useEffect, useCallback } from 'react'` (`useIsClient` was never
  used). Required for any of the Phase A work to run at all.
- Added imports: `MagnifyingGlass` (phosphor), `SETTINGS_NAV_GROUPS`, and the three wired
  primitives below.

**`surfaces/ai.allternit.com/src/views/settings/settings.config.ts`**
- Exported the `SettingsGroup` type (was module-private).
- Added `SETTINGS_NAV_GROUPS` (`{ group, label }[]`) — sidebar group order + sentence-case
  labels, kept next to `SETTINGS_NAV_ITEMS` so the config stays the single source of truth
  for nav. `about` has `label: null` and renders unlabeled (single item, as before).

**`surfaces/ai.allternit.com/src/shell/ShellRail.tsx` / `SettingsDrilldown.tsx`** — *no changes
needed.* Both already trigger settings via `allternit:open-settings` → `ShellApp.open('settings')`
→ ViewRegistry renders `SettingsView`. The modal presentation lives inside SettingsView itself
(fixed overlay), so the entry points work unchanged.

### Phase B — Primitives (all new, named exports, `'use client'`, `cn()`, CSS variables)

- **`src/components/settings/SettingsRow.tsx`** — label (14px medium) + muted 13px description
  left, control slot right, `py-4`, no card/border.
- **`src/components/settings/Toggle.tsx`** — iOS-style `w-10 h-6` (40×24) toggle,
  `var(--accent-primary)` when on, `role="switch"`/`aria-checked`, optional `disabled`.
- **`src/components/settings/SectionHeading.tsx`** — 16px semibold sentence case, `mt-8 mb-3`
  (`first:mt-0`).
- **`src/components/settings/SettingsTable.tsx`** — muted 12px column headers, hairline row
  dividers; also exports `SettingsTableCell` and `SettingsTableChip` (blue/gray chip cell,
  e.g. "Current").
- **`src/components/settings/PanelHeader.tsx`** — 16px semibold title left; right-side slot
  for search icon / secondary buttons / "Add ▾".
- **`src/components/settings/Badge.tsx`** — small gray pill (e.g. "Beta").
- **`src/components/settings/SkeletonRow.tsx`** — gray rounded `animate-pulse` shimmer bars,
  `lines` prop, decreasing widths.
- **`src/components/settings/EmptyState.tsx`** — centered muted outline icon + 13px muted
  caption + single quiet bordered CTA button.
- **`src/components/settings/MonoChip.tsx`** — monospace value in a subtle gray bordered chip.

### Wired sections (proof in place)

`renderGeneralPanel` and `renderAppearancePanel` in `SettingsView.tsx` (~lines 1533–1591) now
use `SectionHeading` + `SettingsRow` + `Toggle`: General = "Language & region" (Language,
Timezone selects as row controls) + "Behavior" (3 toggles); Appearance = "Theme" (row with the
light/dark/system buttons, restyled compact) + "Layout" (2 toggles). All other sections render
exactly as before — `ToggleItem` is intentionally left in place for them.

## Deviations from spec (and why)

1. **ShellRail/SettingsDrilldown untouched** — the event wiring already implements triggering;
   duplicating it would add nothing. See above.
2. **Backdrop is dark** (`bg-black/60`) rather than a light-theme dim — this is a dark-themed
   app; the dark dim is the equivalent of the observed dimmed desktop.
3. **No Escape-to-close** — the spec names backdrop click and `×` as the two close paths; kept
   to exactly those to avoid scope creep.
4. **Nav icons render at their configured size (18px)** — spec says "render the icons that
   already exist in `settings.config.ts`"; they are defined at size 18 there. Changing the
   size would mean editing every config entry.
5. **`about` group has no label** — single-item group, unlabeled before and now; the four
   spec-named groups (Account, Platform, Products, Infrastructure) have labels.

## Left for Phase C

- Migrate all remaining sections (models, api-keys, shortcuts, permissions, gizziio-code,
  cowork, extensions, billing, usage, diagnostics, infrastructure, environment, security,
  agents, about, signin, vps) to `SettingsRow`/`Toggle`/`SectionHeading` and retire
  `ToggleItem`.
- Account: trusted-devices + active-sessions tables via `SettingsTable`/`SettingsTableChip`
  (`usePlatformSessions` already exists), Org ID `MonoChip`, log-out-of-all-devices.
- List panels (Skills/Connectors/Plugins) using `PanelHeader` + `EmptyState`; `SkeletonRow`
  in slow-loading panels; `Badge` for Beta features; quiet secondary/destructive button
  restyle; Usage thin-bar rows.
- Note: agent-ops/GC/security dashboards are now constrained to the 740px content column —
  fine for Phase A/B, but Phase C/D should either widen them per-section or extract them out
  of settings (per the parity map's Phase D suggestion).
