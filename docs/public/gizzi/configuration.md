# `config.toml` reference

`gizzi` reads user-level configuration from
`~/.config/gizzi-code/config.toml`. Project-level overrides can be added via
`.gizzi/config.toml`, `gizzi.json`, or `gizzi.jsonc` in the project tree.

## Top-level fields

```toml
default_model = "anthropic/claude-sonnet-4"
```

| Field           | Type   | Description                                              |
| --------------- | ------ | -------------------------------------------------------- |
| `default_model` | string | Provider/model identifier used when no model is specified. |

## Authentication profiles

```toml
[auth]
active_profile = "work"
credential_store = "auto"

[auth.profiles.work]
provider = "anthropic"
api_key_env = "ANTHROPIC_API_KEY"

[auth.profiles.local]
provider = "openai-compatible"
base_url = "http://localhost:11434/v1"
```

| Field                        | Type   | Description                                                                            |
| ---------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `auth.active_profile`        | string | Name of the profile used by default.                                                   |
| `auth.credential_store`      | string | `file`, `keyring`, or `auto`.                                                          |
| `auth.profiles.<name>.provider` | string | Provider id (e.g., `anthropic`, `openai`, `openai-compatible`).                       |
| `auth.profiles.<name>.api_key`  | string | Inline API key. Use `api_key_env` instead when possible.                              |
| `auth.profiles.<name>.api_key_env` | string | Environment variable that holds the API key.                                         |
| `auth.profiles.<name>.base_url`   | string | Custom provider base URL.                                                             |

## Sandbox preferences

```toml
[sandbox]
enabled = true
allow_network = false
allowed_domains = ["registry.npmjs.org"]
```

| Field             | Type       | Description                                                      |
| ----------------- | ---------- | ---------------------------------------------------------------- |
| `enabled`         | boolean    | Whether the Bash tool runs inside the sandbox wrapper.           |
| `allow_network`   | boolean    | Allow network access inside the sandbox.                         |
| `allowed_domains` | string[]   | Allow-listed domains when network is disabled.                   |

### Sandbox presets

Instead of setting `enabled` and `allow_network` directly, you can use a preset:

```toml
[sandbox]
mode = "read-only"
```

| Preset                | `enabled` | `allow_network` | Description                                    |
| --------------------- | --------- | --------------- | ---------------------------------------------- |
| `read-only`           | `true`    | `false`         | Read-only filesystem, no network.              |
| `workspace-write`     | `true`    | `false`         | Writes allowed inside workspace, no network.   |
| `danger-full-access`  | `false`   | `true`          | No sandbox, full network access.               |

Explicit `enabled`, `allow_network`, or `allowed_domains` values always override
preset defaults.

## Named permission profiles

```toml
[permission_profiles]
active_profile = "strict"

[permission_profiles.profiles.strict.rules]
bash = "ask"
edit = "ask"
webfetch = "deny"

[permission_profiles.profiles.relaxed.rules]
bash = "allow"
edit = "allow"
```

| Field                                   | Type   | Description                                             |
| --------------------------------------- | ------ | ------------------------------------------------------- |
| `permission_profiles.active_profile`    | string | Name of the profile whose rules are applied by default. |
| `permission_profiles.profiles.<name>.rules.<tool>` | string | One of `ask`, `allow`, or `deny`.            |

The active profile is merged into the runtime permission set before any explicit
`[permission]` block; explicit rules always win.

Common permission keys include `read`, `edit`, `glob`, `grep`, `list`, `bash`,
`task`, `webfetch`, `websearch`, `codesearch`, `lsp`, `skill`, and the wildcard
`*`.

## Approval policy

`approval_policy` provides a higher-level way to set the default permission
 posture. It is applied before named permission profiles and explicit
`[permission]` rules.

```toml
[approval_policy]
mode = "on-request"

[approval_policy.granular]
sandbox_approval = true
skill_approval = true
web_search = "live"
```

### Modes

| Mode          | Default action | Description                                              |
| ------------- | -------------- | -------------------------------------------------------- |
| `untrusted`   | `ask`          | Ask before every tool use.                               |
| `on-request`  | `ask`          | Ask for operations the model explicitly requests.        |
| `on-failure`  | `allow`        | Allow by default, ask only after a failure.              |
| `never`       | `allow`        | Allow all tool use without approval.                     |
| `granular`    | from rules     | Use the `granular` block for per-category control.       |

### Granular overrides

```toml
[approval_policy.granular]
sandbox_approval = true   # bash requires approval
skill_approval = true     # skills require approval
web_search = "live"       # or "disabled"

[approval_policy.granular.rules]
edit = "ask"
bash = "allow"
```

| Field                | Type              | Description                                            |
| -------------------- | ----------------- | ------------------------------------------------------ |
| `sandbox_approval`   | boolean           | When `true`, maps the `bash` permission to `ask`.      |
| `skill_approval`     | boolean           | When `true`, maps the `skill` permission to `ask`.     |
| `web_search`         | `live` / `disabled` | When `live`, maps `websearch` to `allow`; otherwise `deny`. |
| `rules`              | permission object | Per-tool rules using the same shape as `[permission]`. |

## Loading order

Configuration is merged from lowest to highest precedence:

1. Remote `.well-known/gizzi` (org defaults)
2. Global user config (`~/.config/gizzi-code/*`)
3. `GIZZI_CONFIG` path override
4. Project config (`config.toml`, `gizzi.jsonc`, `gizzi.json`)
5. `.gizzi/` directory config and local plugins
6. `GIZZI_CONFIG_CONTENT` inline config
7. Managed enterprise config (`/Library/Application Support/gizzi`, `/etc/gizzi`, etc.)

Higher-precedence sources override lower ones. Arrays such as `plugin` and
`instructions` are concatenated and deduplicated rather than replaced.
