# OpenClaw vs Allternit CLI/TUI Parity Matrix

## Scope

- OpenClaw reference: `services/vendor-integration/vendor/openclaw/dist/cli/*`, `dist/tui/*`
- Allternit implementation: `cmd/cli/*`, `cmd/shell-ui/*`

This document tracks parity by capability, not by copying OpenClaw internals.

## Full Matrix

| Capability | OpenClaw reference | Allternit status | Notes |
|---|---|---|---|
| OpenClaw command surface (native) | `dist/cli/*`, `dist/commands/*` | Near parity | Allternit now parses OpenClaw-style roots natively via external subcommand router (`setup`, `onboard`, `agent`, `gateway`, `models`, `memory`, `message`, etc.) |
| Root `health` command | `dist/commands/health.js` | Parity | `a2 health --json` available |
| Root `status` command | `dist/commands/status*` | Near parity | Multi-source summary plus service probes and telemetry |
| Root `sessions` command | `dist/commands/sessions.js` | Near parity | Added filters for `--active`, `--status`, `--brain`, `--limit` |
| Fast routed root commands | `dist/cli/program/command-registry.js` routes | Parity floor | Added fast-route handlers for `health/status/sessions` under `ALLTERNIT_CLI_FAST_ROUTE=1` |
| Runtime bootstrap/profile | `dist/cli/run-main.js` | Partial parity | Profile + env bootstrap present; OpenClaw still has deeper plugin/runtime guards |
| Kernel/API path fallback | OpenClaw gateway command wrappers | Parity | `/v1` + `/api/v1` fallback and SSE stream support |
| Brain attach/log follow | OpenClaw session stream behavior | Parity | `a2 brain attach`, `a2 brain logs --follow` stream live events |
| Unified TUI entry | `dist/cli/tui-cli.js` | Near parity | Native `a2 tui` accepts `--url --token --password --session --deliver --thinking --history-limit --timeout-ms --message` |
| TUI interaction model | `dist/tui/*` | Near parity | Replaced tabbed ops workspace with chat-first terminal flow: slash commands, pickers, session attach/stream, footer/status model |
| Marketplace terminal surface | OpenClaw plugin/channel tooling | Partial parity | Real marketplace TUI path exists; broader channel/plugin UX still wider in OpenClaw |
| Command graph breadth (channels/approvals/etc.) | OpenClaw large sub-CLI set | Partial | Allternit has focused command set; not full breadth by design |

## Implemented In This Pass

1. Fast route parity for diagnostics
- `ALLTERNIT_CLI_FAST_ROUTE=1` now routes:
  - `health`
  - `status`
  - `sessions`
- File: `cmd/cli/src/fast_route.rs`

2. `status` parity hardening
- Added flags:
  - `--all` (implies `--deep` + runtime details)
  - `--usage` (runtime usage snapshot when endpoint data exists)
- Added runtime section in status summary, including:
  - runtime reachability/source path
  - best-effort usage extraction (cpu/memory/rss/load/inflight/queue)
- File: `cmd/cli/src/commands/status_health_sessions.rs`

3. `sessions` parity hardening
- Added filters:
  - `--status running,ready`
  - `--brain <brain_id>`
  - `--limit <n>`
- Existing `--active` retained, now combined with other filters.
- File: `cmd/cli/src/commands/status_health_sessions.rs`

4. OpenClaw command-surface native router
- Added native external-subcommand parser for OpenClaw-style roots.
- Implemented command handlers for setup/onboard/configure/dashboard/reset/uninstall/update,
  agent/agents, gateway, models, memory, message, browser, system, docs.
- Files:
  - `cmd/cli/src/commands/openclaw_compat.rs`
  - `cmd/cli/src/main.rs`
  - `cmd/cli/src/config.rs`

5. Native TUI flag parity bump
- Added native TUI support for:
  - `--password`
  - `--deliver`
  - `--thinking`
- Dispatch payload now includes `deliver` and `thinking` hints.
- Added OpenClaw-like slash command set and keybinding overlays.
- File: `cmd/cli/src/commands/tui.rs`

## Remaining Gaps

1. Channel/plugin command depth
- Allternit has parser scaffolds for OpenClaw plugin/channel families but backend endpoint parity is still incomplete for several of those command groups.

2. Browser action depth
- OpenClaw browser automation subcommand breadth (click/type/snapshot/evaluate/etc.) still exceeds current Allternit browser surface.

## Acceptance Snapshot

- `cargo check -p allternit-cli` passes.
- OpenClaw-style roots now execute through native Allternit command handlers (no runtime delegation).
- `health/status/sessions` now support both normal path and fast-route dispatch mode.
- OpenClaw parity floor for diagnostics + agent/session operations + chat-first TUI is implemented in native Rust CLI/TUI paths.
