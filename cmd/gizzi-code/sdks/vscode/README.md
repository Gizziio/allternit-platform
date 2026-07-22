# Gizzi Code for VS Code

This extension runs the local Gizzi Code CLI in an editor terminal and connects editor context to the active session.

## Features

- `Cmd/Ctrl+Esc` focuses the current Gizzi terminal or creates one.
- `Cmd/Ctrl+Shift+Esc` creates an independent session.
- `Cmd+Option+K` / `Ctrl+Alt+K` inserts the active file and selected line range as an `@file#Lx-Ly` reference.
- A status-bar item reports bridge startup and reconnect failures.
- `Gizzi Code: Reconnect` replaces stale extension terminals with a fresh bridge.
- Workspace-aware launch directories, remote-workspace support, logs, and `vscode://` deep links.

The extension preserves the old `opencode.*` command identifiers as upgrade aliases, but new configuration and menus use `gizzi.*`.

## Prerequisite

Install the `gizzi` CLI and authenticate it. If the executable is not on VS Code's PATH, set `gizzi.cliPath` to its absolute path.

## Development

Open this directory directly in VS Code and press `F5`. Packaging and typechecking are intentionally separate from ordinary source edits.
