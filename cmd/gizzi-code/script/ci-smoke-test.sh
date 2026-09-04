#!/usr/bin/env bash
# ci-smoke-test.sh — run the empirically-green gizzi-code test subset.
#
# The list of test files/directories to run lives in test/smoke.txt (one entry
# per line, relative to cmd/gizzi-code). Lines starting with '#' and blank lines
# are ignored, so CI owners can annotate entries without touching this script.
# Known-flaky files are listed in test/quarantine.txt for visibility only —
# they are NOT run here.
#
# Usage: bash script/ci-smoke-test.sh   (from anywhere; resolves its own root)

set -u
cd "$(dirname "$0")/.."

SMOKE_LIST="test/smoke.txt"
QUAR_LIST="test/quarantine.txt"

if [ ! -f "$SMOKE_LIST" ]; then
  echo "ERROR: $SMOKE_LIST not found" >&2
  exit 2
fi

# Collect entries: strip comments and blank lines.
entries=()
while IFS= read -r line; do
  line="${line%%#*}"
  line="$(echo "$line" | tr -d '[:space:]')"
  [ -z "$line" ] && continue
  entries+=("$line")
done < "$SMOKE_LIST"

if [ "${#entries[@]}" -eq 0 ]; then
  echo "ERROR: no entries in $SMOKE_LIST" >&2
  exit 2
fi

missing=0
for e in "${entries[@]}"; do
  if [ ! -e "$e" ]; then
    echo "ERROR: smoke entry does not exist: $e" >&2
    missing=1
  fi
done
[ "$missing" -eq 1 ] && exit 2

if [ -f "$QUAR_LIST" ]; then
  quar_count=$(grep -vE '^\s*(#|$)' "$QUAR_LIST" | wc -l | tr -d ' ')
else
  quar_count=0
fi

echo "=== gizzi-code smoke tests ==="
echo "entries: ${#entries[@]}  (quarantined, not run: $quar_count)"
echo

bun test --preload ./test/preload.ts --timeout 30000 "${entries[@]}"
rc=$?

echo
if [ $rc -eq 0 ]; then
  echo "SMOKE PASS: ${#entries[@]} entries green"
else
  echo "SMOKE FAIL: bun test exited $rc" >&2
fi
exit $rc
