#!/bin/bash
# Consumer-packaged Cowork P1 — managed runtime live evidence (2026-09-14)
set -u
API="${API:-http://127.0.0.1:18013}"
OUT="${OUT:-/tmp/coworkp1-evidence/evidence.md}"
mkdir -p "$(dirname "$OUT")"
: > "$OUT"
say() { echo "$@" >> "$OUT"; }
DESKTOP_TOKEN="${DESKTOP_TOKEN:-p1evidencedesktoptoken000000000000}"

say "# Consumer-Packaged Cowork P1 — Managed Runtime live evidence ($(date -u +%FT%TZ))"
say "API: $API (scratch data dir, ALLTERNIT_DESKTOP_ACCESS_TOKEN set at spawn)"
say ""

say "## 1.1 — local-only ensure route (desktop access-token gated)"
say "- POST ensure WITHOUT token → $(curl -s -X POST "$API/api/v1/fabric/transport/local/ensure-worker-principal" -H 'content-type: application/json' -d '{}')"
say "- POST ensure with WRONG token → $(curl -s -X POST "$API/api/v1/fabric/transport/local/ensure-worker-principal" -H 'content-type: application/json' -H "x-allternit-desktop-access-token: wrong" -d '{}')"
RESP=$(curl -s -X POST "$API/api/v1/fabric/transport/local/ensure-worker-principal" \
  -H 'content-type: application/json' \
  -H "x-allternit-desktop-access-token: $DESKTOP_TOKEN" \
  -H 'x-allternit-user-id: desktop-local' \
  -H 'x-allternit-user-email: desktop-local@desktop.allternit.local' \
  -d '{"workspace":"default"}')
say "- POST ensure WITH token → principal + once-only token (withheld)"
TOKEN=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))' 2>/dev/null)
PID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("principal_id",""))' 2>/dev/null)
say "  principal_id=$PID token_len=${#TOKEN}"

say "- second ensure ROTATES (old token must die):"
RESP2=$(curl -s -X POST "$API/api/v1/fabric/transport/local/ensure-worker-principal" \
  -H 'content-type: application/json' \
  -H "x-allternit-desktop-access-token: $DESKTOP_TOKEN" \
  -H 'x-allternit-user-id: desktop-local' \
  -d '{}')
TOKEN2=$(echo "$RESP2" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))' 2>/dev/null)
say "  new_token_len=${#TOKEN2} rotated=$([ "$TOKEN" != "$TOKEN2" ] && echo yes || echo NO)"
CLAIM_OLD=$(curl -s -X POST "$API/api/v1/fabric/transport/claim" -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{}')
say "- claim with OLD token → refused: $(echo "$CLAIM_OLD" | head -c 160)"
echo "$TOKEN2" > /tmp/coworkp1-evidence/worker.token
echo "$DESKTOP_TOKEN" > /tmp/coworkp1-evidence/desktop.token
say ""

say "## 1.4 — folder grants via /cowork-preferences (desktop local auth)"
GETP=$(curl -s "$API/api/v1/cowork-preferences" -H "x-allternit-desktop-access-token: $DESKTOP_TOKEN" -H 'x-allternit-user-id: desktop-local')
say "- GET preferences (fresh profile): $GETP"
say "- PUT trusted_folders: $(curl -s -X PUT "$API/api/v1/cowork-preferences" -H 'content-type: application/json' -H "x-allternit-desktop-access-token: $DESKTOP_TOKEN" -H 'x-allternit-user-id: desktop-local' -d '{"trusted_folders":["/tmp/coworkp1-evidence/granted"]}')"
GETP2=$(curl -s "$API/api/v1/cowork-preferences" -H "x-allternit-desktop-access-token: $DESKTOP_TOKEN" -H 'x-allternit-user-id: desktop-local')
say "- GET after: $GETP2"
say ""

say "## worker claim loop with the provisioned token (managed spawn shape)"
WLOG=/tmp/coworkp1-evidence/worker.log
: > "$WLOG"
cd $HOME/Desktop/allternit-workspace/allternit-session-coworkp1-0914/cmd/gizzi-code
ALLTERNIT_API_URL="$API" ALLTERNIT_GIZZI_TOKEN="$TOKEN2" GIZZI_COMPUTE_MODE=local \
  bun run src/runtime/fabric-transport/worker-daemon-entry.ts > "$WLOG" 2>&1 &
WPID=$!
sleep 6
kill -TERM $WPID 2>/dev/null
sleep 2
say "- worker log (structured JSON):"
sed 's/^/    /' "$WLOG" | head -12 >> "$OUT"
grep -q 'worker.daemon_start' "$WLOG" && say "- daemon_start observed: yes" || say "- daemon_start observed: NO"
grep -q 'shutdown_requested' "$WLOG" && say "- SIGTERM graceful stop observed: yes" || say "- SIGTERM graceful stop observed: NO"
say ""

echo "evidence written to $OUT"
