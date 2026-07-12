# Settings UI Parity — Phase C Notes

Completed per `docs/SETTINGS_PARITY_PHASE_C_TASK.md`, implementing Phase C of
`docs/CLAUDE_DESKTOP_SETTINGS_PARITY_MAP.md` using the Phase B primitives. No builds,
typechecks, or dev servers were run (per constraints); all verification was by reading
code. No git operations. The reviewer's content-pane structure (non-scrolling `relative`
wrapper with pinned `×`, inner `h-full overflow-y-auto` scroller) was left untouched.

## Files changed

### `surfaces/ai.allternit.com/src/views/settings/settings.config.ts`
- Added `'customize'` to the `SettingsGroup` union.
- New nav items: `privacy` (group `account`, directly after `billing`), and `skills`,
  `connectors`, `plugins` under the new `customize` group (icons: `Lock`, `Sparkle`,
  `PlugsConnected`, `Package`).
- Added `{ group: 'customize', label: 'Customize' }` to `SETTINGS_NAV_GROUPS` (after
  Infrastructure). `SETTINGS_NAV_ITEMS`/`SETTINGS_NAV_GROUPS` remain the single source of
  truth; the `SettingsSection` type and section map derive automatically.

### `surfaces/ai.allternit.com/src/views/settings/SettingsView.tsx`

**Shared additions (module scope)**
- `QUIET_BUTTON_CLASS` — quiet bordered secondary button, now the default action style
  everywhere in the view.
- `DESTRUCTIVE_BUTTON_CLASS` — muted gray destructive treatment (reddens only on hover).
- `SETTINGS_SELECT_CLASS` — standard bordered select styling shared by migrated panels.
- New imports: the remaining Phase B primitives (`SettingsTable`/`SettingsTableCell`/
  `SettingsTableChip`, `PanelHeader`, `Badge`, `SkeletonRow`, `EmptyState`, `MonoChip`),
  `usePlatformHardSignOut`, and phosphor icons `Sparkle`, `PlugsConnected`, `PuzzlePiece`.

**Per-section work**

- **signin (ClerkAuthPanel)** — full migration off cards: avatar/name/email header row with
  quiet "Log out"; User ID `MonoChip`; "Log out of all devices" row wired to
  `usePlatformHardSignOut()`; **Active sessions** as a `SettingsTable` (Session / Last active
  / actions) with a blue `SettingsTableChip` "Current" and per-row Revoke; **Trusted devices**
  section with inline "No trusted devices." message; Backend group (connection + refresh /
  restart rows, backend URL `MonoChip`, routing row with quiet Manage/BYOC buttons);
  Offline-first sovereignty as a plain paragraph. Early-return states (loading, auth
  disabled, signed out) restyled to `SectionHeading` + muted text, no cards.
- **permissions** — `PermissionsPanel` converted from inline styles to Tailwind +
  `SectionHeading`; `PermissionRow` rewritten as a `SettingsRow` with "Granted" success chip,
  "Not granted" gray chip + quiet Grant button, "Checking…" placeholder; accent-filled
  Refresh button replaced with quiet style.
- **usage** — thin gray progress-bar rows with right-aligned "N% used", grouped under
  `SectionHeading` "Current session" and "Weekly limits" (static sample values), "Last
  updated: just now" row with a quiet Refresh button (state-driven, simulated refresh).
  `ResourceUsageDashboard` kept below under a "Usage details" heading.
- **privacy (new)** — two chevron link rows (no-op per spec), Preferences toggles (location
  metadata, improve-models), "Your data" group: Export / Shared chats Manage / Memory
  preferences Manage — all disabled with `title="Not wired yet"` (no existing handlers).
- **models** — `LocalModelManager` untouched; Session controls heading + Streaming
  `SettingsRow`/`Toggle`.
- **api-keys** — heading/intro restyled; `BrainsPanel` untouched.
- **shortcuts** — card table replaced with `SettingsTable` (Action / Shortcut), shortcut
  values in `MonoChip`.
- **diagnostics** — telemetry list converted to `SettingsTable` (Item / Value) with status
  dots; session metrics kept as thin `MetricBar` rows without the card wrapper.
- **about** — logo grid kept; title/links restyled to semibold sentence case, quiet muted
  13px link buttons (uppercase tracking killed).
- **gizziio-code** — restructured per the map: `ServiceUrlSettings` kept on top; **General**
  (2 toggles as rows); **Code appearance** with light/dark theme selects and a side-by-side
  static diff preview (real red/green diff rows on white and `#0d1117` backgrounds);
  **Browser** (browser-tools toggle, persist-sessions select incl. "Don't keep"); **Pull
  requests** (branch-prefix text input, auto-create-PRs toggle, autofix toggle);
  **Authorized API access** as a row with the Revoke button in the muted destructive style
  (behavior and `gizzi login` hint preserved).
- **cowork** — Dispatch toggle row with gray `Badge` "Beta"; files-location row (monospace
  underlined path link, warning-styled "Use recommended" button with icon, quiet "Change");
  Trusted folders → Manage; Global instructions → Edit. The "managed per-project" placeholder
  box was removed since real rows now exist.
- **extensions** — two toggle rows under a heading.
- **billing** — gradient card removed; "Allternit Pro" row with green Active chip, billing
  portal row with quiet "Manage billing portal" button.

**List panels (new `customize` group)**
- **Skills** — `PanelHeader` (search icon, Browse, Add ▾) + `EmptyState` ("No skills
  installed yet." / "Browse skills" CTA → opens the Skills Registry view via
  `allternit:open-view` `memory`).
- **Connectors** — reuses the same data source as `ConnectorSettingsPanel`
  (`GET /api/v1/cowork/connectors`, fetched on section entry, Refresh button in the header).
  `SkeletonRow` while loading, `EmptyState` with Retry on error, otherwise a `SettingsTable`
  (Connector / Category / Status with chip).
- **Plugins** — `PanelHeader` + `EmptyState` ("No plugins installed yet." / "Browse plugins"
  CTA → opens the `plugins` view).

**Cleanup**
- `ToggleItem` deleted (spec requirement — nothing references it anymore).
- `DiagnosticRow` deleted (orphaned by the diagnostics migration).
- `renderContent` switch covers all 23 nav ids (verified one-to-one against
  `SETTINGS_NAV_ITEMS`).

## Deviations from spec (and why)

1. **Usage bars are static sample values** (8/14/34/27%). The map's usage percentages come
   from live plan data that doesn't exist in this codebase yet; the bar component is
   data-shaped (`{ label, used }[]`) so Phase D can drop in a real source.
2. **Connectors table columns are Connector / Category / Status**, not name / last updated /
   author — the connectors API has no updated/author fields; status is the meaningful
   content. Skills/Plugins (which fit the name/updated/author shape) render `EmptyState`s
   because they have no data source in this repo.
3. **"Use recommended" in Cowork is disabled** (`title="Not wired yet"`) like the other
   unwired buttons — there is no files-location handler to wire it to. The warning styling
   (amber border/bg/icon) is in place for when it gets a handler.
4. **Link rows in Privacy are `<button>`s with chevrons** (no-op, per spec) rather than
   anchors — there are no destination routes yet.
5. **`SectionDivider`** remains defined but unused — it was already unused before Phase C;
   left alone as out of scope (the spec only mandated deleting `ToggleItem`).
6. **Agent-ops/GC/security internals untouched** per scope; they still use `StatCard` and
   their own styling, now inside the 740px column.

## Left for Phase D

- Wire real data: usage percentages, skills list (name/updated/author table is ready to
  receive rows), plugins registry contents, trusted devices list.
- Wire the placeholder handlers: Export data, Shared chats, Memory preferences, Trusted
  folders, Global instructions, files-location Change/Use recommended, list-panel search and
  Add ▾ menus.
- Restyle agent-ops/GC/security dashboards (or extract them out of settings per the map's
  Phase D suggestion); they are the last card-heavy holdouts.
- Persist the new toggle/select/input states (privacy, gizziio-code, cowork) — currently
  local component state like the pre-existing settings.
- Light/dark token sweep and skeleton/empty-state coverage in the external panels
  (infrastructure, environment, security, agents, vps) whose internals were out of scope.
