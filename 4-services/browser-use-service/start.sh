#!/bin/bash
# Start Browser-Use Service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Browser-Use Service ==="
echo "Starting browser automation backend..."

# Check if browser-use is installed
if ! python3 -c "import browser_use" 2>/dev/null; then
    echo "Installing browser-use..."
    pip3 install browser-use playwright
    playwright install chromium
fi

# Install requirements
pip3 install -r requirements.txt

# Start service
PORT=${PORT:-8080}
HOST=${HOST:-0.0.0.0}

echo "Starting on $HOST:$PORT"
python3 main.py
