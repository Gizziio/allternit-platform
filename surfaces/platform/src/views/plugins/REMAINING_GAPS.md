# Plugin Manager Execution Backlog (Locked Scope)

Last updated: March 5, 2026 (afternoon pass)
Owner: A2R UI platform
Status legend: `[ ]` pending, `[~]` in progress, `[x]` complete

## Product constraints (locked)

- Keep the 7 tab model in the left navigation (`Skills`, `Commands`, `CLI Tools`, `Plugins`, `MCPs`, `Webhooks`, `Connectors`).
- Do not copy external product wording/branding.
- Left pane starts lower to avoid clipping under top-left mode switchers.
- Back control in pane 1 must also sit below the clipped area.
- Middle and right panes remain top-aligned full height.
- Improve parity in behavior and polish, not literal clone text.

## Phase 1: Layout shell and baseline polish

- [x] Implement pane geometry rule:
  - Left pane vertically offset below global mode switcher area.
  - Middle/right panes full-top layout.
- [x] Replace heavy header treatment with compact, low-clutter controls.
- [x] Tighten spacing and hierarchy across all 3 panes.
- [x] Add robust main empty state (icon + guidance + quick actions).
- [x] Add left-pane utility CTA area for discovery/browse flows.
- [x] Normalize selected/hover/focus states so only one active target is visually dominant.

## Phase 2: Skills and file experience

- [x] Add skills grouping sections (built-in/examples/custom pattern).
- [x] Improve tree semantics and expansion behavior for nested files/folders.
- [x] Improve right-pane metadata framing (author/source, description, terms cue).
- [x] Render HTML files in Human mode as interactive preview (sandboxed iframe).
- [x] Keep Code mode with syntax-highlighted source for all previewable files.
- [x] Add skill upload modal with drag/drop area and requirements guidance.
- [x] Expand skill create flow beyond generic create (guided write + upload paths).

## Phase 3: Connectors experience

- [x] Group connectors by state:
  - Included/builtin
  - Connected
  - Not connected
- [x] Add included badge and state semantics for builtin connectors.
- [x] Add connector detail sections:
  - Description
  - Enable toggle
  - Tool permissions
  - Management/settings links
- [x] Wire real connect flow state (not just local enabled toggle).
- [x] Add settings/management entry point in connectors header.
- [x] Add connector browse modal:
  - Featured / All tabs
  - Search
  - Type filter
  - Category filter
  - 2-column card grid with add action
- [x] Add custom connector creation/link flow from connector modal.

## Phase 4: Plugins marketplace and personal sources

- [x] Keep Marketplace + Personal split with improved IA.
- [x] Add Personal source actions:
  - Add marketplace from GitHub
  - Add marketplace by URL
  - Upload plugin bundle
- [x] Add warning/validation UX for custom source install/sync.
- [x] Improve install/uninstall discoverability and state feedback.
- [x] Prefer real marketplace data; keep mock fallback controlled and clearly secondary.

## Phase 5: Data and persistence hardening

- [x] Preserve local source scanning (`.a2r`, `.agents`, `.codex`) while improving model fidelity.
- [x] Evolve connector data model from static local JSON toward account-aware connection state.
- [x] Ensure toggle/create/edit/delete actions persist through file-system API consistently.
- [x] Add explicit loading/error/empty states for each tab and modal surface.

## Phase 6: Validation and rollout

- [x] Add focused interaction tests for:
  - pane layout constraints
  - html preview mode switch
  - connector grouping and connect actions
  - personal marketplace source flows
- [~] Run build/type checks and fix regressions.
- [x] Produce post-implementation gap report with remaining deltas and priority.

## Current execution order

1. Layout shell constraints and pane offsets.
2. Skills preview/file handling (including HTML human preview).
3. Connectors grouping + marketplace modal and detail pane.
4. Plugin personal source workflows.
5. Persistence hardening + validation.

## Validation notes

- Added focused utility tests in `PluginManager.utils.test.ts` for GitHub source parsing, language detection, and marketplace payload normalization.
- Added focused flow tests in `PluginManager.flows.test.tsx` for create/edit/uninstall + marketplace install/uninstall, connector connect/disconnect modal flow, pane offset assertions, HTML preview mode switching, and personal source add/remove.
- Full workspace type-check still reports many pre-existing errors outside Plugin Manager scope; this pass validated targeted plugin tests and live Electron behavior.

## Production Hardening Sequence (March 7, 2026)

1. [x] Replace metadata-only installs with real package installs from marketplace source descriptors.
2. [x] Implement lifecycle sync/update behavior:
   - Installed vs remote version comparison.
   - Per-plugin update action.
   - Update-all action for eligible plugins.
   - Manual marketplace source sync trigger.
3. [x] Upgrade plugin/marketplace validation to schema-based validation (Zod) and enforce during create/install flows.
4. [x] Expand plugin wizard scaffolding:
   - Command stub files.
   - Skill `SKILL.md` scaffolds.
   - MCP config scaffolds.
   - Webhook config scaffolds.
5. [x] Add source policy management:
   - Curated source enable/disable registry.
   - Untrusted/community source gating toggle.
   - Blocked install/update state in UI when policy disallows source trust level.
6. [x] Add targeted tests for new hardening scope:
   - `pluginStandards.test.ts`
   - `marketplaceInstaller.test.ts`
   - Updated `PluginManager.utils.test.ts`
