# Task: Settings UI Parity — Phase A + B ONLY

You are implementing Phases A and B of `docs/CLAUDE_DESKTOP_SETTINGS_PARITY_MAP.md`. Read that file first — it is the spec. Do NOT start Phase C or D.

## Scope

### Phase A — Shell
Work in `surfaces/ai.allternit.com/src/views/settings/SettingsView.tsx` (layout block near the bottom, ~lines 2028–2092), `surfaces/ai.allternit.com/src/views/settings/settings.config.ts`, and the entry points in `surfaces/ai.allternit.com/src/shell/ShellRail.tsx` / `SettingsDrilldown.tsx`.

1. Present settings as a **centered modal overlay**: dimmed backdrop, max-w ~1000px, ~80vh, rounded-2xl, large shadow, `×` close button top-right of the content pane. Keep the existing `allternit:close-settings` event wiring working (backdrop click and × both dispatch it).
2. Sidebar restyle: **search input at top** (rounded, magnifier icon, filters nav items by label as you type). Group labels become 12px sentence-case muted (e.g. "Account", "Platform", "Products", "Infrastructure") — kill the font-black uppercase tracking style.
3. Nav items: render the icons that already exist in `settings.config.ts` (NavButton currently ignores them) + 14px label. Active state = soft neutral rounded pill (`bg-[var(--bg-secondary)]`), NO left accent bar. Truncate long labels with ellipsis.
4. Content pane: scrolling inside the pane only; content column max-w ~740px with generous padding; replace the uppercase tracking-widest `h1` with a 16px semibold sentence-case heading.

### Phase B — Primitives
Create in `surfaces/ai.allternit.com/src/components/settings/`:
- `SettingsRow.tsx` — label (14–15px medium) + muted 13px description left, control slot right, generous vertical padding, no card/border
- `Toggle.tsx` — iOS-style ~40×24, `var(--accent-primary)` when on
- `SectionHeading.tsx` — 16px semibold sentence case, spacing above/below
- `SettingsTable.tsx` — muted 12px column headers, hairline row dividers, supports a chip cell (e.g. blue "Current")
- `PanelHeader.tsx` — title left; slot for search icon / secondary buttons / "Add ▾" right
- `Badge.tsx` — small gray pill ("Beta")
- `SkeletonRow.tsx` — gray rounded shimmer bars
- `EmptyState.tsx` — centered outline icon + muted caption + single quiet CTA button
- `MonoChip.tsx` — monospace value in a subtle gray chip

Wire at least the **General** and **Appearance** sections in SettingsView to use `SettingsRow`/`Toggle`/`SectionHeading` so the primitives are proven in place. Leave other sections rendering as-is (Phase C will migrate them).

## Constraints
- NEVER run build commands: no `tsc`, no `npm/pnpm/bun build`, no `cargo build`, no dev servers. Type-check by reading code only.
- Do NOT commit or touch git.
- Match existing idiom: Tailwind classes with CSS variables (`var(--text-primary)` etc.), `cn()` from `@/lib/utils`, `@phosphor-icons/react` icons, named exports.
- Do not delete existing sections or the agent-ops/GC code — leave everything outside scope untouched.
- Keep `SETTINGS_NAV_ITEMS` as the single source of truth for nav.

## Deliverable
When finished, write `docs/SETTINGS_PARITY_PHASE_AB_NOTES.md` containing: files changed (with paths), what was done per file, any deviations from the spec and why, and anything you left for Phase C. This file existing = you are done.
