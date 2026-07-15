#!/bin/bash
# Open Notebook Backend Bootstrap
# No Docker — native SurrealDB binary + Python virtual environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$HOME/.allternit/services/open-notebook"
BIN_DIR="$HOME/.allternit/bin"
SURREAL_VERSION="v2.0.0"

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$ARCH" in
  x86_64) ARCH="x86_64" ;;
  arm64|aarch64) ARCH="aarch64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

echo "[bootstrap] Platform: $OS / $ARCH"

# Ensure directories exist
mkdir -p "$DATA_DIR/surreal_data"
mkdir -p "$DATA_DIR/data"
mkdir -p "$BIN_DIR"

# ── SurrealDB ───────────────────────────────────────────────────────────────
# Prefer a system install (e.g. `brew install surrealdb/tap/surreal`) — only
# download a copy into ~/.allternit/bin if nothing is already on PATH.
SURREAL_BIN="$(command -v surreal || true)"

if [ -n "$SURREAL_BIN" ]; then
  echo "[bootstrap] Using system SurrealDB at $SURREAL_BIN"
elif [ -f "$BIN_DIR/surreal" ]; then
  echo "[bootstrap] SurrealDB already installed at $BIN_DIR/surreal"
else
  echo "[bootstrap] Downloading SurrealDB $SURREAL_VERSION..."
  SURREAL_URL="https://github.com/surrealdb/surrealdb/releases/download/$SURREAL_VERSION/surreal-$SURREAL_VERSION.$OS-$ARCH.gz"
  curl -L -o "$DATA_DIR/surreal.gz" "$SURREAL_URL"
  gunzip -f "$DATA_DIR/surreal.gz"
  mv "$DATA_DIR/surreal" "$BIN_DIR/surreal"
  chmod +x "$BIN_DIR/surreal"
  echo "[bootstrap] SurrealDB installed"
fi

# ── Vendor the real backend source ──────────────────────────────────────────
# The full FastAPI app (notebooks/sources/chat/search/podcast/connectors/etc.)
# lives in this repo checkout at ./src — copy it + its dependency manifest so
# the desktop app's start.sh can run it without needing the monorepo present.
echo "[bootstrap] Vendoring backend source..."
rm -rf "$DATA_DIR/src"
cp -R "$SCRIPT_DIR/src" "$DATA_DIR/src"
cp "$SCRIPT_DIR/pyproject.toml" "$DATA_DIR/pyproject.toml"

# ── Python Virtual Environment ──────────────────────────────────────────────
VENV_DIR="$DATA_DIR/venv"

if [ -d "$VENV_DIR" ]; then
  echo "[bootstrap] Python venv already exists"
else
  echo "[bootstrap] Creating Python virtual environment..."
  python3 -m venv "$VENV_DIR"
fi

echo "[bootstrap] Installing Python dependencies from pyproject.toml..."
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet "$DATA_DIR"

echo "[bootstrap] Done. Run ./start.sh to launch the service."
