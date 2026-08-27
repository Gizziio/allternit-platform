# PHASE 4 TASK — Queue consumption: build-queue.sh

You are the executor. This file is your complete task spec. It builds the last
link of the discovery pipeline: consuming `docs/pipeline/queue/` (READY specs) by
spawning build executors. Read `docs/pipeline/README.md` and
`docs/pipeline/bin/check-spec.sh` first to match conventions. Do NOT modify
scout/generate-spec/check-spec behavior.

## Workflow rules (same as before)

1. Update `.steering/checkpoint.md` at meaningful checkpoints; `[steering]`
   messages are authoritative — fix, answer, update checkpoint.
2. Done + verified → `docs/PIPELINE_PHASE_4_NOTES.md` with YAML frontmatter
   (`status`, `files_changed`, `deviations`, `remaining`), then
   `touch docs/PIPELINE_PHASE_4_NOTES.sentinel`.
3. Then commit: `git add .pipeline docs .steering && git commit -m "feat(pipeline): queue consumption — build-queue runner (Phase 4)"`.
   A gate reviews the commit; fix and retry if blocked.

## Build

1. **`docs/pipeline/bin/build-queue.sh`** (bash, `set -uo pipefail`):
   - Usage: `build-queue.sh [--all] [slug ...]`. No args = list queue contents.
   - Runs `docs/pipeline/bin/rails-ensure.sh` first; aborts non-zero if it fails.
   - For each slug (or every `docs/pipeline/queue/*.md` with `--all`), skip any
     already recorded as `building`/`built` in `docs/pipeline/builds.json`
     (gitignored; python3 for JSON like `.steering/bin/` does):
     a. Generate a task file `docs/pipeline/builds/<slug>-TASK.md` from the spec:
        a header with the standard executor conventions (update
        `.steering/checkpoint.md` at checkpoints; `[steering]` is
        authoritative; NOTES file with YAML frontmatter + `.sentinel`; single
        commit at the end naming the spec slug) followed by the full spec
        content. NOTES path: `docs/BUILD_<SLUG>_NOTES.md` (slug uppercased,
        dashes to underscores).
     b. Record `building` in builds.json with a timestamp.
     c. Spawn the builder: `ao-spawn --worktree "build-$SLUG" <repo-root>
        "$BUILD_AGENT_CMD"` where `BUILD_AGENT_CMD` defaults to
        `kimi --yolo` (env override). Then `ao-send "build-$SLUG"` a one-line
        prompt pointing at the task file path inside the worktree (the
        worktree path is `<repo-parent>/<repo-name>-ao-build-<slug>` — derive
        it, don't hardcode).
     d. Unless `--no-wait` is passed, block on
        `ao-watch "build-$SLUG" <worktree>/docs/BUILD_<SLUG>_NOTES.sentinel 3600 30`.
        On watch exit 0: record `built`, announce to rails thread
        `wih:pipeline-builds` via `POST /api/rails/mail/share` with
        `asset_ref` = the NOTES file path in the worktree and a `note` of
        `built: <slug> — awaiting human merge review`. On watch exit 3/4:
        record `failed` with the exit code, announce `failed: <slug>` the
        same way. Announcement failure = hard error (errors.log + non-zero).
        There is NO auto-merge: a human merges `ao/build-<slug>` after review.
   - `--no-wait`: spawn and return immediately (for parallel/manual driving).
2. **`docs/pipeline/bin/build-queue-test.sh`**:
   - Stub `ao-spawn`, `ao-send`, `ao-watch`, `curl` via a PATH-shim dir
     (fake commands that log invocations to a capture file; ao-watch exits 0
     and creates the sentinel path it's given).
   - Verify: rails-ensure failure aborts before any spawn; a queued spec
     produces a task file containing the spec content + executor conventions;
     spawn/send/watch called with the right session names; `built` recorded;
     rails announcement captured with the awaiting-merge note; already-built
     slug is skipped on re-run; `--no-wait` spawns without watching.
   - PASS/FAIL lines, non-zero on FAIL.
3. Update `docs/pipeline/README.md`: Phase 4 section, the full-cycle diagram now
   ending in `build → human merge`, and the exact commands to drive it.

## Constraints

- No changes to `rails-ensure.sh`, `scout.cjs`, `generate-spec.cjs`,
  `check-spec.sh` (bug fixes only, noted in NOTES).
- All new state files gitignored via `docs/pipeline/.gitignore` (add `builds/`,
  `builds.json` — task files under `builds/` are runtime artifacts).
- The runner never runs `git merge` or `git push` — human merge is the boundary.

## Acceptance

- `bash docs/pipeline/bin/build-queue-test.sh` passes (recorded in NOTES).
- `bash docs/pipeline/bin/build-queue.sh` with an empty queue prints a sensible
  "queue is empty" message, exit 0.
- NOTES + sentinel, then the commit above.
