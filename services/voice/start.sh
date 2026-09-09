#!/usr/bin/env bash
# Start the Rust voice sidecar (whisper.cpp STT) on PORT (default 8001).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export PORT="${PORT:-8001}"
exec cargo run -p voice-service
