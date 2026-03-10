# PluginManager Implementation Status

Last updated: March 6, 2026

## Completed

1. Renderer build blocker fixed for Node builtin imports in browser bundles.
2. Toggle state now updates live and persists via local storage overrides.
3. Marketplace install flow is now implemented through `useFileSystem.installMarketplacePlugin`.
4. Create dropdown actions are wired (`Create new`, `Import from file`, `Import from URL`).
5. Add-capability forms now submit structured payloads instead of `console.log` stubs.
6. Add-capability forms are integrated into PluginManager and create items immediately.
7. Right pane actions are functional (`Edit`, `Copy`, menu actions, connector `Connect`).
8. Marketplace install state is persisted and reflected in UI.
9. Real filesystem + API fallback layering is implemented in `useFileSystem`.
10. Capability scanner no longer caches `homeDir` at construction time.
11. Scans run only after filesystem readiness and refresh when ready.
12. Synthetic connector injection was removed from scanner output.
13. Scanner metadata now uses file modification timestamps when available.
14. `plugins` route now opens `PluginManager` directly.
15. Plugin registry cards now have functional `Activate/Deactivate` and `Details` actions.
16. Cowork agent capabilities panel now reads enabled capabilities from shared stores.
17. PluginManager CLI tools tab now uses API-backed `useCliToolsApi` data when available.
18. Dead mock capability datasets were removed from PluginManager.
19. Loading and error states are rendered in PluginManager UI.
20. Skill scanner now discovers nested local skill directories containing `SKILL.md` (including `.codex/skills/.system/*`).
21. Skill upload now supports `.zip` bundles by extracting `SKILL.md` and writing bundled text files.
22. Personal marketplace upload now accepts `.zip` plugin manifests in addition to JSON/TXT.
23. Marketplace fetch now has timeout + fallback behavior, preventing indefinite loading state when APIs are empty/unavailable.
24. Filesystem deletion now handles directories for recursive uninstall cleanup.
25. Plugin manager tab-type mapping now correctly translates UI tabs (`skills/plugins/...`) to writer API types (`skill/plugin/...`) for toggle/delete/update flows.
26. Skill metadata updates now resolve against scanned candidate roots (`.a2r`, `.agents`, `.codex`) instead of writing only to `.a2r`.
27. Marketplace search now uses real sources only (A2R API + GitHub); when both are unavailable it returns an explicit empty-state result instead of synthetic mock catalog data.
28. Plugin create flow now persists plugin manifests/README to `.a2r/plugins` via filesystem writer instead of memory-only state.
29. Connector connect flow now uses an account-aware modal (instead of prompt-only toggle) and persists connection metadata (`accountLabel`, `connectedAt`, `lastAttemptAt`).
30. Plugin marketplace overlay now renders explicit loading/error/empty states in-surface (not only toast notifications).
31. Skills/file rendering now includes responsive third-pane behavior with scroll-safe layout and interactive HTML preview in Human mode.
32. Three-pane visual polish aligned to settings-style floating surface behavior while preserving left-pane offset constraints.
33. Added focused utility tests for PluginManager parsing/normalization helpers (`PluginManager.utils.test.ts`).
34. Added focused interaction flow tests for PluginManager UI behaviors (`PluginManager.flows.test.tsx`), including create/edit/uninstall flows, marketplace install/uninstall, connector connect/disconnect modal, pane offset assertions, HTML preview mode switching, and personal source add/remove.
35. Plugin Manager now persists UI workflow state (`enabledOverrides`, marketplace installs, personal source definitions, connector connection metadata) to `~/.a2r/plugin-manager/ui-state.json` via filesystem API, with local-storage fallback.
36. Runtime filesystem backend now uses only real/API-backed implementations; mock filesystem fallback has been removed from production hook flow.
37. Plugin marketplace runtime no longer injects hardcoded mock plugin catalog entries when external sources fail.

## Remaining Follow-ups

1. Replace local PluginRegistryView toggle overrides with backend persistence once telemetry provider mutation endpoints exist.
2. Add end-to-end desktop/UI automation coverage beyond current component interaction tests.
3. Tighten type contracts between plugin package types and simplified capability view models.
4. Resolve unrelated workspace-wide TypeScript errors to allow clean full-repo type-check gate.

## Notes

- This file tracks implementation status, not product roadmap.
- For product roadmap items, use the main planning docs.
