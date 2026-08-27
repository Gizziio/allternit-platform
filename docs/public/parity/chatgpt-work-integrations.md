# ChatGPT Work and third-party integrations parity

This page maps ChatGPT Work concepts, Chronicle memory, and third-party integrations (Amazon Bedrock, Linear, Slack) to Allternit.

## Chronicle

Chronicle is a hosted memory that surfaces screen and conversation context. Allternit's equivalent is the combination of:

- **Session memory** and **history persistence** (see [History persistence](../cli/history-persistence.md)).
- **Memory stores API** (`/api/v1/beta/memory-stores`) for longer-lived facts.
- **Tool Belt** skills that can read files, fetch URLs, and recall previous tasks.

Because Allternit is self-hosted, data stays in your infrastructure; privacy and security are governed by your deployment. Prompt-injection mitigations are provided by the gateway safety classifier and permission policies.

## Get started with ChatGPT Work

ChatGPT Work is a managed multi-user workspace. Allternit provides the same primitives for self-hosting:

- **Workspaces and RBAC** (`/api/v1/admin/workspaces`, `/api/v1/admin/rbac_roles`) for access control.
- **Local or cloud work** via BYOC/self-host or managed cloud deployments. See [BYOC](../self-hosting/byoc.md).
- **Recurring updates** via `/api/v1/beta/deployments` cron scheduling.
- **Presentation and spreadsheet generation** via skills (e.g., `allternit/powerpoint`) and structured `response_format` outputs.

See the [use-case playbooks](../guides/use-case-playbooks.md) for end-to-end examples.

## Use ChatGPT Work and Codex with Amazon Bedrock

Allternit's SDK harness supports Amazon Bedrock as a BYOK provider:

```typescript
import { AllternitHarness } from '@allternit/sdk/ai-runtime/harness';
const harness = new AllternitHarness({
  mode: 'byok',
  byok: {
    bedrock: {
      region: 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  },
});
```

You can also configure an `openai-compatible` auth profile pointing at a Bedrock OpenAI-compatible endpoint. Supported models are listed in the model registry; add a Bedrock model alias if yours is not present.

## Use Codex in Linear

Allternit integrates with Linear through an MCP server. Add it to `~/.allternit/mcp-servers.json`:

```json
{
  "linear": {
    "transport": "stdio",
    "command": ["npx", "-y", "@modelcontextprotocol/server-linear"],
    "env": { "LINEAR_API_KEY": "{{env.LINEAR_API_KEY}}" }
  }
}
```

Then mention Linear issues in a prompt:

```bash
gizzi exec "summarize the Linear issue mentioned in the prompt and propose a fix"
```

The agent can read issues, create comments, and update status through the attached MCP tools.

## Use Codex in Slack

Allternit can receive Slack events via **webhooks** (`/beta/webhooks`). Configure a Slack app to POST message events to an Allternit webhook, then route them to an agent session:

```bash
curl -X POST https://api.allternit.com/beta/webhooks \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -d '{"url":"https://hooks.slack.com/services/...","events":["session.message"]}'
```

The agent can reply by calling the Slack webhook or using an MCP Slack server.

## Manage app updates

In a self-hosted or BYOC deployment, app updates are handled by your package manager or container orchestrator. Managed configurations can pin versions via `/etc/gizzi/config.toml` or a container image tag. In-app update checks can be disabled with:

```toml
[telemetry]
check_for_updates = false
```

## Personalize ChatGPT

Personalization maps to Allternit instructions and memory:

- **Memories**: enable `[history].persistence` and use memory tools to recall context.
- **Personality**: set a system prompt or project `AGENTS.md` file with the desired tone.
- **Management**: edit `~/.gizzi/config.toml` or project `.gizzi/config.toml` to change defaults.

## Troubleshooting

- **App doesn't pick up a teammate's shared local environment**: share environment definitions via managed config or a container image, not local files.
- **Code doesn't run on a worktree**: use `gizzi config path` and `gizzi config list --sources` to verify config; ensure the worktree is trusted.
- **Feedback and logs**: logs live in `~/.gizzi/logs/`; feedback controls are in [Feedback controls](../cli/feedback-controls.md).
- **Files appear that the agent didn't edit**: check the session files API and approval log.
- **Find archived chats**: sessions are archived via `/api/v1/beta/sessions`; query by `status=archived`.
- **Recover a prompt after selecting the wrong target**: use `/api/v1/beta/sessions/:id/interrupt` or start a new `gizzi exec` run.
- **Terminal issues**: verify shell environment policy and login-shell settings in your permission profile.
