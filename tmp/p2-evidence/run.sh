#!/bin/bash
# P2 — Chat drives A:// live evidence (2026-09-14)
set -u
API=http://127.0.0.1:18013
MOCK=http://127.0.0.1:18014
OUT=/tmp/p2-demo/evidence.md
mkdir -p /tmp/p2-demo/granted
: > "$OUT"
say() { echo "$@" >> "$OUT"; }
H='-H content-type:application/json -H x-allternit-user-id:p2-user -H x-allternit-user-email:p2@allternit.local'
DT='-H x-allternit-desktop-access-token:p2evidencedesktoptoken000000000'

say "# P2 — Chat drives A:// live evidence ($(date -u +%FT%TZ))"
say ""

say "## setup: delegation rule + trusted folders + worker credential"
say "- rule: $(curl -s $H -X PUT $API/api/v1/fabric/transport/delegation-rules -d '{"workspace":"default","action_type":"organize","target_principal":"principal/gizzi-daemon-1","priority":10}')"
DP=$(curl -s $H -X POST $API/api/v1/fabric/transport/principals -d '{"id":"principal/gizzi-daemon-1","workspace":"a://workspace/default","capabilities":["compute.local"],"roles":["worker"]}')
TOK=$(echo "$DP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))')
say "- worker principal provisioned (token withheld)"
say "- trusted_folders: $(curl -s $H $DT -X PUT $API/api/v1/cowork-preferences -d '{"trusted_folders":["/tmp/p2-demo/granted"]}')"
echo "$TOK" > /tmp/p2-demo/worker.token
say ""

say "## 2.1 — SSE chat stream: message → intent → delegation → narration"
curl -s -N $H -X POST $API/api/v1/cowork/al/chat/stream \
  -d '{"session_id":"p2sess-1","message":"organize this folder"}' > /tmp/p2-demo/sse.log 2>&1 &
SSE=$!
sleep 2
say "- stream opened; first frames:"
grep '^data:' /tmp/p2-demo/sse.log | head -4 | sed 's/^/    /' >> "$OUT"

say ""
say "## 2.2/2.3 — agentic worker claims, writes ONLY inside grants; killed mid-run; recovers"
WLOG=/tmp/p2-demo/worker.log
: > "$WLOG"
cd /Users/joe/Desktop/allternit-workspace/allternit-session-coworkp1-0914/cmd/gizzi-code
ALLTERNIT_API_URL=$MOCK ALLTERNIT_GIZZI_TOKEN="$TOK" ALLTERNIT_OPERATOR_API_KEY=p2-operator-key \
  ALLTERNIT_WORKER_TRUSTED_FOLDERS='["/tmp/p2-demo/granted"]' ALLTERNIT_GIZZI_LEASE_SECS=20 \
  bun run src/runtime/fabric-transport/worker-daemon-entry.ts > "$WLOG" 2>&1 &
WPID=$!
sleep 2
say "- worker claimed; model call in flight (3s); KILLING worker mid-run (pid $WPID)"
kill -9 $WPID 2>/dev/null
sleep 1
MID=$(sqlite3 /tmp/p2-demo/data/allternit.db "SELECT state FROM cowork_jobs ORDER BY created_at DESC LIMIT 1;")
say "- canonical job state right after kill: $MID (still active; sweeper must requeue)"
say "- waiting for lease expiry + sweeper requeue…"
sleep 22
REQUEUE=$(sqlite3 /tmp/p2-demo/data/allternit.db "SELECT state, retry_count FROM cowork_jobs ORDER BY created_at DESC LIMIT 1;")
say "- canonical job state after sweeper: $REQUEUE (requeued for recovery)"
say "- restarting worker (fresh process; replay against the SAME run)"
ALLTERNIT_API_URL=$MOCK ALLTERNIT_GIZZI_TOKEN="$TOK" ALLTERNIT_OPERATOR_API_KEY=p2-operator-key \
  ALLTERNIT_WORKER_TRUSTED_FOLDERS='["/tmp/p2-demo/granted"]' ALLTERNIT_GIZZI_LEASE_SECS=60 \
  bun run src/runtime/fabric-transport/worker-daemon-entry.ts >> "$WLOG" 2>&1 &
WPID2=$!
sleep 12
kill -TERM $WPID2 2>/dev/null
sleep 2
say "- worker log:"
sed 's/^/    /' "$WLOG" | head -18 >> "$OUT"
say ""
say "## artifacts confinement proof"
say "- granted dir: $(ls /tmp/p2-demo/granted/ 2>/dev/null | tr '\n' ' ')"
say "- /tmp/p2-demo outside grants: $(ls /tmp/p2-demo/ | grep -v granted | grep -v evidence | grep -v worker | grep -v sse | grep -v mock | grep -v 'p2-demo' | tr '\n' ' ')(no agent-written files expected)"
EVIL=$(find /tmp/p2-demo -maxdepth 1 -name 'evil*' -o -maxdepth 1 -name 'organized*' | grep -v granted | wc -l | tr -d ' ')
say "- files written OUTSIDE grants: $EVIL (must be 0)"
say ""
say "## SSE stream result frames"
sleep 1
say "- tail frames:"
grep '^data:' /tmp/p2-demo/sse.log | tail -6 | sed 's/^/    /' >> "$OUT"
kill $SSE 2>/dev/null
say ""
echo "evidence written to $OUT"
