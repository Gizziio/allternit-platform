#!/usr/bin/env bash
# learn-event.sh — shared learning-event capture (M1-R1). When a learnable
# moment happens (a steering/gate/check-spec verdict, a record-outcome call,
# a dismissal), the script that observes it calls:
#
#   learn-event.sh <kind> <refs> <summary>
#
# Appends {ts, kind, refs, summary} as one JSON line to
# docs/pipeline/learn/events.jsonl (gitignored — runtime data, not code).
# Inputs are sanitized (whitespace collapsed, length-capped) and the target
# directory is created on demand. Capture is advisory by contract: callers
# invoke it with `|| true` so a capture failure can never alter a verdict.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PIPELINE_DIR="${LEARN_PIPELINE_DIR:-$ROOT/.pipeline}"
EVENTS="$PIPELINE_DIR/learn/events.jsonl"

kind="${1:-}"
refs="${2:-}"
summary="${3:-}"

if [ -z "$kind" ]; then
  echo "usage: learn-event.sh <kind> <refs> <summary>" >&2
  exit 2
fi

python3 - "$EVENTS" "$kind" "$refs" "$summary" <<'PY'
import datetime
import json
import os
import sys

path, kind, refs, summary = sys.argv[1:5]


def clean(s, cap):
    return " ".join(str(s).split())[:cap]


event = {
    "ts": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "kind": clean(kind, 40),
    "refs": clean(refs, 300),
    "summary": clean(summary, 500),
}
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "a") as f:
    f.write(json.dumps(event) + "\n")
PY
