# Automation Service (Nova-style) Spec (v0)

Goal
- Execute forward-moving action plans using ToolABI.
- Keep actions policy-gated, confirmed, and auditable.

## Core loop

1) Plan
- gizzi-core produces an ActionPlan (steps + expected outcomes).

2) Validate
- API evaluates policy for each step.
- Denied steps stop the plan.

3) Confirm
- User explicitly approves the plan (or individual steps).

4) Execute
- Steps are executed via ToolABI and tools-gateway.
- Each step emits EventEnvelope + PolicyDecisionArtifact.

5) Verify
- Optional verification step compares expected vs actual.

## ActionPlan contract

```json
{
  "plan_id": "plan_01HV...",
  "request_id": "req_01HV...",
  "tenant_id": "tenant_default",
  "actor_id": "gizzi-core",
  "subject_id": "user_123",
  "summary": "Deploy workflow capsule",
  "steps": [
    {
      "step_id": "step_1",
      "description": "Build capsule",
      "tool": "capsule.build",
      "arguments": { "project_id": "proj_123" },
      "requires_confirmation": true
    }
  ]
}
```

## Endpoints (initial)

- `POST /api/automation/plan`
  - validate and store plan
- `POST /api/automation/confirm`
  - confirm plan or specific steps
- `POST /api/automation/execute`
  - execute confirmed steps
- `GET /api/automation/{plan_id}/status`
  - current state + step results

## Event + audit requirements

Each plan MUST emit:
- PlanCreated
- PlanValidated (policy decisions)
- PlanConfirmed
- StepStarted / StepCompleted / StepFailed
- PlanCompleted / PlanFailed

Each step MUST emit:
- ToolCallStarted / ToolCallCompleted
- PolicyDecisionArtifact

## Safety constraints

- Default to confirmation required for side effects.
- Idempotency enforced via `request_id`.
- Steps must be re-entrant and resumable.

## Implementation notes

- Execution engine lives in `packages/orchestration/control-plane-service`.
- Automation service is a thin adapter (HTTP/WS) over the core.
- Tools are executed via `packages/security/tools-gateway`.
