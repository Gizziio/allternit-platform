# Action Plan: Robust CLI Buildout

## Goal
Transform the `a2` CLI from a simple HTTP wrapper into a robust, modular, and user-friendly Agentic Interface.

## Key Improvements
1.  **Modular Architecture**: Split `main.rs` into dedicated command modules (`auth`, `model`, `run`, `capsule`, etc.) inside `apps/cli/src/commands/`.
2.  **Configuration Management**: Implement a persistent CLI config (`~/.a2/config.toml`) to store the Kernel URL, default output format, and user preferences.
3.  **TUI / Output Formatting**: Use `crossterm` or `ratatui` (or just styled `println!`) for better visual feedback (spinners, colors, tables).
4.  **Error Handling**: Standardized error reporting with actionable suggestions.
5.  **Interactive Mode**: A REPL mode (`a2 repl`) for continuous interaction with the Kernel without restarting the binary.

## Implementation Steps

### 1. Refactor `main.rs`
*   Move `Auth`, `Model`, `Run` commands to separate files in `src/commands/`.
*   Keep `main.rs` as the entry point that sets up the runtime and dispatches to subcommands.

### 2. Add New Command Modules
*   `src/commands/auth.rs`: Handle login/logout/status.
*   `src/commands/model.rs`: Handle listing/switching models.
*   `src/commands/run.rs`: Handle sending intents and displaying results.
*   `src/commands/repl.rs`: New interactive loop.

### 3. Shared Utilities
*   `src/client.rs`: A robust HTTP client wrapper with error handling and automatic auth header injection (if needed later).
*   `src/config.rs`: Load/Save CLI preferences.
*   `src/ui.rs`: Helper functions for spinners, tables, and colored output.

## Dependencies
*   Add `dialoguer` for interactive prompts.
*   Add `indicatif` for progress bars/spinners.
*   Add `colored` or `crossterm` for styling.
*   Add `tabled` for tabular output (model lists, etc).

## Affected Files
*   `apps/cli/Cargo.toml`
*   `apps/cli/src/main.rs`
*   `apps/cli/src/commands/*`
*   `apps/cli/src/client.rs` (New)
*   `apps/cli/src/config.rs` (New)
*   `apps/cli/src/ui.rs` (New)

## Verification
*   Build `a2` and run `a2 --help`.
*   Run `a2 auth login` and see an interactive prompt.
*   Run `a2 repl` and have a chat session.
