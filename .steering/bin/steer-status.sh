#!/bin/bash
# .steering/bin/steer-status.sh — print steering status and recent consults.
# Works from any subdirectory of the repo.

set -u

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "steer-status: not inside a git repository" >&2
  exit 1
}

if [ -f "$repo_root/.steering/off" ]; then
  echo "steering: DISABLED"
  status=1
else
  echo "steering: ENABLED"
  status=0
fi

log="$repo_root/.steering/state/consults.log"
if [ -s "$log" ]; then
  tail -5 "$log"
else
  echo "no consults recorded yet"
fi

exit "$status"
