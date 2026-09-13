# Steering checkpoint — session/adocs2-0913 (A:// task DAG A-T1–A-T5)

## Goal
Owner directive: record the five remaining items as a task DAG, implement all
in dependency order on PR #473's branch (do NOT merge), update docs to
completion, verify with tests + live evidence.

## Just did
- MASTER_TRACKING.md: A-T1..A-T5 recorded with definitions of done + deps.
- A-T1 (V165): handoff chains validated at the route; cowork_handoffs.job_id
  linkage; POST .../handoffs/:id/ack completes the linked job (typed result,
  handoff.completed event). Test: test_handoff_ack_completes_linked_job.
- A-T2 (V165): cowork_memory_entries owner_principal + grants; /cowork/memory
  principal-scoped read/write with default-deny. Test: test_memory_principal_grants.
- A-T3 (V166): cowork_delegation_rules + intent orchestration columns;
  orchestrate_pending_intents + record_orchestration_results; 2s tick loop in
  main.rs. Test: test_al_orchestration_loop.
- A-T4: cmd/gizzi-code/src/runtime/fabric-transport/worker.ts (+entry) —
  long-poll claim, Sandbox.wrap execution, heartbeat, checkpoints, typed
  Result. tsc clean.
- A-T5 (V167): cowork_connector_secrets (env-var references) +
  cowork_connector_sessions; request (lease+policy validated, approval-gated
  critical capabilities) + system-side invoke (secret never leaves server;
  honest simulated path). Test: test_connector_broker_sessions.
- Docs: A_PROTOCOL scorecard, contract changelog (5th+6th), conformance
  matrix §5b, AL/GIZZI/BOT/SCHEMA specs — all A-T items Implemented, no stale
  open-item lists.
- Live: orchestrator delegated intent→gizzi and recorded completion; the real
  bun TS worker claimed/executed/completed a job; handoff ack completed linked
  job (cyclic chain 409); memory grants visible to owner+grantee; broker
  session invoked the local webhook catcher (HTTP 200, no secret in response).
  22/22 tests, build clean, clippy clean.

## Next
- Commit, push (updates PR #473), report. Stop before merge.

## Open questions
- none.
