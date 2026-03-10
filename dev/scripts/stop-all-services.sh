#!/bin/bash
# =============================================================================
# A2RCHITECH PLATFORM - STOP ALL SERVICES SCRIPT
# =============================================================================
# Usage: ./stop-all-services.sh [options]
#
# Options:
#   --force   - Force kill with SIGKILL instead of SIGTERM
#   --all     - Kill all processes on known A2R ports (not just tracked ones)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Source service configuration
source "${SCRIPT_DIR}/service-config.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse options
FORCE=false
KILL_ALL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force) FORCE=true ;;
        --all) KILL_ALL=true ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
    shift
done

# Signal to use
SIGNAL="TERM"
[[ "$FORCE" == true ]] && SIGNAL="KILL"

log_info "Stopping A2R services..."

# Stop tracked services first
if [[ -d "${PROJECT_ROOT}/.pids" ]]; then
    for pid_file in "${PROJECT_ROOT}/.pids/"*.pid; do
        if [[ -f "$pid_file" ]]; then
            local service_name pid
            service_name=$(basename "$pid_file" .pid)
            pid=$(cat "$pid_file")
            
            if kill -0 "$pid" 2>/dev/null; then
                log_info "Stopping $service_name (PID: $pid)..."
                kill -${SIGNAL} "$pid" 2>/dev/null || true
                
                # Wait for process to die
                for i in {1..10}; do
                    if ! kill -0 "$pid" 2>/dev/null; then
                        break
                    fi
                    sleep 0.5
                done
                
                # Force kill if still running
                if kill -0 "$pid" 2>/dev/null; then
                    kill -9 "$pid" 2>/dev/null || true
                fi
                
                log_success "$service_name stopped"
            fi
            
            rm -f "$pid_file"
        fi
    done
fi

# Kill all known A2R ports if --all flag is set
if [[ "$KILL_ALL" == true ]]; then
    log_info "Checking all known A2R ports..."
    
    for port in $A2R_ALL_PORTS; do
        if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
            log_warn "Found process on port $port, killing..."
            lsof -ti :"$port" | xargs kill -${SIGNAL} 2>/dev/null || true
            sleep 0.5
            # Force kill if needed
            if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
                lsof -ti :"$port" | xargs kill -9 2>/dev/null || true
            fi
        fi
    done
fi

# Also check workspace service port (3021)
if lsof -Pi :3021 -sTCP:LISTEN -t >/dev/null 2>&1; then
    log_warn "Found process on port 3021 (workspace), killing..."
    lsof -ti :3021 | xargs kill -${SIGNAL} 2>/dev/null || true
    sleep 0.5
    if lsof -Pi :3021 -sTCP:LISTEN -t >/dev/null 2>&1; then
        lsof -ti :3021 | xargs kill -9 2>/dev/null || true
    fi
fi

log_success "All services stopped!"
