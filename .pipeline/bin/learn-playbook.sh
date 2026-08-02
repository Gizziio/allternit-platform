#!/usr/bin/env bash
# learn-playbook.sh — playbook inclusion helper (M1-R3/R4). Prints
# .pipeline/playbook.md for inclusion in a consult request, with two
# transformations:
#
#   - rules whose `last_confirmed: YYYY-MM-DD` is 90+ days ago are marked
#     [stale] at inclusion time (same pattern as C4-R2 precedent staleness —
#     the playbook file itself is never mutated);
#   - output is capped at 4KB so the playbook can never swamp a consult.
#
# Usage: learn-playbook.sh [playbook-path]
#   (default: $LEARN_PIPELINE_DIR/playbook.md, else <git-root>/.pipeline/playbook.md)
#
# Prints nothing and exits 0 when the playbook is absent.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PIPELINE_DIR="${LEARN_PIPELINE_DIR:-$ROOT/.pipeline}"
PLAYBOOK="${1:-$PIPELINE_DIR/playbook.md}"

[ -f "$PLAYBOOK" ] || exit 0

python3 - "$PLAYBOOK" <<'PY'
import datetime
import re
import sys

STALE_DAYS = 90
CAP = 4096

path = sys.argv[1]
try:
    text = open(path, encoding="utf-8", errors="replace").read()
except Exception:
    sys.exit(0)

now = datetime.datetime.now(datetime.timezone.utc).date()
out = []
for line in text.splitlines():
    m = re.match(r"^(- )\s*(.*last_confirmed:\s*(\d{4})-(\d{2})-(\d{2}).*)$", line)
    if m:
        try:
            confirmed = datetime.date(int(m.group(3)), int(m.group(4)), int(m.group(5)))
            if (now - confirmed).days > STALE_DAYS:
                line = m.group(1) + "[stale] " + m.group(2)
        except ValueError:
            pass
    out.append(line)
sys.stdout.write("\n".join(out)[:CAP])
sys.stdout.write("\n")
PY
