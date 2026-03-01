#!/bin/bash
#
# Run the Agent Service backend
#

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
export PORT="${AGENT_SERVICE_PORT:-3005}"
export DATABASE_URL="${AGENT_SERVICE_DB:-sqlite:$PROJECT_ROOT/data/agent_service.db}"
export RUST_LOG="${RUST_LOG:-info}"

echo "================================"
echo "Starting Agent Service"
echo "================================"
echo "Port: $PORT"
echo "Database: $DATABASE_URL"
echo "Log Level: $RUST_LOG"
echo "================================"

# Create data directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/data"

# Run the service
cd "$PROJECT_ROOT/1-kernel/rust/services/agent-service"
cargo run --release
