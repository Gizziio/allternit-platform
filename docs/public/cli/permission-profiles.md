# Permission profiles

Permission profiles let you save named security presets and switch between them from the `gizzi-code` CLI. A profile bundles a set of permission decisions — sandbox boundaries, network access, tool approvals, and more — so you can move quickly between restrictive and permissive modes without editing `config.toml` by hand.

For an overview of how permissions and approvals work together, see [Agent approvals and security](/docs/cli/agent-approvals-security). For the full configuration key list, see [Configuration reference](/docs/cli/config-reference).

---

## Built-in profiles

`gizzi-code` ships with a small set of built-in profiles that cover common workflows. Use `--profile <name>` to activate a profile for a single run.

```shell
# Interactive session with the trusted-review profile
gizzi --profile trusted-review

# One-off task with the restricted profile
gizzi exec --profile restricted "summarize README.md"
```

Built-in profiles are read-only. You can inspect them with `gizzi config permission-profiles show <name>`:

```shell
gizzi config permission-profiles show restricted
```

The exact list of built-ins can change between releases. Common examples include:

| Profile | Purpose |
| ------- | ------- |
| `restricted` | Filesystem and network access are blocked; every tool use requires approval. Good for untrusted code or sensitive repos. |
| `workspace-write` | The agent can write inside the current workspace, but network access is off by default. |
| `trusted-review` | Writes are allowed and selected tools can run without prompting, but network access still requires approval. |
| `danger-full-access` | Sandboxing is disabled. Use only when your environment already isolates processes. |

---

## Define a custom profile

Custom profiles live in `~/.gizzi/profiles/<profile-name>.toml`. Profile names can contain letters, numbers, hyphens, and underscores.

Create the directory if it does not exist:

```shell
mkdir -p ~/.gizzi/profiles
```

Then write a TOML file with the permissions you want:

```toml
# ~/.gizzi/profiles/deep-review.toml
[permissions]
approval_policy = "on-request"
sandbox_mode = "workspace-write"
network_access = false

[permissions.sandbox_workspace_write]
writable_roots = ["/Users/YOU/projects"]
exclude_tmpdir_env_var = false
exclude_slash_tmp = false
```

Keep each profile file self-contained. Use top-level keys inside the file; do not nest them under `[profiles.<name>]`.

### Profile overlay order

When you run `gizzi --profile <name>`, the CLI loads configuration in this order, with later layers overriding earlier ones:

1. `~/.gizzi/config.toml` (user defaults)
2. `~/.gizzi/profiles/<name>.toml` (named permission profile)
3. `.gizzi/config.toml` in the project tree (project overrides, if trusted)
4. CLI flags and `-c` / `--config` overrides

Because the profile is a layer above your base user config, it only needs to contain the values that differ from your defaults.

---

## Add a profile

Create a new profile file in `~/.gizzi/profiles/`:

```shell
gizzi config permission-profiles add untrusted-audit
```

This opens the profile in your default editor. Save a file such as:

```toml
# ~/.gizzi/profiles/untrusted-audit.toml
[permissions]
approval_policy = "never"
sandbox_mode = "workspace-write"
network_access = false
allow_login_shell = false

[permissions.sandbox_workspace_write]
writable_roots = []
```

You can also create the file directly with a text editor or by copying an existing profile:

```shell
cp ~/.gizzi/profiles/restricted.toml ~/.gizzi/profiles/untrusted-audit.toml
```

---

## Remove a profile

Delete the profile file or use the CLI:

```shell
gizzi config permission-profiles remove untrusted-audit
```

Built-in profiles cannot be removed.

---

## Set an active default profile

To use a profile by default without passing `--profile` every time, set it in your user config:

```toml
# ~/.gizzi/config.toml
active_permission_profile = "workspace-write"
```

You can still override the active profile for a single run:

```shell
gizzi --profile restricted
```

A CLI `--profile` flag always takes precedence over `active_permission_profile`.

---

## What permissions a profile controls

A permission profile can configure any of the following areas.

### Approval policy

Controls when `gizzi-code` pauses to ask for user approval.

```toml
[permissions]
approval_policy = "on-request"   # Options: untrusted, on-request, never, or granular
```

Use a granular policy when you want different behavior for different prompt categories:

```toml
[permissions]
approval_policy = { granular = {
  sandbox_approval = true,
  rules = true,
  tool_elicitations = true,
  request_permissions = false,
  skill_approval = false
} }
```

### Sandbox mode

Controls filesystem and process isolation.

```toml
[permissions]
sandbox_mode = "workspace-write"   # Options: workspace-write, restricted, danger-full-access
```

In `workspace-write` mode, the agent can write inside the workspace root. Some environments keep `.git/` and `.gizzi/` read-only even when the rest of the workspace is writable, so commands such as `git commit` may still require approval. To block specific commands automatically, add [rules](/docs/cli/rules).

### Network access

Controls outbound network access from inside the sandbox.

```toml
[permissions]
network_access = false

[permissions.sandbox_workspace_write]
network_access = true   # Opt in for workspace-write mode only
```

Set `network_access = true` only when the agent needs to fetch dependencies, call APIs, or browse the web.

### Writable roots

Limits where the agent can write files.

```toml
[permissions.sandbox_workspace_write]
writable_roots = ["/Users/YOU/projects/my-app", "/tmp/gizzi-work"]
```

Paths outside `writable_roots` are read-only. Relative paths are resolved against the workspace root.

### Tool permissions

Grant or deny access to specific tool categories.

```toml
[permissions.tools]
allow_bash = true
allow_filesystem_write = true
allow_network = false
allow_subagents = "on-request"
```

The exact tool keys match the names shown in `gizzi config tools list`. You can also scope permissions per skill or MCP server:

```toml
[permissions.tools.mcp.my_server]
allowed = ["read_document", "search_index"]
```

### Shell environment policy

Controls which environment variables are passed to spawned commands.

```toml
[permissions.shell_environment_policy]
inherit = "core"   # Options: none, core

[permissions.shell_environment_policy.filters]
"AWS_*" = "exclude"
"AZURE_*" = "exclude"
```

Start with `inherit = "none"` for the tightest control, or `inherit = "core"` to keep common variables such as `PATH` and `HOME`.

### Login shell hardening

Disable login shells for shell tools as an extra hardening step.

```toml
[permissions]
allow_login_shell = false
```

---

## One-off overrides

You can override any permission value for a single run without editing a profile file. Use `-c` / `--config` with dot-notation keys.

```shell
# Disable network access for this run only
gizzi --config permissions.network_access=false

# Use a granular approval policy inline
gizzi --config 'permissions.approval_policy={granular={sandbox_approval=true,skill_approval=false}}'
```

Values are parsed as TOML. Quote the value when your shell might split it on spaces.

---

## Inspect and compare profiles

List all available profiles:

```shell
gizzi config permission-profiles list
```

Show the resolved permissions for the active profile:

```shell
gizzi config permission-profiles active
```

Compare two profiles side by side:

```shell
gizzi config permission-profiles diff restricted workspace-write
```

---

## Example: review profile

A profile optimized for code review in a trusted repository:

```toml
# ~/.gizzi/profiles/review.toml
[permissions]
approval_policy = "on-request"
sandbox_mode = "workspace-write"
network_access = true
allow_login_shell = false

[permissions.sandbox_workspace_write]
writable_roots = ["{{workspace}}"]
network_access = true

[permissions.tools]
allow_bash = true
allow_filesystem_write = false
allow_subagents = "on-request"
```

Use it with:

```shell
gizzi exec --profile review "review the latest diff"
```

---

## Migration note

In older versions of `gizzi-code`, profiles were declared inline under `[profiles.<name>]` in `~/.gizzi/config.toml`. This format is no longer supported. Move each profile into its own file under `~/.gizzi/profiles/<name>.toml` and remove the legacy `[profiles.<name>]` tables from your user config.

---

## See also

- [Agent approvals and security](/docs/cli/agent-approvals-security)
- [Configuration reference](/docs/cli/config-reference)
- [Rules](/docs/cli/rules)
- [gizzi auth](/docs/cli/auth)
