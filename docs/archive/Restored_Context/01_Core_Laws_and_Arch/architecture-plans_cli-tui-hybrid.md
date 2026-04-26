# Hybrid CLI/TUI System

## 1. Vision
A unified execution stream that provides both high-level observability (Operator Console) and low-level control (Embedded Terminal) without duplicating execution paths.

## 2. Architecture
- **Source of Truth**: IO Runner (Journal Ledger).
- **Control Path**:
  - `Shell UI` -> `Kernel` -> `IO Runner`
  - `Terminal` -> `Kernel` -> `IO Runner`
- **Observability Path**:
  - `IO Runner` -> `Journal Event` -> `Operator Console`

## 3. Power Mode (Embedded Terminal)
For advanced users, the "Power Mode" toggle enables a functional `xterm.js` instance.
- **Connection**: Directly attached to the IO Runner PTY abstraction.
- **Logging**: Every keystroke and command is captured and journaled to the session.
- **Safety**: Still subject to safety tiers and policy gates configured in the kernel.

## 4. UI Requirements
- **Visual Distinction**: The Operator Console uses a "Verbatim Output" style, while the Terminal is a standard interactive prompt.
- **Mandatory Banner**: "Connected to IO Runner — all commands are logged."
- **Context Awareness**: Terminal commands are aware of the active capsule and workspace root.
