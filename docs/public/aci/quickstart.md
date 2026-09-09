# ACI Quickstart

## One-command demo

> **Coming soon — not yet available on `main`.** A single `demo` command that
> launches a self-contained ACI demonstration (one command, one browser run,
> live screenshot stream) is being packaged in a companion change. Until it
> lands, use the manual quickstart below — it exercises the same surface the
> demo command will wrap.

## Manual quickstart: drive a browser with one API call

ACI browser runs start with a natural-language goal:

```bash
curl -X POST http://127.0.0.1:8013/api/aci/run \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Find the latest release notes on github.com/allternit/allternit",
    "model": "claude-sonnet-4-6",
    "allowedSites": ["github.com"],
    "openLinksInBrowser": true,
    "autoVerify": false
  }'
```

Response:

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "adapterId": "browser"
}
```

The run streams events over SSE at `/api/aci/stream/{sessionId}`. Event types include:

| Type | Meaning |
|------|---------|
| `trace` | Human-readable progress message from the ACU gateway |
| `state` | Structured state update from the planning loop |
| `done` | Run completed or was cancelled |

Watch a run live:

```bash
curl -N http://127.0.0.1:8013/api/aci/stream/550e8400-e29b-41d4-a716-446655440000
```

If the run needs human approval for a risky action, it returns
`202 handoff_required` with an `approval_id` — see
[Approve a risky action](./recipes.md#approve-a-risky-action) in the Recipes.

Next: the [Guide](./guide.md) covers the integration modes, the action space,
approvals enforcement, and environments in depth.
