# Agents API

Allternit Agents is one product with two specialties:

- **Cloud Agents** — API-driven agent sessions. You create a session with an
  agent and a computer kind, send user events, and read the event stream.
  This is the same kind of product as hosted agent sessions, on Allternit's
  own session model. See [Sessions](sessions.md) for the full reference.
- **Bot Agents** — the existing Bot contract for persistent desktop/chat
  agents. It is unchanged by this API.

Underneath both sits the model access layer, exposed directly for callers
who want to drive their own loop:

- **Completions** — `POST /api/agents/v1/chat/completions`
- **Responses** — `POST /api/agents/v1/responses`

## Which surface do I use?

| You want to… | Use |
|---|---|
| Send a prompt and get a model completion back | Completions |
| Send a prompt with tools/instructions and get a structured response | Responses |
| Run a stateful agent over multiple turns, with events and history | Cloud Agents sessions (`/api/v1/sessions`) |
| Operate a persistent desktop or messaging agent | Bot Agents (existing contract) |

## Cloud Agents at a glance

Base URL: `/api/v1`. Auth: `Authorization: Bearer <clerk_jwt>` (Clerk session
or API key — the same middleware as the rest of the platform). No
`OpenAI-Beta` header is required; if you send one it is ignored.

```bash
curl -X POST http://localhost:8013/api/v1/sessions \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": { "model": "kimi-k2", "instructions": "Be terse." },
    "computer": { "kind": "none" },
    "input": "Summarize the repo layout.",
    "stream": false
  }'
```

```json
{
  "session": {
    "id": "9f…",
    "agent_id": "3c…",
    "status": "running",
    "computer": { "kind": "none", "id": null },
    "created_at": "2026-09-10 12:00:00",
    "updated_at": "2026-09-10 12:00:00",
    "archived_at": null
  }
}
```

Sessions use Allternit event type names (`session.created`, `turn.started`,
`agent.message`, …) and Allternit status names (`idle`, `running`,
`waiting`, `failed`, `archived`). Turns are listed at
`GET /api/v1/sessions/:id/turns`. Session create can bind a `brain_id` and
`vault_ids` (unknown ids return `400`). `/api/v1/vaults` is the public
alias of `/api/v1/beta/vaults`. `GET /agents/:id/toolset` returns the agent's
tools, allowed_tools, and allowed_skills (`tool_search` and MCP are not
bound on this surface yet). `/api/v1/schedules` aliases `/beta/deployments`.
There is no public `/runtimes` resource; the computer binding lives on the
session. `computer.kind` `sandbox` and `desktop` provision a Computer Cloud
desktop (Cloud Desktop / Incus / Tart), not Fly. `fabric` returns `400`.

## SDK

The TypeScript SDK ships a Cloud Agents client as `@allternit/sdk/cloud-agents`:

```ts
import { Allternit } from "@allternit/sdk/cloud-agents";

const allternit = new Allternit({ apiKey, baseURL: "http://localhost:8013" });
const session = await allternit.sessions.create({
  agent: { model: "kimi-k2", instructions: "Be terse." },
  computer: { kind: "none" },
  input: "Summarize the repo layout.",
});
for await (const event of allternit.sessions.events.stream(session.id)) {
  console.log(event.type, event.data);
}
await allternit.sessions.events.send(session.id, [
  { type: "user.interrupt" },
]);
await allternit.sessions.archive(session.id);
```

The Python SDK exposes the same client as `allternit.Allternit`.

## Notes

- Completions and Responses (`/api/agents/v1/*`) are unchanged by the Cloud
  Agents release and are documented with the model-routing surface.
- `/api/v1/beta/sessions` keeps working as an alias over the same sessions
  table. New integrations should use `/api/v1/sessions`.
- `computer.kind: "sandbox"` returns `400` unless the account has a hosted
  computer entitlement; it never silently downgrades to `none`.
- `computer.kind: "local"` is a descriptor only in this release: the session
  records the intent and accepts events, but no worker is attached.
