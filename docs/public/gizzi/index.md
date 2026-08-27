# gizzi-code

`gizzi-code` is the unified CLI brand for the Allternit agentic runtime. It is
distributed as the `gizzi` executable and is the same engine that powers the
platform web/desktop surfaces and the iOS agent bridge.

> Do not refer to this surface as the "Allternit CLI" in user-facing copy. The
> product name is **gizzi-code**; the binary name is **gizzi**.

## Installation

In the monorepo:

```bash
bun run --cwd cmd/gizzi-code build
./cmd/gizzi-code/dist/gizzi --version
```

Or install from the published package:

```bash
npm install -g @allternit/gizzi-code
```

Configuration lives in `~/.config/gizzi-code/config.toml` by default.

## Authentication

### Sign in with an API key

```bash
gizzi auth login --api-key $ANTHROPIC_API_KEY --provider anthropic --profile work
```

If `--api-key` is omitted, the CLI prompts for the key interactively. The key is
stored according to `auth.credential_store` in `config.toml` (`file`, `keyring`,
or `auto`).

### Check authentication state

```bash
gizzi auth status
```

Output is one of:

- `Authenticated via OAuth token`
- `Authenticated via API key: <profile>`
- `Not authenticated`

### Manage authentication profiles

```bash
gizzi auth profile list
gizzi auth profile add local --provider openai-compatible --base-url http://localhost:11434/v1
gizzi auth profile set-active work
gizzi auth profile remove local
```

Each profile stores a provider, optional API key, `api_key_env` reference, and
`base_url`. The first profile created becomes the active profile automatically.

## Configuration profiles

`gizzi config profile` manages named **permission profiles** in
`config.toml`. These profiles define default approval rules that are merged into
the active permission set on startup.

```bash
gizzi config profile list
gizzi config profile add strict --rule bash=ask --rule edit=ask
gizzi config profile set-active strict
gizzi config profile remove strict
```

See [`configuration.md`](./configuration.md) for the full `config.toml`
reference.

## Headless execution

`gizzi exec` is a pipe-safe alias for `gizzi run` that prints the response and
exits without launching the TUI.

```bash
# Single prompt
echo "Explain this diff" | git diff | gizzi exec

# Explicit command
gizzi exec "Write a commit message for the staged changes"

# JSON event stream for automation
gizzi exec --output-format stream-json "Summarize README.md"
```

Under the hood, `exec` sets `--print`, defaults `--output-format` to `text`,
and uses the `dontAsk` permission mode so it can run unattended in CI scripts.

## Credential store

The `auth.credential_store` setting controls where secrets are persisted:

| Store   | Behavior                                                              |
| ------- | --------------------------------------------------------------------- |
| `file`  | Secrets are written inline in `config.toml` under the auth profile.   |
| `keyring` | Secrets are delegated to the OS keyring via a pluggable backend.    |
| `auto`  | Prefer keyring; fall back to `file` if no keyring backend is available. |

`file` is the default. The `config.toml` file is created with `0o600` permissions
when auth profiles are written.
