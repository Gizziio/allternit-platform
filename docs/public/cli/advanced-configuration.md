# Advanced configuration

`gizzi-code` is configured through layered `config.toml` files, environment variables, and CLI flags. This page covers the advanced configuration options that control permissions, sandboxing, project discovery, the TUI, and one-off CLI overrides.

## Approval policies and sandbox modes

`gizzi-code` uses an approval policy to decide when the agent must ask before running a tool. The policy can be set globally in config, per project, or overridden from the CLI.

### Sandbox presets

The `sandbox` section lets you choose a preset that fills in safe defaults:

```toml
[sandbox]
mode = "read-only"        # "read-only" | "workspace-write" | "danger-full-access"
allow_network = false
allowed_domains = ["api.github.com"]
```

- `read-only`: the agent can read files but cannot write to disk.
- `workspace-write`: the agent can write inside the project workspace but not outside it.
- `danger-full-access`: no sandbox restrictions. Use only in trusted, isolated environments.

### Approval policy DSL

For finer control, use `approval_policy`:

```toml
[approval_policy]
mode = "granular"

[[approval_policy.rules]]
permission = "bash"
pattern = "*"
action = "ask"

[[approval_policy.rules]]
permission = "file.write"
pattern = "*.md"
action = "allow"
```

Allowed actions are `allow`, `deny`, and `ask`. Rules are evaluated in order; the first match wins.

## Project root detection

`gizzi-code` discovers the project root by scanning upward from the current working directory for any of:

- a `.gizzi/` directory
- a `gizzi.json` or `gizzi.jsonc` file
- a `config.toml` in a `.gizzi/` directory

Project-level configuration overrides global user configuration. To see which files were loaded, run:

```bash
gizzi config list --sources
```

## Project instructions discovery

You can add custom instruction files that are included automatically for every session in a project.

```toml
# .gizzi/config.toml or project-level gizzi.json
instructions = [".gizzi/INSTRUCTIONS.md", "docs/CODING_GUIDELINES.md"]
```

Paths are resolved relative to the project root. Instructions are merged with any global instructions and system defaults.

## TUI options

The TUI section controls scroll behavior and diff rendering:

```toml
[tui]
scroll_speed = 1.0

[tui.scroll_acceleration]
enabled = true

diff_style = "auto"   # "auto" | "stacked"
```

### Keybindings

Keyboard shortcuts are also configurable under `keybinds`:

```toml
[keybinds]
terminal_title_toggle = "ctrl+t"
tips_toggle = "<leader>h"
display_thinking = "ctrl+o"
display_runtime_trace = "ctrl+r"
```

Run `gizzi config keybinds` to see the full list of bindable actions and their defaults.

## One-off overrides from the CLI

Many config options can be overridden for a single invocation without editing files.

```bash
# Use a different model
gizzi --model anthropic/claude-4 "review this PR"

# Change reasoning effort
 gizzi --variant high "design this system"

# Use a restrictive permission mode
 gizzi --permission-mode ask "refactor this file"

# Skip permissions (dangerous; use only in isolated environments)
 gizzi --dangerously-skip-permissions "run the benchmark"

# Allow only specific tools
 gizzi --allowedTools bash,file.read "debug this test"

# Specify a fallback model
 gizzi --fallback-model openai/gpt-5 "analyze this log"
```

CLI flags take precedence over project config, which takes precedence over global user config.

## Environment variable overrides

A subset of settings can also be controlled through environment variables:

| Variable | Effect |
|---|---|
| `GIZZI_CONFIG` | Path to a specific config file to load. |
| `GIZZI_CONFIG_CONTENT` | Inline TOML config content. Highest precedence after managed config. |
| `GIZZI_PERMISSION` | Override the active permission profile. |
| `DISABLE_TELEMETRY` | Disable analytics and feedback surveys. |
| `GIZZI_DISABLE_NONESSENTIAL_TRAFFIC` | Disable auto-updates, release notes fetching, and other nonessential network traffic. |

## Configuration precedence

From lowest to highest precedence:

1. Remote `.well-known/gizzi` defaults
2. Global user config (`~/.config/gizzi/config.toml`)
3. Custom config path (`GIZZI_CONFIG`)
4. Project config (`.gizzi/config.toml` or `gizzi.json`)
5. `.gizzi/` directory overrides
6. Inline config (`GIZZI_CONFIG_CONTENT`)
7. Managed config directory (`/Library/Application Support/gizzi` on macOS, `/etc/gizzi` on Linux, `C:\ProgramData\gizzi` on Windows) — enterprise only, always wins
8. CLI flags and environment variables where supported

## Related pages

- [Config and state locations](./config-locations.md)
- [Permission profiles](./permission-profiles.md)
- [History persistence](./history-persistence.md)
- [Named permission profiles](./permission-profiles.md)
