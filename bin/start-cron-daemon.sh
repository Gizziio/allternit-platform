#!/bin/bash
# Start the Allternit headless cron daemon.
# The daemon executes scheduled agent jobs independently of the terminal server.
# The allternit-api delegates routine/loop execution to this daemon via
# ALLTERNIT_CRON_DAEMON_URL (default http://127.0.0.1:3031).

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
DAEMON_PORT="${ALLTERNIT_CRON_DAEMON_PORT:-3031}"
LOG_DIR="$PROJECT_ROOT/.logs"

mkdir -p "$LOG_DIR"

kill_port() {
    lsof -ti :"$1" | xargs kill -9 2>/dev/null || true
}

kill_port "$DAEMON_PORT"
sleep 1

(
    cd "$PROJECT_ROOT/cmd/gizzi-code"
    bun run ./src/daemon/main.ts start
) > "$LOG_DIR/cron-daemon.log" 2>&1 &

pid=$!
echo "$pid" > "$LOG_DIR/cron-daemon.pid"

for i in $(seq 1 30); do
    if curl -s "http://127.0.0.1:${DAEMON_PORT}/health" > /dev/null 2>&1; then
        echo "Cron daemon ready at http://127.0.0.1:${DAEMON_PORT}"
        exit 0
    fi
    sleep 1
done

echo "Cron daemon failed to start. Logs: $LOG_DIR/cron-daemon.log"
exit 1
