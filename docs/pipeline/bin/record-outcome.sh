#!/usr/bin/env bash
# record-outcome.sh — outcome feedback loop (C4-R1). When a build's outcome is
# known (a human merges, reverts, or rejects it at the queue/merge stage; or
# the build itself fails — B3-R3 wires build-queue to call this once per
# completed build with merged|failed):
#
#   record-outcome.sh <slug> <merged|reverted|rejected|failed> [note]
#
# Appends {ts, slug, outcome, note} to docs/pipeline/outcomes.jsonl and ingests the
# outcome to memory (:3201, advisory) as a taste precedent. Trust tier follows
# C1-R2: merged -> "trusted"; reverted/rejected -> "failed" (failed attempts
# stay visible as pitfalls, never as evidence). Memory down = logged to
# docs/pipeline/errors.log, exit stays 0 — the jsonl record is the hard artifact.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PIPELINE_DIR="${TASTE_PIPELINE_DIR:-$ROOT/.pipeline}"
OUTCOMES="$PIPELINE_DIR/outcomes.jsonl"
ERRORS_LOG="$PIPELINE_DIR/errors.log"
MEMORY_URL="${TASTE_MEMORY_URL:-http://localhost:3201/api/ingest}"

slug="${1:-}"
outcome="${2:-}"
note="${3:-}"

usage() {
  echo "usage: record-outcome.sh <slug> <merged|reverted|rejected|failed> [note]" >&2
  exit 2
}

[ -n "$slug" ] && [ -n "$outcome" ] || usage
case "$outcome" in
  merged|reverted|rejected|failed) ;;
  *) usage ;;
esac

ts="$(date -u +%FT%TZ)"

python3 - "$OUTCOMES" "$ts" "$slug" "$outcome" "$note" <<'PY'
import json, sys, os
path, ts, slug, outcome, note = sys.argv[1:6]
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "a") as f:
    f.write(json.dumps({"ts": ts, "slug": slug, "outcome": outcome, "note": note}) + "\n")
PY

case "$outcome" in
  merged) tier="trusted" ;;
  *)      tier="failed" ;;
esac

payload=$(python3 -c 'import json,sys
ts, slug, outcome, note, tier = sys.argv[1:6]
content = "Build outcome for %s: %s (%s)%s" % (slug, outcome, ts, (" — " + note) if note else "")
print(json.dumps({
    "content": content,
    "source": "pipeline-outcome",
    "metadata": {
        "source": "pipeline-outcome",
        "trust_tier": tier,
        "provenance_ref": slug,
    },
}))' "$ts" "$slug" "$outcome" "$note" "$tier")

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -X POST "$MEMORY_URL" \
  -H 'Content-Type: application/json' -d "$payload" 2>/dev/null)
if [[ "$code" != 2* ]]; then
  printf '[%s] %s\n' "$(date -u +%FT%TZ)" \
    "record-outcome: memory ingest failed for $slug (HTTP ${code:-000}) — continuing (advisory)" >> "$ERRORS_LOG"
  echo "record-outcome: memory unreachable for $slug — logged, continuing (advisory)"
fi

# M1-R1: capture the outcome as a learning event (advisory — never fatal).
LEARN_EVENT="${LEARN_EVENT:-$PIPELINE_DIR/bin/learn-event.sh}"
[ -x "$LEARN_EVENT" ] && LEARN_PIPELINE_DIR="$PIPELINE_DIR" \
  "$LEARN_EVENT" "outcome" "$slug" "$outcome${note:+ — $note}" >/dev/null 2>&1 || true

echo "record-outcome: $slug $outcome recorded in $OUTCOMES"
