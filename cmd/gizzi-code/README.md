# Gizzi Code

AI-powered terminal coding agent for the Allternit ecosystem. Gizzi Code runs
locally, speaks to the LLM provider you configure, and integrates with the
Allternit platform (cloud auth, cowork runs, rails mail, the `alt_` API-key
ecosystem) when you connect it.

## Install

**macOS / Linux:**
```bash
curl -fsSL https://install.gizziio.com/install | bash
```

**Windows (PowerShell):**
```powershell
irm https://install.gizziio.com/install.ps1 | iex
```
PE32+ x64 zip with `checksums.txt` verification. Credentials are stored
via Windows DPAPI (CurrentUser). ARM64 Windows runs the x64 build under
emulation.

**Homebrew (macOS / Linux):**
```bash
brew tap Gizziio/tap
brew install gizzi-code
```

**Scoop / winget (Windows):**
```powershell
scoop bucket add gizziio https://github.com/Gizziio/scoop-bucket
scoop install gizzi-code
winget install Allternit.GizziCode
```

**npm (canonical, all platforms):**
```bash
npm install -g @allternit/gizzi-code
```

Or grab a prebuilt binary from the
[releases page](https://github.com/Gizziio/allternit-platform/releases)
(assets `gizzi-code-v<version>-<target>.tar.gz` / `.zip`; tags
`gizzi-code/v<version>`). The repo installer also works without waiting
for install.gizziio.com:

```bash
curl -fsSL https://raw.githubusercontent.com/Gizziio/allternit-platform/main/cmd/gizzi-code/install | bash
```

## Platform support

| Platform | Status |
|---|---|
| macOS | Primary target; signed & notarized builds planned |
| Linux | Supported |
| Windows | Supported — PE32+ x64 zip; credentials stored with DPAPI (CurrentUser). ARM64 uses the x64 build under emulation |

## Quick start

```bash
gizzi                    # interactive session
gizzi exec "fix the failing tests"   # one-shot, non-interactive
gizzi serve              # local HTTP/WebSocket server (opt-in)
gizzi api-keys list      # manage Allternit platform tokens
gizzi doctor             # updater + environment health
gizzi --help             # everything else
```

## Configuration

- Provider keys: `ALLTERNIT_API_KEY` for first-party Allternit, plus
  standard provider env vars (`OPENAI_API_KEY`, …) or an auth profile in
  `~/.config/gizzi-code/config.toml`.
- Platform token: `gizzi api-keys set allternit alt_...` (durable scoped keys)
  or run the login flow (`gizzi org status` will point you at it when missing).
- Env overrides: `ALLTERNIT_API_URL`, `GIZZI_PLATFORM_API_URL`,
  `GIZZI_CLERK_ISSUER` — defaults live in `src/shared/constants/cloudUrls.ts`
  and `allternitGateway.ts`.

## Development

```bash
pnpm install                 # from the repo root (pnpm monorepo)
cd cmd/gizzi-code
bun run dev                  # run from source
bun run typecheck            # tsc --noEmit (builds packages/sdk dist first)
bash script/ci-smoke-test.sh # empirically-green test subset
bun run build                # production binary -> dist/gizzi-code
```

## Repository layout

This package lives at `cmd/gizzi-code` inside the
[Gizziio/allternit-platform](https://github.com/Gizziio/allternit-platform)
monorepo. Platform services it talks to: `cmd/allternit-cloud-api` (public
cloud API, api.allternit.com) and `cmd/allternit-api` (local gateway backend,
loopback-only today — see `reports/2026-09-04-backend-b-deploy-decision.md`).

## Security

See [SECURITY.md](./SECURITY.md). Server mode is opt-in and unauthenticated
without `GIZZI_SERVER_PASSWORD`; the permission system is a UX feature, not a
sandbox.

## Telemetry

Usage telemetry is on by default, anonymous, and never includes prompts,
file contents, or credentials. Disable it with `gizzi config telemetry off`
or `GIZZI_TELEMETRY=off`. Full field-level inventory: [docs/telemetry.md](./docs/telemetry.md).

## License

MIT
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
