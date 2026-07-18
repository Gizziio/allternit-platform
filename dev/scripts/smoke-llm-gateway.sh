#!/usr/bin/env bash
# Smoke test for the LLM gateway control plane (B2–B7).
#
# Exercises the full flow against a RUNNING stack (this script starts
# nothing — see dev/scripts/start-api.sh and your Gizzi launcher):
#   1. create a virtual key (admin API, Clerk local-dev bypass)
#   2. non-streaming chat completion via a policy alias (B5 routing)
#   3. streaming chat completion
#   4. verify llm_usage_events + llm_routing_decisions rows via sqlite3
#   5. bogus primary model (explicit provider/model) → error path, and
#      x-allternit-fallback header when the environment fails over
#   6. tiny monthly budget → 429 budget_exceeded
#   7. AWS key in the prompt → 400 content_policy_violation + dlp_blocked row
#
# Env overrides: API_BASE, GIZZI_BASE, ALLTERNIT_DB_PATH.
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:8013}"
GIZZI_BASE="${GIZZI_BASE:-http://127.0.0.1:4096}"
DB_PATH="${ALLTERNIT_DB_PATH:-${ALLTERNIT_DATA_DIR:-$HOME/Library/Application Support/allternit}/allternit.db}"

log()  { echo "[smoke-llm-gateway] $*"; }
pass() { echo "[smoke-llm-gateway] PASS: $*"; }
skip() { echo "[smoke-llm-gateway] SKIP: $*"; }
fail() { echo "[smoke-llm-gateway] FAIL: $*" >&2; exit 1; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"; }

# Print one field of a JSON document read from stdin.
#   json_field 'd["choices"][0]["message"]["content"]' <<< "$body"
json_field() {
    python3 -c "import sys, json; d = json.load(sys.stdin); print($1)"
}

# sql <query> — run a sqlite3 query against the gateway DB.
sql() {
    sqlite3 "$DB_PATH" "$1"
}

# http_request <method> <url> <body-or-empty> [extra curl args...]
# Sets HTTP_CODE, HTTP_BODY, HTTP_HEADERS (headers file path).
HTTP_CODE=""
HTTP_BODY=""
HTTP_HEADERS=""
http_request() {
    local method="$1" url="$2" body="$3"
    shift 3
    HTTP_HEADERS="$(mktemp -t smoke-llm-gateway-headers)"
    local body_file
    body_file="$(mktemp -t smoke-llm-gateway-body)"
    local args=(-sS -X "$method" -D "$HTTP_HEADERS" -o "$body_file" -w '%{http_code}')
    if [ -n "$body" ]; then
        args+=(-H 'content-type: application/json' -d "$body")
    fi
    HTTP_CODE="$(curl "${args[@]}" "$@" "$url")"
    HTTP_BODY="$(cat "$body_file")"
    rm -f "$body_file"
}

header_value() {
    # header_value x-allternit-fallback < "$HTTP_HEADERS"
    tr -d '\r' < "$HTTP_HEADERS" | awk -v name="$1" 'BEGIN{IGNORECASE=1} $0 ~ "^"name":" {sub(/^[^:]*:[ ]*/,""); print; exit}'
}

require_cmd curl
require_cmd python3
require_cmd sqlite3

log "API: $API_BASE   Gizzi: $GIZZI_BASE"
log "DB:  $DB_PATH"

# ── 0. Liveness ──────────────────────────────────────────────────────────────
curl -sf "$API_BASE/health" > /dev/null 2>&1 \
    || fail "allternit-api not reachable at $API_BASE — start it first (dev/scripts/start-api.sh)"
curl -sf "$GIZZI_BASE/v1/provider/" > /dev/null 2>&1 \
    || fail "Gizzi runtime not reachable at $GIZZI_BASE — start it first"
[ -f "$DB_PATH" ] || fail "gateway database not found at $DB_PATH (set ALLTERNIT_DB_PATH)"
pass "stack is up"

CONNECTED=$(curl -sf "$GIZZI_BASE/v1/provider/" | json_field '",".join(d.get("connected", []))')
[ -n "$CONNECTED" ] || fail "Gizzi reports no connected providers — connect one before smoking the gateway"
log "connected providers: $CONNECTED"
FIRST_PROVIDER="${CONNECTED%%,*}"

# ── 1. Create a virtual key ──────────────────────────────────────────────────
http_request POST "$API_BASE/api/v1/gateway/keys" '{"name":"smoke-llm-gateway"}'
[ "$HTTP_CODE" = "201" ] || fail "key creation returned $HTTP_CODE: $HTTP_BODY (needs Clerk auth or the local-dev bypass)"
KEY_ID="$(json_field 'd["id"]' <<< "$HTTP_BODY")"
GATEWAY_KEY="$(json_field 'd["key"]' <<< "$HTTP_BODY")"
pass "virtual key created: $KEY_ID"

AUTH=(-H "Authorization: Bearer $GATEWAY_KEY")

# ── 2. Non-streaming completion via a policy alias (B5 routing) ──────────────
http_request POST "$API_BASE/v1/chat/completions" \
    '{"model":"allternit-balanced","messages":[{"role":"user","content":"Reply with the single word: pong"}]}' \
    "${AUTH[@]}"
[ "$HTTP_CODE" = "200" ] || fail "non-stream completion returned $HTTP_CODE: $HTTP_BODY"
CONTENT="$(json_field 'd["choices"][0]["message"]["content"]' <<< "$HTTP_BODY")"
[ -n "$CONTENT" ] || fail "non-stream completion returned empty content"
pass "non-stream completion ok: ${CONTENT:0:40}"

# ── 3. Streaming completion ──────────────────────────────────────────────────
STREAM_OUT="$(curl -sN -X POST "$API_BASE/v1/chat/completions" \
    -H 'content-type: application/json' "${AUTH[@]}" \
    -d '{"model":"auto","messages":[{"role":"user","content":"Count from one to three."}],"stream":true,"stream_options":{"include_usage":true}}')"
grep -q 'chat.completion.chunk' <<< "$STREAM_OUT" || fail "stream emitted no completion chunks: ${STREAM_OUT:0:200}"
grep -q 'data: \[DONE\]' <<< "$STREAM_OUT" || fail "stream did not terminate with [DONE]"
pass "streaming completion ok"

# ── 4. Usage + routing-decision rows ─────────────────────────────────────────
sleep 1 # record_usage_event writes on a spawned task
OK_ROWS="$(sql "SELECT COUNT(*) FROM llm_usage_events WHERE virtual_key_id='$KEY_ID' AND status='ok';")"
[ "$OK_ROWS" -ge 2 ] || fail "expected >= 2 ok usage rows, found $OK_ROWS"
pass "usage rows recorded ($OK_ROWS ok)"

DECISION_ROWS="$(sql "SELECT COUNT(*) FROM llm_routing_decisions d JOIN llm_usage_events e ON e.id = d.usage_event_id WHERE e.virtual_key_id='$KEY_ID';")"
[ "$DECISION_ROWS" -ge 1 ] || fail "expected routing decisions linked to usage rows, found $DECISION_ROWS"
pass "routing decisions persisted and linked ($DECISION_ROWS)"

RECOMPUTED="$(sql "SELECT COUNT(*) FROM llm_usage_events WHERE virtual_key_id='$KEY_ID' AND recomputed_cost_microdollars IS NOT NULL;")"
if [ "$RECOMPUTED" -ge 1 ]; then
    pass "B4 cost recompute stored ($RECOMPUTED rows)"
else
    skip "no recomputed_cost_microdollars (models.dev cache missing or model unpriced — recompute tolerated)"
fi

# ── 5. Bogus primary model ───────────────────────────────────────────────────
# Explicit provider/model requests keep their primary but still carry the
# router-derived fallback chain. Gizzi only engages the chain for
# generation-time failures; a catalog-unknown id fails at model resolution
# (pre-chain), in which case the error path is what we verify.
http_request POST "$API_BASE/v1/chat/completions" \
    "{\"model\":\"$FIRST_PROVIDER/allternit-smoke-bogus-000\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}" \
    "${AUTH[@]}"
FALLBACK_HEADER="$(header_value x-allternit-fallback < "$HTTP_HEADERS")"
sleep 1
if [ "$HTTP_CODE" = "200" ] && [ -n "$FALLBACK_HEADER" ]; then
    pass "failover engaged: x-allternit-fallback: $FALLBACK_HEADER"
    FB_ROWS="$(sql "SELECT COUNT(*) FROM llm_usage_events WHERE virtual_key_id='$KEY_ID' AND fallback_from IS NOT NULL;")"
    [ "$FB_ROWS" -ge 1 ] || fail "fallback header set but no fallback_from recorded"
elif [ "$HTTP_CODE" != "200" ]; then
    ERR_TYPE="$(json_field 'd["error"]["type"]' <<< "$HTTP_BODY" 2>/dev/null || echo '')"
    [ -n "$ERR_TYPE" ] || fail "bogus model returned $HTTP_CODE with non-OpenAI error: ${HTTP_BODY:0:200}"
    ERR_ROWS="$(sql "SELECT COUNT(*) FROM llm_usage_events WHERE virtual_key_id='$KEY_ID' AND status='error';")"
    [ "$ERR_ROWS" -ge 1 ] || fail "bogus model errored but no 'error' usage row was recorded"
    skip "bogus id rejected at model resolution (Gizzi pre-chain); error path verified instead of failover ($ERR_TYPE)"
else
    fail "bogus primary returned 200 without a fallback header — the bogus model was unexpectedly served"
fi

# ── 6. Tiny budget → 429 ─────────────────────────────────────────────────────
# A 0-cent cap is the deterministic "tiny budget": the pre-check is
# `spent >= cap`, so the very next request must be rejected regardless of
# what the previous completions cost (or whether the model is free).
http_request PATCH "$API_BASE/api/v1/gateway/keys/$KEY_ID" '{"monthly_budget_cents":0}'
[ "$HTTP_CODE" = "200" ] || fail "budget PATCH returned $HTTP_CODE: $HTTP_BODY"

http_request POST "$API_BASE/v1/chat/completions" \
    '{"model":"auto","messages":[{"role":"user","content":"hello"}]}' \
    "${AUTH[@]}"
if [ "$HTTP_CODE" = "429" ]; then
    BUDGET_TYPE="$(json_field 'd["error"]["type"]' <<< "$HTTP_BODY")"
    [ "$BUDGET_TYPE" = "budget_exceeded" ] || fail "429 error type is $BUDGET_TYPE, expected budget_exceeded"
    pass "tiny budget enforced with 429 budget_exceeded"
else
    fail "expected 429 budget_exceeded with a 0-cent budget, got $HTTP_CODE: ${HTTP_BODY:0:200}"
fi

# Lift the cap again so the DLP check below reaches the middleware chain.
http_request PATCH "$API_BASE/api/v1/gateway/keys/$KEY_ID" '{"monthly_budget_cents":null}'
[ "$HTTP_CODE" = "200" ] || fail "budget reset PATCH returned $HTTP_CODE: $HTTP_BODY"

# ── 7. DLP block ─────────────────────────────────────────────────────────────
http_request POST "$API_BASE/v1/chat/completions" \
    '{"model":"auto","messages":[{"role":"user","content":"Store this AWS credential: AKIAIOSFODNN7EXAMPLE"}]}' \
    "${AUTH[@]}"
[ "$HTTP_CODE" = "400" ] || fail "AWS key prompt returned $HTTP_CODE, expected 400: ${HTTP_BODY:0:200}"
DLP_TYPE="$(json_field 'd["error"]["type"]' <<< "$HTTP_BODY")"
[ "$DLP_TYPE" = "content_policy_violation" ] || fail "DLP error type is $DLP_TYPE, expected content_policy_violation"
sleep 1
DLP_ROWS="$(sql "SELECT COUNT(*) FROM llm_usage_events WHERE virtual_key_id='$KEY_ID' AND status='dlp_blocked';")"
[ "$DLP_ROWS" -ge 1 ] || fail "DLP blocked the request but no dlp_blocked usage row exists"
pass "DLP blocked the AWS key with a dlp_blocked usage row"

# ── Done ─────────────────────────────────────────────────────────────────────
log "cleaning up smoke key"
http_request DELETE "$API_BASE/api/v1/gateway/keys/$KEY_ID" ""
[ "$HTTP_CODE" = "200" ] || log "note: key revoke returned $HTTP_CODE (harmless)"

pass "all smoke checks passed"
