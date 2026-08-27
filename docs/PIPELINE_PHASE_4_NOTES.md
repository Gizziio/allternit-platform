---
status: done
files_changed:
  - docs/pipeline/bin/build-queue.sh        # new: queue consumption runner (Phase 4)
  - docs/pipeline/bin/build-queue-test.sh   # new: offline PATH-shim test (50 checks)
  - docs/pipeline/README.md                 # Phase 4 section, full-cycle diagram, commands, testing/layout
  - docs/pipeline/.gitignore                # added builds/ and builds.json
  - .steering/checkpoint.md             # steering checkpoint for this phase
  - .steering/spec.md                   # R1-R10 + acceptance for Phase 4 (gate requirement)
  - docs/PIPELINE_PHASE_4_NOTES.md      # this file
deviations:
  - "List mode (no args) and the empty-queue path are read-only: rails-ensure
    runs only when there is actual build work. This keeps `build-queue.sh`
    with an empty queue side-effect-free (exit 0, 'queue is empty'), which
    the acceptance criteria require; the spec's 'rails-ensure first' is
    honored on every path that can spawn or announce."
  - "The task file is generated under docs/pipeline/builds/ in the main repo and
    then copied into the ao worktree after spawn, because builds/ and queue/
    are gitignored and therefore absent from a fresh worktree; the spec
    content travels embedded in the task file itself."
  - "Worktree path is taken from ao-spawn's stdout ('<session> <workdir>
    <log>') with the derived <repo-parent>/<repo-name>-ao-build-<slug> path
    as fallback — derived, not hardcoded, per spec."
  - "Watch exit codes other than 0 (not just 3/4) also record `failed` with
    the exit code and announce `failed: <slug>` — same handling, slightly
    wider net."
  - "Per steering-gate review: the rails announcement is tracked separately
    from the build status (`announced: false` until a 2xx), so an announce
    failure is retried announce-only by a later run instead of being
    silently lost — same bug class the gate previously found in
    check-spec.sh's READY path."
remaining:
  - "Real (non-stubbed) end-to-end run against a live queue spec requires
    rails on :8013 and a working `kimi --yolo` spawn; only the stubbed test
    was executed here."
---

# Phase 4 NOTES — queue consumption: build-queue.sh

## What was built

`docs/pipeline/bin/build-queue.sh` consumes `docs/pipeline/queue/` (READY specs):

- `build-queue.sh` (no args) lists queue contents with builds.json status;
  empty queue prints "queue is empty" and exits 0.
- `--all` or explicit slugs: runs `rails-ensure.sh` first (aborts non-zero
  on failure, before any spawn), then per slug — skipping anything already
  `building`/`built` (and announced) in `docs/pipeline/builds.json` (python3
  JSON helpers, same style as `check-spec.sh`):
  1. Generates `docs/pipeline/builds/<slug>-TASK.md`: executor-conventions
     header (checkpoint updates, authoritative `[steering]`, NOTES with YAML
     frontmatter + `.sentinel`, single commit naming the slug, no merge/push)
     followed by the full spec content.
  2. Records `building` with a UTC timestamp.
  3. `ao-spawn --worktree build-<slug> <repo-root> $BUILD_AGENT_CMD`
     (default `kimi --yolo`, env override), copies the task file into the
     worktree, `ao-send` a one-line prompt pointing at the in-worktree path.
     ao-spawn/ao-send failure records `failed` with a reason AND logs to
     `errors.log` (no silent stuck `building`).
  4. Unless `--no-wait`: `ao-watch build-<slug>
     <worktree>/docs/BUILD_<SLUG>_NOTES.sentinel 3600 30`. Exit 0 → `built`;
     exit 3/4 → `failed` with the exit code. The verdict is recorded with
     `announced: false` plus the stashed `announce_asset_ref`/`announce_note`;
     the flag flips to `true` only after a rails 2xx. Announcement failure
     logs to `errors.log` and exits non-zero (hard error); a later run
     retries ONLY the announcement, never re-spawns a completed build.
     Announced notes: `built: <slug> — awaiting human merge review` /
     `failed: <slug>` to thread `wih:pipeline-builds`, asset_ref = NOTES
     path in the worktree.
- No auto-merge anywhere: the runner never runs `git merge`/`git push`; the
  task file tells the executor the same. Human merges `ao/build-<slug>`.

`.steering/spec.md` carries R1-R10 (EARS) + acceptance for this phase, per
the steering gate's audit-trail requirement.

No changes to `rails-ensure.sh`, `scout.cjs`, `generate-spec.cjs`, or
`check-spec.sh` (no bug fixes were needed).

## Steering gate history

First commit attempt was blocked with 3 MAJOR + 2 MINOR findings; all fixed
in this revision:

1. MAJOR: spec.md had no Phase 4 requirements → wrote R1-R10 + Gherkin-style
   acceptance.
2. MAJOR: announce-after-record was unrecoverable (built/failed recorded
   before announce; skip logic would never retry) → announcement now tracked
   via `announced` field with announce-only retry; regression tests added.
3. MAJOR: ao-send failure left a silent stuck `building` → now records
   `failed` + reason + errors.log entry; test added.
4. MINOR: test count overclaimed (said 34, was 33) → this NOTES file reports
   the measured count (50).
5. MINOR: log messages said "session ao-build-<slug>" while calls use
   `build-<slug>` → messages now read "spawned build-<slug> (tmux session
   ao-build-<slug>)".

## Verification

- `bash docs/pipeline/bin/build-queue-test.sh` — **all 50 checks PASS**
  (rails-ensure abort before spawn; task file contains spec content +
  executor conventions; spawn/send/watch called with `build-<slug>` session
  names and the right paths; `built` recorded with timestamp; rails
  announcement captured with thread, awaiting-merge note, and worktree
  NOTES asset_ref; `announced` tracked separately; already-built skipped on
  re-run; `--no-wait` spawns without watching and leaves status `building`;
  watch exit 3 records `failed` + `watch_exit: 3` and announces
  `failed: <slug>`; ao-send failure records `failed` + reason + errors.log
  with no watch attempted; announce failure exits non-zero with
  `announced: false` + stashed asset_ref/note + errors.log, and the retry
  run re-announces WITHOUT re-spawning then flips `announced` to true;
  `--all`; empty-queue exit 0 + message in both list and `--all` modes).
- `bash docs/pipeline/bin/build-queue.sh` with an empty queue — prints
  "build-queue: queue is empty — nothing to build", exit 0.
