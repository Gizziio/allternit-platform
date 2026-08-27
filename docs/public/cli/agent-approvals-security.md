# Agent approvals and security

`gizzi-code` runs code, edits files, and can access the network on your behalf. The approval and sandbox system lets you decide how much autonomy the agent has and what it must ask permission for.

## Overview

The security model has two layers:

1. **Sandbox mode** — controls what the agent can access on your machine (read-only, workspace-write, or full access).
2. **Approval policy** — controls when the agent must stop and ask before running a tool.

These can be configured globally, per project, or overridden from the CLI for a single invocation.

## Sandbox modes

Choose a preset in `~/.config/gizzi-code/config.toml`:

```toml
[sandbox]
mode = "read-only"
```

Available presets:

| Mode | Effect |
| --- | --- |
| `read-only` | The agent can read files but cannot write to disk or run commands. |
| `workspace-write` | The agent can write files inside the project workspace and run sandboxed commands. |
| `danger-full-access` | No sandbox restrictions. Use only in isolated, trusted environments. |

You can also set individual flags:

```toml
[sandbox]
enabled = true
allow_network = false
allowed_domains = ["api.github.com", "pypi.org"]
```

## Approval modes

The `approval_policy.mode` preset controls the default behavior:

```toml
[approval_policy]
mode = "ask"
```

Available modes:

| Mode | Behavior |
| --- | --- |
| `always-ask` | Every tool call requires explicit approval. |
| `ask` | Potentially destructive or risky operations require approval. |
| `auto` | Safe operations run automatically; risky ones still ask. |
| `granular` | Use the `granular` block for per-tool/per-path rules. |

## Granular approval policy

For fine-grained control, use the `granular` block:

```toml
[approval_policy]
mode = "granular"

[approval_policy.granular]
sandbox_approval = true
skill_approval = false
web_search = "live"

[[approval_policy.granular.rules]]
tool = "bash"
action = "ask"

[[approval_policy.granular.rules]]
tool = "file.write"
file_path = "*.md"
action = "allow"

[[approval_policy.granular.rules]]
tool = "file.write"
file_path = "/etc/*"
action = "deny"
```

Actions:

- `allow` — run without asking.
- `deny` — refuse to run.
- `ask` — prompt for approval.

Rules are evaluated in order; the first match wins.

## Common sandbox and approval combinations

### Safe default for everyday coding

```toml
[sandbox]
mode = "workspace-write"
allow_network = true

[approval_policy]
mode = "ask"
```

### Maximum autonomy in CI

```bash
gizzi exec --permission-mode auto --dangerously-skip-sandbox "run the tests"
```

Use `--dangerously-skip-sandbox` only in ephemeral, isolated CI environments.

### Maximum caution for sensitive repositories

```toml
[sandbox]
mode = "read-only"

[approval_policy]
mode = "always-ask"
```

## Network access

By default, network access follows the sandbox mode. You can explicitly allow or deny it:

```toml
[sandbox]
allow_network = true
allowed_domains = ["api.github.com"]
```

Or disable web search specifically:

```toml
[approval_policy.granular]
web_search = "disabled"
```

## Run without approval prompts

For non-interactive or highly trusted workflows, use CLI flags to skip approvals:

```bash
gizzi exec --permission-mode auto --no-interactive "deploy"
```

You can also set a permission mode for a single interactive session:

```bash
gizzi --permission-mode auto
```

## Protected paths in writable roots

Even in `workspace-write` mode, `gizzi-code` refuses to write to sensitive paths outside the project workspace unless explicitly allowed. Use `approval_policy.granular.rules` with `action = "allow"` to permit specific paths.

## Version control safety

`gizzi-code` detects Git repositories and treats the repository root as the workspace boundary. Changes are made inside the worktree; it will not modify files outside the repository unless the sandbox mode allows it.

## Monitoring and telemetry

Approval decisions and sandbox violations can be logged for audit. To enable OpenTelemetry spans for model calls, set:

```toml
[experimental]
openTelemetry = true
```

To disable product analytics and feedback surveys, set:

```bash
export DISABLE_TELEMETRY=1
```

## Security and privacy guidance

- Keep the sandbox enabled for everyday interactive use.
- Use `--dangerously-skip-permissions` and `--dangerously-skip-sandbox` only in isolated environments.
- Review project-level `.gizzi/config.toml` files before running `gizzi` in an unfamiliar repository.
- Store API keys in the credential store or environment variables, not in project config.

## Related pages

- [Advanced configuration](./advanced-configuration.md)
- [Permission profiles](./permission-profiles.md)
- [Config and state locations](./config-locations.md)
