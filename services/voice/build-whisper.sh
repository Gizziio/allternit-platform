#!/usr/bin/env bash
# Build whisper.cpp's whisper-cli for the host, targeting the oldest
# supported macOS so we do not repeat the pyinstaller min-version bug.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$ROOT/dist"
mkdir -p "$DIST"

if [[ -x "$DIST/whisper-cli" ]]; then
  echo "whisper-cli already at $DIST/whisper-cli"
  exit 0
fi

if command -v whisper-cli >/dev/null 2>&1; then
  cp "$(command -v whisper-cli)" "$DIST/whisper-cli"
  chmod +x "$DIST/whisper-cli"
  echo "copied PATH whisper-cli → $DIST/whisper-cli"
  exit 0
fi

SRC="${WHISPER_CPP_SRC:-$ROOT/.whisper.cpp}"
if [[ ! -d "$SRC/.git" ]]; then
  git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git "$SRC"
fi

export MACOSX_DEPLOYMENT_TARGET="${MACOSX_DEPLOYMENT_TARGET:-13.0}"
cmake -S "$SRC" -B "$SRC/build" -DCMAKE_BUILD_TYPE=Release
cmake --build "$SRC/build" -j --target whisper-cli

BIN=""
for candidate in \
  "$SRC/build/bin/whisper-cli" \
  "$SRC/build/whisper-cli" \
  "$SRC/build/examples/cli/whisper-cli"
do
  if [[ -x "$candidate" ]]; then
    BIN="$candidate"
    break
  fi
done
[[ -n "$BIN" ]] || { echo "whisper-cli build produced no binary" >&2; exit 1; }

cp "$BIN" "$DIST/whisper-cli"
chmod +x "$DIST/whisper-cli"
echo "whisper-cli → $DIST/whisper-cli"
