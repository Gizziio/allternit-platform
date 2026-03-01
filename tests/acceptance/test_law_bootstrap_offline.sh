#!/usr/bin/env bash
set -euo pipefail

rm -rf .venv-law

bash scripts/law_setup.sh
PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi

"$PYTHON_BIN" scripts/validate_law.py
