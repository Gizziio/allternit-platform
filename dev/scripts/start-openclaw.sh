#!/bin/bash
#
# Start OpenClaw Gateway for Shell UI Integration
#
# This script starts OpenClaw's gateway on port 18789 so that
# the Control UI is accessible via iframe in Shell UI.
#
# Usage: ./scripts/start-openclaw.sh [start|stop|status|logs]

set -e

OPENCLAW_PORT=18789
PIDFILE=".logs/openclaw.pid"
LOGFILE=".logs/openclaw.log"

cd "$(dirname "$0")/.."

# Ensure logs directory exists
mkdir -p .logs

case "${1:-start}" in
  start)
    echo "🚀 Starting OpenClaw Gateway on port $OPENCLAW_PORT..."
    
    # Kill any existing process on the port
    lsof -ti :$OPENCLAW_PORT | xargs kill -9 2>/dev/null || true
    sleep 1
    
    # Check if openclaw is installed
    if ! command -v openclaw &> /dev/null; then
      echo "❌ OpenClaw is not installed"
      echo "   Install with: npm install -g openclaw@latest"
      exit 1
    fi
    
    # Generate a secure token
    OPENCLAW_TOKEN=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | head -c 64)
    
    # Save token for Shell UI
    echo "OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_TOKEN}" > ".openclaw.env"
    echo "OPENCLAW_PORT=${OPENCLAW_PORT}" >> ".openclaw.env"
    
    # Configure OpenClaw
    OPENCLAW_CONFIG_DIR="${HOME}/.openclaw"
    mkdir -p "$OPENCLAW_CONFIG_DIR"
    
    # Set required config values using openclaw CLI
    export OPENCLAW_GATEWAY_TOKEN="${OPENCLAW_TOKEN}"
    openclaw config set gateway.port ${OPENCLAW_PORT}
    openclaw config set gateway.mode local
    openclaw config set gateway.auth.token "${OPENCLAW_TOKEN}"
    openclaw config set gateway.controlUi.allowInsecureAuth true
    
    # Start OpenClaw gateway
    echo "   Command: openclaw gateway --port $OPENCLAW_PORT"
    nohup openclaw gateway --port "$OPENCLAW_PORT" > "$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    
    # Wait for health check
    echo "   Waiting for health check..."
    for i in {1..30}; do
      if curl -s "http://localhost:$OPENCLAW_PORT/health" > /dev/null 2>&1; then
        echo "✅ OpenClaw Gateway is running!"
        echo ""
        echo "   Control UI: http://localhost:$OPENCLAW_PORT"
        echo "   Log file:   $LOGFILE"
        echo "   PID:        $(cat $PIDFILE)"
        echo "   Token:      ${OPENCLAW_TOKEN:0:16}..."
        echo ""
        echo "   In Shell UI: Navigate to 'OpenClaw' tab to see Control UI"
        exit 0
      fi
      sleep 1
    done
    
    echo "❌ OpenClaw failed to start within 30 seconds"
    echo "   Check logs: $LOGFILE"
    cat "$LOGFILE" | tail -20
    rm -f "$PIDFILE"
    exit 1
    ;;
    
  stop)
    if [ -f "$PIDFILE" ]; then
      PID=$(cat "$PIDFILE")
      if kill -0 "$PID" 2>/dev/null; then
        echo "🛑 Stopping OpenClaw Gateway (PID: $PID)..."
        kill "$PID" 2>/dev/null || true
        rm -f "$PIDFILE"
        echo "✅ OpenClaw stopped"
      else
        echo "⚠️  OpenClaw is not running"
        rm -f "$PIDFILE"
      fi
    else
      echo "⚠️  OpenClaw is not running (no PID file)"
    fi
    ;;
    
  status)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "✅ OpenClaw is running (PID: $(cat $PIDFILE))"
      echo "   Port: $OPENCLAW_PORT"
      echo "   URL:  http://localhost:$OPENCLAW_PORT"
      
      # Check health
      if curl -s "http://localhost:$OPENCLAW_PORT/health" > /dev/null 2>&1; then
        echo "   Health: OK"
      else
        echo "   Health: FAILING"
      fi
    else
      echo "❌ OpenClaw is not running"
      rm -f "$PIDFILE" 2>/dev/null || true
    fi
    ;;
    
  logs)
    if [ -f "$LOGFILE" ]; then
      echo "📋 OpenClaw logs (last 50 lines):"
      echo "---"
      tail -n 50 "$LOGFILE"
    else
      echo "No log file found at $LOGFILE"
    fi
    ;;
    
  *)
    echo "Usage: $0 [start|stop|status|logs]"
    echo ""
    echo "Commands:"
    echo "  start  - Start OpenClaw Gateway (default)"
    echo "  stop   - Stop OpenClaw Gateway"
    echo "  status - Check if OpenClaw is running"
    echo "  logs   - Show OpenClaw logs"
    echo ""
    echo "This starts OpenClaw on port $OPENCLAW_PORT so it can be accessed"
    echo "via iframe in Shell UI at the 'OpenClaw' tab."
    exit 1
    ;;
esac
