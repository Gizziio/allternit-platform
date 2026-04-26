#!/usr/bin/env bash
set -euo pipefail

if [ ! -f spec/Contracts/Receipt.schema.json ]; then
  echo "FAIL: spec/Contracts/Receipt.schema.json missing"
  exit 1
fi

cargo test -p allternit-tools-gateway test_write_receipt_creates_file
