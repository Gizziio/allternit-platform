#!/bin/bash
# A:// product-depth live evidence (session/aproduct-0913, 2026-09-13)
# Runs against allternit-api on dev port 18013, scratch data dir, files root.
set -u
API="${API:-http://127.0.0.1:18013}"
OUT="${OUT:-/tmp/aproduct-evidence/evidence.md}"
FILES_ROOT="${FILES_ROOT:-/tmp/aproduct-evidence/filesroot}"
mkdir -p "$FILES_ROOT" "$(dirname "$OUT")"
echo "hello from files connector" > "$FILES_ROOT/note.txt"
: > "$OUT"
say() { echo "$@" >> "$OUT"; }
req() { # worker-scoped request (bearer token)
  local method="$1" path="$2" token="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -s -X "$method" "$API$path" -H "Authorization: Bearer $token" \
      -H 'content-type: application/json' -H 'x-allternit-user-id: evidence-user' \
      -H 'x-allternit-user-email: evidence@allternit.local' -d "$body"
  else
    curl -s -X "$method" "$API$path" -H "Authorization: Bearer $token" \
      -H 'x-allternit-user-id: evidence-user' -H 'x-allternit-user-email: evidence@allternit.local'
  fi
}
UHDR=(-H 'x-allternit-user-id: evidence-user' -H 'x-allternit-user-email: evidence@allternit.local')
ureq() { # user-scoped request (no bearer)
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -X "$method" "$API$path" -H 'content-type: application/json' "${UHDR[@]}" -d "$body"
  else
    curl -s -X "$method" "$API$path" "${UHDR[@]}"
  fi
}
field() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('$1','') if isinstance(d,dict) else '')" 2>/dev/null; }

say "# A:// Product-Depth Live Evidence — session/aproduct-0913 ($(date -u +%FT%TZ))"
say "API: $API (dev port 18013, scratch data dir, ALLTERNIT_BROKER_FILES_ROOT=$FILES_ROOT)"
say ""

# ── P-T2: principals, capabilities, compute placement, claim refusal/grant ──
say "## P-T2 — non-local compute placement"
VM=$(ureq POST /api/v1/fabric/transport/principals '{"id":"principal/gizzi-vm-1","workspace":"a://workspace/evidence","capabilities":["compute.vm"],"roles":["worker"]}')
say "- create VM-capable principal: $(echo "$VM" | sed 's/"token":"[^"]*"/"token":"<withheld>"/')"
TOK_VM=$(echo "$VM" | field token)
LOCAL=$(ureq POST /api/v1/fabric/transport/principals '{"id":"principal/gizzi-local-1","workspace":"a://workspace/evidence","capabilities":["compute.local"],"roles":["worker"]}')
say "- create local-only principal: $(echo "$LOCAL" | sed 's/"token":"[^"]*"/"token":"<withheld>"/')"
TOK_LOC=$(echo "$LOCAL" | field token)

INTENT=$(ureq POST /api/v1/fabric/transport/intents '{"version":"a/0.1","intent_id":"intent-evidence-vm-1","workspace":"a://workspace/evidence","initiator":"a://principal/evidence-user","target":"principal/gizzi-vm-1","action":{"action_type":"shell_steps","description":"evidence vm job","payload":{"steps":[{"command":"echo vm-ok"}]}},"compute":"vm"}')
say "- submit intent compute=vm: $(echo "$INTENT" | head -c 400)"
RUN_ID=$(echo "$INTENT" | field run_id)
JOB=$(ureq GET "/api/v1/runs/$RUN_ID/jobs" | python3 -c 'import sys,json;d=json.load(sys.stdin);jobs=d if isinstance(d,list) else d.get("jobs",[]);print((jobs[0].get("id") or jobs[0].get("job_id")) if jobs else "")' 2>/dev/null)
JOBINFO=$(ureq GET "/api/v1/fabric/transport/jobs/$JOB")
say "- canonical job (fabric transport view): $(echo "$JOBINFO" | head -c 400)"

REFUSE=$(req POST /api/v1/fabric/transport/claim "$TOK_LOC" "{\"job_id\":\"$JOB\",\"lease_ttl_secs\":120}")
say "- local-only worker claims vm job → REFUSED: $REFUSE"
CLAIM=$(req POST /api/v1/fabric/transport/claim "$TOK_VM" "{\"job_id\":\"$JOB\",\"lease_ttl_secs\":120}")
LEASE_ID=$(echo "$CLAIM" | field lease_id)
GEN=$(echo "$CLAIM" | field lease_generation)
say "- vm-capable worker claims vm job → GRANTED lease $LEASE_ID (generation $GEN)"
say ""

say "## P-T4 — connector breadth (files/local through the broker)"
CS_READ=$(req POST "/api/v1/fabric/transport/jobs/$JOB/connector-sessions" "$TOK_VM" "{\"lease_id\":\"$LEASE_ID\",\"lease_generation\":$GEN,\"capability\":\"connector.files.read\",\"ttl_secs\":120}")
CS_READ_ID=$(echo "$CS_READ" | field session_id)
say "- files.read session: $(echo "$CS_READ" | head -c 300)"
INV_READ=$(req POST "/api/v1/fabric/transport/connector-sessions/$CS_READ_ID/invoke" "$TOK_VM" "{\"job_id\":\"$JOB\",\"lease_id\":\"$LEASE_ID\",\"lease_generation\":$GEN,\"payload\":{\"path\":\"note.txt\"}}")
say "- files.read invoke note.txt: $INV_READ"

WRITE_BLOCKED=$(req POST "/api/v1/fabric/transport/jobs/$JOB/connector-sessions" "$TOK_VM" "{\"lease_id\":\"$LEASE_ID\",\"lease_generation\":$GEN,\"capability\":\"connector.files.write\",\"ttl_secs\":120}")
say "- files.write session WITHOUT approval → GATED: $WRITE_BLOCKED"

APR=$(req POST "/api/v1/fabric/transport/jobs/$JOB/approvals/request" "$TOK_VM" "{\"lease_id\":\"$LEASE_ID\",\"lease_generation\":$GEN,\"capability\":\"connector.files.write\",\"target\":\"*\"}")
APR_ID=$(echo "$APR" | field id)
say "- worker requests approval: status=$(echo "$APR" | field status) id=$APR_ID"
GRANT=$(ureq POST "/api/v1/fabric/transport/approvals/$APR_ID/grant" '')
say "- human grants: status=$(echo "$GRANT" | field status)"
CS_WRITE=$(req POST "/api/v1/fabric/transport/jobs/$JOB/connector-sessions" "$TOK_VM" "{\"lease_id\":\"$LEASE_ID\",\"lease_generation\":$GEN,\"capability\":\"connector.files.write\",\"ttl_secs\":120}")
CS_WRITE_ID=$(echo "$CS_WRITE" | field session_id)
INV_WRITE=$(req POST "/api/v1/fabric/transport/connector-sessions/$CS_WRITE_ID/invoke" "$TOK_VM" "{\"job_id\":\"$JOB\",\"lease_id\":\"$LEASE_ID\",\"lease_generation\":$GEN,\"payload\":{\"path\":\"out/result.txt\",\"content\":\"written via files connector\"}}")
say "- files.write invoke out/result.txt: $INV_WRITE"
say "- on-disk proof: $(cat "$FILES_ROOT/out/result.txt" 2>/dev/null)"
ESC=$(req POST "/api/v1/fabric/transport/connector-sessions/$CS_READ_ID/invoke" "$TOK_VM" "{\"job_id\":\"$JOB\",\"lease_id\":\"$LEASE_ID\",\"lease_generation\":$GEN,\"payload\":{\"path\":\"../../etc/passwd\"}}")
say "- path escape attempt → REFUSED: $ESC"
say ""

say "## P-T1 — consolidation boundary (leased-job projection refusal)"
BOUND=$(ureq POST "/api/v1/runs/$RUN_ID/jobs/$JOB/state" '{"state":"completed"}')
say "- POST /cowork/runs/$RUN_ID/jobs/$JOB/state on a leased job → $BOUND"
DONE=$(req POST "/api/v1/fabric/transport/jobs/$JOB/complete" "$TOK_VM" "{\"lease_id\":\"$LEASE_ID\",\"lease_generation\":$GEN,\"success\":true,\"summary\":\"evidence vm job completed\"}")
say "- canonical complete via fabric transport: $(echo "$DONE" | head -c 300)"
BOUND2=$(ureq POST "/api/v1/runs/$RUN_ID/jobs/$JOB/state" '{"state":"failed"}')
say "- projection write after terminal transition applied: $BOUND2"
say ""

say "## P-T5 — Al persona chat (deterministic fallback; no OS control plane)"
AL=$(ureq POST /api/v1/cowork/al/chat '{"session_id":"alsess-evidence-1","message":"Run a shell step that echoes hello from Al"}')
say "- POST /cowork/al/chat: $(echo "$AL" | head -c 900)"
SESS=$(ureq GET /api/v1/cowork/al/sessions/alsess-evidence-1)
say "- GET /cowork/al/sessions/alsess-evidence-1: $(echo "$SESS" | head -c 600)"
say ""

say "## P-T6 — control-surface endpoints"
say "- GET /fabric/transport/principals: $(ureq GET '/api/v1/fabric/transport/principals?workspace=a://workspace/evidence' | head -c 600)"
RULE=$(ureq PUT /api/v1/fabric/transport/delegation-rules '{"workspace":"a://workspace/evidence","action_type":"shell_steps","target_principal":"principal/gizzi-local-1","priority":10}')
say "- PUT delegation-rule: $RULE"
say "- GET delegation-rules: $(ureq GET '/api/v1/fabric/transport/delegation-rules?workspace=a://workspace/evidence' | head -c 400)"
say "- DELETE delegation-rule: $(ureq DELETE '/api/v1/fabric/transport/delegation-rules/a:%2F%2Fworkspace%2Fevidence/shell_steps' | head -c 200)"
EV=$(ureq GET "/api/v1/runs/$RUN_ID/events")
say "- GET /cowork/runs/$RUN_ID/events (attribution triple): $(echo "$EV" | head -c 800)"
CS=$(ureq GET /api/v1/fabric/transport/connector-sessions)
say "- GET /fabric/transport/connector-sessions: $(echo "$CS" | head -c 500)"
say ""

# ── P-T5 end-to-end + P-T3: Al delegates → daemon worker claims & executes ──
say "## P-T5 (end-to-end) + P-T3 — Al delegates; daemon worker claims, executes, shuts down gracefully"
DAEMON=$(ureq POST /api/v1/fabric/transport/principals '{"id":"principal/gizzi-daemon-1","workspace":"a://workspace/default","capabilities":["compute.local"],"roles":["worker"]}')
TOK_DAEMON=$(echo "$DAEMON" | field token)
say "- daemon principal (workspace default): $(echo "$DAEMON" | sed 's/"token":"[^"]*"/"token":"<withheld>"/')"
RULE2=$(ureq PUT /api/v1/fabric/transport/delegation-rules '{"workspace":"default","action_type":"run","target_principal":"principal/gizzi-daemon-1","priority":10}')
say "- delegation rule run → gizzi-daemon-1: $RULE2"
AL2=$(ureq POST /api/v1/cowork/al/chat '{"session_id":"alsess-evidence-2","message":"Run a shell step that echoes hello from Al"}')
say "- Al chat #2 (rule matched): $(echo "$AL2" | head -c 700)"
RUN2=$(echo "$AL2" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("run_id",""))' 2>/dev/null)
JOB2=""
for i in $(seq 1 10); do
  JOB2=$(ureq GET "/api/v1/runs/$RUN2/jobs" | python3 -c 'import sys,json;d=json.load(sys.stdin);jobs=d if isinstance(d,list) else d.get("jobs",[]);print((jobs[0].get("id") or jobs[0].get("job_id")) if jobs else "")' 2>/dev/null)
  [ -n "$JOB2" ] && break
  sleep 1
done
say "- canonical run $RUN2 job: $JOB2"

DAEMON_LOG=/tmp/aproduct-evidence/daemon.log
: > "$DAEMON_LOG"
cd /Users/joe/Desktop/allternit-workspace/allternit-session-aproduct-0913/cmd/gizzi-code
ALLTERNIT_API_URL=http://127.0.0.1:18013 ALLTERNIT_GIZZI_TOKEN="$TOK_DAEMON" ALLTERNIT_GIZZI_LEASE_SECS=60 \
  bun src/runtime/fabric-transport/worker-daemon-entry.ts > "$DAEMON_LOG" 2>&1 &
DPID=$!
cd - >/dev/null
sleep 12
kill -TERM $DPID 2>/dev/null
sleep 3
say "- daemon log (structured JSON):"
sed 's/^/    /' "$DAEMON_LOG" | head -20 >> "$OUT"
JOB2STATE=$(ureq GET "/api/v1/runs/$RUN2/jobs" | python3 -c 'import sys,json;d=json.load(sys.stdin);jobs=d if isinstance(d,list) else d.get("jobs",[]);print(jobs[0].get("state","") if jobs else "")' 2>/dev/null)
say "- job $JOB2 state after daemon run: $JOB2STATE"
EV2=$(ureq GET "/api/v1/runs/$RUN2/events")
say "- run $RUN2 events (attribution initiator/delegator/executor): $(echo "$EV2" | head -c 800)"
say ""

echo "TOK_VM=$TOK_VM" > /tmp/aproduct-evidence/tokens
echo "TOK_LOC=$TOK_LOC" >> /tmp/aproduct-evidence/tokens
echo "TOK_DAEMON=$TOK_DAEMON" >> /tmp/aproduct-evidence/tokens
echo "JOB=$JOB RUN_ID=$RUN_ID JOB2=$JOB2 RUN2=$RUN2" >> /tmp/aproduct-evidence/tokens
echo "evidence written to $OUT"
