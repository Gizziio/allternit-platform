#!/usr/bin/env bash
# dismiss.sh — dismissal ledger (C2-R3). When a suggested idea/candidate is
# dismissed by a human:
#
#   dismiss.sh <slug-or-title> [note]
#
# Records {title, dismissed_at, note} in docs/pipeline/dismissals.json (keyed by
# slug) and ingests the dismissal to memory (:3201, advisory) as a taste
# precedent — trust_tier "failed", so it surfaces as a [pitfall] in steering
# consults, never as evidence (same convention as record-outcome.sh's
# rejected outcomes). scout.cjs suppresses items whose normalized title
# (lowercase, alnum-only) matches a dismissal younger than 14 days.
#
# If the argument matches docs/pipeline/candidates/<slug>.md, the candidate's
# title is taken from that file; otherwise the argument itself is the title.
# Memory down = logged to docs/pipeline/errors.log, exit stays 0 — the ledger is
# the hard artifact.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PIPELINE_DIR="${TASTE_PIPELINE_DIR:-$ROOT/.pipeline}"
DISMISSALS="$PIPELINE_DIR/dismissals.json"
CANDIDATES_DIR="$PIPELINE_DIR/candidates"
ERRORS_LOG="$PIPELINE_DIR/errors.log"
MEMORY_URL="${TASTE_MEMORY_URL:-http://localhost:3201/api/ingest}"

arg="${1:-}"
note="${2:-}"

if [ -z "$arg" ]; then
  echo "usage: dismiss.sh <slug-or-title> [note]" >&2
  exit 2
fi

ts="$(date -u +%FT%TZ)"

# Resolve title: candidate file's first "# " heading when the arg is a known
# candidate slug; otherwise the argument verbatim.
title="$arg"
if [ -f "$CANDIDATES_DIR/$arg.md" ]; then
  t="$(sed -n 's/^# //p' "$CANDIDATES_DIR/$arg.md" | head -1)"
  [ -n "$t" ] && title="$t"
fi

slug="$(python3 - "$DISMISSALS" "$arg" "$title" "$note" "$ts" <<'PY'
import json, os, re, sys, hashlib

path, arg, title, note, ts = sys.argv[1:6]

def slugify(t):
    s = re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:60].rstrip("-")
    return s or hashlib.sha1(t.encode()).hexdigest()[:12]

try:
    d = json.load(open(path))
except Exception:
    d = {}
slug = slugify(arg)
d[slug] = {"title": title, "dismissed_at": ts, "note": note}
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    json.dump(d, f, indent=2, sort_keys=True)
    f.write("\n")
print(slug)
PY
)"

payload=$(python3 -c 'import json,sys
ts, slug, title, note = sys.argv[1:5]
content = "Dismissed idea: %s (%s)%s" % (title, ts, (" — " + note) if note else "")
print(json.dumps({
    "content": content,
    "source": "pipeline-dismissal",
    "metadata": {
        "source": "pipeline-dismissal",
        "trust_tier": "failed",
        "provenance_ref": slug,
    },
}))' "$ts" "$slug" "$title" "$note")

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -X POST "$MEMORY_URL" \
  -H 'Content-Type: application/json' -d "$payload" 2>/dev/null)
if [[ "$code" != 2* ]]; then
  printf '[%s] %s\n' "$(date -u +%FT%TZ)" \
    "dismiss: memory ingest failed for $slug (HTTP ${code:-000}) — continuing (advisory)" >> "$ERRORS_LOG"
  echo "dismiss: memory unreachable for $slug — logged, continuing (advisory)"
fi

# M1-R1: capture the dismissal as a learning event (advisory — never fatal).
LEARN_EVENT="${LEARN_EVENT:-$PIPELINE_DIR/bin/learn-event.sh}"
[ -x "$LEARN_EVENT" ] && LEARN_PIPELINE_DIR="$PIPELINE_DIR" \
  "$LEARN_EVENT" "dismissal" "$slug" "dismissed: $title" >/dev/null 2>&1 || true

echo "dismiss: '$title' recorded in $DISMISSALS (slug: $slug)"
