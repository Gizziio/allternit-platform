# Codex manual parity, part 1

This page maps the first portion of the Codex manual to Allternit. The source
concepts come from the [Codex manual](https://learn.chatgpt.com/docs/codex-manual.md).
The examples below are Allternit examples: do not paste Codex keys into a Gizzi
configuration file and expect them to work.

Allternit is self-hostable and provider-neutral. Its closest Codex surface is
the `gizzi` CLI, backed by the Allternit API and `@allternit/sdk`. Configuration
lives in `~/.config/gizzi-code/config.toml`, with project overrides in
`.gizzi/config.toml`, `gizzi.json`, or `gizzi.jsonc`. See the
[`config.toml` reference](../gizzi/configuration.md) and
[config locations](../cli/config-locations.md).

## Configuration, authentication, and models

Codex's **Config basics**, **Advanced Configuration**, **Config Profiles
(separate files)**, **Environment variables**, **Environment Profile**,
**Instruction Overrides**, and **Configuration, Authentication, and Models**
correspond to Gizzi's layered configuration. A CI profile is selected by path,
not by Codex's `$CODEX_HOME/ci.config.toml` convention:

```bash
GIZZI_CONFIG=/etc/gizzi/ci.config.toml \
GIZZI_CONFIG_CONTENT='[sandbox]\nmode = "workspace-write"' \
gizzi exec --no-interactive "review this repository"
```

The load order is remote organization defaults, user config, `GIZZI_CONFIG`,
project config, `.gizzi/`, `GIZZI_CONFIG_CONTENT`, then managed enterprise
configuration. This is also the Allternit answer to **Centralized Feature Flags
(preferred)** and **Disable surface-specific features when needed**: managed
policy and the CLI's GrowthBook-backed flags can gate capabilities centrally.
There is no general Codex-style `[features]` table contract; **Leave this table
empty to accept defaults. Set explicit booleans to opt in/out** is therefore
not directly portable.

Authentication uses provider profiles and either an OS keyring or file store:

```toml
default_model = "openai/gpt-5"

[auth]
active_profile = "work"
credential_store = "auto"

[auth.profiles.work]
provider = "openai"
api_key_env = "OPENAI_API_KEY"
```

```bash
gizzi auth status
gizzi config show
```

This covers **Authentication & Login**, **Authentication and sessions**, and
the useful portion of **Force login mechanism when Codex would normally
auto-select. Default: unset.** Allternit selects an explicit auth profile rather
than `chatgpt | api`; **Allowed values: chatgpt | api** and **Base URL for
ChatGPT auth flow (not OpenAI API)** are Codex-service details and are **Not
applicable / roadmap**. Allternit uses Clerk JWTs for its UI/admin APIs and
virtual `ak-...` keys for its OpenAI-compatible API. See
[the security model](../security/security-model.md).

### Provider examples

Gizzi can target any OpenAI-compatible endpoint through `base_url`; the SDK
also has first-class Azure, Ollama, and Bedrock adapters.

```toml
# Azure/OpenAI-compatible provider
[auth.profiles.azure]
provider = "openai-compatible"
api_key_env = "AZURE_OPENAI_API_KEY"
base_url = "https://example.openai.azure.com/openai/deployments/my-deployment"

# Local OSS (Ollama-compatible)
[auth.profiles.local]
provider = "openai-compatible"
base_url = "http://localhost:11434/v1"

# OpenAI-compatible regional or proxy endpoint
[auth.profiles.regional]
provider = "openai-compatible"
api_key_env = "OPENAI_API_KEY"
base_url = "https://regional-gateway.example/v1"
```

At the SDK layer:

```ts
import { AllternitAzure, AllternitBedrock, AllternitOllama } from '@allternit/sdk/ai-runtime';

const local = new AllternitOllama({ baseURL: 'http://localhost:11434' });
const azure = new AllternitAzure({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  endpoint: 'https://example.openai.azure.com',
  deploymentName: 'my-deployment',
  apiVersion: '2024-10-21',
});
const bedrock = new AllternitBedrock({
  region: process.env.AWS_REGION ?? 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
});
```

These examples cover **Azure/OpenAI-compatible provider**, **Local OSS (e.g.,
Ollama-compatible)**, **OpenAI data residency with explicit base URL or
headers**, and **built-in Amazon Bedrock provider options**. Custom static
headers are available on remote MCP definitions, but not as documented Gizzi
auth-profile keys. **command-backed bearer token auth**, **Default OSS provider
for `--oss` sessions**, and **Default local provider used with `--oss`** do not
have the same CLI switches; use an auth profile or SDK adapter instead.

Allternit agents carry model configuration in `AgentProfile`. A caller may set
the model for a run or spawned agent, but Gizzi has no documented global
equivalents for **Default model for spawned agents**, **Default reasoning effort
for spawned agents**, **Force enable or disable reasoning summaries**, or
**Communication style ... none | friendly | pragmatic**. These are **roadmap**
configuration ergonomics, not provider limitations.

## Approval, sandbox, filesystem, and network

Codex's **Approval & Sandbox** and **Approvals, Sandboxing, and Security** map to
Gizzi sandbox presets, permission profiles, and approval policy:

```toml
[sandbox]
mode = "workspace-write"
allow_network = false
allowed_domains = ["api.openai.com"]

[approval_policy]
mode = "granular"

[approval_policy.granular]
sandbox_approval = true
skill_approval = true
web_search = "disabled"

[approval_policy.granular.rules]
bash = "ask"
edit = "allow"

[permission]
webfetch = "deny"
```

This is the Allternit form of **Example granular approval policy**, **Example
granular policy**, **Allow outbound network access inside the sandbox. Default:
false**, and **Enable the feature before configuring sandboxed networking
rules**. Presets are `read-only`, `workspace-write`, and
`danger-full-access`. Tool rules are `ask`, `allow`, or `deny`.

The SDK editor resolves all paths beneath one `workspaceRoot` and rejects path
escapes. Therefore **By default, deny read access to all files on disk** and
**By extending the `:workspace` profile, you get Codex's safeguards** map to
workspace confinement, but not to the same profile grammar. The following
Codex snippets have **no exact Allternit equivalent / roadmap**:

- `"/absolute/path/to/secrets" = "deny"`
- `"/var/run/docker.sock" = "allow"`
- `":workspace_roots" = { "." = "write", "**/*.env" = "deny" }`
- `"~/code/app" = true` and `"~/code/shared-lib" = true`
- **Additional writable roots beyond the workspace (cwd). Default: []**
- **Example additional workspace roots that inherit this profile's ...**
- **Example filesystem profile. Use `"deny"` to deny reads for exact paths or ...**
- **By extending the `:workspace` profile, `:tmpdir` and `:slash_tmp` are
  `"write"` ...**, **Exclude `$TMPDIR`**, and **Exclude `/tmp`**

Use one workspace root per Tool Belt instance, separate agents/worktrees for
separate roots, and tool-level denial for sensitive operations. Allternit does
not currently expose Codex's exact-path/glob precedence language.

`allowed_domains` is an allowlist. It does not implement Codex's host-pattern
and deny-rule grammar, so all of these are **no exact equivalent / roadmap**:

- `"*"` allows any public host that is not denied.
- `"*.example.com"` versus `"**.example.com"` apex behavior.
- `"api.openai.com" = "allow"` and `"example.com" = "deny"`.
- **Exact hosts match only themselves.**
- **Add an exact local IP literal or `localhost` allow rule ... or set it to
  true ...**

For the supported behavior, either set `allow_network = true` or list only the
domains required by the job. Browser automation has a separate `NetworkPolicy`.

Environment filtering has no documented Gizzi equivalent to Codex's
case-insensitive `include`/`exclude`/`set` algorithm. Consequently **Canonical
case-insensitive filters**, **Excludes apply before explicit set values and the
include allowlist**, **Don't combine filters with legacy exclude ...**, and
**Explicit key/value overrides. Include filters can still remove them** are
**roadmap**. Pass a minimal environment to the `gizzi` process or container.

Gizzi's Bash tool uses its runtime shell, but there is no public
`allow_login_shell` key. **Allow login-shell semantics**, **Default: true. Set
false to force non-login shells**, and **Experimental: run via user shell
profile** are **roadmap**. Container entrypoints are the self-hosted equivalent.

## MCP, tools, plugins, apps, and skills

Codex's **Define MCP servers under this table. Leave empty to disable** maps to
Gizzi `mcpServers`. Local command transport is the STDIO equivalent; `remote`
is the streamable HTTP equivalent:

```json
{
  "mcpServers": {
    "local-docs": {
      "type": "local",
      "command": ["npx", "-y", "@example/docs-mcp"]
    },
    "team-tools": {
      "type": "remote",
      "url": "https://tools.example.com/mcp",
      "headers": { "Authorization": "Bearer ${MCP_TOKEN}" },
      "oauth": false
    }
  }
}
```

Allternit's server-side endpoint is also directly testable:

```bash
curl -sS -X POST "$ALLTERNIT_API_URL/mcp/server" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

This covers **Example: STDIO transport**, **Example: Streamable HTTP
transport**, and **Define tools**. The SDK `ToolRegistry` defines strict JSON
Schema tools; `NativeToolBelt` provides `tool_search`, `tool_activate`,
`web_search`, `web_fetch`, `str_replace_editor`, `bash`, `code_execution`, and
`memory`. See [Native Tool Belt](../tools/tool-belt.md),
[strict tool use](../tools/strict-tool-use.md), and [MCP](../tools/mcp.md).

Gizzi supports MCP OAuth, but Codex-specific **server-specific callback ID**,
**custom callback paths**, and `mcp_oauth_callback_port` are **not the Allternit
contract / roadmap**. Remote static headers are supported. A command that
refreshes a bearer token is not currently a documented MCP config field.

**Apps / Connectors**, **Customization, Skills, Rules, MCP, and Integrations**,
**Brainstorm plugin use cases**, **Define tools**, and **Connect and test your
plugin** map to the connector-backed MCP catalog, local skills, project rules,
and plugin SDK. Browse servers in the MCP directory, attach one, inspect
`tools/list`, then make a test `tools/call`. The closest plugin workflow is:

1. Describe the user job and smallest safe actions.
2. Define closed JSON Schemas in `@allternit/plugin-sdk` or an MCP server.
3. Connect it through `mcpServers` and verify discovery/execution.
4. Apply permission and approval policy before enabling it for a workspace.

Skills are loaded from the configured skills directories. The SDK registry can
filter enabled skills, but there is no stable documented TOML key for **Disable
or re-enable a specific skill without deleting it**; that control is
**roadmap** at the Gizzi config surface. **Code mode namespaces ... under
development and off by default** is a Codex implementation detail; Allternit
already namespaces MCP tools as `<server>.<tool>`.

## Sessions, history, UI, and execution

**Execution Model and Workflows**, **CLI, IDE, App, and Cloud Behavior**,
**Cloud environments**, **Local environments**, and **Long-running work** map
to local Gizzi sessions, remote sessions over WebSocket/SSE, the Allternit API,
and customer-managed workers. Session endpoints and persistence are documented
in [API sessions](../api/sessions.md). The self-host/BYOC deployment—not an
OpenAI-hosted Codex Cloud—is the cloud boundary.

**History & File Opener** maps partially to `history.jsonl`, `sessions/`, and
the integrated terminal. History can be disabled or capped:

```toml
[history]
persistence = "none"
# max_bytes = 104857600
```

There is no public Gizzi file-opener command template that implements **Append
the opened path directly after the command** or **Append one JSON argument with
the path and editor context**. These are **roadmap**. There is also no stable
TOML surface for Codex's status-line IDs (**app-name, project, spinner, status,
thread, git-branch, model**), custom key bindings, alternate-screen selection,
burst-paste detection, welcome/status/spinner animation, feedback submission,
external notifier argv, or filtered TUI desktop notifications. Those items are
**roadmap UI customization**; terminal behavior is currently chosen by Gizzi's
Ink runtime (including fullscreen handling).

Memories exist as a native session key/value tool and Gizzi has session/team
memory features. Codex's exact **Enable memories with `[features].memories`,
then tune memory behavior here** syntax does not apply.

Multi-agent execution is supported by Allternit's agent controller and swarm
routes. The exact Codex setting **Enable or disable multi-agent tools. Default:
true** is not a stable Gizzi TOML key; use managed feature/policy controls or do
not expose the swarm tools.

Worktrees are ordinary Git linked worktrees, and Gizzi includes worktree
utilities. `.worktreeinclude` is **not supported by that name**. Copy or
provision ignored local files explicitly and never copy secrets by default; see
[config locations](../cli/config-locations.md). Trust is project/session policy,
not the Codex `"~/code/app" = true` table.

**Check for updates on startup. Default: true** maps to Gizzi's auto-updater,
but no public TOML contract guarantees that exact default. **From your WSL
shell**, **Install and run Codex in WSL**, **Deploy the Windows app**, and
ChatGPT desktop deployment are product-specific; run the Gizzi CLI in WSL or
deploy Allternit's own desktop/web surfaces using the repository's platform
instructions.

## Observability, analytics, governance, and security

Allternit's Analytics API exposes cost, token, volume, per-user, active-user,
artifact, chat/project, connector, plugin, skill, and Gizzi usage endpoints:

```bash
curl -sS "$ALLTERNIT_API_URL/api/v1/admin/analytics/token-usage?organization_id=$ORG_ID&start=2026-08-01&end=2026-08-12&granularity=day" \
  -H "Authorization: Bearer $CLERK_JWT"
```

This covers **Analytics API**, **Governance**, **Groups and provisioning**,
**Compliance API and audit events**, **ChatGPT usage limits and spend controls**,
and **ChatGPT Work admin FAQ** through Allternit's own admin APIs: RBAC roles and
groups, SCIM, spend limits, audit feeds, and compliance export/delete requests.
See [Work admin FAQ](../admin/work-admin-faq.md), [RBAC](../admin/rbac.md),
[compliance](../security/compliance.md), and [audit](../security/audit.md).

CLI analytics are ingested at `POST /analytics/gizzi-code/events`. There is no
documented user config equivalent for **Enable or disable analytics for this
machine**. Deployment operators may disable the endpoint or telemetry at the
service boundary; a first-class user toggle is **roadmap**.

The code emits tracing, but Codex's `[otel]` contract is not implemented as a
Gizzi TOML contract. The following are therefore **roadmap**, and these examples
must not be treated as supported Allternit configuration:

- `"x-otlp-api-key" = "${OTLP_TOKEN}"`
- **Example OTLP/HTTP exporter configuration**
- **Example OTLP/gRPC trace exporter configuration**
- **Exporter: none (default) | otlp-http | otlp-grpc**
- **Environment label applied to telemetry. Default: `"dev"`**
- **Include user prompt text in logs. Default: false**

Use the deployment's OpenTelemetry collector/environment integration until a
public Allternit exporter schema is added. Never log prompt text by default.

**Cyber Safety** maps to DLP scanning, prompt-injection scoring, strict tool
schemas, approval policy, sandboxing, RBAC, audit, and the browser quarantine
flow. Allternit does not ship the OpenAI **Codex Security plugin quickstart**,
**plugin changelog**, or **Codex Security TypeScript SDK**. Accordingly,
**Export and track security findings** and **Fix and verify security findings**
are **Not applicable / roadmap** as Codex Security workflows. Use audit/DLP
events and the normal issue tracker; a dedicated finding lifecycle is not yet a
public Allternit API.

## Product-navigation concepts

The manual also contains navigation labels rather than discrete runtime
features. Their Allternit destinations are:

| Codex/ChatGPT concept | Allternit destination |
|---|---|
| **CLI command reference**, **Developers** | `gizzi --help`, `gizzi <command> --help`, and `docs/public/cli/` |
| **Built-ins include** | Native Tool Belt, bundled MCP catalog, and installed skills |
| **Find By Topic**, **Glossary** | Public docs navigation/search; no dedicated parity glossary yet (**roadmap**) |
| **Feature Maturity**, **Breaking changes** | Repository changelogs/releases; no consolidated public maturity ledger (**roadmap**) |
| **Get started with ChatGPT Work** | Allternit Work admin FAQ and workspace setup |
| **ChatGPT on the web** | The self-hosted Allternit web surface |
| **ChatGPT Voice** | Gizzi vault voice controls and Allternit voice surfaces; not ChatGPT Voice service parity |
| **Manage app updates**, **Check for updates on startup** | Gizzi auto-updater and deployment-controlled releases |
| **Import from another agent** | Session/API import must be implemented by the caller; no one-command importer (**roadmap**) |
| **Improving the threat model** | Security model, DLP, audit, and deployment threat modeling |

## Exact source-item disposition

The grouped sections above also cover the source headings **Config basics**,
**Advanced Configuration**, **Approval & Sandbox**, **Approvals, Sandboxing,
and Security**, **Authentication & Login**, **Configuration, Authentication,
and Models**, **Customization, Skills, Rules, MCP, and Integrations**,
**Execution Model and Workflows**, **Developers**, and **Feature Maturity**.

The following source items are deliberately documented as non-portable or
roadmap rather than silently claimed: filesystem-profile literals; network
wildcard/deny grammar; environment include/exclude precedence; Codex login-shell
keys; Codex auth-mode and ChatGPT auth URL; Codex `--oss` defaults; subagent
default model/effort keys; reasoning-summary and personality keys; Codex MCP
callback/command-token details; `.worktreeinclude`; TUI status IDs, keymaps,
animations, feedback, notifications and paste settings; Codex OTLP TOML; Codex
Security products; and OpenAI-hosted ChatGPT/Codex deployment concepts.

