# Checkpoint — session/cu7-tsdk

## Goal
Align sdk/computer-use TS client/stream contracts with the shipped gateway contract from PR #152. PR, do NOT merge.

## Just did
- types.ts: ExecuteResponse = gateway ExecutionResult envelope (error adapted to EngineError); added DirectActionOutcome/DirectRunResult; EngineEvent.session_id/mode/target_scope optional (SSE envelope lacks them); EngineEventType += 'approval.resolved','run.ended'; exported new types via index.ts.
- client.ts: normalizeExecuteResponse (gateway string|null error -> EngineError|null); fixed getRunEvents path -> /computer-use/runs/{id}/events (after_index unsupported by gateway); @deprecated pauseRun/resumeRun/getPendingApproval with pointer to run-events stream; doc updates.
- events.ts: route -> {endpoint}/computer-use/runs/{id}/events; parseEventEnvelope maps {event_type,run_id,message,data} -> EngineEvent; dropped dead named-event listeners + 'done' + after_index (gateway sends no named SSE event fields); run.ended terminal + auto-close.
- approvals.ts: isTerminalEvent += 'run.ended'.
- Tests: client.test.ts +4 (direct contract no-task shape, envelope parse w/ per-action results + artifacts, string-error adaptation, null-error passthrough); new tests/events.test.ts (8 tests: route, envelope parse, junk rejection, waitForApproval awaiting_approval, waitForApproval reject on run.ended, waitForRun run.ended + auto-close, approval.resolved parse, watchRun auto-approve POSTs /approve); conformance.test.ts successBody updated to new envelope.

## Verification
- pnpm test (jest): 110 passed / 4 suites (baseline 98 -> +12 new, 0 failures).
- npx tsc --noEmit: clean.
- eslint src: pre-existing breakage (eslint.config.js needs 'typescript-eslint' package, not installed in this workspace) — unrelated to this change.

## Next
Commit (fix(...) prefix), push -u origin session/cu7-tsdk, gh pr create with contract summary + verification. Do NOT merge.

## Open questions
- None.
