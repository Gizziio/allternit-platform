#!/bin/bash
#
# Daily Memory Consolidation Script
# Runs overnight to organize and connect memories
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

LOG_FILE="/tmp/memory-consolidate-$(date +%Y-%m-%d).log"
START_TIME=$(date +%s)

echo "╔══════════════════════════════════════════════════════════╗" | tee -a "$LOG_FILE"
echo "║     Memory Consolidation - $(date)                      ║" | tee -a "$LOG_FILE"
echo "╚══════════════════════════════════════════════════════════╝" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check Ollama connection
log "Checking VPS Ollama connection..."
if ! curl -s --connect-timeout 10 "$OLLAMA_HOST:$OLLAMA_PORT/api/tags" > /dev/null; then
    log "❌ ERROR: Cannot connect to Ollama at $OLLAMA_HOST:$OLLAMA_PORT"
    exit 1
fi
log "✅ Connected to Ollama"

# Show available models
log "Available models:"
curl -s "$OLLAMA_HOST:$OLLAMA_PORT/api/tags" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for m in data.get('models', []):
    size_gb = m['size'] / 1024 / 1024 / 1024
    print(f\"  - {m['name']} ({size_gb:.1f} GB)\")
" | tee -a "$LOG_FILE"

# Start memory agent for consolidation
log "Starting consolidation process..."

# Use smallest model for speed (consolidation runs overnight, speed matters less)
export OLLAMA_CONSOLIDATE_MODEL="${OLLAMA_CONSOLIDATE_MODEL:-qwen3.5:0.8b}"

log "Using model: $OLLAMA_CONSOLIDATE_MODEL"

# Trigger consolidation via HTTP API (if running)
if curl -s --connect-timeout 5 http://localhost:3201/health > /dev/null 2>&1; then
    log "Memory agent is running, triggering consolidation..."
    
    RESULT=$(curl -s -X POST http://localhost:3201/api/consolidate)
    echo "$RESULT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(f\"  Memories Processed: {d.get('memories_processed', 0)}\")
    print(f\"  Connections Found: {d.get('connections_found', 0)}\")
    print(f\"  Insights Generated: {d.get('insights_generated', 0)}\")
    print(f\"  Duration: {d.get('duration_ms', 0) / 1000:.1f}s\")
except:
    print('Consolidation triggered')
" | tee -a "$LOG_FILE"
else
    log "Memory agent not running via HTTP. Running direct consolidation..."
    # Fallback: could run Python/Node script directly
    log "Note: Full consolidation requires memory agent HTTP API"
fi

# Generate daily summary
log "Generating daily summary..."

# Get memory stats
STATS=$(curl -s http://localhost:3201/stats 2>/dev/null || echo '{}')

if [ "$STATS" != "{}" ]; then
    echo "$STATS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
mem = d.get('memories', {})
print('')
print('Memory Statistics:')
print(f\"  Total Memories: {mem.get('total', 0)}\")
print(f\"  Raw: {mem.get('raw', 0)}\")
print(f\"  Processed: {mem.get('processed', 0)}\")
print(f\"  Consolidated: {mem.get('consolidated', 0)}\")
print(f\"  Insights: {d.get('insights', 0)}\")
print(f\"  Connections: {d.get('connections', 0)}\")
" | tee -a "$LOG_FILE"
fi

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log ""
log "╔══════════════════════════════════════════════════════════╗"
log "║     Consolidation Complete                               ║"
log "╚══════════════════════════════════════════════════════════╝"
log "Duration: $((DURATION / 60))m $((DURATION % 60))s"
log "Log file: $LOG_FILE"
log ""

# Cleanup old logs (keep last 7 days)
find /tmp -name "memory-consolidate-*.log" -mtime +7 -delete 2>/dev/null || true

echo "✅ Consolidation finished successfully"
