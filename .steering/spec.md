# Steering spec — pipeline Phase 4: queue consumption (build-queue.sh)

## Requirements

- [ ] R1: WHEN invoked with no arguments, THE SYSTEM SHALL list the queued
  specs with their builds.json status, and WHEN the queue is empty, THE
  SYSTEM SHALL print "queue is empty" and exit 0 without touching rails.
- [ ] R2: WHEN build work is requested (`--all` or explicit slugs) and
  `rails-ensure.sh` fails, THE SYSTEM SHALL abort non-zero before any spawn.
- [ ] R3: WHEN a slug is already recorded `building`/`built` (and announced)
  in `.pipeline/builds.json`, THE SYSTEM SHALL skip it.
- [ ] R4: WHEN building a slug, THE SYSTEM SHALL generate
  `.pipeline/builds/<slug>-TASK.md` containing the executor conventions
  (checkpoint updates, authoritative `[steering]`, NOTES with YAML
  frontmatter + `.sentinel`, single commit naming the slug, no merge/push)
  followed by the full spec content.
- [ ] R5: WHEN building a slug, THE SYSTEM SHALL record `building` with a
  timestamp, `ao-spawn --worktree build-<slug>` with `$BUILD_AGENT_CMD`
  (default `kimi --yolo`), copy the task file into the worktree, and
  `ao-send` a one-line prompt pointing at the in-worktree task file path.
- [ ] R6: WHEN `--no-wait` is not passed, THE SYSTEM SHALL block on
  `ao-watch build-<slug> <worktree>/docs/BUILD_<SLUG>_NOTES.sentinel 3600 30`;
  on exit 0 record `built`, on exit 3/4 record `failed` with the exit code.
- [ ] R7: WHEN a watch verdict is recorded, THE SYSTEM SHALL announce to
  rails thread `wih:pipeline-builds` with asset_ref = the NOTES path in the
  worktree and note `built: <slug> — awaiting human merge review` (or
  `failed: <slug>`); WHEN the announcement fails, THE SYSTEM SHALL log to
  errors.log, exit non-zero, and record `announced: false` so a later run
  retries ONLY the announcement (no re-spawn).
- [ ] R8: WHEN `ao-spawn` or `ao-send` fails for a slug, THE SYSTEM SHALL
  record `failed` with a reason in builds.json AND log to errors.log (no
  silent stuck `building` state).
- [ ] R9: THE SYSTEM SHALL never run `git merge` or `git push`; the human
  merge of `ao/build-<slug>` is the boundary, and the task file says so.
- [ ] R10: WHEN `--no-wait` is passed, THE SYSTEM SHALL spawn and return
  without watching, leaving status `building`.

## Out of scope

- Auto-merge, auto-push, or PR creation of build branches.
- Changes to `rails-ensure.sh`, `scout.cjs`, `generate-spec.cjs`,
  `check-spec.sh` (bug fixes only).
- Retrying a `failed` build automatically (a failed-but-announced slug may
  be rebuilt by an explicit re-run; only announce retries are automatic).

## Acceptance

- `bash .pipeline/bin/build-queue-test.sh` passes, covering: rails-ensure
  abort before spawn; task-file content + conventions; spawn/send/watch
  session names and paths; `built` recorded; awaiting-merge announcement;
  built-skip on re-run; `--no-wait`; watch-failure → `failed` + announce;
  announce failure → `announced: false` + errors.log + non-zero, then a
  retry run that re-announces WITHOUT re-spawning; ao-send failure →
  `failed` + errors.log; empty queue exit 0.
- `bash .pipeline/bin/build-queue.sh` with an empty queue prints
  "queue is empty", exit 0.
