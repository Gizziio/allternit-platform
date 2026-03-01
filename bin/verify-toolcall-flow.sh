#!/usr/bin/env bash
set -euo pipefail

KERNEL_URL="${KERNEL_URL:-http://localhost:3000}"

echo "[verify] kernel health..."
curl -s "${KERNEL_URL}/v1/health" || { echo "Kernel not reachable at ${KERNEL_URL}"; exit 1; }
echo

echo "[verify] governance evaluate..."
curl -s -X POST "${KERNEL_URL}/v1/governance/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "verify-session",
    "tool": "desktop_control",
    "action": { "type": "click", "x": 120, "y": 240 },
    "security_level": "standard"
  }'
echo

echo "[verify] governance receipts..."
curl -s -X POST "${KERNEL_URL}/v1/governance/receipts" \
  -H "Content-Type: application/json" \
  -d '{
    "receipt_id": "rcpt_verify_001",
    "run_id": "verify-session",
    "tool_id": "desktop_control",
    "status": "ok"
  }'
echo

echo "[verify] done."
