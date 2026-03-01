#!/bin/bash
#
# Platform Orchestrator Wrapper
#
# This script integrates the platform orchestration service with the
# enterprise startup script. It can be called by the platform orchestrator
# or used standalone.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/.logs"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/platform-wrapper.log"
}

# Check if enterprise script exists
if [ ! -f "$PROJECT_ROOT/scripts/start-enterprise.sh" ]; then
    log "ERROR: Enterprise startup script not found"
    exit 1
fi

log "Platform wrapper starting..."

# Forward commands to the enterprise script
case "${1:-start}" in
    start)
        log "Starting platform via enterprise script"
        exec "$PROJECT_ROOT/scripts/start-enterprise.sh" start
        ;;
    stop)
        log "Stopping platform via enterprise script"
        exec "$PROJECT_ROOT/scripts/start-enterprise.sh" stop
        ;;
    restart)
        log "Restarting platform via enterprise script"
        exec "$PROJECT_ROOT/scripts/start-enterprise.sh" restart
        ;;
    status)
        exec "$PROJECT_ROOT/scripts/start-enterprise.sh" status
        ;;
    logs)
        exec "$PROJECT_ROOT/scripts/start-enterprise.sh" logs "${2:-all}"
        ;;
    *)
        log "Unknown command: $1"
        echo "Usage: $0 [start|stop|restart|status|logs]"
        exit 1
        ;;
esac
