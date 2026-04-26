#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${Allternit_DEV_STATE_DIR:-/tmp/allternit-dev}"
PID_DIR="$STATE_DIR/pids"
LOG_DIR="$STATE_DIR/logs"
VENV_DIR="${Allternit_DEV_VENV_DIR:-$ROOT_DIR/.venv}"
VENV_PYTHON="$VENV_DIR/bin/python3"
REQUIRE_VOICE="${Allternit_DEV_REQUIRE_VOICE:-0}"
VOICE_HEALTH_ATTEMPTS="${Allternit_DEV_VOICE_HEALTH_ATTEMPTS:-20}"
START_UI="${Allternit_DEV_START_UI:-1}"
REQUIRE_UI="${Allternit_DEV_REQUIRE_UI:-1}"
UI_HEALTH_ATTEMPTS="${Allternit_DEV_UI_HEALTH_ATTEMPTS:-60}"

mkdir -p "$PID_DIR" "$LOG_DIR" "$ROOT_DIR/workspace"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[up] required command not found: $cmd"
    exit 1
  fi
}

ensure_venv() {
  require_cmd "python3"
  if [[ ! -x "$VENV_PYTHON" ]]; then
    echo "[up] creating virtualenv: $VENV_DIR"
    python3 -m venv "$VENV_DIR"
  fi
}

venv_has_python_module() {
  local module="$1"
  "$VENV_PYTHON" - <<PY >/dev/null 2>&1
import importlib
import sys
try:
    importlib.import_module("$module")
except Exception:
    sys.exit(1)
sys.exit(0)
PY
}

ensure_venv_requirements() {
  local probe_module="$1"
  ensure_venv
  if ! venv_has_python_module "$probe_module"; then
    echo "[up] installing Python deps into $VENV_DIR"
    "$VENV_PYTHON" -m pip install --upgrade -r "$ROOT_DIR/scripts/requirements.txt"
  fi
  if ! venv_has_python_module "$probe_module"; then
    echo "[up] recreating virtualenv due broken Python deps: $VENV_DIR"
    rm -rf "$VENV_DIR"
    ensure_venv
    "$VENV_PYTHON" -m pip install --upgrade -r "$ROOT_DIR/scripts/requirements.txt"
  fi
  if ! venv_has_python_module "$probe_module"; then
    echo "[up] unable to import Python module after reinstall: $probe_module"
    exit 1
  fi
}

start_if_needed() {
  local name="$1"
  local cmd="$2"
  local pid_file="$PID_DIR/${name}.pid"
  local log_file="$LOG_DIR/${name}.log"

  if [[ -f "$pid_file" ]]; then
    local existing_pid
    existing_pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
      echo "[up] ${name} already running (pid=${existing_pid})"
      return
    fi
  fi

  nohup /bin/bash -lc "$cmd" >"$log_file" 2>&1 &
  local new_pid=$!
  echo "$new_pid" > "$pid_file"
  echo "[up] started ${name} (pid=${new_pid})"
}

wait_http() {
  local name="$1"
  local url="$2"
  local attempts="${3:-180}"
  local delay="${4:-1}"

  for _ in $(seq 1 "$attempts"); do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      echo "[up] ${name} healthy: ${url}"
      return 0
    fi
    sleep "$delay"
  done

  echo "[up] ${name} did not become healthy: ${url}"
  return 1
}

VOICE_CMD="cd '$ROOT_DIR/4-services/ml-ai-services/voice-service' && python3 launch.py"
KERNEL_CMD="cd '$ROOT_DIR' && export PATH='$VENV_DIR/bin':\$PATH && cargo run -p kernel"
API_CMD="cd '$ROOT_DIR/7-apps/api' && Allternit_DB_PATH='$ROOT_DIR/workspace/allternit-api.db' Allternit_LEDGER_PATH='$ROOT_DIR/workspace/allternit-api.jsonl' Allternit_KERNEL_URL='http://127.0.0.1:3004' Allternit_API_POLICY_ENFORCE='false' cargo run"
SHELL_UI_CMD="cd '$ROOT_DIR' && pnpm --dir 7-apps/shell-ui dev"

# Kernel boot depends on jsonschema via scripts/validate_law.py.
ensure_venv_requirements "jsonschema"

start_if_needed "voice" "$VOICE_CMD"
if ! wait_http "voice" "http://127.0.0.1:8001/health" "$VOICE_HEALTH_ATTEMPTS" "1"; then
  echo "[up] voice failed to start. tail -n 200 \"$LOG_DIR/voice.log\""
  if [[ "$REQUIRE_VOICE" == "1" ]]; then
    exit 1
  fi
  echo "[up] continuing without voice (set Allternit_DEV_REQUIRE_VOICE=1 to make this fatal)"
fi

start_if_needed "kernel" "$KERNEL_CMD"
if ! wait_http "kernel" "http://127.0.0.1:3004/v1/health"; then
  echo "[up] kernel failed to start. tail -n 240 \"$LOG_DIR/kernel.log\""
  exit 1
fi

start_if_needed "api" "$API_CMD"
if ! wait_http "api" "http://127.0.0.1:3000/health"; then
  echo "[up] api failed to start. tail -n 240 \"$LOG_DIR/api.log\""
  exit 1
fi

if [[ "$START_UI" == "1" ]]; then
  if curl -fsS --max-time 2 "http://127.0.0.1:5177/" >/dev/null 2>&1; then
    echo "[up] shell-ui already healthy: http://127.0.0.1:5177/"
  else
    start_if_needed "shell-ui" "$SHELL_UI_CMD"
    if ! wait_http "shell-ui" "http://127.0.0.1:5177/" "$UI_HEALTH_ATTEMPTS" "1"; then
      echo "[up] shell-ui failed to start. tail -n 240 \"$LOG_DIR/shell-ui.log\""
      if [[ "$REQUIRE_UI" == "1" ]]; then
        exit 1
      fi
      echo "[up] continuing without shell-ui (set Allternit_DEV_REQUIRE_UI=1 to make this fatal)"
    fi
  fi
fi

echo "[up] logs: $LOG_DIR"
echo "[up] pids: $PID_DIR"
