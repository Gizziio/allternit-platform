#!/usr/bin/env bash
# build-queue.sh — queue consumption (Phase 4).
#
# Usage: build-queue.sh [--all] [--no-wait] [slug ...]
#   No args        -> list .pipeline/queue/ contents (read-only, no rails).
#   --all          -> build every queued spec: ticketed items FIRST (B3-R2 —
#                     GET /api/rails/tickets/ready filtered client-side for the
#                     "pipeline" label, spec:<slug> labels mapped to queue
#                     files, ordered by GET /api/rails/graph/triage score;
#                     tickets missing from the 50-capped triage response sort
#                     after scored items by created_at then ticket_id), then
#                     legacy filesystem queue files without tickets. If the
#                     tickets endpoint is unreachable, build-queue logs and
#                     degrades to legacy file mode (documented fallback —
#                     tickets are an enhancement, not a hard dependency).
#   slug ...       -> build those queued specs (user-specified order).
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
#      B3-R3: when the watch verdict lands, the slug's rails ticket (if any —
#      ticket_id lives in verdicts.json) is updated: POST /tickets/:id/close
#      with reason = NOTES path for built; left open + a failure note appended
#      to its description via PATCH for failed. Then record-outcome.sh is
#      called once (merged|failed — C4 wiring). Both are logged-and-continue;
#      the rails announcement below remains the hard error.
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
RAILS_TICKETS_URL="http://localhost:8013/api/rails/tickets"
RAILS_TRIAGE_URL="http://localhost:8013/api/rails/graph/triage"
RECORD_OUTCOME="${RECORD_OUTCOME:-$PIPELINE_DIR/bin/record-outcome.sh}"
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

# ─── rails tickets: ready list + triage ordering (B3-R2), outcome (B3-R3) ───

VERDICTS_FILE="$PIPELINE_DIR/verdicts.json"

verdict_ticket_id() { # verdict_ticket_id <slug> -> ticket_id (empty if none)
  python3 - "$VERDICTS_FILE" "$1" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    d = {}
print(d.get(sys.argv[2], {}).get("ticket_id", ""))
PY
}

# compute_queue_order -> stdout lines classifying the queue:
#   "T <slug>"  ticketed spec, in build order (triage score first; tickets
#               missing from the 50-capped triage response after, by
#               created_at then ticket_id)
#   "B <slug>"  has a ticket but it is not ready (blocked by open
#               dependencies, or closed) — skipped, NOT built as legacy
#   "L <slug>"  legacy filesystem queue file (no ticket) — builds last
# Exit non-zero if the ready endpoint is unreachable/unparseable: the caller
# degrades to legacy file mode (documented B3-R2 fallback). A triage failure
# only degrades ordering (all ticketed items unscored), never the mode.
compute_queue_order() {
  local ready_resp triage_resp
  ready_resp=$(curl -s --max-time 5 -w '\n%{http_code}' "$RAILS_TICKETS_URL/ready" 2>/dev/null)
  triage_resp=$(curl -s --max-time 5 -w '\n%{http_code}' "$RAILS_TRIAGE_URL" 2>/dev/null)
  python3 - "$ready_resp" "$triage_resp" "$VERDICTS_FILE" "$QUEUE_DIR" <<'PY'
import glob, json, os, sys

ready_raw, triage_raw, verdicts_path, queue_dir = sys.argv[1:5]

def split(raw):
    # Real curl appends "\n<http_code>" via -w; capture stubs may emit only
    # a body — and a pretty-printed JSON body has internal newlines, so only
    # treat the trailing line as a status when it looks like one.
    if "\n" in raw:
        body, _, code = raw.rpartition("\n")
        c = code.strip()
        if c.isdigit() and len(c) == 3:
            return body, c
    return raw, ""

body, code = split(ready_raw)
if code and not code.startswith("2"):
    sys.exit(1)
try:
    ready = json.loads(body).get("ready") or []
except Exception:
    sys.exit(1)

rank = {}
triage_body, triage_code = split(triage_raw)
if triage_code and not triage_code.startswith("2"):
    sys.stderr.write("build-queue: triage endpoint returned %s — ticketed items unscored\n" % triage_code)
else:
    try:
        items = json.loads(triage_body).get("items") or []
        rank = {str(it.get("ticket")): i for i, it in enumerate(items)}
    except Exception:
        sys.stderr.write("build-queue: triage response unparseable — ticketed items unscored\n")

try:
    verdicts = json.load(open(verdicts_path))
except Exception:
    verdicts = {}

def slug_of(t):
    labels = t.get("labels") or []
    if "pipeline" not in labels:
        return None
    for l in labels:
        if isinstance(l, str) and l.startswith("spec:"):
            return l[5:]
    return None

queue_files = sorted(
    f for f in glob.glob(os.path.join(queue_dir, "*.md"))
    if not os.path.basename(f).endswith(".review.md")
)
queue_slugs = {os.path.basename(f)[:-3] for f in queue_files}

ticketed = []  # (slug, ticket_id, created_at)
seen = set()
for t in ready:
    s = slug_of(t)
    if not s or s in seen or s not in queue_slugs:
        continue
    seen.add(s)
    ticketed.append((s, str(t.get("id", "")), str(t.get("created_at", ""))))

scored = sorted((t for t in ticketed if t[1] in rank), key=lambda t: rank[t[1]])
unscored = sorted((t for t in ticketed if t[1] not in rank), key=lambda t: (t[2], t[1]))
ordered = [s for s, _, _ in scored + unscored]

for s in ordered:
    print("T", s)
for f in queue_files:
    s = os.path.basename(f)[:-3]
    if s in ordered:
        continue
    if verdicts.get(s, {}).get("ticket_id"):
        print("B", s)
    else:
        print("L", s)
PY
}

# http_ok <curl-response> -> 0 if 2xx (tolerates stubs without a status line:
# a JSON error body or a bare non-2xx token fails).
http_ok() {
  case "$1" in
    *$'\n'*) [[ "${1##*$'\n'}" == 2* ]] ;;
    *) case "$1" in *'"error"'* | 000 | 4* | 5*) return 1 ;; *) return 0 ;; esac ;;
  esac
}

ticket_close() { # ticket_close <ticket-id> <reason> — B3-R3 built path
  local payload resp
  payload=$(python3 -c 'import json,sys; print(json.dumps({"reason":sys.argv[1]}))' "$2")
  resp=$(curl -s --max-time 5 -w '\n%{http_code}' -X POST "$RAILS_TICKETS_URL/$1/close" \
    -H 'Content-Type: application/json' -d "$payload" 2>/dev/null)
  http_ok "$resp"
}

ticket_note_failure() { # ticket_note_failure <ticket-id> <slug> <watch-exit>
  # B3-R3 failed path: the ticket stays OPEN; append the failure note to its
  # description via PATCH (the only free-text field the update endpoint has).
  local resp desc payload
  resp=$(curl -s --max-time 5 "$RAILS_TICKETS_URL/$1" 2>/dev/null)
  desc=$(python3 -c 'import json,sys
try:
    print(json.loads(sys.argv[1])["ticket"].get("description", ""))
except Exception:
    sys.exit(1)' "$resp") || return 1
  payload=$(python3 -c 'import json,sys,datetime
note = "\n\n[build-queue] failed: %s (watch exit %s) at %s" % (
    sys.argv[2], sys.argv[3],
    datetime.datetime.now(datetime.timezone.utc).isoformat())
print(json.dumps({"description": sys.argv[1] + note}))' "$desc" "$2" "$3")
  resp=$(curl -s --max-time 5 -w '\n%{http_code}' -X PATCH "$RAILS_TICKETS_URL/$1" \
    -H 'Content-Type: application/json' -d "$payload" 2>/dev/null)
  http_ok "$resp"
}

record_outcome() { # record_outcome <slug> <merged|failed> <note> — advisory
  if [ ! -f "$RECORD_OUTCOME" ]; then
    log_error "record-outcome.sh not found at $RECORD_OUTCOME — outcome for $1 not recorded (advisory)"
    return 0
  fi
  if ! bash "$RECORD_OUTCOME" "$1" "$2" "$3"; then
    log_error "record-outcome.sh $1 $2 failed — outcome not recorded (advisory)"
    echo "build-queue: $1 — record-outcome failed; logged (advisory)" >&2
  fi
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
    # B3-R2: ticketed path first. On tickets-endpoint failure, log + degrade
    # to legacy file mode (documented fallback — legacy files are never gated
    # on rails tickets).
    if order="$(compute_queue_order)"; then
      legacy=()
      while IFS= read -r line; do
        case "$line" in
          T\ *) slugs+=("${line#T }") ;;
          B\ *) echo "build-queue: ${line#B } — ticket not ready (blocked by open dependencies or closed); skipping" ;;
          L\ *) legacy+=("${line#L }") ;;
        esac
      done <<< "$order"
      # Legacy filesystem queue files always build after ticketed items.
      slugs+=(${legacy[@]+"${legacy[@]}"})
    else
      log_error "tickets endpoint unreachable — build-queue degraded to legacy file mode (B3-R2 documented fallback)"
      echo "build-queue: tickets endpoint unreachable — degraded to legacy file mode (logged in $ERRORS_LOG)" >&2
      for spec in "$QUEUE_DIR"/*.md; do
        [ -e "$spec" ] || continue
        slug="$(basename "$spec" .md)"
        case "$slug" in *.review) continue ;; esac
        slugs+=("$slug")
      done
    fi
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

  # B3-R3: reflect the outcome on the rails ticket (if this slug has one) and
  # record the outcome for the taste engine (C4 wiring, one call). Both are
  # logged-and-continue; the announcement below remains the hard error.
  ticket_id="$(verdict_ticket_id "$slug")"
  if [ -n "$ticket_id" ]; then
    if [ "$verdict" = "built" ]; then
      if ! ticket_close "$ticket_id" "$asset_ref"; then
        log_error "ticket close failed for $slug (ticket $ticket_id) — continuing (B3-R3, advisory)"
        echo "build-queue: $slug — ticket $ticket_id close failed; logged (advisory)" >&2
      fi
    else
      if ! ticket_note_failure "$ticket_id" "$slug" "$rc"; then
        log_error "ticket failure note failed for $slug (ticket $ticket_id) — continuing (B3-R3, advisory)"
        echo "build-queue: $slug — ticket $ticket_id failure note failed; logged (advisory)" >&2
      fi
    fi
  fi
  if [ "$verdict" = "built" ]; then
    record_outcome "$slug" "merged" "$note"
  else
    record_outcome "$slug" "failed" "$note"
  fi

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
