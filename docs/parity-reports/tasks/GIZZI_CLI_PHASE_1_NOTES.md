---
status: done
files_changed:
  - cmd/gizzi-code/src/config/profiles.ts
  - cmd/gizzi-code/src/config/permissionProfiles.ts
  - cmd/gizzi-code/src/config/syntaxTheme.ts
  - cmd/gizzi-code/src/context/guidance.ts
  - cmd/gizzi-code/src/cli/ci.ts
  - cmd/gizzi-code/src/cli/commands/profile/index.ts
  - cmd/gizzi-code/src/cli/commands/permission-profile/index.ts
  - cmd/gizzi-code/src/cli/commands/completions/index.ts
  - cmd/gizzi-code/src/cli/commands/remote/index.ts
  - cmd/gizzi-code/src/cli/main.ts
  - cmd/gizzi-code/src/cli/ui/index.ts
blockers: []
---

# Gizzi Code CLI Surfaces — Phase 1 Notes

## Summary

All 7 items from the Swarm D parity track have been implemented as new modules and CLI commands in the Gizzi Code codebase.

## D3: Config Profiles ✅

**Files:** `src/config/profiles.ts`, `src/cli/commands/profile/`

Named configuration profiles across three scopes: `user` (global, in `~/.config/gizzi/profiles/`), `project` (in `.gizzi/profiles/`), and `ci` (in `.gizzi/ci/`). Each scope has an index file tracking the active profile and available entries.

**CLI:** `gizzi profile list|save|activate|deactivate|delete|show`

**Integration:** The `ConfigProfiles` namespace provides `autoDetectCI()` which activates a "ci" profile automatically when CI environment variables are detected. The `mergeProfileConfig()` function uses the same deep-merge semantics as the main config system.

## D4: Filesystem Permission Profiles ✅

**Files:** `src/config/permissionProfiles.ts`, `src/cli/commands/permission-profile/`

Standalone permission profile files that extend the existing inline `permission_profiles` config field. Profiles are stored as JSON files in `~/.config/gizzi/permission-profiles/` (user) or `.gizzi/permission-profiles/` (project).

**Built-in presets:** `read-only`, `developer`, `ci-safe`, `restricted` — each with pre-defined permission rules and optional sandbox settings.

**CLI:** `gizzi permission-profile list|show|activate|deactivate|save|delete|presets`

**Integration:** `PermissionProfiles.getEffective()` resolves the active profile across env var (`GIZZI_PERMISSION_PROFILE`), project marker, and user marker. `toRuleset()` converts profiles into `PermissionNext.Ruleset` format for the existing permission engine.

## D5: AGENTS.md / SKILL.md Guidance Discovery ✅

**File:** `src/context/guidance.ts`

Automatically discovers and loads project guidance files from the workspace tree:
- `AGENTS.md`, `SKILL.md`, `QWEN.md`, `CLAUDE.md`, `.cursorrules`
- `.gizzi/instructions.md`, `.gizzi/guidance.md`
- Parent directories up to git root
- `GIZZI_INSTRUCTIONS` env var

**Integration:** `Guidance.discover()` returns all found files with source metadata. `Guidance.buildContext()` concatenates them with section headers matching the existing context pack format. `Guidance.load()` is a convenience one-liner.

## D6: Shell Completions ✅

**File:** `src/cli/commands/completions/`

Generates completion scripts for bash, zsh, and fish with full subcommand awareness for all top-level commands and key subcommands (profile, permission-profile, theme, session, auth, completions).

**CLI:** `gizzi completions bash|zsh|fish|install`

The `install` action auto-detects the user's shell and writes completions to the appropriate location (`~/.bashrc`, `~/.zsh/completions/_gizzi`, `~/.config/fish/completions/gizzi.fish`).

## D7: Syntax Themes ✅

**File:** `src/config/syntaxTheme.ts`

Defines 16 syntax highlighting tokens (keyword, string, number, comment, function, type, operator, variable, property, tag, attribute, punctuation, builtin, constant, regexp, decorator) with built-in dark and light palettes based on the Allternit brand colors.

**Features:**
- `deriveFromTheme()` — generates syntax tokens from any theme's palette
- `toAnsi()` — converts hex tokens to ANSI 24-bit escape codes for terminal rendering
- `merge()` — allows user overrides on top of built-in defaults

## D8: CI Mode ✅

**File:** `src/cli/ci.ts`

Non-interactive CI mode activated via `--ci` flag or auto-detected from CI environment variables (GitHub Actions, GitLab CI, Buildkite, CircleCI, Jenkins, Azure DevOps, Drone, Travis).

**Features:**
- Three output formats: `ndjson` (machine-readable), `text` (human-readable), `markdown`
- Deterministic exit codes: 0=success, 1=runtime, 2=permission, 3=config, 4=provider, 5=timeout
- Structured event emission: `CIMode.emit()`, `CIMode.progress()`, `CIMode.exitWithResult()`
- Auto-sets `acceptEdits` permission mode for unattended operation

**CLI flags:** `--ci`, `--ci-format ndjson|text|markdown`

## D10: Remote Mode ✅

**File:** `src/cli/commands/remote/`

Self-hosted runner management with connection testing, session listing, and log streaming.

**CLI:** `gizzi remote list|connect|setup|status|test|logs|config`

**Features:**
- `RemoteConfig` namespace for persistent config in `~/.config/gizzi/remote.json`
- Environment variable overrides (`GIZZI_REMOTE_URL`, `GIZZI_REMOTE_TOKEN`)
- Health check with latency measurement
- Session listing via REST API
- Log streaming via chunked HTTP response

## Additional Changes

- **`src/cli/ui/index.ts`** — Added `UI.info()`, `UI.success()`, `UI.warn()` methods to the UI namespace for consistent CLI output formatting.
- **`src/cli/main.ts`** — Registered all 4 new commands (`ProfileCommand`, `PermissionProfileCommand`, `CompletionsCommand`, `RemoteCommand`) and added CI mode activation in the middleware.

## Phase 2 Remaining Work

1. **Guidance integration:** Wire `Guidance.load()` into the session context builder so AGENTS.md/SKILL.md content is automatically injected at session start.
2. **CI mode + StructuredIO:** Connect `CIMode` events to the `StructuredIO` protocol for proper non-interactive session output.
3. **Remote WebSocket:** Integrate the `RemoteCommand.connect` action with the existing `RemoteSessionManager` for full interactive remote sessions.
4. **Profile activation in config state:** Wire `ConfigProfiles.getActive()` into the `Config.state()` initialization so active profiles are merged before agent execution.
5. **Permission profile integration:** Wire `PermissionProfiles.getEffective()` into the permission evaluation chain so file-based profiles compose with inline rules.
