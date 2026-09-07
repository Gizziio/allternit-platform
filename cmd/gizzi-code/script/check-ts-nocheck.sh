#!/usr/bin/env bash
# check-ts-nocheck.sh — ratchet on `// @ts-nocheck` usage under src/.
#
# Counts files containing @ts-nocheck and compares against the committed
# baseline (script/ts-nocheck-baseline.txt). The count may never exceed the
# baseline; lowering it (by stripping directives and fixing the type errors)
# is expected and the baseline should be updated in the same commit.
#
# Exit codes:
#   0 — count <= baseline (or baseline missing → initialize, see below)
#   1 — count exceeds baseline (ratchet violation)
#
# Baseline auto-initialization: if the baseline file is missing, it is
# created from the current count and the run passes. This keeps the first
# CI run green; commit the generated baseline.
set -euo pipefail

cd "$(dirname "$0")/.."

BASELINE_FILE="script/ts-nocheck-baseline.txt"
SRC_DIR="src"

CURRENT_LIST="$(mktemp)"
trap 'rm -f "$CURRENT_LIST"' EXIT

grep -rl --include='*.ts' --include='*.tsx' '@ts-nocheck' "$SRC_DIR" \
  | sed "s|^$SRC_DIR/||" | sort > "$CURRENT_LIST"

CURRENT_COUNT=$(wc -l < "$CURRENT_LIST" | tr -d ' ')

write_baseline() {
  {
    echo "# Baseline for script/check-ts-nocheck.sh"
    echo "# Count of files under $SRC_DIR containing @ts-nocheck."
    echo "# Regenerate: bash script/check-ts-nocheck.sh --update"
    echo "count=$CURRENT_COUNT"
    echo "--- files ---"
    cat "$CURRENT_LIST"
  } > "$BASELINE_FILE"
  echo "check-ts-nocheck: wrote $BASELINE_FILE with count=$CURRENT_COUNT"
}

if [ "${1:-}" = "--update" ]; then
  write_baseline
  exit 0
fi

if [ ! -f "$BASELINE_FILE" ]; then
  write_baseline
  echo "check-ts-nocheck: no baseline found; initialized (first run does not fail)"
  exit 0
fi

BASELINE_COUNT=$(grep -m1 '^count=' "$BASELINE_FILE" | cut -d= -f2)

echo "check-ts-nocheck: baseline=$BASELINE_COUNT current=$CURRENT_COUNT"

if [ "$CURRENT_COUNT" -gt "$BASELINE_COUNT" ]; then
  DIFF="$(comm -13 <(grep -v '^#' "$BASELINE_FILE" | grep -v '^count=' | grep -v '^--- files ---$' | sort) "$CURRENT_LIST" || true)"
  echo "::error::@ts-nocheck count increased: $BASELINE_COUNT -> $CURRENT_COUNT"
  if [ -n "$DIFF" ]; then
    echo "New files with @ts-nocheck:"
    echo "$DIFF"
  fi
  echo "Remove the directive and fix the type errors, or (if unavoidable) update $BASELINE_FILE in the same commit."
  exit 1
fi

if [ "$CURRENT_COUNT" -lt "$BASELINE_COUNT" ]; then
  echo "check-ts-nocheck: count decreased by $((BASELINE_COUNT - CURRENT_COUNT)). Update $BASELINE_FILE to lock in the improvement."
fi
exit 0
