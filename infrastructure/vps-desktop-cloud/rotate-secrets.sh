#!/bin/bash
# Rotate sensitive tokens for the Allternit Desktop Cloud deployment.
#
# Run from a machine that can SSH as root into the VPS and as the admin user
# into each Tart host. Keeps a timestamped backup of the previous env file so
# you can roll back if something goes wrong.
#
# Usage:
#   TART_HOSTS="100.88.98.69" ./rotate-secrets.sh [VPS_HOST]

set -euo pipefail

VPS_HOST="${1:-mail}"
TART_HOSTS="${TART_HOSTS:-}"
ENV_FILE="/etc/allternit-api/api.env"
TART_ENV_FILE="${HOME}/.allternit/tart-host.env"
BACKUP_DIR="/etc/allternit-api/secret-backups"
TS=$(date +%Y%m%d-%H%M%S)

log() { echo "[rotate-secrets] $*"; }
fail() { echo "[rotate-secrets] ERROR: $*" >&2; exit 1; }

new_hex() { openssl rand -hex 32; }

log "target VPS: ${VPS_HOST}"

# ---------------------------------------------------------------------------
# 1. Backup existing secrets on the VPS.
# ---------------------------------------------------------------------------
ssh "root@${VPS_HOST}" "mkdir -p ${BACKUP_DIR} && cp ${ENV_FILE} ${BACKUP_DIR}/api.env.${TS}"
log "backed up ${ENV_FILE} -> ${BACKUP_DIR}/api.env.${TS}"

# ---------------------------------------------------------------------------
# 2. Rotate API-side tokens.
# ---------------------------------------------------------------------------
log "rotating API tokens"
ssh "root@${VPS_HOST}" "
set -e
sed -i \
  -e 's/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$(new_hex)/' \
  -e 's/^ALLTERNIT_INTERNAL_SERVICE_TOKEN=.*/ALLTERNIT_INTERNAL_SERVICE_TOKEN=$(new_hex)/' \
  -e 's/^ALLTERNIT_SELF_HOSTED_SETUP_TOKEN=.*/ALLTERNIT_SELF_HOSTED_SETUP_TOKEN=$(new_hex)/' \
  ${ENV_FILE}
chown root:root ${ENV_FILE}
chmod 600 ${ENV_FILE}
"

# ---------------------------------------------------------------------------
# 3. Rotate the Tart host token on every configured host and update the API.
# ---------------------------------------------------------------------------
if [ -n "${TART_HOSTS}" ]; then
  new_tart_token=$(new_hex)
  for host in ${TART_HOSTS//,/ }; do
    host=$(echo "${host}" | sed 's|http://||; s|https://||; s|:.*||')
    log "rotating Tart host token on ${host}"
    ssh "admin@${host}" "
set -e
mkdir -p \$(dirname ${TART_ENV_FILE})
if [ -f ${TART_ENV_FILE} ]; then
  cp ${TART_ENV_FILE} ${TART_ENV_FILE}.${TS}
fi
echo 'TART_HOST_TOKEN=${new_tart_token}' > ${TART_ENV_FILE}
chmod 600 ${TART_ENV_FILE}
launchctl bootout gui/\$(id -u)/com.allternit.tart-host >/dev/null 2>&1 || true
launchctl bootstrap gui/\$(id -u) ${HOME}/Library/LaunchAgents/com.allternit.tart-host.plist
"
  done

  log "updating API env with new Tart token"
  ssh "root@${VPS_HOST}" "
set -e
if grep -q '^TART_HOST_TOKEN=' ${ENV_FILE}; then
  sed -i 's/^TART_HOST_TOKEN=.*/TART_HOST_TOKEN=${new_tart_token}/' ${ENV_FILE}
else
  echo 'TART_HOST_TOKEN=${new_tart_token}' >> ${ENV_FILE}
fi
"
fi

# ---------------------------------------------------------------------------
# 4. Restart the API to pick up new secrets.
# ---------------------------------------------------------------------------
log "restarting allternit-api"
ssh "root@${VPS_HOST}" "systemctl restart allternit-api && sleep 3 && systemctl is-active allternit-api"

log "secret rotation complete"
