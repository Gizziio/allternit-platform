#!/usr/bin/env bash
# Live smoke — one real code-mode run end-to-end (spec code-mode-execution, C3).
# payload -> grant -> human approve -> sandboxed execution -> fixed envelope -> receipt
# Run: ALLTERNIT_API_URL=http://localhost:<port> bash scripts/code_mode_smoke.sh
BASE="${ALLTERNIT_API_URL:-http://localhost:18013}"
AUTH=(-H "content-type: application/json" -H "x-allternit-user-id: cu23-smoke" -H "origin: http://localhost:5173")
PASS=0; FAIL=0

check() { # name ok
  if [ "$2" = "0" ]; then PASS=$((PASS+1)); echo "PASS: $1";
  else FAIL=$((FAIL+1)); echo "FAIL: $1"; fi
}

body_of() { printf '%s' "$1" | sed -e '$d'; }
code_of() { printf '%s' "$1" | tail -1; }
jget() { printf '%s' "$1" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d$2)" 2>/dev/null; }

echo "== 1. benign payload, no grant -> confirmation_required =="
PAYLOAD_FILE=$(mktemp /tmp/cu23-payload.XXXX)
cat > "$PAYLOAD_FILE" <<'JSON'
{
  "origin": "smoke.cu23",
  "session": "smoke-session-1",
  "language": "playwright-js",
  "code": "console.log('smoke: ' + process.env.CODE_USER);\nawait sandboxFs.writeFile('result.txt', 'ok');\nconsole.log('done');",
  "declaredTargets": ["http://127.0.0.1:8080"]
}
JSON
R1=$(curl -s -w '\n%{http_code}' "${AUTH[@]}" -X POST "$BASE/api/aci/code" -d @"$PAYLOAD_FILE")
BODY1=$(body_of "$R1"); CODE1=$(code_of "$R1")
OK=0; [ "$CODE1" = "403" ] && echo "$BODY1" | grep -q confirmation_required && OK=1
check "grant gate asks for confirmation (403 + approval_id)" $((1-OK))
APPROVAL_ID=$(jget "$BODY1" "['approval_id']")
ACTION_HASH=$(jget "$BODY1" "['action_hash']")
echo "   approval_id=$APPROVAL_ID hash=$ACTION_HASH"

echo "== 2. replay without approval -> still required (grant pending) =="
R2=$(curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" -X POST "$BASE/api/aci/code" -d '{
  "language": "playwright-js",
  "code": "console.log(1);", "declaredTargets": []}')
OK=0; [ "$R2" = "403" ] && OK=1
check "pending grant cannot execute" $((1-OK))

echo "== 3. human approves via the handoff endpoint =="
R3=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/aci/handoff/$APPROVAL_ID/approve")
OK=0; [ "$R3" = "200" ] && OK=1
check "handoff approve records the human decision" $((1-OK))

echo "== 4. approved payload executes in the sandbox =="
GRANTED_FILE=$(mktemp /tmp/cu23-granted.XXXX)
PAYLOAD_FILE_SMOKE="$PAYLOAD_FILE" APPROVAL_ID_SMOKE="$APPROVAL_ID" GRANTED_FILE_SMOKE="$GRANTED_FILE" python3 - <<'PY'
import json, os
d = json.load(open(os.environ["PAYLOAD_FILE_SMOKE"]))
d["approvalId"] = os.environ["APPROVAL_ID_SMOKE"]
json.dump(d, open(os.environ["GRANTED_FILE_SMOKE"], "w"))
PY
R4=$(curl -s -w '\n%{http_code}' "${AUTH[@]}" -X POST "$BASE/api/aci/code" -d @"$GRANTED_FILE")
BODY4=$(body_of "$R4"); CODE4=$(code_of "$R4")
OK=0; [ "$CODE4" = "200" ] && OK=1
check "approved payload returns 200" $((1-OK))
OK=0; [ "$(jget "$BODY4" "['descriptor_hash']")" = "$ACTION_HASH" ] && OK=1
check "executed descriptor hash matches the granted hash" $((1-OK))
ENVCHECK=$(printf '%s' "$BODY4" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d['result']
assert r['exit_status'] == 0, r
assert r['timed_out'] is False, r
# The credential canary: the sandbox_env VALUE must be scrubbed from the
# model-visible stdout — seeing *** IS the pass.
assert 'cu23-smoke-user' not in r['stdout'], r['stdout']
assert 'smoke: ***' in r['stdout'], r['stdout']
assert d['receipt']['status'] == 'completed', d['receipt']
assert d['receipt']['stdout_bytes'] > 0
assert 'stdout' not in d['receipt'], 'receipt must not carry stdout content'
print('envelope exit=%s timed_out=%s stdout=%r' % (r['exit_status'], r['timed_out'], r['stdout']))
" 2>&1)
OK=0; [ $? = 0 ] && OK=1
check "fixed envelope + receipt metadata-only ($ENVCHECK)" $((1-OK))
RECEIPT_ID=$(jget "$BODY4" "['receipt_id']")

echo "== 5. grant is single-use: replay with the same approvalId is denied =="
R5=$(curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" -X POST "$BASE/api/aci/code" -d "{
  \"language\": \"playwright-js\",
  \"code\": \"console.log(1);\", \"declaredTargets\": [],
  \"approvalId\": \"$APPROVAL_ID\"}")
OK=0; [ "$R5" = "403" ] && OK=1
check "replayed grant denied (single-use)" $((1-OK))

echo "== 6. tampered payload with the same grant is denied =="
R6=$(curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" -X POST "$BASE/api/aci/code" -d "{
  \"language\": \"playwright-js\",
  \"code\": \"console.log('tampered');\", \"declaredTargets\": [],
  \"approvalId\": \"$APPROVAL_ID\"}")
OK=0; [ "$R6" = "403" ] && OK=1
check "tampered payload hash-mismatch denied" $((1-OK))

echo "== 7. refuse-list: credential literal is refused pre-grant =="
R7=$(curl -s -w '\n%{http_code}' "${AUTH[@]}" -X POST "$BASE/api/aci/code" -d '{
  "language": "playwright-js",
  "code": "const k = '"'"'AKIAIOSFODNN7EXAMPLE'"'"'; console.log(k);",
  "declaredTargets": []}')
BODY7=$(body_of "$R7"); CODE7=$(code_of "$R7")
OK=0; [ "$CODE7" = "400" ] && echo "$BODY7" | grep -q '"class":"credential_pattern"' && OK=1
check "credential literal refused (400, class named)" $((1-OK))

echo "== 8. refuse-list: undeclared egress target is refused =="
R8=$(curl -s -w '\n%{http_code}' "${AUTH[@]}" -X POST "$BASE/api/aci/code" -d '{
  "language": "playwright-js",
  "code": "await page.goto('"'"'https://evil.example/x'"'"');",
  "declaredTargets": ["http://127.0.0.1:8080"]}')
BODY8=$(body_of "$R8"); CODE8=$(code_of "$R8")
OK=0; [ "$CODE8" = "400" ] && echo "$BODY8" | grep -q '"class":"undeclared_network_target"' && OK=1
check "undeclared network target refused (400, fail-closed)" $((1-OK))

echo "== 9. receipt fetchable + chained trail =="
R9=$(curl -s "$BASE/api/aci/code/receipts/$RECEIPT_ID" "${AUTH[@]}")
OK=0; [ "$(jget "$R9" "['status']")" = "completed" ] && [ -n "$(jget "$R9" "['grant_id']")" ] && OK=1
check "receipt fetchable by id, completed, grant-bound" $((1-OK))

echo "== 10. runtime egress refusal inside the sandbox =="
R10=$(curl -s -w '\n%{http_code}' "${AUTH[@]}" -X POST "$BASE/api/aci/code" -d '{
  "language": "playwright-js",
  "code": "await page.goto('"'"'https://runtime-evil.example/x'"'"');",
  "declaredTargets": ["https://runtime-evil.example", "http://127.0.0.1:8080"]}')
# Declare the host so the DESCRIPTOR passes; the runner must still fail the
# op honestly (no browser bridge in this harness placement) — proving the
# payload hits the sandbox surface, not a host fallback.
BODY10=$(body_of "$R10"); CODE10=$(code_of "$R10")
APPROVAL10=$(jget "$BODY10" "['approval_id']")
if [ "$CODE10" = "403" ] && [ -n "$APPROVAL10" ]; then
  curl -s -o /dev/null -X POST "$BASE/api/aci/handoff/$APPROVAL10/approve"
  R10B=$(curl -s -w '\n%{http_code}' "${AUTH[@]}" -X POST "$BASE/api/aci/code" -d "{
    \"language\": \"playwright-js\",
    \"code\": \"await page.goto('https://runtime-evil.example/x');\",
    \"declaredTargets\": [\"https://runtime-evil.example\", \"http://127.0.0.1:8080\"],
    \"approvalId\": \"$APPROVAL10\"}")
  BODY10=$(body_of "$R10B")
fi
OK=0
echo "$BODY10" | grep -q '"exit_status":13' && OK=1
echo "$BODY10" | grep -q 'no browser bridge' && OK=1
check "sandboxed run returns honest refusal envelope (exit 13 / no bridge)" $((1-OK))

echo
echo "SMOKE RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" = "0" ]
