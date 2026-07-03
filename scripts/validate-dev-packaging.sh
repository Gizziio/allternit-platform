#!/usr/bin/env bash
# Simulate a packaged app layout in a temp directory and validate that the
# Allternit Platform can boot with a brain configured via the Gizzi runtime.
#
# This catches packaging regressions without requiring a full code-sign build.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BIN="$REPO_ROOT/target/debug/allternit-api"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ ! -f "$API_BIN" ]]; then
    echo "API binary not found. Run: cargo build --bin allternit-api"
    exit 1
fi

mkdir -p "$TMP_DIR/Contents/MacOS" "$TMP_DIR/Contents/Resources"
cp "$API_BIN" "$TMP_DIR/Contents/MacOS/allternit-api"

# Generate a minimal company.json that bakes in company standards.
cat > "$TMP_DIR/Contents/Resources/company.json" <<'EOF'
{
  "tenantId": "alpackaged",
  "gatewayUrl": "http://localhost:8013",
  "terminalServerUrl": "http://127.0.0.1:4096",
  "railsUrl": "http://127.0.0.1:3021",
  "railsWorkspaceId": "default"
}
EOF

"$REPO_ROOT/scripts/validate-packaged-app.sh" "$TMP_DIR"
