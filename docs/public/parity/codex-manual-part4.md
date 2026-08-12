# Codex manual parity, part 4

This page maps the fourth configuration-reference portion of the Codex manual
to Allternit. Codex examples on this page describe OpenAI's hosted Codex
runtime; the Allternit examples are the supported equivalents for the
self-hosted, provider-neutral `gizzi` CLI, Allternit API, and TypeScript SDK.

Do not copy Codex keys verbatim into `~/.config/gizzi-code/config.toml`. Use the
documented fields in the [`config.toml` reference](../gizzi/configuration.md).

## Providers, credentials, and model selection

Codex provider entries such as `name = "Azure"`, `name = "Ollama"`,
`name = "OpenAI Data Residency"`, and `name = "OpenAI using LLM proxy"` map to
named Allternit auth profiles. Codex's `env_key`, `openai_base_url`, and provider
name fields become `api_key_env`, `base_url`, and `provider`:

```toml
default_model = "azure/gpt-5"

[auth]
active_profile = "azure"

[auth.profiles.azure]
provider = "openai-compatible"
api_key_env = "AZURE_OPENAI_API_KEY"
base_url = "https://example.openai.azure.com/openai/deployments/gpt-5"

[auth.profiles.ollama]
provider = "openai-compatible"
base_url = "http://localhost:11434/v1"

[auth.profiles.eu]
provider = "openai-compatible"
api_key_env = "OPENAI_API_KEY"
base_url = "https://eu-gateway.example/v1"
```

Set the credential in the process environment; there is no separate
`env_key_instructions` field:

```bash
export AZURE_OPENAI_API_KEY="..."
gizzi auth profile set-active azure
gizzi exec "summarize this repository"
```

The SDK has explicit Azure, Ollama, and Bedrock adapters. This is the
Allternit equivalent of `model_provider = "amazon-bedrock"`, `region =
"eu-central-1"`, `oss_provider = "ollama"`, Azure `query_params`, and the
provider display names:

```ts
import {
  AllternitAzureOpenAI,
  AllternitBedrock,
  AllternitOllama,
} from '@allternit/sdk/ai-runtime';

const azure = new AllternitAzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  resourceName: 'example',
  deploymentName: 'gpt-5',
  apiVersion: '2025-04-01-preview',
});
const bedrock = new AllternitBedrock({ region: 'eu-central-1' });
const ollama = new AllternitOllama({ baseURL: 'http://localhost:11434' });
```

Allternit discovers provider model catalogs and exposes them through
`GET /v1/models`; catalog entries can include `context_window` and
`max_output_tokens`:

```bash
curl -sS "$ALLTERNIT_API_URL/v1/models" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY"
```

The Codex startup overrides `model_catalog_json = "./models.json"` and an
absolute `model_catalog_json` path have **no Gizzi config equivalent / roadmap**.
Use a connected provider's catalog or an Allternit model policy. Likewise,
`model_context_window`, `model_verbosity`, `service_tier = "fast"`,
`prefill_token_weight`, `sampling_token_weight`, and `wire_api = "responses"`
are provider/request concerns, not stable Gizzi TOML fields. Choose a
provider/model or pass supported request options through its SDK adapter.
`wire_api = "responses"` is specifically a Codex provider implementation
detail, so its “only supported value” rule is not applicable.

## Instructions, compaction, memory, and context limits

Codex's `model_instructions_file` maps directly to Allternit's instruction-file
array:

```toml
instructions = [".gizzi/INSTRUCTIONS.md", "./instructions.txt"]
```

Skills are directories containing `SKILL.md`, normally beneath
`~/.allternit/skills/`. A Codex `path = "/path/to/skill/SKILL.md"` therefore maps
to installing the containing skill directory or adding a skill folder through
the supported `skills` configuration; see [skill format](../skills/skill-format.md).

Gizzi performs runtime compaction, but these Codex tuning keys are **no exact
equivalent / roadmap**:

- `experimental_compact_prompt_file` with either relative or absolute paths
- `model_auto_compact_token_limit = 64000`
- `model_auto_compact_token_limit_scope = "total"`
- `limit_tokens = 100000` and the rule that it is required when enabled
- `reminder_interval_tokens = 10000`
- `tool_output_token_limit = 12000`

Provider model metadata and the runtime's compaction strategy determine the
working context today. `generate_memories = true` maps to the Tool Belt's
`memory` tool and server memory endpoints, but generation is agent-driven; it
is not a global boolean. `personality = true` and `personality = "pragmatic"`
(`friendly` or `none`) have no global Gizzi schema. Put tone guidance in an
instruction file or agent profile instead.

## MCP servers, environment forwarding, and OAuth

Codex remote MCP `url`, static `http_headers`, OAuth `scopes`, and request
`timeout_ms` map to Gizzi's `mcpServers` entries. Allternit names discovered
tools as `<server>.<tool>` rather than `mcp__<server>__<tool>`.

```json
{
  "mcpServers": {
    "github": {
      "type": "remote",
      "url": "https://github-mcp.example.com/mcp",
      "headers": { "X-Example": "value" },
      "oauth": {
        "scope": "repo read:docs"
      },
      "timeout": 5000,
      "enabled": true
    },
    "docs": {
      "type": "local",
      "command": ["docs-server"],
      "timeout": 10000,
      "enabled": true
    }
  }
}
```

The local `timeout` is the closest equivalent of Codex `startup_timeout_sec`;
the remote `timeout` covers request/tool timeouts. Values are milliseconds in
Gizzi, and no separate `tool_timeout_sec` field exists. Codex `required = true`
(fail startup/resume), `experimental_environment = "remote"` for remote STDIO,
and `oauth_resource` are **roadmap**. In BYOC deployments, run the MCP server on
the target host and connect to its remote URL.

Gizzi supports explicit local MCP process environment pairs through the
`environment` object, but it does not distinguish parent-local and
remote-executor secrets:

```json
{
  "mcpServers": {
    "docs": {
      "type": "local",
      "command": ["docs-server"],
      "environment": { "LOG_LEVEL": "info" }
    }
  }
}
```

The Codex forms `env_vars = ["ANOTHER_SECRET"]` and
`env_vars = ["LOCAL_TOKEN", { name = "REMOTE_TOKEN", source = "remote" }]`
have **no exact equivalent**. Inject a minimal environment into the Gizzi/MCP
container or use its secret manager. Never place secret values in static
headers.

MCP OAuth is automatic and the API callback is `/mcp/oauth/callback`. Codex's
`mcp_oauth_callback_port = 4321` and custom `mcp_oauth_callback_url` are not
supported Gizzi keys. Configure the externally reachable API/tunnel URL at the
deployment layer. OAuth scopes are represented by one space-delimited `scope`
string, rather than Codex arrays such as `["repo"]` or `["read:docs"]`.

`excluded_tool_namespaces`, `include_only` combination rules, `mode =
"limited"`, `open_world_enabled`, and `remote_plugin` are Codex app/plugin
catalog controls with **no one-to-one Gizzi field / roadmap**. Allternit uses
per-tool permission rules and explicit MCP enablement:

```toml
[permission]
"github.delete_issue" = "deny"
"github.*" = "ask"
```

Codex connector/plugin discoverables—Google Calendar, Gmail, Figma, and Slack
objects—map to Allternit's connector-backed MCP catalog and locally installed
plugins, not hard-coded `{ type, id }` TOML values. Connect the desired service,
then expose only its namespaced tools. See [MCP integration](../tools/mcp.md).

## Tools, shell, hooks, and concurrency

Allternit already uses one Tool Belt execution path; `unified_exec = true` and
`features = { unified_exec = false }` are therefore **not portable feature
flags**. `shell_tool = true`, `view_image = true`, `tools_view_image = true`,
and `shell_snapshot = true` correspond to built-in/runtime capabilities, but
are controlled by tool availability and permission policy rather than those
booleans:

```toml
[permission]
bash = "ask"
read = "allow"
edit = "ask"
websearch = "allow"
```

`hooks = false`, hook `matcher = "^Bash$"`, hook `type = "command"`, and
`statusMessage = "Checking Bash command"` have no public Gizzi TOML contract.
Use ordered `approval_policy`/`permission` rules or project automation. The
`skill_mcp_dependency_install` toggle is also roadmap; skill dependencies must
be reviewed and installed explicitly.

`max_concurrent_threads_per_session = 6` is a Codex client limit. Allternit
models concurrent work as agent runs, lanes, and deployments; enforce limits
at the worker/orchestrator layer. `fast_mode = true` does have a runtime
equivalent: use Gizzi's `/fast` command to toggle the supported fast mode for
the current session. It is not a documented top-level TOML key.

`protocol = "binary" | "json"`, `interrupt_message = true`, and
`resume_cwd = "session"` are Codex subprocess/session protocol details. Use the
Allternit session event APIs instead. An active server session can be
interrupted explicitly:

```bash
curl -sS -X POST \
  "$ALLTERNIT_API_URL/api/v1/beta/sessions/$SESSION_ID/interrupt" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H 'Content-Type: application/json' \
  -d '{"data":{"reason":"operator requested stop"}}'
```

## Sandbox, filesystem, environment, and network

Codex `sandbox_mode = "read-only"` maps directly to an Allternit preset:

```toml
[sandbox]
mode = "read-only" # or "workspace-write" or "danger-full-access"
allow_network = false
allowed_domains = ["api.github.com"]
```

The Windows-specific `sandbox = "unelevated"` fallback is **not applicable** to
the cross-platform/self-hosted sandbox contract. `trust_level = "trusted"`
maps conceptually to choosing permission and sandbox profiles, but is not a
Gizzi key. `network_proxy = false`, `proxy_url`, and `socks_url` are deployment
network settings; configure the host/container's standard proxy variables and
egress policy. There is no Gizzi SOCKS TOML block.

Codex's rule that `.codex/` and `.git/` subfolders remain read-only while the
rest of a workspace is writable has **no exact Allternit equivalent / roadmap**.
Use `workspace-write`, protect metadata with source-control/OS permissions, and
deny dangerous shell commands. `hide_full_access_warning`,
`hide_world_writable_warning`, and `suppress_unstable_features_warning` are
Codex warning-suppression flags and are intentionally not portable security
controls.

Allternit does not expose Codex's environment inheritance grammar (`inherit:
all | core | none`) or its `include_only` arrays, including Codex's
automatically determined “minimal” set of files and folders. Launch Gizzi with
a curated environment or use a container. Similarly, Codex's pre-expanded glob guidance,
`glob_scan_max_depth = 3`, and `project_root_markers = [".git"]` have **no
exact config equivalent**. Gizzi discovers projects from `.gizzi/`,
`gizzi.json[c]`, and project config, and its file tools perform their own
workspace-bound traversal.

## History, logs, telemetry, and state

Codex `max_bytes = 5242880` maps to Gizzi history retention:

```toml
[history]
persistence = "save-all" # or "none"
max_bytes = 5242880
```

`save-all | none` is the Allternit persistence choice. `sqlite_home` and
Codex's explicit `log_dir` have no documented Gizzi TOML equivalent; state and
logs follow the platform-specific locations described in
[config and state locations](../cli/config-locations.md).

OTel exporter details belong in the deployment's collector and standard
environment variables. This replaces Codex exporter tables, `headers = {
"x-otlp-meta" = "abc123" }`, `protocol`, and exporter `timeout = 30`:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT="https://otel.example.com"
export OTEL_EXPORTER_OTLP_HEADERS="x-otlp-meta=abc123"
export OTEL_SERVICE_NAME="gizzi-code"
gizzi exec "inspect the service"
```

Gizzi emits AI SDK OTel spans when `experimental.openTelemetry` is enabled and
respects standard OTel environment variables. The Rust API currently provides
structured local tracing and `/metrics`; a native Rust OTLP exporter is
roadmap. See [OTel metrics](../cli/otel-metrics.md).

## TUI, notifications, and keyboard behavior

Allternit exposes individual keybindings rather than Codex arrays. The closest
equivalents of `interrupt_turn = "f12"`, `submit = ["enter", "ctrl-m"]`,
`open_transcript = "ctrl-t"`, and `open_external_editor = []` are:

```toml
theme = "catppuccin-mocha"

[keybinds]
session_interrupt = "f12"
input_submit = "return"
display_lane_history = "ctrl+t"
terminal_title_toggle = "ctrl+shift+t"
```

One action accepts one configured binding; alternate-binding arrays and a
Codex-style external-editor list are **roadmap**. `status_line = ["model",
"context-remaining", "git-branch"]` and `terminal_title = ["spinner",
"project"]` do not have the same composition grammar. Gizzi has its own status
line and an enable/toggle control for terminal titles.

`notification_condition = "unfocused"`, `notification_method = "auto"`,
`prevent_idle_sleep = false`, `refresh_interval_ms = 300000`, and
`hide_rate_limit_model_nudge`/`hide_gpt5_1_migration_prompt` are Codex client UX
preferences with **no public Gizzi equivalents / roadmap**.

## Hosted ChatGPT controls that do not apply

`forced_login_method = "chatgpt"` and
`forced_chatgpt_workspace_id = "00000000-0000-0000-0000-000000000000"` are
OpenAI-hosted account controls. Allternit's managed equivalents use
`forced_login_method = "oauth" | "api_key"` and `forced_workspace_id`:

```toml
forced_login_method = "oauth"
forced_workspace_id = "00000000-0000-0000-0000-000000000000"
```

`profile = "default"` is represented by `auth.active_profile`; there is no
ChatGPT workspace dependency. `service_tier`, OpenAI search-index behavior,
and curated plugin IDs are not platform invariants in a self-host/BYOC setup.

Finally, Codex `web_search = "indexed"` (and text describing cached/indexed
search results) is **not applicable** because Allternit does not depend on an
OpenAI-maintained search index. Use live search or disable it:

```toml
[approval_policy]
mode = "granular"

[approval_policy.granular]
web_search = "live" # or "disabled"
```

`web_search = "live"` is the Allternit equivalent of fetching current web
data. It grants the `websearch` tool permission; the search provider remains a
deployment/runtime choice.

## Summary of roadmap-only keys

The following Codex knobs are not silently accepted by Gizzi and should not be
treated as implemented configuration: compact-prompt and token-scope tuning;
model-catalog file overrides; output token weighting; Codex warning/nudge
suppression; hook matcher/status tables; tool namespace include/exclude modes;
remote-STDIO execution; MCP required-startup semantics and callback-port
overrides; idle-sleep and notification policy; status-line/terminal-title
composition; per-session concurrency caps; and `.codex`-specific filesystem
exceptions. They are either roadmap ergonomics or hosted Codex implementation
details, as identified above.
