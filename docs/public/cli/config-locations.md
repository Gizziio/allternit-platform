# Config and state locations

The `gizzi-code` CLI stores configuration, credentials, logs, caches, and session
history in a small set of well-known directories. This page describes the default
locations on macOS, Linux, and Windows, how XDG paths and managed directories are
resolved, and which environment variables override them.

## Default user data directory

`gizzi` resolves a single per-user home directory — referred to as `GIZZI_HOME`
— and places most runtime files underneath it. The default path depends on the
operating system.

| OS | Default `GIZZI_HOME` | Notes |
|---|---|---|
| macOS | `~/.gizzi` | Used unless `GIZZI_HOME` or XDG variables are set. |
| Linux | `~/.gizzi` | Honours `XDG_DATA_HOME` for data/state and `XDG_CONFIG_HOME` for config when those variables are present. |
| Windows | `%USERPROFILE%\.gizzi` | Typically resolves to `C:\Users\<user>\.gizzi`. |

You can inspect the resolved home path at any time:

```bash
gizzi config path
```

Example output:

```text
/home/alice/.gizzi
```

## XDG paths on Linux

On Linux, `gizzi` respects the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)
when the relevant environment variables are exported:

| Purpose | Environment variable | Default fallback | Typical resolved path |
|---|---|---|---|
| Configuration | `XDG_CONFIG_HOME` | `~/.config` | `~/.config/gizzi-code` |
| Data / state | `XDG_DATA_HOME` | `~/.local/share` | `~/.local/share/gizzi-code` |
| Cache | `XDG_CACHE_HOME` | `~/.cache` | `~/.cache/gizzi-code` |
| Logs | `XDG_STATE_HOME` | `~/.local/state` | `~/.local/state/gizzi-code` |

When XDG variables are present, `gizzi` maps files to those roots instead of
putting everything under `~/.gizzi`. For example:

```bash
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_CACHE_HOME="$HOME/.cache"
export XDG_STATE_HOME="$HOME/.local/state"

gizzi config path
# -> /home/alice/.config/gizzi-code
```

If only some XDG variables are set, the remaining files fall back to their XDG
defaults rather than `~/.gizzi`.

## Files and subdirectories

Regardless of the exact root, `gizzi` organises files under the following
subdirectories:

| Path | Description |
|---|---|
| `config.toml` | Your local configuration file. Located directly under the config root (`~/.gizzi/config.toml` or `~/.config/gizzi-code/config.toml` when XDG is active). |
| `auth.json` | File-based credential storage, created when `auth.credential_store = "file"`. When set to `keyring` or `auto`, credentials are stored in the OS keychain instead. |
| `history.jsonl` | Local session transcript history, written when `[history].persistence` is enabled. |
| `logs/` | Structured runtime logs and crash reports. |
| `cache/` | Remote model lists, downloaded assets, and other transient caches. Safe to delete; `gizzi` will recreate it. |
| `sessions/` | Active and recently closed session state used by the interactive TUI. |
| `skills/` | Cached or user-installed local skill definitions. |
| `profiles/` | Optional profile-specific config overlays such as `profiles/work.config.toml`. |

A typical macOS or Linux layout looks like this:

```text
~/.gizzi/
├── config.toml
├── auth.json
├── history.jsonl
├── logs/
│   └── gizzi-2026-08-10.log
├── cache/
│   └── model-cache.json
├── sessions/
│   └── last-session.json
├── skills/
│   └── local-skill/
│       └── SKILL.md
└── profiles/
    └── work.config.toml
```

## Environment overrides

You can redirect `gizzi`'s data and configuration roots with environment
variables. These are evaluated before any config file is loaded.

| Variable | Effect |
|---|---|
| `GIZZI_HOME` | Overrides the entire per-user home directory. All config, state, logs, and cache files are placed under this path. |
| `GIZZI_CONFIG` | Path to a specific `config.toml` file to load instead of the user-level default. |
| `GIZZI_CONFIG_CONTENT` | Inline TOML content that is merged as a high-precedence configuration layer. Useful for CI and ephemeral environments. |
| `XDG_CONFIG_HOME` | Linux only: relocates configuration files. |
| `XDG_DATA_HOME` | Linux only: relocates data and state files. |
| `XDG_CACHE_HOME` | Linux only: relocates cache files. |
| `XDG_STATE_HOME` | Linux only: relocates log files. |

### Examples

Run with a portable home directory on a USB drive or shared runner:

```bash
export GIZZI_HOME=/mnt/shared/gizzi-home
gizzi
```

Use a checked-in team config for a single invocation:

```bash
GIZZI_CONFIG=/etc/gizzi/team.config.toml gizzi exec "review this change"
```

Provide an entire config inline for a CI job:

```bash
export GIZZI_CONFIG_CONTENT='
default_model = "anthropic/claude-sonnet-4"

[sandbox]
enabled = true
allow_network = false
'
gizzi exec --no-interactive "run the tests"
```

## Managed config directory

For organisation-wide defaults, administrators can place managed configuration
files in system directories. These are loaded with lower precedence than user and
project config, so local settings can still override them.

| OS | Managed config directory |
|---|---|
| macOS | `/Library/Application Support/gizzi` |
| Linux | `/etc/gizzi` |
| Windows | `%ProgramData%\gizzi` |

A managed config might enforce a default model or permission posture:

```toml
# /etc/gizzi/config.toml

[approval_policy]
mode = "on-request"

[permission_profiles.profiles.team.rules]
bash = "ask"
edit = "allow"
```

Managed directories can also be used to distribute shared skills or profile
templates. Users cannot write to these locations without administrator rights,
which prevents accidental changes to enforced defaults.

## Project-level config

In addition to user and managed config, `gizzi` reads project-scoped overrides
from files inside the working tree. Relative paths in a project config are
resolved against the directory that contains the config file.

| File | Purpose |
|---|---|
| `.gizzi/config.toml` | Primary project-level configuration override. |
| `gizzi.json` / `gizzi.jsonc` | Alternative JSON/JSONC project config formats. |

Project config is loaded only when the project is trusted. For details, see the
[`config.toml` reference](../gizzi/configuration.md).

## Inspecting active locations

`gizzi` exposes a few CLI helpers to see where files are being read from.

```bash
# Show the resolved user data / config root
gizzi config path

# List the config files loaded for the current session
gizzi config list --sources

# Print the merged effective configuration
gizzi config show
```

Use these commands when debugging why a setting is not taking effect, or when
setting up a new machine.

## Security and cleanup

- Credentials are stored in the OS keychain by default when available. Use
  `gizzi auth status` to confirm the active credential store.
- The `cache/` directory can be deleted at any time to reclaim disk space.
- Session history can be disabled or capped:

```toml
# ~/.gizzi/config.toml
[history]
persistence = "none"
# or
max_bytes = 104857600  # 100 MiB
```

For authentication options, see [gizzi auth](./authentication.md). For the full list of
configuration keys, see the [`config.toml` reference](../gizzi/configuration.md).
