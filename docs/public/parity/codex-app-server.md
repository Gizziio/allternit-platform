# Codex App Server parity

Codex App Server is a local, bidirectional protocol used by rich clients to
drive Codex. Its primitives are threads, turns, streamed items, approvals,
configuration, authentication, and process/tool execution.

Allternit exposes the same concerns through two composable surfaces rather than
a wire-compatible App Server:

- the Allternit API owns durable sessions, child threads, budgets, resources,
  metadata, and ordered event streams;
- Gizzi Code owns the interactive agent loop, tools, skills, MCP, sandboxing,
  permissions, model selection, and local process lifecycle.

There is no claim of JSON-RPC compatibility. A client written specifically for
Codex App Server needs an adapter.

## Getting started and protocol

Start the self-hosted API, obtain an Allternit/Clerk credential appropriate to
the route, and create a managed session:

```bash
export ALLTERNIT_URL=http://localhost:8013/api/v1
export CLERK_JWT='<session JWT>'

curl -sS -X POST "$ALLTERNIT_URL/beta/sessions" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "repository-maintenance",
    "metadata": {"repository": "acme/widget"},
    "budget": {"max_turns": 20, "max_tool_calls": 80}
  }'
```

The Codex initialization handshake has no direct equivalent. HTTP
authentication and API versioning initialize an Allternit client; Gizzi loads
user, project, inline, and managed configuration when its process starts.
Managed-session communication is HTTP plus ordered SSE or WebSocket events,
not JSON-RPC over stdio. API errors use HTTP status codes and JSON bodies;
runtime failures and refusals appear in the event stream.

The stable API does not require an experimental opt-in. Routes under `/beta`
are explicitly versioned as beta. There is no equivalent of
`experimentalFeature/list`; feature availability is determined by the deployed
version and its configuration.

## Authentication

Codex can exchange a ChatGPT device code or accept a host application's
`chatgptAuthTokens`. Those modes are **not applicable / roadmap** in Allternit's
self-hosted/BYOC architecture: Allternit does not broker ChatGPT subscriptions
or accept ChatGPT account tokens.

Allternit separates control-plane identity from model-provider credentials:

- managed session routes require `Authorization: Bearer <Clerk JWT>`;
- OpenAI-compatible inference routes accept an Allternit API key;
- Gizzi supports named provider profiles backed by an environment variable,
  file, or OS keyring;
- session resources can hold encrypted API keys or vault references without
  putting secrets in prompts.

```bash
gizzi auth login --api-key "$ANTHROPIC_API_KEY" \
  --provider anthropic --profile work
gizzi auth status
gizzi auth profile set-active work
```

```toml
# ~/.config/gizzi-code/config.toml
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

Consequently, Codex App Server's ChatGPT auth endpoints and externally managed
ChatGPT-token refresh callbacks have no equivalent. The Allternit API's normal
HTTP authentication is the supported auth boundary.

## Core primitives and lifecycle

| Codex concept | Allternit mapping |
|---|---|
| Thread | Durable `/beta/sessions` record. `parent_thread_id` creates a child thread. |
| Turn | A Gizzi prompt/agent-loop iteration; durable consumers record progress as ordered session events. |
| Item and item delta | Event `data`; `thinking_delta`, `content_block_delta`, `tool_calls`, and `refusal` are appendable runtime events. |
| Thread/turn status | Session `status`, timestamps, budgets, and SSE/WebSocket events. |
| Stored resources | `/beta/sessions/:id/resources` and `/files`; sensitive values are encrypted or referenced through a vault. |
| Process/tool execution | Gizzi `bash`, native Tool Belt tools, skills, plugins, and MCP tools. |

### Start, resume, read, and list threads

`POST /beta/sessions` starts a durable session. `GET /beta/sessions/:id` reads it
without starting a model turn. A caller resumes by reusing the session id and
continuing from its stored state/events; Gizzi also exposes `/resume` in its
interactive UI.

```bash
# Read one stored thread
curl -sS "$ALLTERNIT_URL/beta/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $CLERK_JWT"

# List active top-level or child sessions
curl -sS "$ALLTERNIT_URL/beta/sessions?status=active" \
  -H "Authorization: Bearer $CLERK_JWT"
curl -sS "$ALLTERNIT_URL/beta/sessions?parent_thread_id=$SESSION_ID" \
  -H "Authorization: Bearer $CLERK_JWT"
```

Filtering by `status` and `parent_thread_id` is supported, but cursor pagination
is **roadmap**. There is no separate server-side concept of “loaded threads,” nor
an unsubscribe RPC: close the SSE/WebSocket connection to unsubscribe. Thus
“list loaded threads” is local-client state, not an API resource.

The durable API does not expose a separate `turn/list`; consumers reconstruct
turn history from the ordered event stream. Full turn grouping is **roadmap**.

### Events, deltas, warnings, and interruption

Subscribe with SSE or WebSocket. `after` provides resumable delivery by sequence
number and is the Allternit equivalent of turn events, item deltas, and thread
status notifications.

```bash
curl -N "$ALLTERNIT_URL/beta/sessions/$SESSION_ID/events?after=0" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H 'Accept: text/event-stream'

curl -sS -X POST "$ALLTERNIT_URL/beta/sessions/$SESSION_ID/interrupt" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H 'Content-Type: application/json' \
  -d '{"data":{"reason":"user_pressed_stop"}}'
```

System events include `session_created`, `budget_updated`, `budget_exceeded`,
`user_interrupt`, and `session_archived`. Runtime warnings do not have a
dedicated App-Server-compatible notification type; clients should interpret
typed events and HTTP errors. Notification opt-out is transport-level: do not
subscribe, close the stream, or reconnect with `after=<last sequence>`.

Appending `content_block_delta` or another supported event is the low-level way
for a runtime to inject output into a session. Arbitrary user-item injection and
steering an already executing turn are **roadmap**; interruption followed by a
new Gizzi prompt is the supported workflow.

### Metadata, goals, compaction, archive, and deletion

Update a stored thread's name, metadata, or budget with `PATCH`:

```bash
curl -sS -X PATCH "$ALLTERNIT_URL/beta/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"repository-maintenance: tests",
    "metadata":{"goal":"repair flaky tests","priority":"high"},
    "budget":{"max_turns":30,"max_tool_calls":120}
  }'
```

There is no typed goal RPC. Store a goal in `metadata` and use the budget fields
for limits. Gizzi's `/compact` command summarizes conversation history and its
`/rewind` flow rolls back local conversation/file state. These are interactive
runtime operations, not durable-session HTTP endpoints.

`DELETE /beta/sessions/:id` archives rather than destroys a session. Event
history remains readable, and archived sessions reject new events and
interrupts. Hard delete and unarchive are **roadmap**; Allternit deliberately
defaults to recoverable, auditable retention.

## Models, configuration, and external agent config

Codex `model/list` maps to the OpenAI-compatible model catalog:

```bash
export ALLTERNIT_API_KEY='ak-...'
curl -sS http://localhost:8013/v1/models \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY"
```

There is no config JSON-RPC layer. Applications manage settings by writing the
documented Gizzi configuration sources or by setting `GIZZI_CONFIG` /
`GIZZI_CONFIG_CONTENT`. For example:

```toml
default_model = "anthropic/claude-sonnet-4"

[sandbox]
mode = "workspace-write"

[approval_policy]
mode = "on-request"

[approval_policy.granular]
sandbox_approval = true
skill_approval = true

[permission]
read = "allow"
edit = "ask"
bash = "ask"
```

Gizzi merges remote organization defaults, user config, project config,
`.gizzi/` plugins, inline config, and managed enterprise config. This is the
equivalent of importing externally managed agent configuration. It does not
probe Codex installations or translate `config.toml` from another agent;
automatic cross-agent detection/import is **roadmap**.

There is no public `configRequirements/read` RPC. Administrators express
requirements through higher-precedence managed configuration and permission
policy; clients discover the effective behavior when Gizzi loads that policy.

## Approvals, permissions, and sandbox access

Codex has distinct approval request types for commands, file changes, and MCP
tools. Allternit applies one permission system across built-in tools, edits,
skills, plugins, and namespaced MCP tools. Rules are `allow`, `ask`, or `deny`,
and `/permissions` manages them interactively.

The TOML example above maps command-execution approvals to `bash = "ask"`, file
change approvals to `edit = "ask"`, and MCP/app approvals to the registered
tool's permission key. A denied request never executes. Computer-use workflows
add `never`, `on-risk`, and `always` approval levels and emit
`approval.required` / `approval.received` events.

Codex `ReadOnlyAccess` maps to the sandbox preset:

```toml
[sandbox]
mode = "read-only"
```

Additional readable directories can be granted interactively with `/add-dir`.
Permission requests are rendered by the Gizzi client and resolved before tool
execution; there is no public App-Server-compatible approval-response RPC.

## Commands, processes, and clean terminals

Gizzi's `bash` tool executes shell commands subject to sandbox and permission
policy. A user can also launch a noninteractive turn:

```bash
gizzi --print "Inspect the repository and report failing tests"
```

Skills are invoked by naming the installed skill in the prompt or using its
registered slash command; the same permission system can require skill
approval. This maps to “start a turn (invoke a skill),” although it is not a
`turn/start` RPC.

Codex App Server's process handles, `command/exec`, `thread/shellCommand`, and
clean background-terminal management have no stable HTTP equivalent. Gizzi
owns child-process cleanup within its runtime, while deployments should use
their normal container or service supervisor. Long-lived, addressable terminal
process RPCs are **roadmap**.

## Apps, MCP, dynamic tools, and elicitation

Codex apps/connectors map to Allternit plugins and MCP servers. Gizzi merges
bundled and user-configured MCP servers at startup, registers their tools in the
Tool Belt, supports OAuth for remote MCP servers, and presents MCP elicitation
forms in interactive and SDK modes. MCP tool calls go through normal permission
approval.

The SDK can attach tools dynamically at runtime:

```typescript
import { ToolRegistry } from '@allternit/sdk/ai-runtime/tools';
import { NativeToolBelt } from '@allternit/sdk/ai-runtime/tools/search';

const registry = new ToolRegistry();
const belt = new NativeToolBelt(registry);

await belt.attachMcpServer({
  serverId: 'tickets',
  listTools: async () => [{
    name: 'read',
    description: 'Read a ticket',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    }
  }],
  callTool: async (name, args) => ({ content: `${name}: ${args.id}` })
});
```

This is the functional equivalent of experimental dynamic tool calls, but it
uses the SDK registry rather than a Codex JSON-RPC request. See [MCP
Integration](../tools/mcp.md) and [Native Tool Belt](../tools/tool-belt.md).

## Experimental and platform-specific features

The following Codex-specific facilities do not currently have public Allternit
API equivalents:

| Facility | Status in Allternit |
|---|---|
| Fuzzy file-search events | **Roadmap.** Gizzi can glob/grep/search files, but does not stream a dedicated fuzzy-search event protocol. |
| Execution-environment inspection RPC | **Roadmap.** Tools can inspect their environment with permitted shell/read operations; no typed environment descriptor endpoint exists. |
| Windows sandbox setup and setup events | **Not applicable / roadmap.** Sandboxing is configured by policy and the host runtime. Allternit has no Codex-compatible Windows setup RPC or event sequence. |
| Roll back recent durable turns | **Roadmap.** Gizzi `/rewind` is local; the append-only managed event log is not rewritten. |
| Unarchive or hard-delete a thread | **Roadmap.** Current deletion is an auditable soft archive. |
| Start/steer/inject through App Server methods | **Roadmap.** Use Gizzi for the live loop and the session API for durable state/events. |

## API overview

| Operation | Allternit surface |
|---|---|
| Start thread | `POST /api/v1/beta/sessions` |
| Read thread | `GET /api/v1/beta/sessions/:id` |
| List/filter threads | `GET /api/v1/beta/sessions?status=...&parent_thread_id=...` |
| Update metadata/goal/budget | `PATCH /api/v1/beta/sessions/:id` |
| Archive thread | `DELETE /api/v1/beta/sessions/:id` |
| Stream turn/item/status events | `GET .../:id/events` or `GET .../:id/events/ws` |
| Append runtime delta | `POST .../:id/events` |
| Interrupt | `POST .../:id/interrupt` |
| Attach credentials/files | `POST .../:id/resources` or `POST .../:id/files` |
| List models | `GET /v1/models` |
| Execute tools/commands/skills | Gizzi interactive or `gizzi --print` |
| Configure approvals/sandbox | Gizzi `config.toml` and `/permissions` |

For exact request and response schemas, see [Sessions API](../api/sessions.md),
[Events API](../api/events.md), [API reference](../api/reference.md), and [Gizzi
configuration](../gizzi/configuration.md).
