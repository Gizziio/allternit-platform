#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${Allternit_DEV_STATE_DIR:-/tmp/allternit-dev}"
PID_DIR="$STATE_DIR/pids"

stop_pid_file() {
  local name="$1"
  local pid_file="$PID_DIR/${name}.pid"

  if [[ ! -f "$pid_file" ]]; then
    echo "[down] ${name}: no pid file"
    return
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    rm -f "$pid_file"
    echo "[down] ${name}: empty pid file removed"
    return
  fi

  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "[down] ${name}: stopped pid ${pid}"
  else
    echo "[down] ${name}: pid ${pid} already dead"
  fi

  rm -f "$pid_file"
}

stop_pid_file "api"
stop_pid_file "kernel"
stop_pid_file "voice"
stop_pid_file "shell-ui"
