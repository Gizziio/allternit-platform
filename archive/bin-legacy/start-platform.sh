#!/bin/bash

# =============================================================================
# Allternit PLATFORM - Unified Launcher (ALL SERVICES)
# =============================================================================
# Single command to start EVERY service in the platform
# Uses centralized port configuration from service-config.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/.logs"
DESKTOP_DIR="$PROJECT_ROOT/7-apps/shell/desktop"

# Load service configuration
source "$SCRIPT_DIR/service-config.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

mkdir -p "$LOG_DIR"

# Track running services
declare -a RUNNING_SERVICES=()

print_header() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}          ${GREEN}Allternit PLATFORM${NC}                         ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}              ${BLUE}Full Platform Launcher${NC}                    ${CYAN}║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }

# Cleanup on exit
cleanup() {
    echo ""
    print_status "Stopping Allternit Platform..."
    
    # Kill by port
    for port in $Allternit_ALL_PORTS; do
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
    done
    
    # Kill electron/node processes
    pkill -f "electron.*desktop" 2>/dev/null || true
    pkill -f "vite.*${Allternit_SHELL_UI_PORT}" 2>/dev/null || true
    
    # Kill by PID files
    for pidfile in "$LOG_DIR"/*.pid; do
        if [ -f "$pidfile" ]; then
            pid=$(cat "$pidfile")
            kill -9 "$pid" 2>/dev/null || true
            rm -f "$pidfile"
        fi
    done
    
    print_success "Platform stopped"
}

trap cleanup EXIT INT TERM

# Kill existing services
cleanup_existing() {
    print_status "Cleaning up existing processes..."
    for port in $Allternit_ALL_PORTS; do
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
    done
    sleep 1
}

# Wait for service to be ready
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

# Start Terminal Server (AI Models)
start_terminal() {
    print_status "Starting Terminal Server..."
    TERMINAL_DIR="$PROJECT_ROOT/7-apps/shell/terminal"
    
    if [ ! -d "$TERMINAL_DIR" ]; then
        print_warning "Terminal directory not found, skipping..."
        return 0
    fi
    
    (cd "$TERMINAL_DIR" && bun run src/index.ts serve --port $Allternit_TERMINAL_PORT --hostname 127.0.0.1 > "$LOG_DIR/terminal.log" 2>&1) &
    echo $! > "$LOG_DIR/terminal.pid"
    
    if wait_for_service $Allternit_TERMINAL_PORT "Terminal" 30 "/doc"; then
        print_success "Terminal Server started (port $Allternit_TERMINAL_PORT)"
        RUNNING_SERVICES+=("Terminal:$Allternit_TERMINAL_PORT")
        return 0
    else
        print_error "Terminal Server failed to start"
        return 1
    fi
}

# Start Policy Service
start_policy() {
    print_status "Starting Policy Service..."
    POLICY_DIR="$PROJECT_ROOT/2-governance"
    
    if [ ! -d "$POLICY_DIR" ]; then
        print_warning "Policy directory not found, skipping..."
        return 0
    fi
    
    (cd "$POLICY_DIR" && PORT=$Allternit_POLICY_PORT cargo run --release > "$LOG_DIR/policy.log" 2>&1) &
    echo $! > "$LOG_DIR/policy.pid"
    
    sleep 3
    print_success "Policy Service started (port $Allternit_POLICY_PORT)"
    RUNNING_SERVICES+=("Policy:$Allternit_POLICY_PORT")
}

# Start Memory Service
start_memory() {
    print_status "Starting Memory Service..."
    MEMORY_DIR="$PROJECT_ROOT/4-services/memory"
    
    if [ ! -d "$MEMORY_DIR" ]; then
        print_warning "Memory directory not found, skipping..."
        return 0
    fi
    
    (cd "$MEMORY_DIR" && PORT=$Allternit_MEMORY_PORT cargo run --release > "$LOG_DIR/memory.log" 2>&1) &
    echo $! > "$LOG_DIR/memory.pid"
    
    sleep 3
    print_success "Memory Service started (port $Allternit_MEMORY_PORT)"
    RUNNING_SERVICES+=("Memory:$Allternit_MEMORY_PORT")
}

# Start Registry Service
start_registry() {
    print_status "Starting Registry Service..."
    REGISTRY_DIR="$PROJECT_ROOT/4-services/registry"
    
    if [ ! -d "$REGISTRY_DIR" ]; then
        print_warning "Registry directory not found, skipping..."
        return 0
    fi
    
    (cd "$REGISTRY_DIR" && PORT=$Allternit_REGISTRY_PORT cargo run --release > "$LOG_DIR/registry.log" 2>&1) &
    echo $! > "$LOG_DIR/registry.pid"
    
    sleep 3
    print_success "Registry Service started (port $Allternit_REGISTRY_PORT)"
    RUNNING_SERVICES+=("Registry:$Allternit_REGISTRY_PORT")
}

# Start Voice Service
start_voice() {
    print_status "Starting Voice Service..."
    VOICE_DIR="$PROJECT_ROOT/4-services/ml-ai-services/voice-service"
    
    if [ ! -d "$VOICE_DIR" ]; then
        print_warning "Voice directory not found, skipping..."
        return 0
    fi
    
    (cd "$VOICE_DIR" && source .venv/bin/activate 2>/dev/null || true && PORT=$Allternit_VOICE_PORT python api/main.py > "$LOG_DIR/voice.log" 2>&1) &
    echo $! > "$LOG_DIR/voice.pid"
    
    sleep 2
    print_success "Voice Service started (port $Allternit_VOICE_PORT)"
    RUNNING_SERVICES+=("Voice:$Allternit_VOICE_PORT")
}

# Start WebVM Service
start_webvm() {
    print_status "Starting WebVM Service..."
    WEBVM_DIR="$PROJECT_ROOT/4-services/ai/webvm-service"
    
    if [ ! -d "$WEBVM_DIR" ]; then
        print_warning "WebVM directory not found, skipping..."
        return 0
    fi
    
    (cd "$WEBVM_DIR" && PORT=$Allternit_WEBVM_PORT cargo run --release --bin webvm-service > "$LOG_DIR/webvm.log" 2>&1) &
    echo $! > "$LOG_DIR/webvm.pid"
    
    sleep 3
    print_success "WebVM Service started (port $Allternit_WEBVM_PORT)"
    RUNNING_SERVICES+=("WebVM:$Allternit_WEBVM_PORT")
}

# Start Operator Service
start_operator() {
    print_status "Starting Operator Service..."
    OPERATOR_DIR="$PROJECT_ROOT/4-services/allternit-operator"
    
    if [ ! -d "$OPERATOR_DIR" ]; then
        print_warning "Operator directory not found, skipping..."
        return 0
    fi
    
    (cd "$OPERATOR_DIR" && source .venv/bin/activate 2>/dev/null || true && PORT=$Allternit_OPERATOR_PORT python src/main.py > "$LOG_DIR/operator.log" 2>&1) &
    echo $! > "$LOG_DIR/operator.pid"
    
    sleep 3
    print_success "Operator Service started (port $Allternit_OPERATOR_PORT)"
    RUNNING_SERVICES+=("Operator:$Allternit_OPERATOR_PORT")
}

# Start Rails Service
start_rails() {
    print_status "Starting Rails Service..."
    RAILS_DIR="$PROJECT_ROOT/allternit-agent-system-rails"
    
    if [ ! -d "$RAILS_DIR" ]; then
        print_warning "Rails directory not found, skipping..."
        return 0
    fi
    
    (cd "$RAILS_DIR" && PORT=$Allternit_RAILS_PORT cargo run --bin allternit-rails-service --release > "$LOG_DIR/rails.log" 2>&1) &
    echo $! > "$LOG_DIR/rails.pid"
    
    sleep 3
    print_success "Rails Service started (port $Allternit_RAILS_PORT)"
    RUNNING_SERVICES+=("Rails:$Allternit_RAILS_PORT")
}

# Start Kernel Service
start_kernel() {
    print_status "Starting Kernel Service..."
    KERNEL_DIR="$PROJECT_ROOT/4-services/orchestration/kernel-service"
    
    if [ ! -d "$KERNEL_DIR" ]; then
        print_warning "Kernel directory not found, skipping..."
        return 0
    fi
    
    (cd "$KERNEL_DIR" && PORT=$Allternit_KERNEL_PORT cargo run --release > "$LOG_DIR/kernel.log" 2>&1) &
    echo $! > "$LOG_DIR/kernel.pid"
    
    sleep 3
    print_success "Kernel Service started (port $Allternit_KERNEL_PORT)"
    RUNNING_SERVICES+=("Kernel:$Allternit_KERNEL_PORT")
}

# Start Gateway (Main)
start_gateway() {
    print_status "Starting Main Gateway..."
    GATEWAY_DIR="$PROJECT_ROOT/4-services/gateway"
    
    if [ ! -d "$GATEWAY_DIR" ] || [ ! -f "$GATEWAY_DIR/src/main.py" ]; then
        print_warning "Gateway directory not found, skipping..."
        return 0
    fi
    
    (cd "$GATEWAY_DIR" && PORT=$Allternit_GATEWAY_PORT python -m uvicorn src.main:app --port $Allternit_GATEWAY_PORT --host 127.0.0.1 > "$LOG_DIR/gateway.log" 2>&1) &
    echo $! > "$LOG_DIR/gateway.pid"
    
    sleep 3
    print_success "Main Gateway started (port $Allternit_GATEWAY_PORT)"
    RUNNING_SERVICES+=("Gateway:$Allternit_GATEWAY_PORT")
}

# Start AGUI Gateway
start_agui() {
    print_status "Starting AGUI Gateway..."
    AGUI_DIR="$PROJECT_ROOT/4-services/gateway/agui-gateway"
    
    if [ ! -d "$AGUI_DIR" ]; then
        print_warning "AGUI directory not found, skipping..."
        return 0
    fi
    
    (cd "$AGUI_DIR" && PORT=$Allternit_AGUI_PORT npm run dev > "$LOG_DIR/agui.log" 2>&1) &
    echo $! > "$LOG_DIR/agui.pid"
    
    sleep 3
    print_success "AGUI Gateway started (port $Allternit_AGUI_PORT)"
    RUNNING_SERVICES+=("AGUI:$Allternit_AGUI_PORT")
}

# Start A2A Gateway
start_a2a() {
    print_status "Starting A2A Gateway..."
    A2A_DIR="$PROJECT_ROOT/4-services/gateway/a2a-gateway"
    
    if [ ! -d "$A2A_DIR" ]; then
        print_warning "A2A directory not found, skipping..."
        return 0
    fi
    
    (cd "$A2A_DIR" && PORT=$Allternit_A2A_PORT npm run dev > "$LOG_DIR/a2a.log" 2>&1) &
    echo $! > "$LOG_DIR/a2a.pid"
    
    sleep 3
    print_success "A2A Gateway started (port $Allternit_A2A_PORT)"
    RUNNING_SERVICES+=("A2A:$Allternit_A2A_PORT")
}

# Start OpenClaw
start_openclaw() {
    print_status "Starting OpenClaw Gateway..."
    
    if ! command -v openclaw &> /dev/null; then
        print_warning "OpenClaw not installed, skipping..."
        return 0
    fi
    
    lsof -ti :$OPENCLAW_PORT | xargs kill -9 2>/dev/null || true
    sleep 1
    
    OPENCLAW_TOKEN=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | head -c 64)
    echo "OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_TOKEN}" > "$PROJECT_ROOT/.openclaw.env"
    echo "OPENCLAW_PORT=${OPENCLAW_PORT}" >> "$PROJECT_ROOT/.openclaw.env"
    
    export OPENCLAW_GATEWAY_TOKEN="${OPENCLAW_TOKEN}"
    openclaw config set gateway.port $OPENCLAW_PORT 2>/dev/null || true
    openclaw config set gateway.mode local 2>/dev/null || true
    openclaw config set gateway.auth.token "${OPENCLAW_TOKEN}" 2>/dev/null || true
    
    nohup openclaw gateway --port $OPENCLAW_PORT > "$LOG_DIR/openclaw.log" 2>&1 &
    echo $! > "$LOG_DIR/openclaw.pid"
    
    sleep 3
    print_success "OpenClaw Gateway started (port $OPENCLAW_PORT)"
    RUNNING_SERVICES+=("OpenClaw:$OPENCLAW_PORT")
}

# Start API Service
start_api() {
    print_status "Starting API Service..."
    API_DIR="$PROJECT_ROOT/7-apps/api"
    
    if [ ! -d "$API_DIR" ]; then
        print_error "API directory not found: $API_DIR"
        return 1
    fi
    
    (cd "$API_DIR" && PORT=$Allternit_API_PORT cargo run --release > "$LOG_DIR/api.log" 2>&1) &
    echo $! > "$LOG_DIR/api.pid"
    
    print_status "Waiting for API to compile and start..."
    for i in {1..90}; do
        if curl -s "http://127.0.0.1:${Allternit_API_PORT}/health" > /dev/null 2>&1; then
            print_success "API Service ready (port $Allternit_API_PORT)"
            RUNNING_SERVICES+=("API:$Allternit_API_PORT")
            return 0
        fi
        sleep 2
        if [ $((i % 10)) -eq 0 ]; then
            print_status "Still compiling... (${i}s)"
        fi
    done
    
    print_warning "API still starting in background..."
    RUNNING_SERVICES+=("API:$Allternit_API_PORT")
}

# Start Shell UI
start_shell_ui() {
    print_status "Starting Shell UI..."
    SHELL_DIR="$PROJECT_ROOT/7-apps/shell/web"
    
    if [ ! -d "$SHELL_DIR/node_modules" ]; then
        print_status "Installing Shell UI dependencies..."
        (cd "$SHELL_DIR" && npm install)
    fi
    
    cat > "$SHELL_DIR/.env.development.local" << EOF
VITE_TERMINAL_SERVER_URL=http://127.0.0.1:${Allternit_TERMINAL_PORT}
EOF
    
    (cd "$SHELL_DIR" && PORT=$Allternit_SHELL_UI_PORT npm run dev > "$LOG_DIR/shell-ui.log" 2>&1) &
    echo $! > "$LOG_DIR/shell-ui.pid"
    
    sleep 3
    print_success "Shell UI started (port $Allternit_SHELL_UI_PORT)"
    RUNNING_SERVICES+=("ShellUI:$Allternit_SHELL_UI_PORT")
}

# Start Electron Desktop App
start_electron() {
    print_status "Starting Electron Desktop App..."

    if [ ! -d "$DESKTOP_DIR/node_modules" ]; then
        print_status "Installing Electron dependencies..."
        (cd "$DESKTOP_DIR" && npm install)
    fi

    (cd "$DESKTOP_DIR" && npm run dev > "$LOG_DIR/electron.log" 2>&1) &
    echo $! > "$LOG_DIR/electron.pid"

    sleep 5
    print_success "Electron Desktop App starting..."
    RUNNING_SERVICES+=("Electron:desktop")
}

# Check Chrome Streaming Installation
check_chrome_streaming() {
    CHROME_DIR="$PROJECT_ROOT/8-cloud/chrome-stream"
    
    # Check if Chrome streaming is installed
    if [ ! -d "$CHROME_DIR" ]; then
        return 1
    fi
    
    # Check if Docker image exists
    if ! docker image inspect allternit/chrome-stream &> /dev/null; then
        return 1
    fi
    
    # Check if coturn is installed
    if ! command -v turnserver &> /dev/null; then
        return 1
    fi
    
    return 0
}

# Offer to install Chrome Streaming
offer_install_chrome() {
    echo ""
    echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║${NC}        ${CYAN}Chrome Streaming Gateway - Not Installed${NC}          ${YELLOW}║${NC}"
    echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Chrome Streaming enables:${NC}"
    echo "  • Real Google Chrome in browser capsule"
    echo "  • Full Chrome Web Store access"
    echo "  • Native extension installation"
    echo "  • WebRTC video streaming"
    echo ""
    read -p "Install Chrome Streaming now? (recommended) [Y/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        echo ""
        print_status "Running Chrome Streaming installer..."
        if [ -f "$SCRIPT_DIR/install-chrome-streaming.sh" ]; then
            sudo "$SCRIPT_DIR/install-chrome-streaming.sh"
        else
            print_error "Installer not found at: $SCRIPT_DIR/install-chrome-streaming.sh"
            return 1
        fi
        print_success "Chrome Streaming installed!"
        return 0
    else
        print_info "Skipping Chrome Streaming installation"
        return 1
    fi
}

# Start Chrome Streaming Service
start_chrome_streaming() {
    print_status "Starting Chrome Streaming Service..."

    CHROME_DIR="$PROJECT_ROOT/8-cloud/chrome-stream"

    if [ ! -d "$CHROME_DIR" ]; then
        print_warning "Chrome streaming directory not found, skipping..."
        return 0
    fi

    # Start coturn (TURN server for WebRTC)
    print_status "Starting coturn (WebRTC TURN server)..."
    if command -v turnserver &> /dev/null; then
        turnserver -c "$CHROME_DIR/turnserver.conf" -d -f > "$LOG_DIR/coturn.log" 2>&1 &
        echo $! > "$LOG_DIR/coturn.pid"
        sleep 2
        print_success "coturn started (port 3478)"
    else
        print_warning "coturn not installed, TURN disabled (mobile WebRTC may not work)"
    fi

    # Start Chrome session broker (API handles this)
    print_success "Chrome Streaming Service ready (via API)"
    RUNNING_SERVICES+=("ChromeStreaming:api")
}

# Show status
show_status() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Allternit PLATFORM - ALL SERVICES RUNNING${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    echo -e "  ${BLUE}📊 Running Services (${#RUNNING_SERVICES[@]}):${NC}"
    echo ""
    
    # Core Services
    echo -e "  ${BLUE}Core Services:${NC}"
    for svc in "${RUNNING_SERVICES[@]}"; do
        name="${svc%%:*}"
        port="${svc##*:}"
        case $name in
            API|Kernel|Policy|Memory|Registry)
                echo -e "    ${BLUE}⚙️  $name:${NC} http://127.0.0.1:$port"
                ;;
        esac
    done
    echo ""
    
    # AI Services
    echo -e "  ${BLUE}AI Services:${NC}"
    for svc in "${RUNNING_SERVICES[@]}"; do
        name="${svc%%:*}"
        port="${svc##*:}"
        case $name in
            Voice|WebVM|Operator|Rails)
                echo -e "    ${BLUE}🤖 $name:${NC} http://127.0.0.1:$port"
                ;;
        esac
    done
    echo ""
    
    # Gateways
    echo -e "  ${BLUE}Gateways:${NC}"
    for svc in "${RUNNING_SERVICES[@]}"; do
        name="${svc%%:*}"
        port="${svc##*:}"
        case $name in
            Gateway|AGUI|A2A|OpenClaw|Terminal)
                echo -e "    ${BLUE}🚪 $name:${NC} http://127.0.0.1:$port"
                ;;
        esac
    done
    echo ""
    
    # UI
    echo -e "  ${BLUE}User Interface:${NC}"
    for svc in "${RUNNING_SERVICES[@]}"; do
        name="${svc%%:*}"
        port="${svc##*:}"
        case $name in
            ShellUI)
                echo -e "    ${BLUE}🌐 $name:${NC} http://127.0.0.1:$port"
                ;;
            Electron)
                echo -e "    ${BLUE}🖥️  Desktop:${NC} Electron window (check dock)"
                ;;
            ChromeStreaming)
                echo -e "    ${BLUE}🚀 Chrome Streaming:${NC} Available via API"
                ;;
        esac
    done
    
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Main
main() {
    print_header
    
    cleanup_existing
    
    # Start services in dependency order
    
    print_status "Phase 1: Core Infrastructure..."
    start_terminal || exit 1
    start_policy
    start_memory
    start_registry
    
    print_status "Phase 2: AI Services..."
    start_voice
    start_webvm
    start_operator
    start_rails
    
    print_status "Phase 3: Orchestration..."
    start_kernel
    start_api
    
    print_status "Phase 4: Gateways..."
    start_gateway
    start_agui
    start_a2a
    start_openclaw
    
    print_status "Phase 5: User Interface..."
    start_shell_ui
    start_electron
    
    # Check and offer to install Chrome Streaming if not installed
    if ! check_chrome_streaming; then
        if offer_install_chrome; then
            print_success "Chrome Streaming installed successfully!"
        fi
    fi
    start_chrome_streaming

    show_status

    # Keep running
    wait
}

main "$@"
