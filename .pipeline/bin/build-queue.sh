#!/usr/bin/env bash
# build-queue.sh — queue consumption (Phase 4).
#
# Usage: build-queue.sh [--all] [--no-wait] [slug ...]
#   No args        -> list .pipeline/queue/ contents (read-only, no rails).
#   --all          -> build every .pipeline/queue/*.md spec.
#   slug ...       -> build those queued specs.
#   --no-wait      -> spawn and return immediately (parallel/manual driving).
#
# For each slug not already `building`/`built` in builds.json:
#   a. generate .pipeline/builds/<slug>-TASK.md (executor conventions header
#      + full spec content — queue/ is gitignored, so the spec must travel
#      inside the task file),
#   b. record `building` with a timestamp,
#   c. ao-spawn --worktree "build-<slug>" <repo-root> $BUILD_AGENT_CMD
#      (default `kimi --yolo`), copy the task file into the worktree, then
#      ao-send a one-line prompt pointing at it,
#   d. unless --no-wait: ao-watch the NOTES sentinel (3600s, 30s interval).
#      DONE (0)      -> record `built`,  announce to wih:pipeline-builds with
#                       asset_ref = NOTES path in the worktree and note
#                       "built: <slug> — awaiting human merge review"
#      exit 3/4      -> record `failed` + exit code, announce "failed: <slug>"
#      The announcement is tracked separately (`announced: false` until a
#      rails 2xx): announcement failure = hard error (errors.log + non-zero),
#      and a later run retries ONLY the announce — never re-spawns a build
#      that already completed. ao-spawn/ao-send failure records `failed`
#      with a reason + errors.log entry (no silent stuck `building`).
#
# There is NO auto-merge: a human merges ao/build-<slug> after review.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PIPELINE_DIR="${BUILD_QUEUE_DIR:-$ROOT/.pipeline}"
QUEUE_DIR="$PIPELINE_DIR/queue"
BUILDS_DIR="$PIPELINE_DIR/builds"
BUILDS_JSON="$PIPELINE_DIR/builds.json"
ERRORS_LOG="$PIPELINE_DIR/errors.log"
RAILS_ENSURE="${RAILS_ENSURE:-$PIPELINE_DIR/bin/rails-ensure.sh}"
RAILS_SHARE_URL="http://localhost:8013/api/rails/mail/share"
BUILDS_THREAD="wih:pipeline-builds"
BUILD_AGENT_CMD="${BUILD_AGENT_CMD:-kimi --yolo}"
WATCH_TIMEOUT="${BUILD_WATCH_TIMEOUT:-3600}"
WATCH_INTERVAL="${BUILD_WATCH_INTERVAL:-30}"

log_error() {
  printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$1" >> "$ERRORS_LOG"
}

usage() {
  cat <<'EOF'
usage: build-queue.sh [--all] [--no-wait] [slug ...]
  (no args)  list queue contents
  --all      build every queued spec
  --no-wait  spawn and return without watching
EOF
}

# ─── builds.json helpers (python3, like .steering/bin/ and check-spec.sh) ────

build_status() { # build_status <slug> -> status (empty if none)
  build_field "$1" status
}

build_field() { # build_field <slug> <field> -> value (empty if none)
  python3 - "$BUILDS_JSON" "$1" "$2" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    d = {}
v = d.get(sys.argv[2], {}).get(sys.argv[3], "")
print("" if v is None else v)
PY
}

build_set() { # build_set <slug> <status> [extra-json-object]
  python3 - "$BUILDS_JSON" "$1" "$2" "${3:-}" <<'PY'
import json, sys, datetime
path, slug, status, extra = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
try:
    d = json.load(open(path))
except Exception:
    d = {}
rec = d.get(slug, {})
rec["status"] = status
rec["updated"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
if extra:
    rec.update(json.loads(extra))
d[slug] = rec
with open(path, "w") as f:
    json.dump(d, f, indent=2, sort_keys=True)
    f.write("\n")
PY
}

# ─── rails announce (hard dependency — failure is a hard error) ─────────────

announce() { # announce <asset_ref> <note> -> 0 on HTTP 2xx
  local payload code
  payload=$(python3 -c 'import json,sys; print(json.dumps({"thread":"wih:pipeline-builds","asset_ref":sys.argv[1],"note":sys.argv[2]}))' "$1" "$2")
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -X POST "$RAILS_SHARE_URL" \
    -H 'Content-Type: application/json' -d "$payload" 2>/dev/null)
  [[ "$code" == 2* ]]
}

# ─── task file ───────────────────────────────────────────────────────────────

notes_name() { # notes_name <slug> -> BUILD_<SLUG>_NOTES (uppercased, - -> _)
  printf 'BUILD_%s_NOTES' "$(printf '%s' "$1" | tr '[:lower:]-' '[:upper:]_')"
}

write_task_file() { # write_task_file <slug> <spec-file> <task-file>
  local slug="$1" spec="$2" task="$3" notes
  notes="$(notes_name "$slug")"
  {
    cat <<EOF
# BUILD TASK — $slug

You are the build executor. The full spec from .pipeline/queue/$slug.md is
reproduced below the conventions — it is your complete task spec. Implement it
exactly, in this repo.

## Executor conventions

1. Update \`.steering/checkpoint.md\` at meaningful checkpoints (subtask
   finished, design decision made, before a risky change). \`[steering]\`
   messages are authoritative — fix, answer, update the checkpoint before
   continuing.
2. Done + verified → write \`docs/$notes.md\` with YAML frontmatter
   (\`status\`, \`files_changed\`, \`deviations\`, \`remaining\`), then
   \`touch docs/$notes.sentinel\`.
3. Finish with a SINGLE commit naming the spec slug, e.g.
   \`git add -A && git commit -m "build($slug): <what was built>"\`.
   A gate reviews the commit; fix and retry if blocked.
   Do NOT merge, push, or open a PR — a human merges \`ao/build-$slug\`
   after review.

## Spec (from .pipeline/queue/$slug.md)

EOF
    cat "$spec"
  } > "$task"
}

# ─── args ────────────────────────────────────────────────────────────────────

ALL=0
WAIT=1
slugs=()
for arg in "$@"; do
  case "$arg" in
    --all) ALL=1 ;;
    --no-wait) WAIT=0 ;;
    -h|--help) usage; exit 0 ;;
    --*) echo "build-queue: unknown flag $arg" >&2; usage >&2; exit 2 ;;
    *) slugs+=("$arg") ;;
  esac
done

# No args: list mode (read-only — no rails, no state changes).
if [ "$ALL" -eq 0 ] && [ "${#slugs[@]}" -eq 0 ]; then
  if [ ! -d "$QUEUE_DIR" ] || ! ls "$QUEUE_DIR"/*.md >/dev/null 2>&1; then
    echo "build-queue: queue is empty — nothing to build"
    exit 0
  fi
  echo "build-queue: queued specs:"
  for spec in "$QUEUE_DIR"/*.md; do
    slug="$(basename "$spec" .md)"
    case "$slug" in *.review) continue ;; esac
    status="$(build_status "$slug")"
    printf '  %-40s %s\n' "$slug" "${status:-queued}"
  done
  exit 0
fi

if [ "$ALL" -eq 1 ]; then
  slugs=()
  if [ -d "$QUEUE_DIR" ]; then
    for spec in "$QUEUE_DIR"/*.md; do
      [ -e "$spec" ] || continue
      slug="$(basename "$spec" .md)"
      case "$slug" in *.review) continue ;; esac
      slugs+=("$slug")
    done
  fi
fi

if [ "${#slugs[@]}" -eq 0 ]; then
  echo "build-queue: queue is empty — nothing to build"
  exit 0
fi

# Rails first: no point spawning builders if the result cannot be announced.
if ! bash "$RAILS_ENSURE"; then
  echo "build-queue: rails-ensure failed — aborting before any spawn" >&2
  exit 1
fi

mkdir -p "$BUILDS_DIR"
failures=0

for slug in "${slugs[@]}"; do
  status="$(build_field "$slug" status)"
  announced="$(build_field "$slug" announced)"

  # Pending announcement from a previous run (announce failed after the
  # watch verdict was recorded): retry ONLY the announce — never re-spawn a
  # build that already completed (same bug class as check-spec.sh's READY
  # path; the announcement is tracked separately from the build status).
  if [ "$announced" = "False" ] || [ "$announced" = "false" ]; then
    if [ "$status" = "built" ] || [ "$status" = "failed" ]; then
      asset_ref="$(build_field "$slug" announce_asset_ref)"
      note="$(build_field "$slug" announce_note)"
      if ! announce "$asset_ref" "$note"; then
        log_error "builds announce retry failed for $slug ($note) — rails has no fallback"
        echo "build-queue: $slug — rails announcement retry failed; recorded in $ERRORS_LOG" >&2
        exit 1
      fi
      build_set "$slug" "$status" '{"announced":true}'
      echo "build-queue: $slug — pending announcement delivered to $BUILDS_THREAD ($note)"
      [ "$status" = "built" ] || failures=$((failures + 1))
      continue
    fi
  fi

  if [ "$status" = "building" ] || [ "$status" = "built" ]; then
    echo "build-queue: $slug — already $status; skipping"
    continue
  fi

  spec="$QUEUE_DIR/$slug.md"
  if [ ! -f "$spec" ]; then
    echo "build-queue: $slug — no queued spec at $spec; skipping" >&2
    failures=$((failures + 1))
    continue
  fi

  # a. task file (conventions header + full spec content)
  task="$BUILDS_DIR/$slug-TASK.md"
  write_task_file "$slug" "$spec" "$task"

  # b. record building
  build_set "$slug" "building"

  # c. spawn the builder in an ao worktree; ao-spawn prints
  #    "<session> <workdir> <log>" — take the workdir from its output,
  #    falling back to the derived <parent>/<name>-ao-build-<slug> path.
  spawn_out="$(ao-spawn --worktree "build-$slug" "$ROOT" $BUILD_AGENT_CMD)" || {
    echo "build-queue: $slug — ao-spawn failed:" >&2
    printf '%s\n' "$spawn_out" >&2
    build_set "$slug" "failed" '{"reason":"ao-spawn failed"}'
    log_error "ao-spawn failed for $slug — recorded failed"
    failures=$((failures + 1))
    continue
  }
  worktree="$(printf '%s\n' "$spawn_out" | awk 'NF>=2 {print $2; exit}')"
  if [ -z "$worktree" ] || [ ! -d "$worktree" ]; then
    worktree="$(dirname "$ROOT")/$(basename "$ROOT")-ao-build-$slug"
  fi

  # builds/ is gitignored, so the task file does not exist in the fresh
  # worktree — copy it in and point the agent at the in-worktree path.
  mkdir -p "$worktree/.pipeline/builds"
  cp "$task" "$worktree/.pipeline/builds/$slug-TASK.md"

  if ! ao-send "build-$slug" "Read $worktree/.pipeline/builds/$slug-TASK.md and execute it exactly. It is your full task spec."; then
    build_set "$slug" "failed" '{"reason":"ao-send failed"}'
    log_error "ao-send failed for $slug — recorded failed; tmux session ao-build-$slug left for manual driving"
    echo "build-queue: $slug — ao-send failed; recorded failed, tmux session ao-build-$slug left for manual driving" >&2
    failures=$((failures + 1))
    continue
  fi
  echo "build-queue: $slug — spawned build-$slug (tmux session ao-build-$slug) in $worktree"

  # d. watch unless --no-wait
  if [ "$WAIT" -eq 0 ]; then
    continue
  fi

  notes="$(notes_name "$slug")"
  sentinel="$worktree/docs/$notes.sentinel"
  asset_ref="$worktree/docs/$notes.md"
  ao-watch "build-$slug" "$sentinel" "$WATCH_TIMEOUT" "$WATCH_INTERVAL"
  rc=$?
  if [ "$rc" -eq 0 ]; then
    verdict="built"
    note="built: $slug — awaiting human merge review"
  else
    verdict="failed"
    note="failed: $slug"
  fi

  # Record the outcome immediately, but track the announcement separately:
  # announced flips to true only after a rails 2xx, so a failed announce is
  # retried (announce-only) by a later run instead of being silently lost.
  extra="$(python3 -c 'import json,sys; print(json.dumps({"watch_exit":int(sys.argv[1]),"announced":False,"announce_asset_ref":sys.argv[2],"announce_note":sys.argv[3]}))' "$rc" "$asset_ref" "$note")"
  build_set "$slug" "$verdict" "$extra"

  if ! announce "$asset_ref" "$note"; then
    log_error "builds announce failed for $slug ($note) — rails has no fallback"
    echo "build-queue: $slug — rails announcement failed; recorded in $ERRORS_LOG (announced:false — a re-run retries the announce only)" >&2
    exit 1
  fi
  build_set "$slug" "$verdict" '{"announced":true}'
  echo "build-queue: $slug — $note (announced to $BUILDS_THREAD)"
  [ "$rc" -eq 0 ] || failures=$((failures + 1))
done

[ "$failures" -eq 0 ]
