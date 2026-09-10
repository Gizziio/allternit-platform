# Checkpoint — fabric-pwa-bot-mode-ui (Phase 1A executor)

## Goal
Execute `docs/FABRIC_PWA_BOT_MODE_PHASE_1A_TASK.md` exactly: bot-chat
foundation under `surfaces/ai.allternit.com/src/components/bot-chat/`
(types, transcript fold, SSE cursor client, presentational primitives, 3
vitest suites). No 1B/1C work; no edits to existing source files; no git
operations (orchestrator owns git). Verification = vitest run + tsc --noEmit
from the surface; NOTES sentinel at the end.

## Just did
- Wrote `types.ts` (BotChatMessage/ToolCall/ToolResult/ApprovalRequest/
  TranscriptRow/ToolRunGroup/ActiveTurn), `transcript.ts` (pure fold:
  rungs, tool-run folding with error-break split, gap timestamps,
  formatGap with injectable now, deriveRung), `sse-cursor.ts` (fetch-based
  SSE, `<streamId>:<seq>` cursor, Last-Event-ID reconnect, backoff ≤15s,
  no retry on abort), 9 presentational primitives, and 3 colocated test
  suites (transcript, run-folding, sse-cursor).
- Design calls: `typing` rung opens on `message.user` (turn start);
  message.delta/thinking.delta adopt the assistant id. Gap rows block
  folding (30+ min apart = not consecutive). Error result splits a
  previewed run: run closes before it, error renders standalone.
- `pnpm install` running in background (fresh worktree had no
  node_modules) — required before vitest/tsc.

## Next
- DONE: vitest 31/31 green; `tsc --noEmit` 0 errors (no pre-existing
  failures on this branch).
- DONE: NOTES sentinel docs/FABRIC_PWA_BOT_MODE_PHASE_1A_NOTES.md written;
  milestone notes appended to .allternit/shared-context.md; evidence in
  ~/.agent-orchestrator/evidence/fabric-pwa-bot-mode-ui/.
- Orchestrator: review + merge per repo ritual; Phase 1B picks up from the
  fold event grammar documented in NOTES.

## Open questions
- None blocking. `Markdown` reused from `@/components/ai-elements/markdown`
  (Streamdown, presentational, no view state) — qualifies under the spec's
  reuse clause; flagged in NOTES for 1C review re: bundle weight in the
  desktop static build.
