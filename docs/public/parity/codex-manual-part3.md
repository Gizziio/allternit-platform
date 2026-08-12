# Codex manual parity: configuration, UI, integrations, and security

This page maps the third group of Codex manual concepts to Allternit's
self-hosted/BYOC stack. Codex examples in this group describe OpenAI's hosted
apps and `config.toml` schema. Allternit normally expresses the same intent
through Gizzi Code configuration, the Native Tool Belt, MCP, provider profiles,
or an organization-scoped API.

Unless stated otherwise, put TOML in
`~/.config/gizzi-code/config.toml` or a project `.gizzi/config.toml`. Run
`gizzi config list --sources` to inspect the effective configuration.

## Project discovery, sessions, and worktrees

Codex can recognize a project from a configurable list of marker files and can
choose whether resumed sessions use the caller's current directory or their
original directory. Gizzi discovers a project while walking upward for
`.gizzi/`, `gizzi.json`, `gizzi.jsonc`, or `.gizzi/config.toml`; Git-aware
operations also use the repository/worktree root as their safety boundary.
The marker list is currently fixed, so a user-configurable equivalent of
"Treat a directory as the project root when it contains any of these markers"
is **roadmap**.

Use explicit boundaries when automation must not depend on discovery:

```bash
gizzi exec --dir /srv/app "triage the backlog"
gizzi run --worktree /srv/app "review the TypeScript migration"
```

There is no direct `[projects."/absolute/path/to/project"]` trust table.
Project-local configuration, named permission profiles, `--dir`, and
`--worktree` provide the equivalent controls.

Gizzi supports isolated Git worktrees in several forms:

- `gizzi run --worktree <root>` overrides the sandbox/worktree boundary.
- `worktree.autoCreate` creates a worktree for each session; explicit
  `--worktree` and `--no-worktree` flags override it.
- Agent calls can request `isolation: "worktree"`.
- Multi-session bridge mode supports `--spawn=worktree`.

```json
{
  "worktree": {
    "autoCreate": true,
    "symlinkDirectories": ["node_modules", ".cache"],
    "sparsePaths": ["cmd/gizzi-code", "packages/@allternit"]
  }
}
```

Resumed sessions retain their recorded project root and worktree metadata. A
Codex-style `current | session` switch for the resumed/forked working directory
is not exposed; use `--dir`/`--worktree` for a deterministic override.

The Windows app and Windows sandbox are **not separate Allternit products**.
Gizzi is a cross-platform CLI with Windows managed-config locations and a
configurable `defaultShell` (`bash` or `powershell`). Consequently, a
Windows-only onboarding acknowledgement is not applicable. Native Windows
isolation beyond the cross-platform sandbox is roadmap.

## Approvals, permissions, and network access

Codex's approval timing and approval reviewer map to Gizzi's sandbox and
approval policy. Allternit keeps a human in the loop for `ask`; it does not
currently expose `approvals_reviewer = "auto_review"` as a distinct reviewer.

```toml
[sandbox]
mode = "workspace-write"
allow_network = false
allowed_domains = ["api.github.com", "registry.npmjs.org"]

[approval_policy]
mode = "granular"

[approval_policy.granular]
sandbox_approval = true
skill_approval = true
web_search = "live"

[approval_policy.granular.rules]
bash = "ask"
edit = "allow"
```

The available high-level modes are `untrusted`, `on-request`, `on-failure`,
`never`, and `granular`; individual tool rules are `ask`, `allow`, or `deny`.
This covers "when to ask for command approval," `approval_mode = "approve"`,
`approvals_reviewer = "user"`, and the app defaults
`default_tools_enabled`, `default_tools_approval_mode`, `enabled_tools`, and
`disabled_tools` at the policy/tool-registry level, although the Codex key names
are not accepted verbatim.

Codex named permission tables such as `[permissions.workspace]`, its special
`:workspace_roots` rule, and the admonition to define a custom permission name
before using it map to a named Gizzi permission profile:

```toml
[permission_profiles]
active_profile = "workspace"

[permission_profiles.profiles.workspace.rules]
read = "allow"
edit = "allow"
bash = "ask"
webfetch = "deny"
```

`[permissions.workspace.filesystem]` and
`[permissions.workspace.workspace_roots]` map to the active workspace root plus
the `read-only`/`workspace-write` sandbox presets. Common executables such as
`/usr/bin` remain readable/executable according to the host/container policy;
they need not be copied into a Codex permission table.

`[permissions.workspace.network]` and its `domains` map partially to
`sandbox.allow_network` and `sandbox.allowed_domains`. Allternit does not expose
Codex's per-domain `{ allow, deny }` map, Unix-socket allowlist,
`dangerously_allow_all_unix_sockets`, or `:workspace_roots` token verbatim.

The following Codex network-proxy controls are **roadmap** as a unified local
proxy feature: `[features.network_proxy]`, `admin_url`, `allow_local_binding`,
`allow_upstream_proxy`, `enable_socks5`, `enable_socks5_udp`, and the
`dangerously_allow_non_loopback_admin`/`proxy` switches. In today's Allternit,
use the sandbox domain allowlist, standard `HTTP_PROXY`/`HTTPS_PROXY`
environment variables, and deployment-level firewall/container policy. This
also means Codex's statement that `allow_local_binding = false` blocks loopback
and private destinations has no one-key equivalent.

## Authentication, providers, and model availability

Credential persistence has direct parity:

```toml
[auth]
active_profile = "local"
credential_store = "auto" # file | keyring | auto

[auth.profiles.local]
provider = "openai-compatible"
base_url = "http://localhost:11434/v1"

[auth.profiles.azure]
provider = "openai-compatible"
base_url = "https://YOUR_PROJECT_NAME.openai.azure.com/openai"
api_key_env = "AZURE_OPENAI_API_KEY"

[auth.profiles.proxy]
provider = "openai-compatible"
base_url = "https://proxy.example.com/v1"
```

Regional endpoints such as `https://us.api.openai.com/v1` use the same
`base_url` field. A token-producing
`command = "/usr/local/bin/fetch-codex-token"` is not supported as an auth profile field;
populate the referenced environment variable before launching Gizzi instead.

Workspace model availability maps to `GET /v1/models`. Results include
provider metadata and are filtered by the caller's virtual-key model allowlist:

```bash
curl -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  https://api.example.com/v1/models
```

Allternit has no separate `[tui.model_availability_nux]` onboarding switch.
Model visibility is policy-driven, not an OpenAI workspace entitlement prompt.

## MCP servers, apps, and tool discovery

Codex `[mcp_servers.docs]` and `[mcp_servers.github]` tables map to Gizzi's
`mcpServers`. Local servers accept a command, arguments, environment, and
working directory; remote servers accept a URL and headers.

```json
{
  "mcpServers": {
    "docs": {
      "type": "local",
      "command": "docs-server",
      "args": ["--port", "4000"],
      "env": { "API_KEY": "value" },
      "cwd": "/path/to/server"
    },
    "github": {
      "type": "remote",
      "url": "https://mcp.example.com/github",
      "headers": { "Authorization": "Bearer ${GITHUB_TOKEN}" }
    }
  }
}
```

This covers the Codex examples for `command`, `args`, `env`, `cwd`,
`bearer_token_env_var`, and environment-derived HTTP headers; Gizzi uses header
interpolation rather than those exact TOML fields. MCP-level allow/deny policy
uses enterprise `allowedMcpServers` and `deniedMcpServers`. The deferred Native
Tool Belt uses `tool_search`/`tool_activate`, which is the equivalent of
`[tool_suggest]`, `discoverables`, `direct_only_tool_namespaces`, and
`[features.code_mode]` without accepting those Codex keys.

Codex app tables (`[apps._default]`, `[apps.google_drive]`, and
`[apps.google_drive.tools."files/delete"]`) map to Allternit connectors plus
MCP/tool policy. Default enablement, destructive hints, and per-tool allow/deny
are enforced in the registry and permission layer. There is no `_default`
inheritance table or Google Drive-specific TOML schema. Configure the connector
in the platform, expose it through `allternit-connectors`, and deny a destructive
tool by its model-facing name. `apps = true`, `enabled`, `destructive_enabled`,
`default_tools_enabled`, and `default_tools_approval_mode` are therefore
semantic mappings, not copy-and-paste Allternit keys.

Use of Codex directly inside Linear or Slack is **not applicable as an
OpenAI-hosted integration**. Allternit's self-host model uses a connector, an
MCP server, webhook automation, or a custom plugin for either service. There is
no bundled Linear/Slack parity workflow documented today.

## Agents and lifecycle hooks

A Codex `[agents.reviewer]` table maps to a Gizzi custom agent. Give it a
description and instructions in the project's agent directory; model, color,
permissions, and tool access can be scoped per agent. `config_file`,
`description`, `developer_instructions`, and `compact_prompt` express agent
metadata in Codex, but are not accepted together under that TOML table in
Allternit.

Codex's nested `[[hooks.PreToolUse]]` / `[[hooks.PreToolUse.hooks]]` maps to
Gizzi lifecycle hooks. Gizzi supports command and HTTP hooks for `PreToolUse`,
`PostToolUse`, permission, session, interruption, compaction, subagent, stop,
and notification events.

```json
{
  "hooks": {
    "command": [
      {
        "command": "python3 /absolute/path/to/pre_tool_use_policy.py",
        "events": ["PreToolUse"],
        "matchers": ["bash", "file.*"],
        "timeout": 10000
      }
    ],
    "http": [
      {
        "url": "https://policy.example.com/hooks",
        "events": ["PreToolUse", "PermissionRequest"]
      }
    ]
  }
}
```

Hook responses can allow, deny, explain, and (for pre-tool events) modify the
payload. This is the concrete equivalent of the listed `PreToolUse` Python
command example.

## Web search, code execution, and TypeScript

The Native Tool Belt's `web_search` input accepts `cached`, `indexed`, or
`live`; Gizzi approval configuration enables `live` or disables the tool.
Unlike Codex, Allternit has no OpenAI-maintained cached search index and no
global four-value setting whose default is `cached`. "Cached" in the Tool Belt
is an adapter/session cache, `indexed` is provider-dependent, and `live` calls
the selected Tavily, Perplexity, Bing, or DuckDuckGo adapter.

```typescript
const results = await registry.getTool('web_search')!.execute!(
  { query: 'TypeScript backlog', mode: 'live', limit: 5 },
  { callId: 'search-1' },
);
```

TypeScript is a first-class Allternit SDK language. Use
`@allternit/sdk/ai-runtime`, define strict JSON Schema tools, and run TypeScript
through the normal Node toolchain. The sandbox VM also reports installed `tsc`
tooling. The Native Tool Belt's `code_execution` currently lists Node/
JavaScript rather than a distinct `typescript` language enum, so execute
compiled code or run the project command through `bash`.

## TUI, notifications, visualizations, and UI guidance

Codex's UI guidelines—clear hierarchy, readable code, visible progress,
accessible color, restrained motion, and actionable approval prompts—are also
the design principles used by Gizzi's Ink TUI and Allternit web surfaces. They
are guidance, not a compatibility-sensitive API.

Supported TUI equivalents include:

| Codex concept | Allternit equivalent |
|---|---|
| `alternate_screen = "auto"` | No matching config key; Gizzi owns its Ink render surface. |
| Clickable citation URI scheme | Links use terminal/host link handling; no `vscode`, `vscode-insiders`, `windsurf`, `cursor`, `none` selector. |
| Status items `model-with-reasoning`, `context-remaining`, `current-dir` | Custom `statusLine` receives model, context, cwd, and worktree data. |
| Terminal title `["spinner", "project"]`, `[]` clears | No equivalent title-component array. |
| `[tui.keymap.global/chat/composer]` | Flat `[keybinds]` actions; run `gizzi config keybinds`. |
| `[]` unbinds an action | No documented array-unbind syntax; assign a supported binding instead. |
| Custom `.tmTheme` files | Built-in `dark`, `light`, and `high-contrast`; no `.tmTheme` loader. |
| Notifications `unfocused | always` | Lifecycle `Notification` hooks and UI notices; no focus-policy switch. |
| `background_terminal_max_timeout = 300000` | Tool-specific/background-task timeouts; no global setting with this name. |
| task progress | Background/remote task progress components and session event streams. |

```toml
theme = "high-contrast"

[keybinds]
terminal_title_toggle = "ctrl+t"
tips_toggle = "<leader>h"
display_thinking = "ctrl+o"
```

Allternit visualizations are deliverable artifacts and verification evidence,
not a Codex-only UI primitive. Agents can build HTML/SVG/Canvas views, while
the verification subsystem records UI state, visual diffs, coverage maps,
performance charts, and error states. Use the TypeScript SDK or a visualization
tool/plugin for interactive output.

"What's new" maps to release notes/system-prompt changelogs and normal project
documentation. Set `GIZZI_DISABLE_NONESSENTIAL_TRAFFIC=1` to suppress remote
release-note and other nonessential checks. There is no exact Codex What's New
surface.

## Analytics, observability, and rollout controls

Workspace analytics have direct API parity. Organization admins can query
token usage, request volume, cost, active users, project/chat activity,
connectors, plugins, skills, and Gizzi usage:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://api.example.com/api/v1/admin/analytics/token-usage?start_date=2026-08-01&end_date=2026-08-31&granularity=day"
```

`[features.rollout_budget]`, token weights, and a user-facing rollout-budget
feature remain roadmap. Provider limits, virtual-key allowlists, rate limits,
and organization analytics are the current primitives.

Basic model-call tracing is enabled with:

```toml
[experimental]
openTelemetry = true
```

Codex's detailed OTLP tables—`[otel.exporter."otlp-http"]`, its `headers` and
`tls` subtables, `[otel.trace_exporter."otlp-grpc"]`, endpoints, request
compression, CA certificate, client certificate, and private key—do not have
config-schema parity. Configure exporter endpoint, headers, and TLS in the
hosting environment/collector. This is preferable in BYOC deployments because
the operator, rather than OpenAI's client, owns the telemetry boundary.

## Security review and vulnerability reports

The Codex Security workbench, deep scan, and hosted report-writing experience
are **not applicable as OpenAI-hosted products**. Allternit provides the pieces
for an equivalent self-hosted workflow: sandboxed tools, approval and hook
policy, audit logs, semi-formal/empirical verification, and custom reviewer
agents. A dedicated vulnerability-workbench UI is roadmap.

A practical vulnerability-report workflow is:

1. Create a reviewer agent whose instructions prioritize correctness,
   security, and test risks.
2. Run it in a read-only sandbox/worktree.
3. Use `PreToolUse` policy hooks to deny mutation and outbound disclosure.
4. Write findings to a Markdown or SARIF artifact with severity, evidence,
   affected path, reproduction, and remediation.
5. Preserve the run in the session/audit store and require human review before
   publishing.

This also supplies an Allternit equivalent for "triage a backlog": connect the
issue system through MCP/connector tooling, have an agent classify severity,
owner, dependencies, and next action, and leave destructive issue changes in
`ask` mode.

## Items with no literal key parity

The following fragments in the source manual are examples or prose rather than
standalone capabilities: "behaviors, recommended examples, and concise
explanations. Adjust as needed," "default, though you can deny access …," and
"and task-progress." Their underlying subjects are covered above.

Similarly, bare `enabled = true|false`, `destructive_enabled = true|false`,
tool allow/deny lists, and `_default applies to all apps` only make sense within
their parent Codex table. Allternit maps the behavior to connector enablement,
the Tool Registry, MCP enterprise policy, and approval rules; it does not parse
those fragments as global Gizzi options.

## Related documentation

- [Gizzi configuration](../gizzi/configuration.md)
- [Advanced CLI configuration](../cli/advanced-configuration.md)
- [Agent approvals and security](../cli/agent-approvals-security.md)
- [CLI customization](../cli/cli-customization.md)
- [Native Tool Belt](../tools/tool-belt.md)
- [MCP integration](../tools/mcp.md)
- [Provider registry](../providers/provider-registry.md)
- [Analytics API](../cli/analytics-api.md)
- [Security model](../security/security-model.md)
