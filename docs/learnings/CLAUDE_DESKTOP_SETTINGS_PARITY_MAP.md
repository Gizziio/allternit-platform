# Claude Desktop → Allternit Platform: Settings UI Parity Map

Source: Screen Recording 2026-07-11 11.07 AM (77s tour of Claude Desktop's Settings modal)
Target: `surfaces/ai.allternit.com/src/views/settings/` (SettingsView.tsx, settings.config.ts) + `shell/SettingsDrilldown.tsx`

---

## 1. What Claude Desktop's settings actually look like (observed)

### Presentation
- **Centered modal overlay** (~960×700 px) floating over the dimmed app — NOT a full-screen route.
- Rounded ~16px corners, soft large shadow, `×` close button top-right of the content pane.
- Light neutral palette: white content pane, slightly warm off-white (#f7f7f5-ish) sidebar.
- Scrolling happens **inside the content pane only**; thin overlay scrollbar.

### Sidebar (~190px)
- **Search input at the top** (rounded, magnifier icon, filters settings).
- Three groups with **muted sentence-case 12px labels**:
  - `Settings` — General, Account, Privacy, Billing, Usage, Capabilities, Claude Code, Cowork, Claude in Chrome
  - `Desktop app` — General, Extensions, Developer
  - `Customize` — Skills, Connectors, Plugins
- Items: 16px line icon + 14px label. Active state = **soft gray rounded pill** (no accent bar, no bold uppercase). Long labels truncate with ellipsis ("Claude in Chro…").

### Content pane
- No giant page title on most sections — content leads with **16px semibold section headings** ("Account", "Trusted devices", "Plan usage limits", "Browser", "Pull requests"…).
- **The core unit is the settings row**: label (14–15px medium) + muted 13px description on the left, control on the right. Generous vertical padding, whitespace between groups, hairline dividers only inside tables. **No cards.**
- Controls observed:
  - iOS-style toggle, blue when on (~40×24)
  - Bordered rounded dropdown selects ("Don't keep", "Select default policy")
  - Text inputs ("claude" branch prefix)
  - Quiet secondary buttons (white, 1px border, rounded-lg): "Log out", "Manage", "Edit", "Change", "Recheck", "Open System Settings"
  - Muted-gray destructive button ("Delete account")
  - Warning-flavored button with icon ("⚠ Use recommended")
  - Monospace value chip (Organization ID)
  - Inline underlined links ("Learn more", file paths)
- **Tables** with muted column headers + light row dividers: Trusted devices (Device/Added), Active sessions (Device/Location/Created/Updated) with blue "Current" chip, Skills (Skill/Last updated/Author).
- **List-style panels** (Skills, Plugins, Connectors) get their own header bar inside the pane: title left; search icon + "Browse" + "Add ▾" buttons right.
- **Beta** pill badges next to feature names (Dispatch, Computer use, Claude in Chrome settings).
- **Loading**: gray rounded skeleton bars (Claude Code header) or a small centered spinner (Skills/Connectors while fetching).
- **Empty states**: hand-drawn-style outline icon, one-line muted caption, single quiet CTA ("Browse plugins"), and inline empty text in tables ("No trusted devices.", "No apps denied…").
- **Usage section**: thin gray progress bars with right-aligned "0% used", "Last updated: just now ⟳", link row, toggle for usage credits.
- **Claude Code section**: side-by-side light/dark **code theme preview** with real diff highlighting under two dropdowns.
- Status text pairs: "Granted" chip, "Not requested" chip + action button.

---

## 2. What allternit has today

- `SettingsView.tsx` (2,095 lines): **full-screen route view** (`h-screen`), opened via ViewRegistry; closed by `allternit:close-settings` event. Back-caret + "SYSTEM SETTINGS" in font-black uppercase.
- Left nav 220px, groups from `settings.config.ts`: account / platform / products / infrastructure / about (19 sections). Group labels 10px font-black uppercase `tracking-[0.2em]`.
- **Icons are defined in settings.config.ts but `NavButton` never renders them** — label only, plus a 3px accent bar on active.
- **No search** anywhere in settings.
- Content: uppercase tracking-widest `h1` per section; card-heavy layout (`bg-secondary` bordered cards), StatCards, MetricBars; custom 48×28 toggle; dashboard aesthetic rather than document aesthetic.
- Agent-ops/GC/factory dashboards live inside the settings monolith (~1,000 of the 2,095 lines).
- `SettingsDrilldown.tsx` (shell popover menu) is a separate entry point with its own submenu system.

---

## 3. Element-by-element mapping

| # | Claude Desktop | Allternit today | Action |
|---|---|---|---|
| 1 | Centered modal overlay w/ dimmed backdrop, rounded-2xl, shadow, × close | Full-screen route view | Wrap SettingsView in a modal shell (max-w ~1000px, ~80vh, backdrop) triggered from ShellRail/SettingsDrilldown; keep `allternit:close-settings` wiring |
| 2 | Sidebar search filtering settings | None | Add search input at top of nav; filter nav items (v1) and row labels/descriptions (v2) |
| 3 | Sentence-case muted group labels | 10px font-black uppercase tracked | Restyle: 12px, medium, sentence case, muted |
| 4 | Icon + label nav items, soft pill active | Label-only, accent bar active | Render the icons already in `settings.config.ts`; active = neutral pill; drop accent bar; ellipsis truncation |
| 5 | 16px semibold sentence-case section headings | Uppercase font-black h1 | Replace heading style; drop the big page h1 in favor of in-content headings |
| 6 | Row pattern (label+desc left, control right), no cards | Card-heavy panels | New `SettingsRow` primitive; migrate panels off cards |
| 7 | 40×24 blue iOS toggle | 48×28 accent toggle | Restyle `ToggleItem` |
| 8 | Quiet bordered secondary buttons; gray destructive | Bold colored buttons | Button restyle pass (secondary default, destructive muted) |
| 9 | Tables w/ muted headers, hairline dividers, chips | DiagnosticRow lists, StatCards | New `SettingsTable` primitive (used by sessions, devices, skills) |
| 10 | Beta pill badges | None | `Badge` primitive |
| 11 | Skeleton bars + centered spinner loading | (spinners only, inconsistent) | `SkeletonRow` primitive; use in slow panels |
| 12 | Empty states (outline icon + caption + CTA) | Mostly absent | `EmptyState` primitive |
| 13 | List-panel header bar (title + search + Browse + Add ▾) | None | `PanelHeader` primitive for Skills/Connectors/Plugins-style sections |
| 14 | Usage progress bars + "% used" + refresh row | ResourceUsageDashboard (chart-style) | Adapt to thin-bar rows for parity |
| 15 | Code theme dual preview (Claude Code) | None in gizziio-code panel | Add light/dark diff preview under theme selects |
| 16 | Content column ~740px, generous 40px padding, pane-only scroll | max-w-3xl, p-8 px-12, whole-view scroll | Close — adjust to pane-only scroll inside modal |

## 4. Section content mapping

| Claude Desktop section | Allternit section | Gap |
|---|---|---|
| General (app) | general | parity pass only |
| Account | signin (ClerkAuthPanel) | Add: Log out of all devices, Org ID mono chip, Trusted devices table, Active sessions table (`usePlatformSessions` already exists) |
| Privacy | — missing — | New section: data-protection links, location/training toggles, Export data, Shared chats Manage, Memory preferences |
| Billing | billing | parity pass |
| Usage | usage | Progress-bar rows, session/weekly split, credits toggle |
| Capabilities | models + permissions (partial) | Optional consolidation |
| Claude Code | gizziio-code | Add: classify/flag toggles, code appearance dual preview, Browser tools toggle, Persist sessions select, PR group (branch prefix input, auto-PR / autofix / auto-archive toggles) |
| Cowork | cowork | Add: Dispatch toggle (Beta), files-location row (Use recommended / Change), Trusted folders + Manage, Global instructions + Edit |
| Claude in Chrome | extensions (partial) | Connected-browsers status panel w/ Recheck; site-permissions default policy select |
| Desktop app · General | general / permissions | Computer use (Beta) toggles, Denied apps w/ Add app, Accessibility "Granted" chip, Screen recording "Not requested" + Open System Settings |
| Desktop app · Extensions | extensions | parity pass |
| Desktop app · Developer | diagnostics | parity pass |
| Skills | — missing — | List panel: table (name/updated/author), Browse + Add ▾ |
| Connectors | — missing in settings — | Reuse `views/cowork/ConnectorSettingsPanel.tsx` content in list-panel form |
| Plugins | plugins exist outside settings | Settings list panel + empty state ("Browse plugins") |
| *(n/a — allternit-only)* | infrastructure, vps, environment, security, agents, api-keys, shortcuts, appearance | Keep, restyled with the same primitives; consider moving agent-ops/GC dashboards OUT of settings into their own view |

## 5. Suggested build order

- **Phase A — Shell**: modal presentation, sidebar restyle (search, icons, groups, pill active), pane-only scroll. Files: `SettingsView.tsx` layout block (~lines 2028–2092), `settings.config.ts` (regroup), entry points in `ShellRail.tsx`/`SettingsDrilldown.tsx`.
- **Phase B — Primitives** in `components/settings/`: `SettingsRow`, `Toggle`, `Select`, `SectionHeading`, `SettingsTable`, `PanelHeader`, `Badge`, `SkeletonRow`, `EmptyState`, `MonoChip`.
- **Phase C — Section parity**: Account/sessions, Usage bars, new Privacy, Cowork rows, Claude-Code-style panel for gizziio-code, list panels for Skills/Connectors/Plugins.
- **Phase D — Polish**: skeletons everywhere, empty states, truncation, Beta badges, light+dark token mapping, extract agent-ops out of the 2,095-line monolith.
