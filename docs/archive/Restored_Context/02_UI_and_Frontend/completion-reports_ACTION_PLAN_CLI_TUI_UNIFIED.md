# Action Plan: CLI/TUI & Unified UI (Phase 9-11)

## Goal
Build a robust "Operator Console" (CLI/TUI) alongside the "End-User Experience" (Unified UI), both backed by the same Kernel Daemon.

## Phase 9: Daemon API Alignment
**Objective**: Ensure the Kernel exposes the granular endpoints needed by the CLI/TUI.
*   **Current State**: Kernel has `dispatch_intent`, `get_capsule`, `get_journal`.
*   **Missing/Refine**:
    *   `POST /v1/evidence/add`: Add raw evidence without starting a capsule.
    *   `POST /v1/capsules/:id/patch`: Apply a compiler patch manually.
    *   `GET /v1/tools`: List registered tools (registry already exists, just need endpoint).
    *   `SSE Stream`: Ensure `/v1/journal/stream` is true SSE (currently just a list poll in some contexts).

## Phase 10: CLI Expansion (Operator-Grade)
**Objective**: Replace the current basic CLI with the structured `a2` tool.
*   **Structure**:
    *   `a2 up`: Start daemon (if not running).
    *   `a2 ev`: Manage evidence (`add`, `ls`, `rm`).
    *   `a2 cap`: Manage capsules (`new`, `ls`, `show`, `open`).
    *   `a2 j`: Journal interaction (`tail`, `explain`, `replay`).
    *   `a2 run`: Execute tools directly.

## Phase 11: TUI (Operator Cockpit)
**Objective**: Build the interactive Ratatui interface.
*   **Layout**: 3-Pane (Projects, Preview, Journal).
*   **Tech**: Rust (`ratatui`, `crossterm`).
*   **Features**:
    *   Live Journal Feed (via SSE).
    *   Capsule Preview (JSON/Tree view of Spec).
    *   Command Bar (vim-style inputs).

## Integration
*   **Deep Link**: `a2 cap open <id>` -> opens `http://localhost:5173/#/capsules/<id>`.
*   **Single Truth**: Both TUI and Web UI consume `v1/capsules/:id` (CapsuleSpec).

## Implementation Order
1.  **Kernel**: Add missing endpoints (`evidence`, `tools`, `patch`).
2.  **CLI**: refactor `apps/cli` to match the `a2` subcommand spec.
3.  **TUI**: Build `apps/tui` (or `a2 tui` subcommand).

## Affected Files
*   `services/kernel/src/main.rs` (New routes)
*   `apps/cli/src/main.rs` (Refactor)
*   `apps/cli/src/commands/*.rs` (New modules)
*   `apps/tui/` (New crate)

## Verification
*   `a2 ev add https://example.com` -> Evidence ID.
*   `a2 cap new ...` -> Capsule ID.
*   `a2 cap open <id>` -> Browser opens.
