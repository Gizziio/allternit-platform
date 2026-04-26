#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT_DIR/.allternit/services.json"

if [[ ! -f "$CONFIG" ]]; then
  echo "Missing services config at $CONFIG" >&2
  exit 1
fi

ports=$(python3 - <<'PY'
import json
from pathlib import Path
config = Path(".allternit/services.json")
data = json.loads(config.read_text())
ports = sorted({int(v) for v in data.get("ports", {}).values()})
print(" ".join(str(p) for p in ports))
PY
)

if [[ -z "$ports" ]]; then
  echo "No ports found in services config." >&2
  exit 0
fi

echo "Cleaning ports: $ports"

pids=()
for port in $ports; do
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && pids+=("$pid")
  done < <(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
done

if [[ ${#pids[@]} -eq 0 ]]; then
  echo "No listeners found on configured ports."
  exit 0
fi

# Deduplicate PIDs
uniq_pids=$(printf "%s\n" "${pids[@]}" | sort -u)

for pid in $uniq_pids; do
  cmd=$(ps -p "$pid" -o comm= 2>/dev/null | tr -d ' ' || true)
  if [[ -z "$cmd" ]]; then
    cmd="unknown"
  fi
  echo "Stopping PID $pid ($cmd)"
  kill "$pid" 2>/dev/null || true
done

# Give processes time to exit
sleep 1

# Force kill remaining
remaining=()
for pid in $uniq_pids; do
  if kill -0 "$pid" 2>/dev/null; then
    remaining+=("$pid")
  fi
done

if [[ ${#remaining[@]} -gt 0 ]]; then
  for pid in "${remaining[@]}"; do
    cmd=$(ps -p "$pid" -o comm= 2>/dev/null | tr -d ' ' || true)
    if [[ -z "$cmd" ]]; then
      cmd="unknown"
    fi
    echo "Force killing PID $pid ($cmd)"
    kill -9 "$pid" 2>/dev/null || true
  done
fi

echo "Cleanup complete."
