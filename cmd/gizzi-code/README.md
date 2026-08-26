# gizzi-code

AI-powered terminal interface for the Allternit ecosystem. `gizzi-code` (binary name `gizzi`) is the production CLI used to chat with agents, run tools, manage sessions, and connect to model providers from the terminal.

## Stack

- **Runtime:** [Bun](https://bun.sh) (v1.3+)
- **TUI:** React + Ink-based renderer (`src/cli/ui/ink-app`)
- **Protocol support:** MCP (Model Context Protocol), ACP (Agent Client Protocol)
- **Language:** TypeScript

## Development

```bash
# Install dependencies
bun install

# Run the CLI in dev mode
bun run dev

# Run the test suite (isolated, uses test/fixtures for model data)
bun test

# Type-check
bun run typecheck

# Build production binary for the current platform
bun run build

# Build for all platforms
bun run build --all
```

The production build produces `dist/gizzi-code-<platform>-<arch>` and a platform-specific symlink at `dist/gizzi-code`.

## Usage

```bash
# Start the interactive TUI in the current project
gizzi

# Run a single prompt and exit
gizzi run "explain this codebase"

# Execute non-interactively
gizzi exec "write a test for src/util.ts"

# Connect a model provider
gizzi auth login --provider openai

# Connect to a self-hosted / enterprise endpoint
gizzi auth login --provider openai --base-url https://api.example.com/v1

# List available models
gizzi models

# Run with a named permission profile
gizzi exec --permission-profile ci "refactor src/util.ts"

# Manage MCP servers
gizzi mcp list

# Start the ACP server
gizzi acp
```

Run `gizzi --help` for the full command list.

## Project layout

| Path | Purpose |
|------|---------|
| `src/cli/main.ts` | CLI entrypoint and yargs command registration |
| `src/cli/ui/ink-app` | Interactive TUI and background worker |
| `src/runtime/session` | Session lifecycle, messages, prompts |
| `src/runtime/tools/builtins` | Built-in tools (read, edit, bash, grep, etc.) |
| `src/runtime/providers` | Model provider discovery and adapters |
| `src/runtime/integrations/acp` | Agent Client Protocol server integration |
| `src/runtime/server` | Headless HTTP/ACP server |
| `test/` | Bun test suite |
| `script/build-production.js` | Cross-platform `bun build --compile` pipeline |

## Important conventions

- Tests are isolated via `script/test.sh` with temporary XDG directories and `GIZZI_TEST_ISOLATED_CONFIG=1`.
- `GIZZI_MODELS_PATH` points at `test/tool/fixtures/models-api.json` during tests so provider discovery does not hit the network.
- Do not use dynamic `import("@/...")` strings in code that runs inside the compiled binary; the bundler cannot resolve them at runtime.
- All workspace `@allternit/*` packages are resolved to their source at build time in `script/build-production.js`.

## Recently cleaned up

- Removed the unused `superpowers` bundled MCP server stub and its plugin registry entry.
- Removed dead command files that referenced missing packages (`allternit-capsules`, `allternit-vms`, `allternit-plugins`, `allternit-sessions`, `commit-claude`).
- Removed duplicate Vitest-only verification tests under `src/runtime/verification/__tests__/`; the canonical Bun tests live in `test/`.
