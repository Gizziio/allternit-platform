#!/usr/bin/env bash
# brain-resolve.sh — shared brain path resolution (D1-R3, extracted from
# taste-ingest.sh/wiki-ingest.sh for M3). Prints the resolved brain path on
# stdout (always prints something — callers decide whether absence matters
# with their own [ -d ] check):
#   1. explicit TASTE_BRAIN env wins;
#   2. the brain registered by `gizzi brain init` in gizzi user settings
#      (brain.path);
#   3. the D1 default ~/brain when it exists;
#   4. the legacy $HOME/Desktop/allternit-brain path.
set -uo pipefail

if [ -n "${TASTE_BRAIN:-}" ]; then
  printf '%s\n' "$TASTE_BRAIN"
  exit 0
fi

settings="$HOME/.gizzi/settings.json"
configured=""
if [ -f "$settings" ]; then
  configured="$(python3 -c '
import json, sys
try:
    print(json.load(open(sys.argv[1])).get("brain", {}).get("path", "") or "")
except Exception:
    pass
' "$settings" 2>/dev/null)"
fi

if [ -n "$configured" ]; then
  printf '%s\n' "$configured"
elif [ -d "$HOME/brain" ]; then
  printf '%s\n' "$HOME/brain"
else
  printf '%s\n' "$HOME/Desktop/allternit-brain"
fi
