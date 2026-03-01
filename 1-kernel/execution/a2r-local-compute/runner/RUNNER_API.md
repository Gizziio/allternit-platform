# Runner Service API (v0)

Goal
- Execute capsules on local or cloud runners.
- Stream EventEnvelope entries and artifacts back to apps/api.

## Start run

`POST /runner/runs`

Request:
```json
{
  "request_id": "req_01HV...",
  "tenant_id": "tenant_default",
  "capsule_hash": "sha256:...",
  "context_bundle_hash": "sha256:...",
  "policy_decision_id": "pol_01HV...",
  "runner": "local"
}
```

Response:
```json
{
  "run_id": "run_abc",
  "status": "queued"
}
```

## Stop run

`POST /runner/runs/{run_id}/stop`

Request:
```json
{
  "request_id": "req_01HV...",
  "tenant_id": "tenant_default"
}
```

## Run status

`GET /runner/runs/{run_id}/status`

Response:
```json
{
  "run_id": "run_abc",
  "status": "running",
  "started_at": 1730000000
}
```

## Event stream

`GET /runner/runs/{run_id}/events`
- SSE stream of EventEnvelope.

## Artifacts

`GET /runner/runs/{run_id}/artifacts`
- List artifacts emitted by the run.

## Event + audit requirements

Runner MUST emit:
- RunRequested, RunScheduled, RunStarted
- ToolCallStarted/Completed
- RunCompleted or RunFailed

All events include:
- correlation_id
- causation_id
- idempotency_key
- trace_id

## Local runner (MVP-1)

- In-process execution using runtime-core.
- Stores artifacts in `packages/data/artifact-registry`.
- Emits events via `packages/data/messaging` EventBus.

## Cloud runner (upgrade)

- Nomad adapter as the first target.
- Runner agent receives capsule + context bundle, reports events back.
