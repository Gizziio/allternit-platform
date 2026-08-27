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

# If GNU parallel is available, run up to 3 codex processes concurrently.
if command -v parallel >/dev/null 2>&1; then
  find "$PROMPT_DIR" -name 'bundle-*.txt' -print0 | parallel -0 -j 3 run_one
else
  for prompt in "$PROMPT_DIR"/bundle-*.txt; do
    run_one "$prompt"
  done
fi

echo "[$(date -Iseconds)] All Codex tasks complete."
