#!/bin/bash
# Roll back the Allternit API binary and environment to a previous backup.
#
# Usage:
#   ./rollback.sh [VPS_HOST] [BACKUP_TIMESTAMP]
# If BACKUP_TIMESTAMP is omitted, the most recent backup is used.

set -euo pipefail

VPS_HOST="${1:-mail}"
BACKUP_TS="${2:-}"
API_DIR="/opt/allternit-api"
SRC_DIR="/opt/allternit-src"
ENV_FILE="/etc/allternit-api/api.env"
BACKUP_DIR="/etc/allternit-api/secret-backups"
BIN_BACKUP_DIR="/opt/allternit-api/bin/backups"

log() { echo "[rollback] $*"; }
fail() { echo "[rollback] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Select the env backup to restore.
# ---------------------------------------------------------------------------
if [ -z "${BACKUP_TS}" ]; then
  BACKUP_TS=$(ssh "root@${VPS_HOST}" "ls -1 ${BACKUP_DIR}/api.env.* 2>/dev/null | sort | tail -n1 | sed 's/.*api.env.//'" || true)
  if [ -z "${BACKUP_TS}" ]; then
    fail "no env backup found in ${BACKUP_DIR}"
  fi
  log "using most recent env backup: ${BACKUP_TS}"
fi

ENV_BACKUP="${BACKUP_DIR}/api.env.${BACKUP_TS}"
ssh "root@${VPS_HOST}" "test -f ${ENV_BACKUP}" || fail "env backup not found: ${ENV_BACKUP}"

# ---------------------------------------------------------------------------
# 2. Select the binary backup to restore.
# ---------------------------------------------------------------------------
BIN_BACKUP=$(ssh "root@${VPS_HOST}" "ls -1 ${BIN_BACKUP_DIR}/allternit-api.* 2>/dev/null | sort | tail -n1" || true)
if [ -z "${BIN_BACKUP}" ]; then
  log "no binary backup found; will only roll back environment"
  RESTORE_BINARY=false
else
  RESTORE_BINARY=true
  log "using binary backup: ${BIN_BACKUP}"
fi

# ---------------------------------------------------------------------------
# 3. Stop the service and restore files.
# ---------------------------------------------------------------------------
log "stopping allternit-api"
ssh "root@${VPS_HOST}" "systemctl stop allternit-api || true"

log "restoring environment from ${ENV_BACKUP}"
ssh "root@${VPS_HOST}" "cp ${ENV_BACKUP} ${ENV_FILE} && chmod 600 ${ENV_FILE}"

if [ "${RESTORE_BINARY}" = "true" ]; then
  log "restoring binary from ${BIN_BACKUP}"
  ssh "root@${VPS_HOST}" "cp ${BIN_BACKUP} ${API_DIR}/bin/allternit-api && chmod +x ${API_DIR}/bin/allternit-api"
fi

# ---------------------------------------------------------------------------
# 4. Restart and verify.
# ---------------------------------------------------------------------------
log "restarting allternit-api"
ssh "root@${VPS_HOST}" "systemctl start allternit-api"
sleep 3

if ssh "root@${VPS_HOST}" "systemctl is-active --quiet allternit-api"; then
  log "rollback complete; service is active"
else
  fail "service failed to start after rollback"
fi
