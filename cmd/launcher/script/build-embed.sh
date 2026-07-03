#!/usr/bin/env bash
set -euo pipefail

# Build embed artifacts for the single-binary Allternit Platform launcher.
#
# Produces:
#   cmd/launcher/embed/allternit-api  — compiled Rust API binary
#   cmd/launcher/embed/ui             — static UI assets

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCHER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$LAUNCHER_DIR/../.." && pwd)"

EMBED_DIR="$LAUNCHER_DIR/embed"
API_SOURCE="$ROOT_DIR/target/release/allternit-api"
UI_SOURCE="$ROOT_DIR/surfaces/ai.allternit.com/dist"

mkdir -p "$EMBED_DIR"

echo "[launcher-embed] Building allternit-api (release)..."
cd "$ROOT_DIR"
cargo build --release -p allternit-api

echo "[launcher-embed] Copying API binary..."
cp "$API_SOURCE" "$EMBED_DIR/allternit-api"
chmod +x "$EMBED_DIR/allternit-api"

echo "[launcher-embed] Building UI assets..."
cd "$ROOT_DIR/surfaces/ai.allternit.com"
if ! command -v pnpm >/dev/null 2>&1; then
  echo "[launcher-embed] ERROR: pnpm is required to build the UI" >&2
  exit 1
fi
pnpm install
pnpm build

echo "[launcher-embed] Copying UI assets..."
rm -rf "$EMBED_DIR/ui"
cp -R "$UI_SOURCE" "$EMBED_DIR/ui"

echo "[launcher-embed] Done. Artifacts ready in $EMBED_DIR"
echo "[launcher-embed] Build the launcher with: cargo build --release -p allternit-platform-launcher"
