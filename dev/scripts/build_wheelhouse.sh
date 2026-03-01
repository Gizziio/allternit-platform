#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3.12}"
REQS="scripts/requirements.txt"
WHEELHOUSE="third_party/wheels"
MANIFEST="${WHEELHOUSE}/MANIFEST.txt"

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

mkdir -p "$WHEELHOUSE"
rm -f "$WHEELHOUSE"/*.whl "$MANIFEST"

"$PYTHON_BIN" -m pip install --upgrade pip
"$PYTHON_BIN" -m pip download --only-binary=:all: -d "$WHEELHOUSE" -r "$REQS"

if command -v shasum >/dev/null 2>&1; then
  (cd "$WHEELHOUSE" && shasum -a 256 ./*.whl | sort -k2) > "$MANIFEST"
elif command -v sha256sum >/dev/null 2>&1; then
  (cd "$WHEELHOUSE" && sha256sum ./*.whl | sort -k2) > "$MANIFEST"
else
  echo "No SHA256 tool found (shasum/sha256sum)." >&2
  exit 1
fi
