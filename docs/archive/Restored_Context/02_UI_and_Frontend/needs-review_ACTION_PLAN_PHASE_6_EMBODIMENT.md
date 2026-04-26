# Action Plan: Phase 6 Embodiment Control Plane

## Goal
Implement the **Embodiment Control Plane** in the Kernel. This transforms the Kernel from a passive text processor into an agent capable of interacting with the host system (Desktop) and future devices.

## Phase 6: Embodiment Tasks
1.  **Tool Executor Upgrade**:
    *   Upgrade `services/kernel/src/tool_executor.rs` to support dynamic tool registration and async tool streams.
    *   Integrate `allternit_tools` (FS, Search) directly into `ToolExecutor`.
2.  **Desktop Device Adapter**:
    *   Create `services/kernel/src/embodiment/desktop.rs`.
    *   Implement `DesktopDevice` struct that exposes `fs.*` and `shell.exec` capabilities (gated).
    *   Register `DesktopDevice` tools into the `ToolExecutor`.
3.  **Multimodal Interfaces**:
    *   Define `MultimodalInterface` trait in `types.rs` (Screen, Voice, text).
    *   Add `screen.capture` placeholder tool (returns a mock screenshot or text description).

## Affected Files
*   `services/kernel/src/tool_executor.rs` (Major refactor)
*   `services/kernel/src/embodiment/mod.rs` (New)
*   `services/kernel/src/embodiment/desktop.rs` (New)
*   `services/kernel/src/main.rs` (Wiring)
*   `services/kernel/Cargo.toml` (Add dependencies if needed)

## Breaking Changes
*   `ToolExecutor` signature might change. Any code relying on the old `new()` or `execute()` will need updates (likely just `intent_dispatcher.rs`).

## Verification
*   Unit tests for `DesktopDevice` (sandboxed FS writes).
*   Integration test: `ToolExecutor` running a `fs.write` command.
