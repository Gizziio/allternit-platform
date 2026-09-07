# Session attestation — session/fac1893b — desktop modal overlays + settings overhaul

- **Date:** 2026-09-09 09:46 (attestation written 2026-09-07)
- **Agent family:** kimi
- **Branch:** session/fac1893b
- **PR:** #114 (MERGED, merge SHA f45d278ef906da498b25c1658f659c2802912290)
- **Worktree:** allternit-session-fac1893b (cleaned up after merge)

## What was done
Owner-requested overhaul of the Allternit desktop shell UI (`surfaces/ai.allternit.com`):

1. **White theme-aware overlay surfaces.** Light-theme tokens (`--glass-bg*`, `--surface-overlay`, `--shell-dialog-bg`) now resolve white instead of the old warm tan; ~12 modal/overlay roots repointed from tan panel tokens to `--bg-elevated`/`--glass-bg-thick`; `Modal.tsx` backdrop fallback neutralized. Dark theme untouched; app canvas keeps the warm palette per owner scope.
2. **Settings overlay responsive bounds.** `min()` width/height clamps, `p-4 sm:p-6`, sidebar hidden below `sm` — fixed overflow on small windows.
3. **Nav consolidation 29 → 24, regrouped.** `environment` merged into Gizziio Code (`EnvironmentSettings` superset; `ServiceUrlSettings.tsx` deleted); `compute` merged into Infrastructure (new Billing & Credits / Cloud Desktops / BYOC tabs; `ComputeSettings.tsx` deleted; redirects added); `shortcuts` folded into About with a verified-only shortcut list (the old table was ~half fiction — ⌘K/⌘N/⌘B/⌘, have no real bindings); `general` removed (auto-save row → Appearance; default section now `appearance`); AgentOps setup tab deduped into an Open Agent Hub action.
4. **Dead controls wired to real implementations.** Fabric Transport panel rewritten against the real transport (`useRuntimes`, `useRemotePendingCounts`, real Web Push subscribe/unsubscribe, `openFabricSessionWindow`, WakeLock kept); Security renders real `threatLevel` from `getSecurityOverview()` (fallback from open violations), opens policy/purpose workspaces, real purpose-binding data; Diagnostics shows real agent-metrics stat cards + rails health; Appearance density (`data-density`) and sidebar-label toggles made real; chat draft auto-save implemented; local-model streaming pref wired into the Ollama provider.
5. **Placebos removed** (verified zero readers repo-wide): telemetry, language/timezone/system-messages, gizziio-code/extensions/privacy/cowork dead toggles, dispatch `notify*` sub-toggles, static file-access row, dead privacy buttons.

## Verification evidence
- `tsc --noEmit`: clean on the change (1 introduced error found and fixed in DispatchSettingsPanel during Phase 5).
- vitest: 32/32 across SettingsView, CloudInstancesPanel, ollama loopback (19), EnterpriseByocPanel, ComputeBillingPanel, ControlCenter, FloatingWidgets.
- `bun run build` (vite production): success.
- Live smoke (vite dev :3013 + Playwright chromium): shell boots with 0 page errors; settings overlay renders white with pruned nav at 1400px and 700px viewports; account popover white. Screenshots taken (session tmp/, removed at cleanup).

## Incidents / honest deferrals
- **Pre-existing breakage on main (not ours, FIXED LATER):** 26 typecheck errors in terminal files existed on origin/main at attestation time; our branch's diff for those files was empty so they were left untouched. Fixed same day by session/tfix, PR #117 (merge SHA 9220618fa).
- Backend-dependent panels (security overview, agent metrics, transport status) verified by code/tests only — no API running in the smoke env.
- `--shell-overlay-backdrop` (light) still a faint warm scrim — owner decision pending; never renders as a tan surface.
- `gizziio-code.bypassPermissions` toggle kept but still has no reader (not on the approved removal list) — owner to decide.
- DispatchView.tsx is dead code (references removed settings keys; never imported) — deletion candidate.
- Merge conflicts with a parallel session's main changes (ShellRail badge prop, checkpoint.md) resolved keeping both behaviors.

## Attestation status
Committed via the ledger PR (this file + LEDGER.md line) rather than directly on main: the shared checkout could not be fast-forwarded because another session holds uncommitted terminal-workspace WIP, and direct main commits were not allowed to disturb it.
