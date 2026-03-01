#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OPERATOR_DIR="$SCRIPT_DIR/../4-services/a2r-operator"
VENV_DIR="$OPERATOR_DIR/.venv-a2r-usage"
WHEELHOUSE_DIR="$SCRIPT_DIR/../wheelhouse"

mkdir -p "$OPERATOR_DIR"

if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

pip install --upgrade pip setuptools

if [ -d "$WHEELHOUSE_DIR" ] && compgen -G "$WHEELHOUSE_DIR/quickjs-*.whl" >/dev/null; then
  pip install --no-index --find-links="$WHEELHOUSE_DIR" quickjs
else
  pip install quickjs
fi

deactivate

echo "✅ QuickJS environment ready at $VENV_DIR"
