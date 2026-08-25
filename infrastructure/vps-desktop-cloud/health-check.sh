#!/bin/bash
# Allternit API health watchdog for systemd / cron.
# Records health to /var/log/allternit-api/health.log and exits non-zero on
# failure so systemd/on-failure units or cron notifications can react.

set -euo pipefail

API_URL="${ALLTERNIT_API_URL:-https://mail.news.allternit.com}"
ENV_FILE="${ALLTERNIT_ENV_FILE:-/etc/allternit-api/api.env}"
LOG_DIR="/var/log/allternit-api"
LOG_FILE="${LOG_DIR}/health.log"
TS=$(date -Iseconds)

mkdir -p "$LOG_DIR"

SELF_HOSTED_TOKEN=""
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  SELF_HOSTED_TOKEN=$(grep '^ALLTERNIT_SELF_HOSTED_SETUP_TOKEN=' "$ENV_FILE" | cut -d= -f2- || true)
fi

if curl -fsS "${API_URL}/health" >/dev/null 2>&1; then
  echo "${TS} OK ${API_URL}/health" >> "$LOG_FILE"
else
  echo "${TS} FAIL ${API_URL}/health" >> "$LOG_FILE"
  exit 1
fi

if [ -n "$SELF_HOSTED_TOKEN" ]; then
  if curl -fsS -H "X-Allternit-Self-Hosted-Token: ${SELF_HOSTED_TOKEN}" "${API_URL}/api/v1/desktop-health" >/dev/null 2>&1; then
    echo "${TS} OK ${API_URL}/api/v1/desktop-health" >> "$LOG_FILE"
    exit 0
  else
    echo "${TS} FAIL ${API_URL}/api/v1/desktop-health" >> "$LOG_FILE"
    exit 1
  fi
else
  echo "${TS} SKIP ${API_URL}/api/v1/desktop-health (no token)" >> "$LOG_FILE"
fi
