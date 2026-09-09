# ACI Recipes

Copy-paste flows for common ACI tasks.

## Drive my browser

Start an intent-driven run with a natural-language goal:

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

Then watch the run live:

```bash
curl -N http://127.0.0.1:8013/api/aci/stream/<sessionId>
```

Event types: `trace` (human-readable progress), `state` (structured planning-loop update), `done` (run completed or cancelled). Stop a run with `POST /api/aci/stop/<sessionId>`.

## Replay a recording

The gateway keeps a per-run replay buffer, so attaching to the stream at any time replays the full history before the live tail. To see everything a run has done so far — or its complete history after it finished:

```bash
curl -N http://127.0.0.1:8013/api/aci/stream/<sessionId>
```

The stream ends at the `done` event. (Recordings in the sense of saved, named, re-runnable session captures are not available yet — see the next recipe.)

## Run a taught workflow

> **Not available yet.** Teach mode — demonstrating a workflow once and having
> the agent re-run it on demand — has no shipped surface on `main` today.
> Until it lands, the closest equivalent is an intent-driven run with a
> precisely worded `goal`; the planning loop replays the same approval and
> enforcement path every time. This recipe will be filled in when teach-mode
> ships.

## Approve a risky action

When a run, control call, or tool action is classified risky or irreversible,
the gateway pauses and asks a human. Flow for a flagged run:

1. `POST /api/aci/run` with a sensitive goal returns `202 handoff_required`
   with an `approval_id` and `action_hash`.
2. A human decides:

   ```bash
   curl -X POST http://127.0.0.1:8013/api/aci/handoff/<approval_id>/approve
   # or .../deny
   ```

3. The client retries the **same** run body with `"approvalId"` added; the
   gateway recomputes the SHA-256 action hash and redeems the grant. Any
   change to the payload changes the hash and is denied.

For direct control routes and tools, a `403 confirmation_required` response
carries `approval_id` + `action_hash`; retry with the `approvalId` query param
(REST) or `approval_id` argument (`/tools/execute`) after approval.

Grants are hash-bound, single-use, expiring (default 300s, tuned by
`ALLTERNIT_ACI_GRANT_TTL_SECS`), and receipted. A compromised or modified
client cannot approve its own actions — enforcement is server-side. See the
[Guide](./guide.md#approvals-and-server-side-enforcement) for the full model.
