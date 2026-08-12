# Codex manual, part 2: Allternit equivalents

This page maps the second half of the Codex manual to Allternit's self-hosted,
bring-your-own-cloud (BYOC) stack. Codex option names are not accepted by
`gizzi-code` unless the mapping below says so. Allternit configuration normally
lives in `~/.config/gizzi-code/config.toml`, with trusted project overrides in
`.gizzi/config.toml`.

## Quickstart, environments, and unattended work

Codex combines an interactive coding terminal, a headless command, remote
environments, and long-running cloud tasks. Allternit's counterparts are the
interactive `gizzi` TUI, `gizzi exec`, `gizzi serve`, the Sessions API, and the
self-hosted work queue.

```bash
bun install -g @allternit/gizzi-code
gizzi auth login --api-key "$ANTHROPIC_API_KEY" --provider anthropic --profile work
gizzi                         # interactive TUI with integrated shell/tool output
gizzi exec --no-interactive "review the current diff"  # headless/CI
gizzi serve                   # remote agent host
```

| Codex concept | Allternit mapping |
|---|---|
| **Quickstart** | Install the package, create an auth profile, then run `gizzi` or `gizzi exec`. See [gizzi-code](../gizzi/index.md). |
| **Integrated terminal** | The TUI renders shell commands and their streamed output in the session; the Bash tool executes through the configured permission and sandbox layers. It is not a separate terminal emulator. |
| **Non-interactive mode** / **Noninteractive and Programmatic Interfaces** | Use `gizzi exec --no-interactive`, the TypeScript/Python SDK, or `POST /v1/chat/completions`. Use `--print --no-session-persistence` for disposable output. |
| **Local environments** | Run `gizzi` on macOS, Linux, Windows, a container, or against an OpenAI-compatible local endpoint. See [OSS mode](../cli/oss-mode.md) and [cloud environments](../cli/cloud-environments.md). |
| **Remote connections** | `gizzi serve` exposes a remote agent host over HTTP/WebSocket; managed sessions and sandbox workers cover server-side execution. See [remote workflows](../cli/codex-remote.md) and [work queue](../api/work-queue.md). |
| **Long-running work** | Use platform sessions, deployments, and lease/heartbeat work-queue workers. Token, turn, and tool-call limits are explicit session budgets. |
| **Maximum concurrently open spawned-agent threads, excluding the primary thread. When unset, Codex chooses the default.** | The runtime supports spawned subagents and concurrent task threads, but there is no documented user-facing concurrency-limit key. Bound concurrency in the orchestrator/worker deployment; a per-session config control is roadmap. |
| **Projects and chats** | A local project has project-scoped config and transcript files; platform chats are sessions and can form threads with `parent_thread_id`. |
| **Review GitHub pull requests with Codex** | Run `gizzi exec --profile review "review the latest diff"` in the checked-out PR worktree. A hosted GitHub-review bot is not bundled; CI can invoke the same headless command. |
| **Install dependencies** / **Install type checker** | Install the language toolchain in the host/container and let the agent run the repository's own package-manager and type-check commands. Allternit intentionally does not prescribe a universal dependency or type checker. |
| **Install and run Codex in WSL** / **Install default Linux distribution (like Ubuntu)** / **Start a shell inside Windows Subsystem for Linux** | Not applicable as Codex-specific setup. Allternit can be installed inside any existing WSL distribution using the Linux/Bun instructions; WSL distribution provisioning remains an OS administrator action. |
| **Manage app updates** | Package-manager upgrades (`bun update -g @allternit/gizzi-code`) are the reliable path. `GIZZI_DISABLE_NONESSENTIAL_TRAFFIC=1` disables update/release-note checks. There is no managed desktop update channel documented yet. |
| **Open Source** / **Platform, Enterprise, and Caveats** | The runtime, API, SDK, memory, vault, and governance surfaces are source-available and self-hostable. Enterprise identity, audit, policy, and BYOK are deployment features; some provider-validation and tunnel-security integrations are explicitly scaffold/roadmap. |
| **Pricing** | Not a fixed CLI capability. In BYOC, model and infrastructure charges come from the selected provider/cloud; Allternit tracks token usage but does not impose a Codex subscription schedule in this repository. |

## History, memory, compaction, and handoff

Codex's history and memories tables describe persisted prompts, resumable
threads, and context compaction. Allternit persists local JSONL transcripts and
platform session events, offers session-scoped and named user memory stores, and
automatically compacts near the model context limit.

```toml
[history]
persistence = "save-all"   # use "none" to disable
max_bytes = 5242880

[compaction]
auto = true
prune = true
reserved = 16384
```

| Codex concept | Allternit mapping |
|---|---|
| **History (table)** | `history.jsonl` stores prompt history; per-project JSONL files store resumable transcripts. Platform sessions retain ordered events independently. See [history persistence](../cli/history-persistence.md). |
| **Maximum bytes for history file; oldest entries are trimmed when exceeded. Example: 5242880** | `[history].max_bytes = 5242880`; retention can also be bounded with `cleanupPeriodDays`. Confirm support in the active release with `gizzi config show`. |
| **Include user prompt text in logs. Default: false** | Allternit telemetry does not include raw prompt text by default. There is no recommended global “log prompts” switch; transcripts are the auditable record, and collector/provider logging must be configured deliberately. |
| **Memories (table)** | The Tool Belt `memory` tool provides session key/value memory. The API exposes named, user-scoped memory-store records with redaction policy; content-backed store I/O is still scoped as roadmap. |
| **Inline override for the history compaction prompt. Default: unset.** | `/compact <instructions>` supports a one-off custom compaction instruction. There is no stable TOML key for a global inline prompt override. |
| **Load the compact prompt override from a file. Default: unset.** | Roadmap. Project instruction files influence the session, but no dedicated `compact_prompt_file` compatibility option is exposed. |
| **Optional reminder_interval_tokens defaults to 10% of limit_tokens.** / **Token weights default to 1.0.** / **Rollout budget tracking. This feature is under development and off by default.** | No direct config equivalents. Allternit uses explicit session token/turn/tool-call budgets and reports provider usage; reminder cadence, token weights, and Codex rollout accounting are roadmap if needed. |
| **Record a model-visible message when an agent turn is interrupted. Default: true** | Session interruption is persisted as lifecycle/event state. There is no user-facing compatibility boolean controlling insertion of a synthetic model message. |
| **Record & Replay** | Local sessions resume from JSONL and `/v1` non-streaming requests support response replay with `Idempotency-Key`. A deterministic tool/model cassette recorder is not yet a public feature. |
| **Import from another agent** | `cmd/gizzi-code/src/runtime/skills/importer.ts` discovers compatible `.claude`, `.codex`, `AGENTS.md`, and `CLAUDE.md` instructions and skills. Import is treated as untrusted content; vendor-specific runtime state is not imported. |

## Project documentation, instructions, and trust

Codex walks directory trees for project instructions and gates project config by
trust. Allternit follows the same principle with explicit instruction paths,
`AGENTS.md`/`CLAUDE.md` discovery, and a trust prompt before project code or
configuration can execute.

```toml
# .gizzi/config.toml
instructions = ["AGENTS.md", ".gizzi/INSTRUCTIONS.md", "docs/CODING_GUIDELINES.md"]
```

| Codex concept | Allternit mapping |
|---|---|
| **Instruction Overrides** / **Override built-in base instructions with a file path. Default: unset.** | `instructions = [...]` adds ordered project/user instruction files. Replacing the protected runtime base prompt wholesale is not a supported public control. |
| **Project Documentation Controls** | Use project `.gizzi/config.toml`, `instructions`, and discovered `AGENTS.md`/`CLAUDE.md`. Config layers merge from remote defaults through user, project, inline, and managed policy. |
| **Max bytes from AGENTS.md to embed into first-turn instructions. Default: 32768** | No public byte-limit knob. The runtime loads workspace identity/instruction files and applies its own context controls; an administrator should keep instructions concise. |
| **Ordered fallbacks when AGENTS.md is missing at a directory level. Default: []** | Built-in import candidates include `AGENTS.md` and `CLAUDE.md`; arbitrary ordered fallback names are not configurable. Use explicit `instructions` paths instead. |
| **Project root marker filenames used when searching parent directories. Default: [".git"]** | Root discovery recognizes `.gizzi/`, `.gizzi/config.toml`, `gizzi.json`, and `gizzi.jsonc`; a configurable marker list is not public. Git repositories also define the sandbox workspace boundary. |
| **Projects (trust levels)** / **Mark specific worktrees as trusted or untrusted.** | The CLI prompts before loading project code/config from an untrusted directory and stores trust by directory. Trust is directory/project scoped rather than a Codex-compatible per-worktree TOML table. |
| **Leave unset to choose when the current and saved session directories differ.** | On resume, Allternit uses the transcript's project metadata and current workspace. No public tri-state “choose directory” setting exists. |
| **Though in practice, a software agent needs to be able to read folders that** | Allternit formalizes this with the Git/workspace boundary, protected paths, explicit writable roots, and permission rules. Grant only the minimum additional path access required. |

## Sandbox, permissions, networking, and security

Codex's sandbox and approval tables map to Allternit's sandbox presets plus
ordered `allow`, `ask`, and `deny` tool/path rules.

```toml
[sandbox]
mode = "workspace-write"
allow_network = false
allowed_domains = ["api.github.com"]

[approval_policy]
mode = "granular"

[[approval_policy.rules]]
permission = "bash"
pattern = "*"
action = "ask"
```

| Codex concept | Allternit mapping |
|---|---|
| **Sandbox settings (tables)** | Presets are `read-only`, `workspace-write`, and `danger-full-access`; explicit `enabled`, `allow_network`, and `allowed_domains` override preset values. |
| **Named permissions profile to apply by default. Built-ins:** | Built-ins include `restricted`, `workspace-write`, and `trusted-review`. Set `active_permission_profile`, or run `gizzi --profile trusted-review`. Custom files live under `~/.gizzi/profiles/`. |
| **Select it with codex --profile ci.** | Use `gizzi exec --profile ci "…"` after creating `~/.gizzi/profiles/ci.toml`. |
| **To create a config profile, put overrides in a separate profile file under $CODEX_HOME.** | Put Allternit overrides in `~/.gizzi/profiles/<name>.toml`, then select them with `gizzi --profile <name>` or `gizzi exec --profile <name>`. |
| **Set `default_permissions = "workspace"` before enabling this profile.** | No such prerequisite key. Put the complete sandbox and approval posture in the profile itself; later project/CLI layers can override it. |
| **Set conservative defaults** | Recommended: `workspace-write`, network off, and `approval_policy.mode = "on-request"` or `ask`. Use `restricted` for untrusted repositories. |
| **If you use --yolo or another full access sandbox setting, web search defaults to live.** | `--dangerously-skip-sandbox`/`danger-full-access` removes OS sandboxing, but web search remains an independent permission. Set `[approval_policy.granular] web_search = "live"` explicitly. |
| **Sandboxed networking settings** | `allow_network` is the coarse switch and `allowed_domains` is the allowlist. Web search has its own `live`/`disabled` approval control. |
| **Shell Environment Policy for spawned processes (table)** / **Set false to remove those variables before applying explicit filters.** / **Skip automatic filtering for names containing KEY/SECRET/TOKEN. Default: true.** | There is no public Codex-compatible environment-filter table. The runtime sanitizes dangerous variables on sensitive paths; pass required secrets explicitly via `api_key_env` or the orchestrator. Disabling secret-name filtering is intentionally not offered. |
| **Security & Privacy** / **Security Review** | Use sandbox boundaries, approval rules, project trust, keyring credentials, audit events, vault redaction, and optional OTEL. See [security model](../security/security-model.md) and [audit](../security/audit.md). |
| **Improving the threat model** / **Propose security hardening** | Treat repository instructions, web/MCP results, plugins, and inbound attachments as untrusted; deny network by default, isolate full-access CI, pin dependencies, constrain MCP credentials, and record approvals. Hardening proposals should include the trust boundary, attack path, mitigation, and regression test. |
| **Tenant Risk Taxonomy and Allow/Deny Rules** | Enterprise policy is expressed through permission profiles, admin policy/inference hooks, connector policy, audit, RBAC, and vault sensitivity/redaction. A named Codex tenant-risk taxonomy is not currently public. |
| **Roles and workspace permissions** | Platform admin/RBAC and Clerk organization roles control server resources; local tool permissions control device actions. They are deliberately separate layers. |
| **Native Windows sandbox mode (Windows only): unelevated | elevated** | Roadmap. Allternit supports Windows paths/config and WSL execution, but no public native Windows elevated/unelevated sandbox selector is documented. |
| **Prisma AIRS** | Not bundled. A deployment may place Prisma AIRS or another inspection gateway in front of model/MCP traffic; Allternit's native controls are policy hooks, audit, redaction, and sandboxing. |
| **Run Codex Security in CI** / **Run a Codex Security scan** / **Run a deep security scan** | Not applicable as Codex-branded services. Use `gizzi exec --profile restricted` with the repository's SAST/dependency/secret scanners. A first-party Allternit deep-security scanner is roadmap. |
| **Permissions** — Fine-tuning appears only in outbound third-party connectors (e.g. services/open-connector Mistral executors). | Model fine-tuning is not a local tool permission. Govern outbound providers/connectors with admin policy, credentials, network rules, and audit; no general Allternit fine-tuning permission surface is claimed. |

## MCP, skills, plugins, and apps

Model Context Protocol (MCP) is the common tool interoperability layer.
Allternit is both an MCP client and server: it can attach local/remote servers to
the Tool Belt and expose its registry through JSON-RPC at `/mcp/server`.

```bash
curl -X POST http://127.0.0.1:8013/mcp/server \
  -H "Authorization: Bearer $ALLTERNIT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

```json
{
  "mcpServers": {
    "docs": {
      "type": "remote",
      "url": "https://mcp.example.com/rpc",
      "headers": { "Authorization": "Bearer ${DOCS_MCP_TOKEN}" },
      "oauth": false
    }
  }
}
```

| Codex concept | Allternit mapping |
|---|---|
| **Model Context Protocol** / **MCP server and UI quickstart** | Configure `mcpServers`, browse the merged bundled/public/verified catalog, or call `/mcp/server` with `initialize`, `ping`, `tools/list`, and `tools/call`. See [MCP integration](../tools/mcp.md). |
| **MCP server review requirements** | Review source, command/URL, requested headers/secrets, tool schemas, network scope, and publisher before enabling. Use explicit user identity and internal token headers for internal routes; tunnel policy can require mTLS/OAuth metadata. Marketplace-wide human review attestation is roadmap. |
| **Optional MCP OAuth callback overrides (used by `codex mcp login`)** / **Optional fixed port for MCP OAuth callback: 1-65535. Default: unset.** / **Optional redirect URI override for MCP OAuth login (for example, remote devbox ingress).** | Roadmap as public config. Remote MCP entries support OAuth metadata, but fixed callback port/redirect overrides are not documented configuration keys. |
| **Register the full derived URI with your provider, not just the base host or unsuffixed path.** | General OAuth rule: register the exact callback URI emitted by the MCP client. Allternit's future override must likewise match scheme, host, port, and path exactly. |
| **Preferred store for MCP OAuth credentials: auto (default) | file | keyring** | The general auth credential store supports `auto`, `file`, and `keyring`; a separately selectable MCP OAuth store is not yet public. Prefer OS keyring or injected secrets. |
| **Resources** | MCP tool discovery and execution are implemented. MCP `resources/*` and `prompts/*` protocol methods are not exposed by `/mcp/server` yet and are roadmap. |
| **Skills & Plugins** / **Plugin architecture** | Skills are `SKILL.md` capability packages. Plugins bundle skills, commands, agents, hooks, output styles, MCP and LSP definitions in a `plugin.json` directory. |
| **Skill controls** / **Skills (per-skill overrides)** | Skills can be installed/discovered and tool permission `skill = "allow|ask|deny"` gates invocation. Arbitrary per-skill TOML overrides are not a documented stable surface. |
| **Plugin controls** | `gizzi plugin list`, `install`, `enable`, and `disable`; project-local plugins participate in layered config. |
| **Package your plugin** | Create `plugin.json` plus optional `commands/`, `agents/`, `skills/`, `hooks/`, `output-styles/`, `mcp-servers.json`, and `lsp-servers.json`; distribute the directory/repository and install by path or repo. |
| **Submit plugins** / **Plugin submission errors** | Local/repository distribution works. A hosted Allternit marketplace submission and its validation-error contract are not yet documented; treat them as roadmap. Load-time manifest/skill validation errors prevent malformed capabilities from surfacing. |
| **Lifecycle hooks can be configured here inline or in a sibling hooks.json.** | Plugins support a `hooks/` directory and lifecycle hooks; the exact Codex inline/sibling `hooks.json` compatibility form is not guaranteed. Use the Allternit plugin layout. |
| **Optional per-app controls.** / **Leave this table empty to accept defaults. Set explicit booleans to opt in/out.** | Connector/app access is managed by connector configuration, RBAC, vault policy, and tool permissions. There is no generic Codex `[apps]` boolean table. |
| **OpenAI Developers plugin** | Not bundled. Connect OpenAI through the provider profile and API, attach an OpenAI-focused MCP server, or package corresponding docs/tools as an Allternit plugin. |

## Models, prompting, and generated media

Allternit routes provider/model identifiers through a provider-agnostic gateway.
The REST API accepts reasoning effort and multimodal messages; individual model
capabilities and pricing remain provider properties.

```toml
default_model = "openai/gpt-5"

[auth]
active_profile = "local"

[auth.profiles.local]
provider = "openai-compatible"
api_key_env = "LOCAL_API_KEY"
base_url = "http://localhost:11434/v1"
```

```bash
curl http://127.0.0.1:8013/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"allternit-reasoning","reasoning_effort":"high","messages":[{"role":"user","content":"Review this design"}]}'
```

| Codex concept | Allternit mapping |
|---|---|
| **Provider id selected from [model_providers]. Default: "openai".** | Select `provider/model` with `default_model` or `--model`; auth profiles define `provider`. There is no implicit requirement that OpenAI be the default. |
| **Optional base URL override for the built-in OpenAI provider.** | `auth.profiles.<name>.base_url` supports any OpenAI-compatible server. Ensure it includes the provider's expected `/v1` base path. |
| **These IDs are reserved. Use a different ID for custom providers.** | Avoid built-in ids such as `openai`, `anthropic`, `google`, and `kimi`; use `openai-compatible` or a unique adapter id for custom endpoints. |
| **Optional manual model metadata. When unset, Codex uses model or preset defaults.** | The model registry and provider adapters supply capabilities. A general user TOML block for arbitrary model metadata is not public; add metadata in the registry/adapter when integrating a model. |
| **Reasoning & Verbosity (Responses API capable models)** / **Reasoning effort: minimal | low | medium | high | xhigh** | `/v1/chat/completions` accepts `reasoning_effort`: `none`, `minimal`, `low`, `medium`, `high`, or `xhigh`; the TUI uses variants/settings where supported. |
| **Reasoning summary: auto | concise | detailed | none** | TUI controls request and display of thinking (`alwaysThinkingEnabled`, `showThinkingSummaries`), but it does not expose this exact four-value summary enum. |
| **Show raw reasoning content when available. Default: false** / **Suppress internal reasoning events from output. Default: false** | `showThinkingSummaries` and the `display_thinking` keybinding control local display. API callers receive provider-supported reasoning fields/events and decide what to expose. Raw chain-of-thought availability is provider-dependent. |
| **Optional override used when Codex runs in plan mode: none | minimal | low | medium | high | xhigh** | Use the session/model `reasoning_effort` or TUI `effortLevel`; no separate plan-mode effort key is documented. |
| **Optional model override for /review. Default: unset (uses current session model).** | `gizzi --model …` or a review profile selects the model for that invocation. `/review` otherwise uses the active session model; no dedicated review-model setting is public. |
| **Preferred service tier. Use fast or another tier supported by the active model.** | Provider-specific service tiers are not a portable Allternit config key. Choose a model/provider profile or routing alias; provider-specific options require adapter support. |
| **Prompting** / **Personalize ChatGPT** | Use system messages, project instruction files, `AGENTS.md`, skills, agent identity files (`SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`), and saved profiles. ChatGPT account personalization is not applicable to self-hosted/BYOC runs. |
| **Restrict ChatGPT login to a specific workspace id. Default: unset.** | Not applicable to ChatGPT login. Allternit uses provider API-key/OAuth profiles plus platform organization/RBAC controls; tenant restriction belongs in the identity provider and server policy. |
| **Optimize Metadata** | Keep session metadata structured and minimal, choose meaningful agent/model ids, and use server-side session fields for filtering. There is no Codex metadata optimizer command. |
| **Image generation** | The runtime and Tool Belt support multimodal image content and injectable backends, but a first-party text-to-image tool/endpoint is not documented in the public Allternit API. Attach an image-generation MCP/tool or provider adapter; a bundled generator is roadmap. |

## Observability, UI state, and configuration-only Codex keys

```toml
[experimental]
openTelemetry = true
```

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.example.com
export OTEL_SERVICE_NAME=gizzi-code
export GIZZI_EXPERIMENTAL_OPEN_TELEMETRY=true
```

| Codex concept | Allternit mapping |
|---|---|
| **OpenTelemetry (OTEL) - disabled by default** | Equivalent: OTEL spans are opt-in with `experimental.openTelemetry` and standard `OTEL_*` environment variables. Anonymous product analytics are separate and can be disabled with `DISABLE_TELEMETRY=1`. |
| **Metrics exporter: none | statsig | otlp-http | otlp-grpc** | OTLP export is delegated to the configured OpenTelemetry SDK/collector. `statsig` is not a public Allternit exporter selector; use `none` by leaving OTEL disabled. |
| **Trace exporter: none (default) | otlp-http | otlp-grpc** | Same collector-based OTEL mapping; protocol selection belongs in standard OTEL exporter configuration rather than an Allternit-specific enum. |
| **In-product notices (mostly set automatically by Codex).** / **Internal tooltip state keyed by model slug. Usually managed by Codex.** / **Show onboarding tooltips in the welcome screen. Default: true** | Product-specific UI state. Allternit has onboarding/tip keybindings and local UI state, but does not expose Codex's notice/tooltip schema as supported user configuration. |
| **Ordered list of footer status-line item IDs. When unset, Codex uses:** / **Set to [] to hide the footer.** | Roadmap. The current TUI has configurable keybindings and rendering options, not a public arbitrary footer-item list. |
| **Ordered list of terminal window/tab title item IDs. When unset, Codex uses:** | The TUI has a terminal-title toggle, but no public ordered title-component list. |
| **Notification mechanism for terminal alerts: auto | osc9 | bel. Default: "auto"** | No documented selector. Terminal notifications depend on the host terminal/runtime; this is roadmap if users need explicit OSC 9 vs BEL control. |
| **Syntax-highlighting theme (kebab-case). Use /theme in the TUI to preview and save.** | The TUI supports appearance/rendering settings, but no documented `/theme` command or stable syntax-theme config exists. Roadmap. |
| **Place fixed arguments before the opened path.** | No public editor-launcher argument-order compatibility setting is documented. Configure the external editor command/wrapper in the shell instead. |
| **Suppress the warning shown when under-development feature flags are enabled.** | No equivalent public switch; experimental warnings should remain visible in self-hosted deployments. |
| **Surfaces and experiences** | Allternit exposes CLI/TUI, web/desktop surfaces, SDKs, OpenAI-compatible REST, MCP, remote hosts, and mobile/remote bridges. Availability depends on the deployed components. |
| **This file lists the main keys Codex reads from config.toml, along with default** | Allternit's authoritative counterpart is the [`config.toml` reference](../gizzi/configuration.md). Do not copy Codex keys verbatim. |
| **Sample Configuration** | Use the combined sample below as an Allternit baseline. |

```toml
default_model = "anthropic/claude-sonnet-4"
instructions = ["AGENTS.md", ".gizzi/INSTRUCTIONS.md"]
active_permission_profile = "workspace-write"

[auth]
active_profile = "work"
credential_store = "auto"

[auth.profiles.work]
provider = "anthropic"
api_key_env = "ANTHROPIC_API_KEY"

[sandbox]
mode = "workspace-write"
allow_network = false

[approval_policy]
mode = "on-request"

[history]
persistence = "save-all"
max_bytes = 5242880

[compaction]
auto = true
prune = true

[experimental]
openTelemetry = false
```

## Product-specific gaps at a glance

The following are intentionally not presented as implemented equivalents:
Codex-managed notices/tooltips, WSL provisioning, native Windows sandbox
elevation, configurable compaction-prompt files, configurable instruction byte
limits/fallback filenames/root markers, per-app and per-skill boolean tables,
MCP OAuth callback/store controls, MCP resources, marketplace submission,
first-party image generation, footer/title/notification/theme schemas, Prisma
AIRS, Codex Security scans, deterministic record/replay, rollout token weights,
and service-tier/review/plan-specific model knobs. These are either vendor UI
details, deployment responsibilities in the self-host/BYOC model, or explicit
roadmap opportunities.

## Related documentation

- [Configuration reference](../gizzi/configuration.md)
- [Advanced configuration](../cli/advanced-configuration.md)
- [Permission profiles](../cli/permission-profiles.md)
- [History persistence](../cli/history-persistence.md)
- [MCP integration](../tools/mcp.md)
- [Build plugins](../cli/build-plugins.md)
- [Reasoning events](../cli/reasoning-events.md)
- [Observability and telemetry](../cli/observability.md)
- [Sessions API](../api/sessions.md)
