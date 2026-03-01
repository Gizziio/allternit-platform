#!/usr/bin/env bash
set -euo pipefail

VENV_DIR=".venv-law"
REQS="scripts/requirements.txt"
WHEELHOUSE="third_party/wheels"
PYTHON_BIN="${PYTHON_BIN:-python3.12}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "python3.12 required (set PYTHON_BIN to override)" >&2
  exit 1
fi

PY_MAJOR_MINOR="$("$PYTHON_BIN" - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
)"
if [ "$PY_MAJOR_MINOR" != "3.12" ]; then
  echo "python3.12 required, found $PY_MAJOR_MINOR" >&2
  exit 1
fi

if [ ! -d "$WHEELHOUSE" ]; then
  echo "wheelhouse missing: $WHEELHOUSE" >&2
  exit 1
fi
if ! ls "$WHEELHOUSE"/*.whl >/dev/null 2>&1; then
  echo "wheelhouse empty: $WHEELHOUSE" >&2
  exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

python -m pip install --no-index --find-links "$WHEELHOUSE" -r "$REQS"

python scripts/validate_law.py
bash tests/acceptance/test_boot_anchors.sh
