# Checkpoint

## Goal
cu3-skill: Recording-to-skill compiler path. Producer converting ACU JSONL recordings to BrowserTrajectory, compile through compileBrowserTrajectoryToSkill into skill package, expose via HTTP route, tests with redaction asserted, typecheck verified. Touch only infrastructure/chrome-stream/**.

## Just did
- Scoped: actual files are src/protocol/skill-factory.ts and src/browser/routes/protocol.ts (brief's paths were approximate).
- Read ACU recording format (domains/computer-use/core/core/action_recorder.py, read-only): line 0 = manifest `_type:"manifest"` (recording_id, task, session_id, run_id, vision_provider, adapter_id, started_at...), lines 1+ = frames (step, timestamp, action_type, action_target, action_params, reasoning, reflection, action_succeeded, ...).
- Read protocol schemas: ActionKind enum, BrowserTrajectory, ActionIntent (needs Z-suffixed ISO datetime — Python emits +00:00, must normalize).
- Tooling: package @allternit/browser, `pnpm --filter @allternit/browser typecheck` / `test` (vitest).
- Implemented: src/protocol/recording-to-trajectory.ts (JSONL → BrowserTrajectory, action-kind map, provider inference, timestamp normalization, path containment), POST /v1/browser-skills/from-recording route in src/browser/routes/protocol.ts, exports in src/index.ts, tests in src/protocol/recording-to-trajectory.test.ts (fixture → trajectory → skill package, redaction + failed-step exclusion asserted).
- pnpm install running in worktree (fresh checkout, no node_modules).

## Next
- Commit, push, open PR (do not merge). Work is verified: typecheck clean, 49/49 active tests pass (8 pre-existing skips), route smoke-tested live with redaction + path-escape rejection asserted.

## Open questions
- None blocking. Notes for reviewers: brief's file paths were approximate (actual: src/protocol/skill-factory.ts, src/browser/routes/protocol.ts). Added target-aware redaction to skill-factory.ts (compiler) because ACU recordings carry the secret signal in action_target, not in param keys. Route response omits the raw trajectory (it is unredacted). Unknown ACU action_types map to 'extract' with the original type in input.__acuActionType. pnpm-lock.yaml churn from local install was reverted — not part of the change.
