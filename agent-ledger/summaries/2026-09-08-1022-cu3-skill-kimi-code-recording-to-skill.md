# Session cu3-skill — recording → skill compiler path (orphaned teach half connected)

- Date: 2026-09-08 (swarm session, orchestrated by Kimi Code goal run)
- Branch: session/cu3-skill → PR #138 → merge 7e06d6e59

## What was done
`compileBrowserTrajectoryToSkill` existed but nothing produced `BrowserTrajectory` and nothing consumed `BrowserWorkflowSpec`.

- New `infrastructure/chrome-stream/agent-systems/allternit-browser/src/protocol/recording-to-trajectory.ts`: ACU JSONL → `BrowserTrajectory` (action-kind map, provider inference, timestamp normalization, failed-step exclusion, recordings-dir path containment).
- New route `POST /v1/browser-skills/from-recording` (`{recordingId|path, title?, description?, tags?}` → `{workflow, manifest, trajectory-metadata}`).
- `skill-factory.ts`: added **target-aware redaction** — targets like `input[name="password"]` redact `text`/`value`/`input` to `{{password}}` (ACU puts the secret signal in `action_target`; without this, login recordings leak typed passwords).
- Tests: fixture JSONL → trajectory → package, email+password redaction, failed-step exclusion, kind mapping, path containment (49 passed / 8 pre-existing skips).

## Verification
pnpm typecheck clean; pnpm test 49 passed. Live smoke (temp express + curl): package returned with `{{password}}`, `redactions`, manifest↔workflow id match; path-escape rejected 400.

## Honest deferrals / incidents
- Smoke test caught that returning the raw trajectory re-leaked the secret — response now carries trajectory metadata only.
- Planning-loop consumption of BrowserWorkflowSpec is a deliberate follow-up (owned by main-stack, not this session).
