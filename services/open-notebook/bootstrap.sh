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
SURREAL_BIN="$BIN_DIR/surreal"

if [ -f "$SURREAL_BIN" ]; then
  echo "[bootstrap] SurrealDB already installed at $SURREAL_BIN"
else
  echo "[bootstrap] Downloading SurrealDB $SURREAL_VERSION..."
  SURREAL_URL="https://github.com/surrealdb/surrealdb/releases/download/$SURREAL_VERSION/surreal-$SURREAL_VERSION.$OS-$ARCH.gz"
  curl -L -o "$DATA_DIR/surreal.gz" "$SURREAL_URL"
  gunzip -f "$DATA_DIR/surreal.gz"
  mv "$DATA_DIR/surreal" "$SURREAL_BIN"
  chmod +x "$SURREAL_BIN"
  echo "[bootstrap] SurrealDB installed"
fi

# ── Python Virtual Environment ──────────────────────────────────────────────
VENV_DIR="$DATA_DIR/venv"

if [ -d "$VENV_DIR" ]; then
  echo "[bootstrap] Python venv already exists"
else
  echo "[bootstrap] Creating Python virtual environment..."
  python3 -m venv "$VENV_DIR"
fi

# ── Open Notebook Backend ───────────────────────────────────────────────────
# This assumes the Open Notebook backend source is vendored at ./src/
# or available as a package. For now we install core deps.

echo "[bootstrap] Installing Python dependencies..."
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet \
  fastapi uvicorn \
  surrealdb \
  httpx \
  python-multipart

echo "[bootstrap] Done. Run ./start.sh to launch the service."
