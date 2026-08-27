#!/usr/bin/env bash
# rails-ensure: verify the rails mail API (port 8013) accepts pipeline writes,
# self-healing by starting the dev API when the port is free or unhealthy.
# There is NO fallback path: if rails cannot be made to work, exit non-zero.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
# NOTE: must be "localhost", NOT 127.0.0.1 — the dev auth bypass checks the
# Host header for "localhost".
BASE="http://localhost:8013"
PROBE_BODY='{"thread":"wih:pipeline-probe","asset_ref":"/tmp/pipeline-probe","note":"probe"}'

blocker() {
  echo "rails: port 8013 held by an instance that rejects pipeline writes — run \`make stop && make api\` or stop the packaged app" >&2
  exit 1
}

health_ok() {
  curl -sf --max-time 5 "$BASE/health" >/dev/null 2>&1
}

port_free() {
  ! lsof -ti:8013 >/dev/null 2>&1
}

# Real write probe: POST to the rails mail share endpoint. Succeeds only when
# the running instance accepts pipeline writes (dev bypass active).
probe() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
    -X POST "$BASE/api/rails/mail/share" \
    -H 'Content-Type: application/json' \
    -d "$PROBE_BODY" 2>/dev/null)"
  [[ "$code" == 2* ]]
}

if probe; then
  echo "rails: OK"
  exit 0
fi

if port_free || ! health_ok; then
  echo "rails: probe rejected; starting dev API via dev/scripts/start-api.sh" >&2
  "$ROOT/dev/scripts/start-api.sh" >&2
  deadline=$((SECONDS + 60))
  while (( SECONDS < deadline )); do
    if probe; then
      echo "rails: OK"
      exit 0
    fi
    sleep 2
  done
  echo "rails: dev API did not accept the pipeline probe within 60s — check /tmp/allternit-api.log" >&2
  exit 1
fi

# Port is held and healthy but rejects pipeline writes (e.g. packaged app
# instance without the dev bypass). No fallback, no skip.
blocker
