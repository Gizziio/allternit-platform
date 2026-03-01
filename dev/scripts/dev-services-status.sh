#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${A2R_DEV_STATE_DIR:-/tmp/a2r-dev}"
PID_DIR="$STATE_DIR/pids"
LOG_DIR="$STATE_DIR/logs"

print_one() {
  local name="$1"
  local url="$2"
  local pid_file="$PID_DIR/${name}.pid"
  local pid="-"
  local proc="dead"
  local health="down"

  if [[ -f "$pid_file" ]]; then
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      proc="alive"
    else
      proc="dead"
    fi
  fi

  if curl -fsS "$url" >/dev/null 2>&1; then
    health="up"
  fi

  printf "%-8s pid=%-8s proc=%-5s health=%-4s %s\n" "$name" "$pid" "$proc" "$health" "$url"
}

print_one "voice" "http://127.0.0.1:8001/health"
print_one "kernel" "http://127.0.0.1:3004/v1/health"
print_one "api" "http://127.0.0.1:3000/health"

ui_pid="-"
ui_proc="dead"
ui_health="down"
if command -v lsof >/dev/null 2>&1; then
  ui_pid="$(lsof -ti tcp:5177 -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "$ui_pid" ]]; then
    ui_proc="alive"
  fi
fi
if curl -fsS "http://127.0.0.1:5177/" >/dev/null 2>&1; then
  ui_health="up"
fi
printf "%-8s pid=%-8s proc=%-5s health=%-4s %s\n" "shell-ui" "$ui_pid" "$ui_proc" "$ui_health" "http://127.0.0.1:5177/"

echo "logs: $LOG_DIR"
echo "pids: $PID_DIR"
