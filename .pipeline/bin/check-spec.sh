#!/usr/bin/env bash
# check-spec.sh — independent spec-checker loop (Phase 3 + charter layer).
#
# For each .pipeline/specs/*.md without a READY/STALLED/REJECT verdict in
# .pipeline/verdicts.json: assemble spec-rubric.md + charter.md + taste
# precedents from memory (advisory) + the spec, consult the independent
# reviewer (SPEC_CHECK_CMD test hook, else ao-consult), then:
#   READY      -> move spec to .pipeline/queue/, record verdict, announce to
#                 wih:pipeline-queue (announce failure = hard error, R4/C3)
#   NEEDS-WORK -> record verdict + round, append findings to <slug>.review.md;
#                 2nd NEEDS-WORK ingests the rejection pattern to memory
#                 (:3201, advisory — failure logged, run continues);
#                 3rd round marks the spec STALLED and skips it thereafter
#   REJECT     -> charter violation: move spec to .pipeline/rejected/, record
#                 verdict, ingest the violation to memory immediately (taste
#                 signal). REJECT is final — never retried.
# Empty/unparseable consult answer or transport failure: record nothing,
# continue to the next spec (fail open per-spec, never wedge the run).
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PIPELINE_DIR="${CHECK_SPEC_DIR:-$ROOT/.pipeline}"
SPECS_DIR="$PIPELINE_DIR/specs"
QUEUE_DIR="$PIPELINE_DIR/queue"
VERDICTS_FILE="$PIPELINE_DIR/verdicts.json"
ERRORS_LOG="$PIPELINE_DIR/errors.log"
RUBRIC="${SPEC_RUBRIC:-$PIPELINE_DIR/spec-rubric.md}"
CHARTER="${PIPELINE_CHARTER:-$PIPELINE_DIR/charter.md}"
REJECTED_DIR="$PIPELINE_DIR/rejected"
RAILS_ENSURE="${RAILS_ENSURE:-$PIPELINE_DIR/bin/rails-ensure.sh}"
RAILS_SHARE_URL="http://localhost:8013/api/rails/mail/share"
QUEUE_THREAD="wih:pipeline-queue"
MEMORY_URL="http://localhost:3201/api/ingest"
MEMORY_QUERY_URL="http://localhost:3201/api/query"
MAX_ROUNDS=3

log_error() {
  printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$1" >> "$ERRORS_LOG"
}

# ─── verdicts.json helpers (python3, like .steering/bin/) ───────────────────

verdict_get() { # verdict_get <slug> -> "verdict rounds" (empty if none)
  python3 - "$VERDICTS_FILE" "$1" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    d = {}
v = d.get(sys.argv[2])
if v:
    print(f"{v.get('verdict','')} {v.get('rounds',0)}")
PY
}

verdict_set() { # verdict_set <slug> <verdict> <rounds>
  python3 - "$VERDICTS_FILE" "$1" "$2" "$3" <<'PY'
import json, sys, datetime
path, slug, verdict, rounds = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
try:
    d = json.load(open(path))
except Exception:
    d = {}
d[slug] = {
    "verdict": verdict,
    "rounds": rounds,
    "updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
}
with open(path, "w") as f:
    json.dump(d, f, indent=2, sort_keys=True)
    f.write("\n")
PY
}

# ─── rails announce (hard dependency) ───────────────────────────────────────

announce() { # announce <asset_ref> <note> -> 0 on HTTP 2xx
  local payload code
  payload=$(python3 -c 'import json,sys; print(json.dumps({"thread":"wih:pipeline-queue","asset_ref":sys.argv[1],"note":sys.argv[2]}))' "$1" "$2")
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -X POST "$RAILS_SHARE_URL" \
    -H 'Content-Type: application/json' -d "$payload" 2>/dev/null)
  [[ "$code" == 2* ]]
}

# ─── memory ingest (advisory) ───────────────────────────────────────────────

ingest_lesson() { # ingest_lesson <slug> <findings>
  local payload code
  payload=$(python3 -c 'import json,sys; print(json.dumps({"content":sys.argv[1]+"\n\n"+sys.argv[2],"source":"pipeline-spec-checker"}))' "$1" "$2")
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -X POST "$MEMORY_URL" \
    -H 'Content-Type: application/json' -d "$payload" 2>/dev/null)
  if [[ "$code" != 2* ]]; then
    log_error "memory ingest failed for spec $1 (HTTP ${code:-000}) — continuing (lessons are advisory)"
    echo "check-spec: memory unreachable for $1 — logged, continuing (advisory)"
  fi
}

# ─── taste precedents (advisory) ────────────────────────────────────────────

query_precedents() { # -> past rejection/lesson text on stdout (empty if memory down)
  local payload
  payload=$(python3 -c 'import json; print(json.dumps({"question":"pipeline spec rejections, charter violations, and taste precedents","max_results":5}))')
  curl -s --max-time 5 -X POST "$MEMORY_QUERY_URL" \
    -H 'Content-Type: application/json' -d "$payload" 2>/dev/null \
    | python3 -c 'import json,sys,datetime
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
# C4-R2: precedents older than 90 days are marked [stale] instead of being
# presented as current. Items without a parseable timestamp degrade to current.
# C1-R2: failed-tier content (reverted/rejected/failed attempts) must never
# read as evidence — it stays in the assembled text but labeled [pitfall].
STALE_DAYS = 90
now = datetime.datetime.now(datetime.timezone.utc)

def ts_of(it):
    for k in ("ingested_at", "created_at", "timestamp", "ts", "updated_at"):
        v = it.get(k)
        if v is None:
            continue
        if isinstance(v, (int, float)):
            try:
                return datetime.datetime.fromtimestamp(v, datetime.timezone.utc)
            except Exception:
                return None
        if isinstance(v, str):
            s = v.strip()
            if s.isdigit():
                try:
                    return datetime.datetime.fromtimestamp(int(s), datetime.timezone.utc)
                except Exception:
                    return None
            try:
                return datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
            except Exception:
                return None
    return None

def is_stale(it):
    t = ts_of(it)
    if t is None:
        return False
    if t.tzinfo is None:
        t = t.replace(tzinfo=datetime.timezone.utc)
    return (now - t).days > STALE_DAYS

def tier_of(it):
    md = it.get("metadata")
    if isinstance(md, dict) and md.get("trust_tier"):
        return md["trust_tier"]
    return it.get("trust_tier", "")

parts = []
if isinstance(d, dict):
    if d.get("answer"): parts.append(str(d["answer"]))
    for k in ("insights","memories"):
        for it in d.get(k) or []:
            if isinstance(it, dict) and it.get("content"):
                c = str(it["content"])
                if is_stale(it): c = "[stale] " + c
                if tier_of(it) == "failed": c = "[pitfall] " + c
                parts.append(c)
print("\n---\n".join(parts)[:3000])' 2>/dev/null
}

# ─── consult ────────────────────────────────────────────────────────────────

consult() { # consult <request-file> -> answer on stdout (may be empty)
  if [ -n "${SPEC_CHECK_CMD:-}" ]; then
    $SPEC_CHECK_CMD < "$1"
  else
    ao-consult < "$1"
  fi
}

# First line, bullet-stripped (ao-consult prefixes "• "), CR-free, uppercase.
verdict_of() {
  printf '%s\n' "$1" | sed 's/^• //' | head -1 | tr -d '\r' | tr '[:lower:]' '[:upper:]'
}

# ─── main ───────────────────────────────────────────────────────────────────

# Rails first (R0/R1 semantics): abort non-zero if it cannot be made to work.
if ! bash "$RAILS_ENSURE"; then
  echo "check-spec: rails-ensure failed — aborting before any spec check" >&2
  exit 1
fi

if [ ! -d "$SPECS_DIR" ] || ! ls "$SPECS_DIR"/*.md >/dev/null 2>&1; then
  echo "check-spec: no specs in $SPECS_DIR; nothing to do"
  exit 0
fi

mkdir -p "$QUEUE_DIR"
checked=0
for spec in "$SPECS_DIR"/*.md; do
  slug="$(basename "$spec" .md)"
  case "$slug" in *.review) continue ;; esac

  state="$(verdict_get "$slug")"
  verdict="${state%% *}"
  rounds="${state##* }"
  [ -n "$state" ] || rounds=0

  if [ "$verdict" = "READY" ] || [ "$verdict" = "STALLED" ] || [ "$verdict" = "REJECT" ]; then
    continue
  fi

  checked=$((checked + 1))
  request="$(mktemp -t check-spec)"
  {
    cat "$RUBRIC"
    if [ -f "$CHARTER" ]; then
      printf '\n\n=== PIPELINE CHARTER (.pipeline/charter.md) ===\n'
      cat "$CHARTER"
    fi
    precedents="$(query_precedents)"
    if [ -n "${precedents// /}" ]; then
      printf '\n\n=== TASTE PRECEDENTS (from memory — past rejections/lessons) ===\n%s\n' "$precedents"
    fi
    printf '\n\n=== SPEC UNDER REVIEW: .pipeline/specs/%s.md ===\n' "$slug"
    cat "$spec"
  } > "$request"

  answer="$(consult "$request")"
  rm -f "$request"

  if [ -z "${answer// /}" ]; then
    echo "check-spec: $slug — empty consult answer or transport failure; skipping (recorded nothing)"
    continue
  fi

  first="$(verdict_of "$answer")"

  case "$first" in
    READY*)
      # Announce FIRST: on failure, log + exit 1 leaving the spec untouched
      # in specs/ with its prior verdict state, so the next run re-consults
      # and retries the whole READY path (no silent unannounced queue file).
      if ! announce "$QUEUE_DIR/$slug.md" "$slug"; then
        log_error "queue announce failed for $QUEUE_DIR/$slug.md — rails has no fallback (R4)"
        echo "check-spec: rails announcement failed for $slug — recorded in $ERRORS_LOG; aborting (spec left in place for retry)" >&2
        exit 1
      fi
      mv "$spec" "$QUEUE_DIR/$slug.md"
      # Keep the review trail with the spec it documents (if any).
      [ -f "$SPECS_DIR/$slug.review.md" ] && mv "$SPECS_DIR/$slug.review.md" "$QUEUE_DIR/$slug.review.md"
      verdict_set "$slug" "READY" "$rounds"
      echo "check-spec: $slug — READY, moved to queue/ and announced to $QUEUE_THREAD"
      ;;
    NEEDS-WORK*)
      rounds=$((rounds + 1))
      findings="$(printf '%s\n' "$answer" | sed 's/^• //' | head -c 4000)"
      # C3-R1 artifact contract: verdict review records carry schema-versioned
      # frontmatter, written once when the record is created (rounds append).
      if [ ! -f "$SPECS_DIR/$slug.review.md" ]; then
        {
          printf '%s\n' '---'
          printf '%s\n' 'schema_version: 1'
          printf '%s\n' 'trust_tier: unverified'
          printf '%s\n' 'provenance_refs:'
          printf '  - .pipeline/specs/%s.md\n' "$slug"
          printf '%s\n' 'produced_by: check-spec.sh'
          printf 'produced_at: %s\n' "$(date -u +%FT%TZ)"
          printf '%s\n\n' '---'
        } > "$SPECS_DIR/$slug.review.md"
      fi
      {
        printf '\n## Review round %d (%s)\n\n' "$rounds" "$(date -u +%FT%TZ)"
        printf '%s\n' "$findings"
      } >> "$SPECS_DIR/$slug.review.md"
      if [ "$rounds" -eq 2 ]; then
        ingest_lesson "$slug" "$findings"
      fi
      if [ "$rounds" -ge "$MAX_ROUNDS" ]; then
        verdict_set "$slug" "STALLED" "$rounds"
        echo "check-spec: $slug — NEEDS-WORK round $rounds; STALLED after $MAX_ROUNDS rounds"
      else
        verdict_set "$slug" "NEEDS-WORK" "$rounds"
        echo "check-spec: $slug — NEEDS-WORK round $rounds; findings appended to specs/$slug.review.md"
      fi
      ;;
    REJECT*)
      # Charter violation — final. Move the spec aside, record, and ingest the
      # violation immediately: this is the pipeline's taste signal.
      mkdir -p "$REJECTED_DIR"
      findings="$(printf '%s\n' "$answer" | sed 's/^• //' | head -c 4000)"
      mv "$spec" "$REJECTED_DIR/$slug.md"
      [ -f "$SPECS_DIR/$slug.review.md" ] && mv "$SPECS_DIR/$slug.review.md" "$REJECTED_DIR/$slug.review.md"
      verdict_set "$slug" "REJECT" "$rounds"
      ingest_lesson "$slug (REJECTED — charter violation)" "$findings"
      echo "check-spec: $slug — REJECT (charter violation), moved to rejected/ and ingested to memory"
      ;;
    *)
      echo "check-spec: $slug — unparseable verdict line ('$first'); skipping (recorded nothing)"
      ;;
  esac
done

echo "check-spec: done — $checked spec(s) consulted"
