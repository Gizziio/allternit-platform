#!/usr/bin/env bash
# Render a marketing HTML template to PNG via headless Chrome.
# Usage: render-card.sh <template.html> <out.png> [WxH]   (default 1200x675)
set -euo pipefail

TEMPLATE="${1:?template html path required}"
OUT="${2:?output png path required}"
SIZE="${3:-1200x675}"
W="${SIZE%x*}"
H="${SIZE#*x}"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || CHROME="$(command -v google-chrome || command -v chromium)"

"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --default-background-color=00000000 \
  --screenshot="$OUT" --window-size="$W,$H" \
  "file://$(cd "$(dirname "$TEMPLATE")" && pwd)/$(basename "$TEMPLATE")"

echo "wrote $OUT ($SIZE)"
