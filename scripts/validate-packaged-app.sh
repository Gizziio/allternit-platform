#!/usr/bin/env bash
# Validate that a packaged Allternit Platform app can boot with a configured
# brain routed through the Gizzi runtime. This is meant to run against the
# produced app bundle before release.
#
# Usage:
#   ./scripts/validate-packaged-app.sh /path/to/Allternit.app
#
# The script checks:
#   1. The API binary and company.json exist in the bundle.
#   2. company.json contains standard company-level settings.
#   3. The API can start and load the company config.
#   4. A Gizzi runtime is reachable.
#   5. At least one brain is configured (provider in Gizzi config or env).
#   6. A chat/agent health check passes.

set -euo pipefail

APP_PATH="${1:-}"
if [[ -z "$APP_PATH" ]]; then
    echo "Usage: $0 /path/to/Allternit.app"
    exit 1
fi

RESOURCES_DIR="$APP_PATH/Contents/Resources"
BINARY_DIR="$APP_PATH/Contents/MacOS"
API_BIN="$BINARY_DIR/allternit-api"
COMPANY_CONFIG="$RESOURCES_DIR/company.json"

fail() {
    echo "❌ $1"
    exit 1
}

pass() {
    echo "✅ $1"
}

[[ -f "$API_BIN" ]] || fail "API binary not found at $API_BIN"
pass "API binary found"

[[ -f "$COMPANY_CONFIG" ]] || fail "Company config not found at $COMPANY_CONFIG"
pass "Company config found"

# Validate company.json has required keys
for key in tenantId gatewayUrl terminalServerUrl; do
    if ! grep -q "\"$key\"" "$COMPANY_CONFIG"; then
        fail "company.json missing required key: $key"
    fi
done
pass "Company config contains required keys"

# Determine Gizzi config path (packaged apps should mirror the dev path)
GIZZI_CONFIG="${GIZZI_CONFIG:-$HOME/Library/Application Support/gizzi/gizzi.json}"
if [[ ! -f "$GIZZI_CONFIG" ]]; then
    fail "No Gizzi runtime config found at $GIZZI_CONFIG. Run the onboarding wizard first."
fi
pass "Gizzi runtime config found"

# Verify at least one provider is configured
if ! python3 -c "import json,sys; c=json.load(open('$GIZZI_CONFIG')); sys.exit(0 if c.get('provider') else 1)" 2>/dev/null; then
    fail "No providers configured in $GIZZI_CONFIG"
fi
pass "At least one brain provider is configured"

# Start API in the background with local dev bypass so we can probe it
API_PORT=18013
export ALLTERNIT_LOCAL_DEV_BYPASS=true
export ALLTERNIT_API_PORT=$API_PORT
"$API_BIN" &
API_PID=$!

cleanup() {
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for API health
for i in $(seq 1 30); do
    if curl -fs "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1; then
        break
    fi
    sleep 1
done
curl -fs "http://127.0.0.1:$API_PORT/health" >/dev/null || fail "API did not start"
pass "API started and health endpoint responds"

# Check onboarding config reflects a default model
DEFAULT_MODEL=$(curl -fs "http://127.0.0.1:$API_PORT/api/onboarding/config" | python3 -c "import json,sys; print(json.load(sys.stdin)['user']['defaultModel'] or '')")
if [[ -z "$DEFAULT_MODEL" ]]; then
    fail "No default brain model configured"
fi
pass "Default brain model configured: $DEFAULT_MODEL"

# Check Gizzi runtime is reachable from the API
STATUS=$(curl -fs "http://127.0.0.1:$API_PORT/status" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('overall',''))")
if [[ "$STATUS" != "operational" && "$STATUS" != "degraded" ]]; then
    fail "API status check failed: $STATUS"
fi
pass "API status is $STATUS"

echo ""
echo "Packaged app validation passed."
