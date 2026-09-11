#!/usr/bin/env bash
# Standalone install script for the `rails` CLI.
# Usage: ./install.sh [destination]
# Default destination: ~/.cargo/bin

set -euo pipefail

DEST="${1:-$HOME/.cargo/bin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building rails CLI..."
cd "$SCRIPT_DIR"
cargo build --release

TARGET_DIR="$(cargo metadata --format-version 1 | sed -n 's/.*"target_directory":"\([^"]*\)".*/\1/p')"
BINARY="$TARGET_DIR/release/rails"

echo "Installing rails to $DEST..."
mkdir -p "$DEST"
cp "$BINARY" "$DEST/rails"

echo "Installed: $(command -v rails || echo "$DEST/rails")"
echo "Run 'rails init' in any workspace to get started."
