#!/bin/bash
# Voice Service Startup Script

cd "$(dirname "$0")"

# Activate virtual environment
source .venv/bin/activate

# Set environment
export PORT="${PORT:-8001}"
export AUDIO_OUTPUT_DIR="/tmp/voice-service"
export PRELOAD_MODEL="${PRELOAD_MODEL:-false}"

# Create output directory
mkdir -p "$AUDIO_OUTPUT_DIR"

echo "🎙️  Starting Voice Service on port $PORT..."

cd api
exec python3 -m uvicorn main:app --host 0.0.0.0 --port "$PORT"
