#!/bin/bash
# End-to-end verification of a Tart Linux desktop via the allternit-tart-host API.
# Run on the Apple-Silicon Mac that hosts the image.
#
# Tests: create/start, SSH/exec readiness, desktop service, screenshot (scrot),
# mouse/keyboard (xdotool), file push/pull, destroy.
set -euo pipefail

HOST_URL="${TART_HOST_URL:-http://100.88.98.69:8020}"
if [ -f "${HOME}/.allternit/tart-host.env" ]; then
  # shellcheck source=/dev/null
  source "${HOME}/.allternit/tart-host.env"
fi
TOKEN="${TART_HOST_TOKEN:-}"
IMAGE="${TART_IMAGE:-allternit-desktop-tart}"
VM_NAME="allternit-e2e-$(date +%s)"
SSH_USER="admin"
SSH_PASS="admin"

curl_json() {
  local method="$1"
  local path="$2"
  shift 2
  local auth_header=""
  if [ -n "${TOKEN}" ]; then
    auth_header="Authorization: Bearer ${TOKEN}"
  fi
  curl -fsS -X "${method}" \
    "${HOST_URL}${path}" \
    -H "Content-Type: application/json" \
    ${auth_header:+-H "${auth_header}"} \
    "$@"
}

log() {
  echo "[verify-e2e] $*"
}

cleanup() {
  log "cleaning up VM ${VM_NAME}"
  curl_json DELETE "/v1/vms/${VM_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "HOST_URL=${HOST_URL} IMAGE=${IMAGE} VM=${VM_NAME}"

log "creating VM from ${IMAGE}"
curl_json POST "/v1/vms/${VM_NAME}/create" \
  -d "{\"image\":\"${IMAGE}\",\"cpu\":2,\"memory_mb\":4096}"
echo

log "starting VM"
curl_json POST "/v1/vms/${VM_NAME}/start"
echo

log "waiting for VM to reach running state with an IP"
IP=""
for i in $(seq 1 180); do
  status=$(curl_json GET "/v1/vms/${VM_NAME}" 2>/dev/null || echo '{}')
  state=$(echo "${status}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
  IP=$(echo "${status}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("ip",""))')
  if [ "${state}" = "running" ] && [ -n "${IP}" ] && [ "${IP}" != "None" ]; then
    break
  fi
  IP=""
  sleep 2
done

if [ -z "${IP:-}" ]; then
  log "ERROR: VM did not become reachable"
  exit 1
fi
log "VM running at IP ${IP}"

# Helpers for arbitrary exec against the Tart host wrapper.
exec_cmd() {
  local body
  body=$(python3 -c 'import sys,json; print(json.dumps({"command":sys.argv[1:]}))' "$@")
  curl_json POST "/v1/vms/${VM_NAME}/exec" -d "${body}"
}

exec_ok() {
  local out exit_code
  out=$(exec_cmd "$@" 2>/dev/null || true)
  exit_code=$(echo "${out}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("exit_code",1))')
  [ "${exit_code}" = "0" ]
}

log "checking desktop service"
svc_out=$(exec_cmd systemctl is-active allternit-desktop.service 2>/dev/null || true)
svc_status=$(echo "${svc_out}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("stdout","").strip())' || true)
log "service status: ${svc_status:-unknown}"
if [ "${svc_status:-}" != "active" ]; then
  log "starting desktop service with sudo"
  if ! exec_ok sudo systemctl start allternit-desktop.service; then
    log "ERROR: failed to start desktop service"
    log "exec output: $(exec_cmd sudo systemctl start allternit-desktop.service 2>/dev/null || true)"
    exit 1
  fi
fi

log "waiting for X display"
x_ready=false
for i in $(seq 1 60); do
  if exec_ok sh -c 'DISPLAY=:99 xset q'; then
    log "X display ready"
    x_ready=true
    break
  fi
  sleep 2
done
if [ "${x_ready}" != "true" ]; then
  log "ERROR: X display did not become ready"
  log "exec output: $(exec_cmd sh -c 'DISPLAY=:99 xset q' 2>/dev/null || true)"
  exit 1
fi

log "taking screenshot via scrot"
shot_out=$(exec_cmd sh -c 'DISPLAY=:99 scrot /tmp/allternit-e2e-screen.png && base64 -i /tmp/allternit-e2e-screen.png' 2>/dev/null || true)
shot_b64=$(echo "${shot_out}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("stdout","").strip())' || true)
if [ -z "${shot_b64}" ]; then
  log "ERROR: screenshot returned empty base64"
  exit 1
fi
printf '%s' "${shot_b64}" | base64 -d > "/tmp/${VM_NAME}-screen.png"
log "screenshot saved to /tmp/${VM_NAME}-screen.png ($(stat -f%z "/tmp/${VM_NAME}-screen.png" 2>/dev/null || stat -c%s "/tmp/${VM_NAME}-screen.png" 2>/dev/null) bytes)"

log "moving mouse and clicking"
exec_ok sh -c 'DISPLAY=:99 xdotool mousemove 100 100 click 1'
log "mouse click OK"

log "typing test text"
exec_ok sh -c 'DISPLAY=:99 xdotool type --delay 10 "allternit tart e2e"'
log "keyboard type OK"

TEST_FILE="/home/admin/allternit-e2e-$(date +%s).txt"
TEST_PAYLOAD="hello from allternit tart e2e"
log "pushing file to ${TEST_FILE}"
curl_json POST "/v1/vms/${VM_NAME}/files/push" \
  -d "{\"path\":\"${TEST_FILE}\",\"content_base64\":\"$(printf '%s' "${TEST_PAYLOAD}" | base64 | tr -d '\n')\"}"
echo

log "pulling file back"
pulled=$(curl_json POST "/v1/vms/${VM_NAME}/files/pull" -d "{\"path\":\"${TEST_FILE}\"}" 2>/dev/null)
# The pull endpoint returns raw bytes on success.
if [ "${pulled}" != "${TEST_PAYLOAD}" ]; then
  log "ERROR: pulled content does not match. expected='${TEST_PAYLOAD}' got='${pulled}'"
  exit 1
fi
log "file push/pull OK"

log "all Tart desktop e2e checks passed"
