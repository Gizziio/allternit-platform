#!/usr/bin/env bash
set -euo pipefail

FILE="services/kernel/src/main.rs"

if rg -n "path\.starts_with\(\"/v1/brain/\"\)|path\.starts_with\(\"/v1/config/\"\)|path\.starts_with\(\"/v1/sessions\"\)" "$FILE"; then
  echo "FAIL: auth bypass list detected in $FILE"
  exit 1
fi

echo "PASS: no auth bypass list found in $FILE"
