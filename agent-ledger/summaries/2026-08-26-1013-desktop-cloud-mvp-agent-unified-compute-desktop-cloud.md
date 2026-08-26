# Allternit Unified Compute & Desktop Cloud — Work Summary

**Branch:** `session/desktop-cloud-mvp`  
**Main repo:** `/Users/joe/Desktop/allternit-workspace/allternit`  
**Pushed to:** `origin/session/desktop-cloud-mvp`  
**Last commit:** `6295201ec` — Merge local desktop-cloud MVP state with unified compute work

---

## What was created

### Backend (Rust — `cmd/allternit-api`)

| File | Purpose |
|------|---------|
| `migrations/V99__computers.sql` | Creates the unified `computers` table, kind-specific side tables (`computer_cloud_desktop`, `computer_managed`, `computer_byo_vps`, `computer_byoc`), indexes, and backfills existing `bot_desktop_sandboxes` rows into `computers`. |
| `migrations/V100__session_metadata.sql` | Creates `session_metadata` table used to persist session-level metadata such as the provisioned `vmComputerId`. |
| `migrations/V101__backfill_computers_from_bot_desktop.sql` | Idempotent migration that mirrors any remaining `bot_desktop_sandboxes` rows into `computers`. |
| `src/computer_routes.rs` | New `/api/v1/computers` router: list, get, create, start, stop, delete, screenshot, shell. Phase 1 proxies `cloud_desktop` to existing bot-desktop internals. |
| `src/computer_control.rs` | Dispatcher and helpers for computer control actions: screenshot, mouse, keyboard, shell, file read/write. |
| `src/tool_routes.rs` (modified) | Added `computer_screenshot`, `computer_shell`, etc. tool cases and descriptors. |
| `src/bot_desktop_routes.rs` (modified) | Added deprecation notice; legacy `/bots/:bot_id/desktop/*` routes remain for backward compatibility. |
| `src/bot_desktop_input.rs` (modified) | Made `build_mouse_command` and `build_keyboard_command` `pub(crate)` for reuse. |
| `src/bot_desktop_quotas.rs` (modified) | `record_end` now writes `computer_minute` usage events into the unified `usage_events` ledger. |
| `src/admin_spend_limit_routes.rs` (modified) | Org month spend now includes both LLM usage and unified computer usage events. |
| `src/llm_gateway/auth.rs` (modified) | Same org-spend unification for LLM-gateway budget enforcement. |
| `src/pricing.rs` (modified) | Added placeholder `computer_minute:minutes` rate (0.5 cents/min). |
| `src/lib.rs` (modified) | Wired `computer_routes` and `computer_control` modules. |
| `src/main.rs` (modified) | Mounted the `/api/v1/computers` router. |

### Frontend (TypeScript — `surfaces/ai.allternit.com`)

| File | Purpose |
|------|---------|
| `src/lib/computers-api.ts` | Typed client for `/api/v1/computers`: list, get, create, start, stop, delete, usage summary. |
| `src/views/settings/ComputeSettings.tsx` | New tabbed settings panel: Overview / My Computers / Add Computer / Templates / Usage & Credits. |
| `src/views/settings/settings.config.ts` (modified) | Consolidated legacy `vps`, `cloud-instances`, `cloud-credentials` into single `compute` section; added legacy redirects. |
| `src/views/settings/SettingsView.tsx` (modified) | Renders `ComputeSettings` for the `compute` section. |
| `src/lib/bots/vm-operator.ts` (modified) | `createSandbox` / `getSandboxForAgent` now call `/api/v1/computers`. Legacy OpenSandbox path is gated and returns not-configured. |
| `src/lib/bots/vm-operator.test.ts` (modified) | Updated tests to mock `/api/v1/computers`. |
| `src/lib/bots/bot-runtime-env.ts` (modified) | Emits `ALLTERNIT_VM_COMPUTER_KIND` and `ALLTERNIT_VM_TEMPLATE_ID` when configured. |
| `src/lib/bots/useStartBotSession.ts` (modified) | Stores provisioned `vmComputerId` in session metadata. |
| `src/lib/agents/mode-session-store.ts` (modified) | `deleteSession` tears down ephemeral cloud desktops via `deleteComputer`. |
| `src/lib/agents/agent.types.ts` (modified) | Extended `AgentVMOperatorConfig` with `computerKind`, `templateId`, and `cloud-desktop` provider. |
| `src/lib/agents/agent.service.ts` (modified) | Type fix for `api.createAgent` call. |
| `src/components/settings/ComputeBillingPanel.tsx` (modified) | Shows Desktop Cloud usage summary. |
| `src/views/agent-view/components/AgentGalleryCard.tsx` (modified) | Added missing `assistant` type meta entry. |

### Docs

| File | Purpose |
|------|---------|
| `docs/desktop-cloud-mvp/RUNBOOK.md` (modified) | Added "Unified API and deprecation" section. |
| `.steering/checkpoint.md` (modified) | Added steering checkpoints for Phase 2 and phases 3–4. |

---

## What it does

- Exposes a single compute domain (`computers`) covering local, BYO-VPS, managed, BYOC, and cloud-desktop resources.
- Provides one API surface (`/api/v1/computers/*`) for listing, creating, lifecycle control, and tools (screenshot/shell/etc).
- Consolidates the fragmented compute settings UI into one "Compute & Cloud Desktops" section.
- Integrates cloud-desktop provisioning into bot session lifecycle.
- Records Desktop Cloud usage in the same `usage_events` ledger used for hosted compute/BYOC.
- Registers bot tools (`computer_screenshot`, `computer_shell`, etc.) so bots can control their computer.
- Backfills existing bot desktop sandboxes into the unified `computers` table.
- Keeps legacy `/bots/:bot_id/desktop/*` routes working but marks them deprecated.

---

## Verification that was run

- `cargo test -p allternit-api --lib` → 476 passed, 0 failed.
- `cargo test -p allternit-api` (health/metrics/viz integration tests) → 20 passed, 0 failed.
- `pnpm --filter @allternit/ai typecheck` → clean.
- `vitest run src/lib/bots/vm-operator.test.ts src/views/settings/SettingsView.test.tsx` → 12 passed.
- Local API smoke test on port 8028 → `/api/v1/health` OK, `/api/v1/computers` returned unified list.

---

## What is NOT done / still pending

- **Merge to `main`:** All work is on `session/desktop-cloud-mvp`; it has not been merged/rebased onto `main`.
- **Final removal of deprecated routes/tables:** Per Phase 6, old routes and settings sections are intentionally retained for backward compatibility and should only be removed after a deprecation window.
- **Full end-to-end cloud desktop provisioning:** Verified with unit tests and API smoke tests, but not with a live Incus/Tart VM provisioning end-to-end in this session.
- **Video/screen recording proof:** Not recorded for the final unified settings or bot-tool state.
- **Pricing finalization:** `computer_minute` rate is a placeholder pending business decision.
- **True unified "My Computers" list:** `ComputeSettings.tsx` currently reuses existing panels (`VPSConnectionsPanel`, `CloudInstancesPanel`, etc.); a single list rendered directly from `/api/v1/computers` can be wired in later.
- **Cleanup of old allternit-platform worktrees:** `/Users/joe/Desktop/Allternit/allternit-platform-session-*` directories still exist if other sessions use them; only the active desktop-cloud-mvp worktree and wrong checkout were removed.

---

## Notes

- Work was initially done in the wrong checkout (`/Users/joe/Desktop/Allternit/allternit-platform`), then moved to the correct main repo worktree, merged with the local desktop-cloud MVP state, and pushed.
- The merge commit `6295201ec` includes a local backup WIP commit (`b28207ffb`) in its history used to preserve uncommitted desktop-cloud MVP state before pulling the unified compute commits.
