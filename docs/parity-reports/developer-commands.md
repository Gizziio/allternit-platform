---
status: done
files_changed:
  - docs/public/parity/developer-commands.md
  - docs/parity-reports/developer-commands.md
items_covered:
  - Archive the current session with `/archive`
  - Ask for a working tree review with `/review`
  - Assign a key binding
  - Browse apps with `/apps`
  - Browse plugins with `/plugins`
  - Check background terminals with `/ps`
  - Choose a syntax theme with `/theme`
  - Choose a terminal pet with `/pets`
  - Clear the terminal and start a new chat with `/clear`
  - Command details
  - Command overview
  - Configure footer items with `/statusline`
  - Configure memories with `/memories`
  - Configure terminal title items with `/title`
  - Copy the latest response with `/copy`
  - Delete the current session with `/delete`
  - Developer commands
  - Exit the CLI with `/quit` or `/exit`
  - Flag combinations and safety tips
  - Fork the current chat with `/fork`
  - Global flags
  - Grant sandbox read access with `/sandbox-add-read-dir`
  - Highlight files with `/mention`
  - How to read this reference
  - Include IDE context with `/ide`
  - Inspect config layers with `/debug-config`
  - Inspect the session with `/status`
  - Interactive shortcuts
  - Keep transcripts lean with `/compact`
  - List MCP tools with `/mcp`
  - Related resources
  - Remap TUI shortcuts with `/keymap`
  - Rename the current chat with `/rename`
  - Resume a saved chat with `/resume`
  - Review changes with `/diff`
  - Send feedback with `/feedback`
  - Set a communication style with `/personality`
  - Set or view a task goal with `/goal`
  - Set up the elevated Windows sandbox with `/setup-default-sandbox`
  - Sign out with `/logout`
  - Start a new chat with `/new`
  - Start a side chat with `/side`
  - Stop background terminals with `/stop`
  - Switch agent threads with `/agent`
  - Switch to plan mode with `/plan`
  - Toggle Fast mode with `/fast`
  - Toggle Vim mode with `/vim`
  - Toggle experimental features with `/experimental`
  - Toggle raw scrollback with `/raw`
  - Update permissions with `/permissions`
  - Use a slash command
  - View account usage with `/usage`
  - View and manage lifecycle hooks with `/hooks`
items_missing:
  - "`/pets`: cosmetic feature is not implemented and is not required for self-host/BYOC operation"
  - "`/side`: no side-chat command; `/fork` and agent subthreads are the current alternatives"
  - "`/raw`: no raw-scrollback compatibility toggle"
  - "`/setup-default-sandbox`: Codex-specific Windows bootstrap does not map to Allternit's isolation model"
notes: "Docs-only change; no build was run. Exact slash commands are distinguished from API/CLI alternatives and roadmap items."
---

# Developer commands parity report

Created a single Allternit-branded reference covering all 54 assigned handoff
items. The page documents the interactive command palette, exact built-in
commands, launch flags, configurable keybindings, session and MCP HTTP examples,
and safety guidance. Hosted-product ergonomics that do not have exact Allternit
commands are mapped to the closest self-hosted CLI/API workflow and labeled
clearly; genuine non-equivalents remain listed in `items_missing` above.
