#!/bin/bash

# =============================================================================
# A2RCHITECH PLATFORM - Complete Service Launcher (FIXED)
# =============================================================================
# Starts ALL required backend services:
# - Gateway (port 8013) - API Gateway (REQUIRED for UI)
# - Terminal Server (port 4096) - AI Model API
# - Gizzi Code Server (port 3210) - Code execution service
# - API Service (port 3000) - Core Rust API
# - Rails Service (port 3011) - Agent System
# - Voice Service (port 8001) - TTS Service (optional)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
LOG_DIR="$PROJECT_ROOT/.logs"

# Port Configuration
GATEWAY_PORT=8013
TERMINAL_SERVER_PORT=4096
GIZZI_CODE_PORT=3210
API_PORT=3000
RAILS_PORT=3011
VOICE_PORT=8001
MEMORY_PORT=3201
OPERATOR_PORT=3010
SHELL_UI_PORT=5177

# Directories
GATEWAY_DIR="$PROJECT_ROOT/4-services/gateway"
TERMINAL_DIR="$PROJECT_ROOT/cmd/gizzi-code"
GIZZI_DIR="$PROJECT_ROOT/cmd/gizzi-code"
API_DIR="$PROJECT_ROOT/7-apps/api"
RAILS_DIR="$PROJECT_ROOT/0-substrate/a2r-agent-system-rails"
VOICE_DIR="$PROJECT_ROOT/4-services/ml-ai-services/voice-service"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

mkdir -p "$LOG_DIR"

print_header() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}          ${GREEN}A2RCHITECH PLATFORM${NC}                           ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}         ${BLUE}Complete Service Launcher${NC}                      ${CYAN}║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }

# ============================================================================
# Helper Functions
# ============================================================================

wait_for_service() {
    local port=$1
    local name=$2
    local timeout=${3:-30}
    local path=${4:-/health}
    
    for i in $(seq 1 $timeout); do
        if curl -s "http://127.0.0.1:${port}${path}" > /dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    return 1
}

kill_port() {
    local port=$1
    lsof -ti :$port | xargs kill -9 2>/dev/null || true
}

# ============================================================================
# Gateway Service (Port 8013) - REQUIRED
# ============================================================================

start_gateway() {
    print_status "Starting Gateway (API Router) on port $GATEWAY_PORT..."
    
    # Kill any existing process on port 8013
    kill_port $GATEWAY_PORT
    sleep 1
    
    # Check Python dependencies
    if ! python3 -c "import fastapi, uvicorn, httpx" 2>/dev/null; then
        print_warning "Installing Python dependencies for Gateway..."
        pip install -q fastapi uvicorn httpx pydantic 2>/dev/null || pip3 install -q fastapi uvicorn httpx pydantic 2>/dev/null || true
    fi
    
    # Start the Python gateway
    (
        cd "$PROJECT_ROOT"
        # Use the main gateway from 4-services/gateway/src/main.py
        if [ -f "$PROJECT_ROOT/4-services/gateway/src/main.py" ]; then
            PORT=$GATEWAY_PORT API_URL=http://127.0.0.1:$API_PORT RAILS_URL=http://127.0.0.1:$RAILS_PORT TERMINAL_URL=http://127.0.0.1:$TERMINAL_SERVER_PORT \
                python3 "$PROJECT_ROOT/4-services/gateway/src/main.py" > "$LOG_DIR/gateway.log" 2>&1
        else
            print_error "Gateway main.py not found at $PROJECT_ROOT/4-services/gateway/src/main.py"
            return 1
        fi
    ) &
    
    local pid=$!
    echo $pid > "$LOG_DIR/gateway.pid"
    
    # Wait for service to be ready
    print_status "Waiting for Gateway to start..."
    if wait_for_service $GATEWAY_PORT "Gateway" 30 "/health"; then
        print_success "Gateway started on http://127.0.0.1:$GATEWAY_PORT"
        return 0
    else
        print_error "Gateway failed to start within 30s"
        print_error "Check logs: $LOG_DIR/gateway.log"
        return 1
    fi
}

stop_gateway() {
    print_status "Stopping Gateway..."
    if [ -f "$LOG_DIR/gateway.pid" ]; then
        local pid=$(cat "$LOG_DIR/gateway.pid")
        kill -9 "$pid" 2>/dev/null || true
        rm -f "$LOG_DIR/gateway.pid"
    fi
    kill_port $GATEWAY_PORT
}

# ============================================================================
# Gizzi Code Server (Port 3210) - REQUIRED for A2R Platform
# ============================================================================

start_gizzi_code() {
    print_status "Starting Gizzi Code Server on port $GIZZI_CODE_PORT..."
    
    if [ ! -d "$GIZZI_DIR" ]; then
        print_error "Gizzi Code directory not found at $GIZZI_DIR"
        return 1
    fi
    
    # Check if bun is installed
    if ! command -v bun &> /dev/null; then
        print_error "bun is not installed. Install with: curl -fsSL https://bun.sh/install | bash"
        return 1
    fi
    
    # Check if node_modules exists
    if [ ! -d "$GIZZI_DIR/node_modules" ]; then
        print_warning "Installing Gizzi Code dependencies..."
        (cd "$GIZZI_DIR" && bun install)
    fi
    
    # Kill any existing process on port 3210
    kill_port $GIZZI_CODE_PORT
    sleep 1
    
    # Start the Gizzi Code server
    (
        cd "$GIZZI_DIR"
        bun run src/cli/main.ts serve --port $GIZZI_CODE_PORT > "$LOG_DIR/gizzi-code.log" 2>&1
    ) &
    
    local pid=$!
    echo $pid > "$LOG_DIR/gizzi-code.pid"
    
    # Wait for service to be ready
    print_status "Waiting for Gizzi Code Server to start..."
    if wait_for_service $GIZZI_CODE_PORT "Gizzi Code" 30 "/health"; then
        print_success "Gizzi Code Server started on http://127.0.0.1:$GIZZI_CODE_PORT"
        return 0
    else
        # Try without health check endpoint
        sleep 3
        if lsof -ti :$GIZZI_CODE_PORT > /dev/null 2>&1; then
            print_success "Gizzi Code Server started on http://127.0.0.1:$GIZZI_CODE_PORT"
            return 0
        fi
        print_error "Gizzi Code Server failed to start within 30s"
        print_error "Check logs: $LOG_DIR/gizzi-code.log"
        return 1
    fi
}

stop_gizzi_code() {
    print_status "Stopping Gizzi Code Server..."
    if [ -f "$LOG_DIR/gizzi-code.pid" ]; then
        local pid=$(cat "$LOG_DIR/gizzi-code.pid")
        kill -9 "$pid" 2>/dev/null || true
        rm -f "$LOG_DIR/gizzi-code.pid"
    fi
    kill_port $GIZZI_CODE_PORT
}

# ============================================================================
# Terminal Server (Port 4096)
# ============================================================================

start_terminal_server() {
    print_status "Starting Terminal Server (AI Model API) on port $TERMINAL_SERVER_PORT..."
    
    if [ ! -d "$TERMINAL_DIR" ]; then
        print_error "Terminal directory not found at $TERMINAL_DIR"
        return 1
    fi
    
    # Check if bun is installed
    if ! command -v bun &> /dev/null; then
        print_error "bun is not installed. Install with: curl -fsSL https://bun.sh/install | bash"
        return 1
    fi
    
    # Check if node_modules exists
    if [ ! -d "$TERMINAL_DIR/node_modules" ]; then
        print_warning "Installing Terminal Server dependencies..."
        (cd "$TERMINAL_DIR" && bun install)
    fi
    
    # Kill any existing process on port 4096
    kill_port $TERMINAL_SERVER_PORT
    sleep 1
    
    # Start the terminal server
    (
        cd "$TERMINAL_DIR"
        bun run start-server.ts > "$LOG_DIR/terminal-server.log" 2>&1
    ) &
    
    local pid=$!
    echo $pid > "$LOG_DIR/terminal-server.pid"
    
    # Wait for service to be ready
    print_status "Waiting for Terminal Server to start..."
    if wait_for_service $TERMINAL_SERVER_PORT "Terminal Server" 30 "/doc"; then
        print_success "Terminal Server started on http://127.0.0.1:$TERMINAL_SERVER_PORT"
        return 0
    else
        print_error "Terminal Server failed to start within 30s"
        print_error "Check logs: $LOG_DIR/terminal-server.log"
        return 1
    fi
}

stop_terminal_server() {
    print_status "Stopping Terminal Server..."
    if [ -f "$LOG_DIR/terminal-server.pid" ]; then
        local pid=$(cat "$LOG_DIR/terminal-server.pid")
        kill -9 "$pid" 2>/dev/null || true
        rm -f "$LOG_DIR/terminal-server.pid"
    fi
    kill_port $TERMINAL_SERVER_PORT
}

# ============================================================================
# API Service (Port 3000)
# ============================================================================

start_api_service() {
    print_status "Starting API Service (Rust) on port $API_PORT..."
    
    if [ ! -d "$API_DIR" ]; then
        print_warning "API directory not found at $API_DIR, skipping..."
        return 0
    fi
    
    # Kill any existing process on port 3000
    kill_port $API_PORT
    sleep 1
    
    # Start the Rust API service
    (
        cd "$API_DIR"
        cargo run --release > "$LOG_DIR/api-service.log" 2>&1
    ) &
    
    local pid=$!
    echo $pid > "$LOG_DIR/api-service.pid"
    
    # Wait for service to be ready (compilation may take time)
    print_status "Waiting for API Service to compile and start..."
    if wait_for_service $API_PORT "API Service" 60 "/health"; then
        print_success "API Service started on http://127.0.0.1:$API_PORT"
        return 0
    else
        print_warning "API Service still starting in background (check logs: $LOG_DIR/api-service.log)"
        return 0
    fi
}

stop_api_service() {
    print_status "Stopping API Service..."
    if [ -f "$LOG_DIR/api-service.pid" ]; then
        local pid=$(cat "$LOG_DIR/api-service.pid")
        kill -9 "$pid" 2>/dev/null || true
        rm -f "$LOG_DIR/api-service.pid"
    fi
    kill_port $API_PORT
}

# ============================================================================
# Rails Service (Port 3011)
# ============================================================================

start_rails_service() {
    print_status "Starting Rails Service (Agent System) on port $RAILS_PORT..."
    
    if [ ! -d "$RAILS_DIR" ]; then
        print_warning "Rails directory not found at $RAILS_DIR, skipping..."
        return 0
    fi
    
    # Kill any existing process on port 3011
    kill_port $RAILS_PORT
    sleep 1
    
    # Start the Rails service
    (
        cd "$RAILS_DIR"
        cargo run --bin a2r-rails-service --release > "$LOG_DIR/rails-service.log" 2>&1
    ) &
    
    local pid=$!
    echo $pid > "$LOG_DIR/rails-service.pid"
    
    # Wait for service to be ready
    sleep 3
    if wait_for_service $RAILS_PORT "Rails Service" 15 "/health"; then
        print_success "Rails Service started on http://127.0.0.1:$RAILS_PORT"
    else
        print_warning "Rails Service starting in background..."
    fi
    return 0
}

stop_rails_service() {
    print_status "Stopping Rails Service..."
    if [ -f "$LOG_DIR/rails-service.pid" ]; then
        local pid=$(cat "$LOG_DIR/rails-service.pid")
        kill -9 "$pid" 2>/dev/null || true
        rm -f "$LOG_DIR/rails-service.pid"
    fi
    kill_port $RAILS_PORT
}

# ============================================================================
# Voice Service (Port 8001) - Optional
# ============================================================================

start_voice_service() {
    print_status "Starting Voice Service (TTS) on port $VOICE_PORT..."
    
    if [ ! -d "$VOICE_DIR" ]; then
        print_warning "Voice directory not found at $VOICE_DIR, skipping..."
        return 0
    fi
    
    # Check for Python virtual environment
    if [ ! -d "$VOICE_DIR/.venv" ]; then
        print_warning "Voice service venv not found. Creating..."
        python3 -m venv "$VOICE_DIR/.venv" 2>/dev/null || python3.11 -m venv "$VOICE_DIR/.venv" 2>/dev/null || python3.12 -m venv "$VOICE_DIR/.venv"
        (
            cd "$VOICE_DIR"
            source ".venv/bin/activate"
            pip install --upgrade pip
            pip install fastapi uvicorn pydantic torch torchaudio 2>/dev/null || true
        )
    fi
    
    # Kill any existing process on port 8001
    kill_port $VOICE_PORT
    sleep 1
    
    # Start the voice service
    (
        cd "$VOICE_DIR"
        source ".venv/bin/activate"
        nohup python3 api/main.py > "$LOG_DIR/voice-service.log" 2>&1 &
    )
    
    local pid=$!
    echo $pid > "$LOG_DIR/voice-service.pid"
    
    sleep 2
    if wait_for_service $VOICE_PORT "Voice Service" 10 "/health"; then
        print_success "Voice Service started on http://127.0.0.1:$VOICE_PORT"
    else
        print_warning "Voice Service starting (model loads on first request)"
    fi
    return 0
}

stop_voice_service() {
    print_status "Stopping Voice Service..."
    if [ -f "$LOG_DIR/voice-service.pid" ]; then
        local pid=$(cat "$LOG_DIR/voice-service.pid")
        kill -9 "$pid" 2>/dev/null || true
        rm -f "$LOG_DIR/voice-service.pid"
    fi
    kill_port $VOICE_PORT
}

# ============================================================================
# Service Management
# ============================================================================

start_all() {
    print_header
    
    # Start services in dependency order
    # 1. Terminal Server first (provides AI models) - REQUIRED
    start_terminal_server || exit 1
    
    # 2. Gizzi Code Server - REQUIRED for A2R Platform
    start_gizzi_code || exit 1
    
    # 3. API Service - REQUIRED for Gateway
    start_api_service || exit 1
    
    # 4. Rails Service - REQUIRED for Gateway
    start_rails_service || exit 1
    
    # 5. Gateway - REQUIRED (depends on API and Rails)
    start_gateway || exit 1
    
    # 6. Optional services
    start_voice_service
    
    # Display summary
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Services Running:${NC}"
    echo ""
    echo -e "  ${BLUE}🌐 Gateway:${NC}          http://127.0.0.1:$GATEWAY_PORT (REQUIRED for UI)"
    echo -e "  ${BLUE}🤖 Terminal Server:${NC}  http://127.0.0.1:$TERMINAL_SERVER_PORT"
    echo -e "  ${BLUE}💻 Gizzi Code:${NC}       http://127.0.0.1:$GIZZI_CODE_PORT"
    echo -e "  ${BLUE}⚙️  API Service:${NC}      http://127.0.0.1:$API_PORT"
    echo -e "  ${BLUE}🛤️  Rails Service:${NC}   http://127.0.0.1:$RAILS_PORT"
    echo -e "  ${BLUE}🔊 Voice Service:${NC}    http://127.0.0.1:$VOICE_PORT"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Quick Commands:${NC}"
    echo "  ./start-all-fixed.sh status    # Check service status"
    echo "  ./start-all-fixed.sh logs      # View all logs"
    echo "  ./start-all-fixed.sh stop      # Stop all services"
    echo ""
    echo -e "${GREEN}All services started! Press Ctrl+C to stop.${NC}"
    echo ""
    
    # Keep script running and forward signals
    trap 'stop_all; exit 0' INT TERM
    
    # Wait for background processes
    wait
}

stop_all() {
    print_status "Stopping all A2rchitech services..."
    
    stop_gateway
    stop_gizzi_code
    stop_rails_service
    stop_api_service
    stop_voice_service
    stop_terminal_server
    
    print_success "All services stopped"
}

check_status() {
    echo ""
    echo -e "${CYAN}Service Status:${NC}"
    echo ""
    
    # Gateway
    if curl -s "http://127.0.0.1:$GATEWAY_PORT/health" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Gateway (port $GATEWAY_PORT) - REQUIRED for UI"
    else
        echo -e "  ${RED}✗${NC} Gateway (port $GATEWAY_PORT) - ${YELLOW}NOT RUNNING${NC}"
    fi
    
    # Terminal Server
    if curl -s "http://127.0.0.1:$TERMINAL_SERVER_PORT/doc" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Terminal Server (port $TERMINAL_SERVER_PORT)"
    else
        echo -e "  ${RED}✗${NC} Terminal Server (port $TERMINAL_SERVER_PORT)"
    fi
    
    # Gizzi Code
    if lsof -ti :$GIZZI_CODE_PORT > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Gizzi Code Server (port $GIZZI_CODE_PORT)"
    else
        echo -e "  ${RED}✗${NC} Gizzi Code Server (port $GIZZI_CODE_PORT)"
    fi
    
    # API Service
    if curl -s "http://127.0.0.1:$API_PORT/health" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} API Service (port $API_PORT)"
    else
        echo -e "  ${RED}✗${NC} API Service (port $API_PORT)"
    fi
    
    # Rails Service
    if curl -s "http://127.0.0.1:$RAILS_PORT/health" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Rails Service (port $RAILS_PORT)"
    else
        echo -e "  ${RED}✗${NC} Rails Service (port $RAILS_PORT)"
    fi
    
    # Voice Service
    if curl -s "http://127.0.0.1:$VOICE_PORT/health" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Voice Service (port $VOICE_PORT)"
    else
        echo -e "  ${RED}✗${NC} Voice Service (port $VOICE_PORT)"
    fi
    
    echo ""
}

view_logs() {
    local service="${1:-all}"
    
    case $service in
        gateway|g)
            tail -f "$LOG_DIR/gateway.log"
            ;;
        terminal|term|t)
            tail -f "$LOG_DIR/terminal-server.log"
            ;;
        gizzi|gc)
            tail -f "$LOG_DIR/gizzi-code.log"
            ;;
        api|a)
            tail -f "$LOG_DIR/api-service.log"
            ;;
        rails|r)
            tail -f "$LOG_DIR/rails-service.log"
            ;;
        voice|v)
            tail -f "$LOG_DIR/voice-service.log"
            ;;
        all|*)
            tail -f "$LOG_DIR"/*.log
            ;;
    esac
}

# ============================================================================
# Main
# ============================================================================

main() {
    case "${1:-start}" in
        start)
            start_all
            ;;
        stop)
            stop_all
            ;;
        restart)
            stop_all
            sleep 2
            exec "$0" start
            ;;
        status)
            check_status
            ;;
        logs)
            view_logs "$2"
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|status|logs [service]}"
            echo ""
            echo "Commands:"
            echo "  start           Start all services"
            echo "  stop            Stop all services"
            echo "  restart         Restart all services"
            echo "  status          Check service status"
            echo "  logs [service]  View logs (gateway|terminal|gizzi|api|rails|voice|all)"
            echo ""
            echo "Examples:"
            echo "  $0 start                    # Start all services"
            echo "  $0 logs gateway             # View gateway logs"
            echo "  $0 status                   # Check all service status"
            exit 1
            ;;
    esac
}

main "$@"
