#!/bin/bash
set -euo pipefail
PROMPT_DIR="/Users/joe/Desktop/allternit-parity-workspace/docs/parity-reports/prompts"
LOG_DIR="/Users/joe/Desktop/allternit-parity-workspace/docs/parity-reports/logs"
mkdir -p "$LOG_DIR"

run_one() {
  local prompt="$1"
  local name
  name="$(basename "$prompt" .txt)"
  local log="$LOG_DIR/${name}.log"
  echo "[$(date -Iseconds)] Starting $name"
  if codex exec --dangerously-bypass-approvals-and-sandbox < "$prompt" > "$log" 2>&1; then
    echo "[$(date -Iseconds)] Finished $name"
    touch "$LOG_DIR/${name}.done"
  else
    echo "[$(date -Iseconds)] Failed $name (exit $?)"
    touch "$LOG_DIR/${name}.failed"
  fi
}

export -f run_one
export LOG_DIR

for n in 2 3 4 5 6 7 8 9; do
  prompt="$PROMPT_DIR/bundle-${n}-"*.txt
  # shellcheck disable=SC2086
  run_one $prompt &
done
wait
echo "[$(date -Iseconds)] Bundles 2-9 complete."
