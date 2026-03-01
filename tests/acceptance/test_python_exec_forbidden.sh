#!/usr/bin/env bash
set -euo pipefail

FILE="services/python-gateway/main.py"

if rg -n "exec\(" "$FILE"; then
  echo "FAIL: exec() detected in $FILE"
  exit 1
fi

echo "PASS: no exec() usage in $FILE"
