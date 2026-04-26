# Rails Review State

Review state is authoritative only when bound to current head SHA.

## ReviewAgentState
- prId
- headSha
- reviewerId
- reviewRunId
- status: success|failure|pending|timeout
- actionableCount
- findingsDigest
- createdAt

## Rules
- Runner must reject any review state not matching current headSha.
- Rails must dedupe rerun requests by (prId, headSha, reviewerId).
