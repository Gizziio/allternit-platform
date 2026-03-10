#!/bin/bash

# =============================================================================
# A2RCHITECH PLATFORM - Service Launcher
# =============================================================================
# Starts all required backend services for the A2rchitect platform:
# - Terminal Server (port 4096) - AI Model API
# - API Service (port 3000) - Core Rust API
# - Voice Service (port 8001) - TTS Service (optional)
# - Rails Service (port 3011) - Agent System (optional)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
LOG_DIR="$PROJECT_ROOT/.logs"

# Port Configuration
TERMINAL_SERVER_PORT=4096
API_PORT=3000
VOICE_PORT=8001
RAILS_PORT=3011
SHELL_UI_PORT=5177
OPENCLAW_PORT=18789

# Directories
TERMINAL_DIR="$PROJECT_ROOT/cmd/gizzi-code"  # Terminal server is in cmd/gizzi-code
API_DIR="$PROJECT_ROOT/7-apps/api"
VOICE_DIR="$PROJECT_ROOT/4-services/ml-ai-services/voice-service"
RAILS_DIR="$PROJECT_ROOT/0-substrate/a2r-agent-system-rails"
SHELL_DIR="$PROJECT_ROOT/7-apps/shell/web"

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
    echo -e "${CYAN}║${NC}              ${BLUE}Service Launcher${NC}                          ${CYAN}║${NC}"
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
# Terminal Server (Port 4096)
# ============================================================================

start_terminal_server() {
    print_status "Starting Terminal Server (AI Model API) on port $TERMINAL_SERVER_PORT..."
    
    # Check if terminal server code exists
    if [ ! -f "$TERMINAL_DIR/start-server.ts" ]; then
        print_error "Terminal server not found at $TERMINAL_DIR/start-server.ts"
        return 1
    fi
    
    # Check if bun is installed
    if ! command -v bun &> /dev/null; then
        print_error "bun is not installed. Install with: curl -fsSL https://bun.sh/install | bash"
        return 1
    fi
    
    # Check if node_modules exists in gizzi-code
    if [ ! -d "$TERMINAL_DIR/node_modules" ]; then
        print_warning "Installing Terminal Server dependencies..."
        (cd "$TERMINAL_DIR" && bun install)
    fi
    
    # Kill any existing process on port 4096
    kill_port $TERMINAL_SERVER_PORT
    sleep 1
    
    # Start the terminal server using the start-server.ts script
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
        print_status "API Docs: http://127.0.0.1:$TERMINAL_SERVER_PORT/doc"
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
        python3 -m venv "$VOICE_DIR/.venv" 2>/dev/null || python3.11 -m venv "$VOICE_DIR/.venv"
        (
            cd "$VOICE_DIR"
            source ".venv/bin/activate"
            pip install --upgrade pip
            pip install fastapi uvicorn pydantic torch torchaudio chatterbox-tts 2>/dev/null || true
        )
    fi
    
    # Kill any existing process on port 8001
    kill_port $VOICE_PORT
    sleep 1
    
    # Start the voice service
    (
        cd "$VOICE_DIR"
        source ".venv/bin/activate"
        python api/main.py > "$LOG_DIR/voice-service.log" 2>&1
    ) &
    
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
# Rails Service (Port 3011) - Optional
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
# Shell UI (Port 5177) - Optional, for web development
# ============================================================================

start_shell_ui() {
    print_status "Starting Shell UI (Vite) on port $SHELL_UI_PORT..."
    
    if [ ! -d "$SHELL_DIR" ]; then
        print_warning "Shell UI directory not found at $SHELL_DIR, skipping..."
        return 0
    fi
    
    # Check if node_modules exists
    if [ ! -d "$SHELL_DIR/node_modules" ]; then
        print_warning "Installing Shell UI dependencies..."
        (cd "$SHELL_DIR" && npm install)
    fi
    
    # Create .env.development.local to point to Terminal Server
    cat > "$SHELL_DIR/.env.development.local" << EOF
# Auto-generated by start-services.sh
VITE_API_URL=http://127.0.0.1:$TERMINAL_SERVER_PORT
VITE_TERMINAL_SERVER=http://127.0.0.1:$TERMINAL_SERVER_PORT
EOF
    
    # Kill any existing process on port 5177
    kill_port $SHELL_UI_PORT
    sleep 1
    
    # Start the dev server
    (
        cd "$SHELL_DIR"
        npm run dev > "$LOG_DIR/shell-ui.log" 2>&1
    ) &
    
    local pid=$!
    echo $pid > "$LOG_DIR/shell-ui.pid"
    
    sleep 3
    if wait_for_service $SHELL_UI_PORT "Shell UI" 10; then
        print_success "Shell UI started on http://127.0.0.1:$SHELL_UI_PORT"
    else
        print_warning "Shell UI starting..."
    fi
    return 0
}

stop_shell_ui() {
    print_status "Stopping Shell UI..."
    if [ -f "$LOG_DIR/shell-ui.pid" ]; then
        local pid=$(cat "$LOG_DIR/shell-ui.pid")
        kill -9 "$pid" 2>/dev/null || true
        rm -f "$LOG_DIR/shell-ui.pid"
    fi
    kill_port $SHELL_UI_PORT
}

# ============================================================================
# OpenClaw Service (Port 18789) - Optional
# ============================================================================

start_openclaw() {
    print_status "Starting OpenClaw Service on port $OPENCLAW_PORT..."
    
    if ! command -v openclaw &> /dev/null; then
        print_warning "OpenClaw not installed. Install with: npm install -g openclaw@latest"
        return 0
    fi
    
    # Generate a secure random token
    local token=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | head -c 64)
    echo "OPENCLAW_GATEWAY_TOKEN=${token}" > "$PROJECT_ROOT/.openclaw.env"
    echo "OPENCLAW_PORT=${OPENCLAW_PORT}" >> "$PROJECT_ROOT/.openclaw.env"
    
    # Configure OpenClaw
    export OPENCLAW_GATEWAY_TOKEN="${token}"
    openclaw config set gateway.port ${OPENCLAW_PORT} 2>/dev/null || true
    openclaw config set gateway.mode local 2>/dev/null || true
    openclaw config set gateway.auth.token "${token}" 2>/dev/null || true
    openclaw config set gateway.controlUi.allowInsecureAuth true 2>/dev/null || true
    
    # Kill any existing process on port 18789
    kill_port $OPENCLAW_PORT
    sleep 1
    
    # Start OpenClaw gateway
    nohup openclaw gateway --port ${OPENCLAW_PORT} > "$LOG_DIR/openclaw-service.log" 2>&1 &
    
    local pid=$!
    echo $pid > "$LOG_DIR/openclaw-service.pid"
    
    sleep 2
    if wait_for_service $OPENCLAW_PORT "OpenClaw" 15 "/health"; then
        print_success "OpenClaw Service started on http://127.0.0.1:$OPENCLAW_PORT"
    else
        print_warning "OpenClaw Service starting..."
    fi
    return 0
}

stop_openclaw() {
    print_status "Stopping OpenClaw Service..."
    if [ -f "$LOG_DIR/openclaw-service.pid" ]; then
        local pid=$(cat "$LOG_DIR/openclaw-service.pid")
        kill -9 "$pid" 2>/dev/null || true
        rm -f "$LOG_DIR/openclaw-service.pid"
    fi
    kill_port $OPENCLAW_PORT
    rm -f "$PROJECT_ROOT/.openclaw.env"
}

# ============================================================================
# Service Management
# ============================================================================

start_all() {
    print_header
    
    # Start services in dependency order
    # 1. Terminal Server first (provides AI models) - REQUIRED
    start_terminal_server || exit 1
    
    # 2. API Service - REQUIRED
    start_api_service || exit 1
    
    # 3. Optional services
    start_voice_service
    start_rails_service
    start_openclaw
    
    # 4. Shell UI (optional, for web development)
    start_shell_ui
    
    # Display summary
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Services Running:${NC}"
    echo ""
    echo -e "  ${BLUE}🤖 Terminal Server:${NC} http://127.0.0.1:$TERMINAL_SERVER_PORT"
    echo -e "     └─ AI Model API for Web/Desktop apps"
    echo -e "     └─ API Docs: http://127.0.0.1:$TERMINAL_SERVER_PORT/doc"
    echo ""
    echo -e "  ${BLUE}⚙️  API Service:${NC}     http://127.0.0.1:$API_PORT"
    echo -e "  ${BLUE}🔊 Voice Service:${NC}   http://127.0.0.1:$VOICE_PORT"
    echo -e "  ${BLUE}🛤️  Rails Service:${NC}  http://127.0.0.1:$RAILS_PORT"
    echo -e "  ${BLUE}🐾 OpenClaw:${NC}        http://127.0.0.1:$OPENCLAW_PORT"
    echo -e "  ${BLUE}🌐 Shell UI:${NC}        http://127.0.0.1:$SHELL_UI_PORT"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Quick Commands:${NC}"
    echo "  ./start-services.sh status    # Check service status"
    echo "  ./start-services.sh logs      # View all logs"
    echo "  ./start-services.sh stop      # Stop all services"
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
    
    stop_shell_ui
    stop_openclaw
    stop_rails_service
    stop_voice_service
    stop_api_service
    stop_terminal_server
    
    # Clean up env files
    rm -f "$PROJECT_ROOT/.terminal-server.env"
    
    print_success "All services stopped"
}

check_status() {
    echo ""
    echo -e "${CYAN}Service Status:${NC}"
    echo ""
    
    # Terminal Server
    if curl -s "http://127.0.0.1:$TERMINAL_SERVER_PORT/doc" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Terminal Server (port $TERMINAL_SERVER_PORT) - AI Models Ready"
    else
        echo -e "  ${RED}✗${NC} Terminal Server (port $TERMINAL_SERVER_PORT)"
    fi
    
    # API Service
    if curl -s "http://127.0.0.1:$API_PORT/health" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} API Service (port $API_PORT)"
    else
        echo -e "  ${RED}✗${NC} API Service (port $API_PORT)"
    fi
    
    # Voice Service
    if curl -s "http://127.0.0.1:$VOICE_PORT/health" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Voice Service (port $VOICE_PORT)"
    else
        echo -e "  ${RED}✗${NC} Voice Service (port $VOICE_PORT)"
    fi
    
    # Rails Service
    if curl -s "http://127.0.0.1:$RAILS_PORT/health" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Rails Service (port $RAILS_PORT)"
    else
        echo -e "  ${RED}✗${NC} Rails Service (port $RAILS_PORT)"
    fi
    
    # OpenClaw
    if curl -s "http://127.0.0.1:$OPENCLAW_PORT/health" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} OpenClaw (port $OPENCLAW_PORT)"
    else
        echo -e "  ${RED}✗${NC} OpenClaw (port $OPENCLAW_PORT)"
    fi
    
    # Shell UI
    if curl -s "http://127.0.0.1:$SHELL_UI_PORT" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Shell UI (port $SHELL_UI_PORT)"
    else
        echo -e "  ${RED}✗${NC} Shell UI (port $SHELL_UI_PORT)"
    fi
    
    echo ""
}

view_logs() {
    local service="${1:-all}"
    
    case $service in
        terminal|term|t)
            tail -f "$LOG_DIR/terminal-server.log"
            ;;
        api|a)
            tail -f "$LOG_DIR/api-service.log"
            ;;
        voice|v)
            tail -f "$LOG_DIR/voice-service.log"
            ;;
        rails|r)
            tail -f "$LOG_DIR/rails-service.log"
            ;;
        shell|s)
            tail -f "$LOG_DIR/shell-ui.log"
            ;;
        openclaw|oc)
            tail -f "$LOG_DIR/openclaw-service.log"
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
        terminal|term)
            # Start only terminal server
            print_header
            start_terminal_server
            echo ""
            echo -e "${GREEN}Terminal Server running on http://127.0.0.1:$TERMINAL_SERVER_PORT${NC}"
            echo "Press Ctrl+C to stop"
            trap 'stop_terminal_server; exit 0' INT TERM
            wait
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|status|logs [service]|terminal}"
            echo ""
            echo "Commands:"
            echo "  start           Start all services"
            echo "  stop            Stop all services"
            echo "  restart         Restart all services"
            echo "  status          Check service status"
            echo "  logs [service]  View logs (terminal|api|voice|rails|shell|openclaw|all)"
            echo "  terminal        Start only the Terminal Server"
            echo ""
            echo "Examples:"
            echo "  $0 start                    # Start all services"
            echo "  $0 logs terminal            # View terminal server logs"
            echo "  $0 terminal                 # Start only terminal server"
            exit 1
            ;;
    esac
}

main "$@"
