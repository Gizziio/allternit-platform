#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-9222}"

run_agent_browser() {
  agent-browser --cdp "${PORT}" --color-scheme dark "$@"
}

snapshot() {
  run_agent_browser snapshot -i
}

extract_ref_first() {
  local content="$1"
  local needle="$2"
  printf '%s\n' "${content}" \
    | grep -F "${needle}" \
    | sed -n 's/.*\[ref=\([^]]*\)\].*/\1/p' \
    | head -n 1
}

extract_ref_last() {
  local content="$1"
  local needle="$2"
  printf '%s\n' "${content}" \
    | grep -F "${needle}" \
    | sed -n 's/.*\[ref=\([^]]*\)\].*/\1/p' \
    | tail -n 1
}

assert_contains() {
  local content="$1"
  local needle="$2"
  if ! printf '%s\n' "${content}" | grep -Fq "${needle}"; then
    echo "[plugin-manager-e2e] Expected to find: ${needle}" >&2
    exit 1
  fi
}

click_ref() {
  local ref="$1"
  if [[ -z "${ref}" ]]; then
    echo "[plugin-manager-e2e] Missing element ref" >&2
    exit 1
  fi
  run_agent_browser click "@${ref}" >/dev/null
}

select_app_tab() {
  local tabs
  tabs="$(run_agent_browser tab || true)"

  local app_index
  app_index="$(printf '%s\n' "${tabs}" \
    | sed -n 's/.*\[\([0-9][0-9]*\)\].*localhost:5177\/app\/.*/\1/p' \
    | head -n 1)"

  if [[ -z "${app_index}" ]]; then
    app_index="$(printf '%s\n' "${tabs}" \
      | sed -n 's/.*\[\([0-9][0-9]*\)\].*A2rchitect Platform.*/\1/p' \
      | head -n 1)"
  fi

  if [[ -z "${app_index}" ]]; then
    echo "[plugin-manager-e2e] Could not locate main app tab. Tabs:" >&2
    printf '%s\n' "${tabs}" >&2
    exit 1
  fi

  run_agent_browser tab "${app_index}" >/dev/null
}

echo "[plugin-manager-e2e] Attaching to Electron CDP on port ${PORT}"
select_app_tab

echo "[plugin-manager-e2e] Opening Plugin Manager panel"
SNAP="$(snapshot)"
if ! printf '%s\n' "${SNAP}" | grep -Fq 'button "Back"'; then
  REF_PLUGINS_ENTRY="$(extract_ref_first "${SNAP}" 'button "Plugins"')"
  click_ref "${REF_PLUGINS_ENTRY}"
  SNAP="$(snapshot)"
  select_app_tab
fi

assert_contains "${SNAP}" 'button "Back"'
assert_contains "${SNAP}" 'button "Skills"'
assert_contains "${SNAP}" 'button "Plugins"'
assert_contains "${SNAP}" 'button "Connectors"'
assert_contains "${SNAP}" 'textbox "Search capabilities"'

echo "[plugin-manager-e2e] Verifying Connectors flow surface"
REF_CONNECTORS_TAB="$(extract_ref_first "${SNAP}" 'button "Connectors"')"
click_ref "${REF_CONNECTORS_TAB}"

SNAP="$(snapshot)"
assert_contains "${SNAP}" 'button "Connector settings"'
assert_contains "${SNAP}" 'textbox "Search capabilities"'
if ! printf '%s\n' "${SNAP}" | grep -Fq 'button "Connect"' \
  && ! printf '%s\n' "${SNAP}" | grep -Fq 'button "Disconnect"' \
  && ! printf '%s\n' "${SNAP}" | grep -Fq 'button "GitHub"' \
  && ! printf '%s\n' "${SNAP}" | grep -Fq 'button "Google Drive"'; then
  echo "[plugin-manager-e2e] Expected connector action or connector list entry in connectors pane" >&2
  exit 1
fi

echo "[plugin-manager-e2e] Verifying Plugins marketplace + personal source surface"
REF_PLUGINS_TAB="$(extract_ref_last "${SNAP}" 'button "Plugins"')"
click_ref "${REF_PLUGINS_TAB}"

SNAP="$(snapshot)"
REF_BROWSE_PLUGINS="$(extract_ref_first "${SNAP}" 'button "Browse plugins"')"
click_ref "${REF_BROWSE_PLUGINS}"

SNAP="$(snapshot)"
assert_contains "${SNAP}" 'button "Marketplace"'
assert_contains "${SNAP}" 'button "Personal"'
assert_contains "${SNAP}" 'textbox "Search plugins"'

REF_PERSONAL_TAB="$(extract_ref_first "${SNAP}" 'button "Personal"')"
click_ref "${REF_PERSONAL_TAB}"

SNAP="$(snapshot)"
assert_contains "${SNAP}" 'button "Add from GitHub"'
assert_contains "${SNAP}" 'button "Add by URL"'
assert_contains "${SNAP}" 'button "Upload plugin"'
assert_contains "${SNAP}" 'button "Sync personal sources"'

echo "[plugin-manager-e2e] PASS"
