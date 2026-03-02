#!/bin/bash
# =============================================================================
# A2RCHITECT PLATFORM - COMPLETE ONBOARDING SETUP SCRIPT
# =============================================================================
# This script sets up a NEW computer from scratch to run the a2rchitect platform
# Run this on a fresh machine to install ALL dependencies and services
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
REPO_URL="https://github.com/a2rchitech/a2rchitech.git"
INSTALL_DIR="${INSTALL_DIR:-$HOME/a2rchitect-workspace}"
A2R_DIR="$INSTALL_DIR/a2rchitech"
LOG_DIR="$A2R_DIR/.logs"

# Version requirements
NODE_VERSION="18"
RUST_VERSION="stable"
PYTHON_VERSION="3.11"

# Ports used by the platform (for validation)
declare -a A2R_PORTS=(
    3000    # API Server
    3004    # Kernel
    3010    # Operator/Rust API
    3011    # Rails
    3200    # Memory
    5177    # Vite Dev Server
    8001    # Voice Service
    8002    # WebVM Service
    8013    # Gateway
    8080    # Registry
    11434   # Ollama (optional)
)

print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}           ${GREEN}A2RCHITECT PLATFORM${NC}                              ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}              ${BLUE}Complete Onboarding Setup${NC}                       ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}  $1${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_step() { echo -e "${BLUE}[STEP]${NC} $1"; }
print_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

# Detect OS
detect_os() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    case "$OS" in
        linux) OS="linux" ;;
        darwin) OS="macos" ;;
        mingw*|cygwin*|msys*|windows*) OS="windows" ;;
        *)
            print_error "Unsupported OS: $OS"
            exit 1
            ;;
    esac
    echo "$OS"
}

OS=$(detect_os)
print_info "Detected OS: $OS"

# =============================================================================
# PREREQUISITE CHECKS
# =============================================================================

check_prerequisites() {
    print_section "PREREQUISITE CHECKS"
    
    local missing=()
    
    # Check for curl or wget
    if ! command -v curl &>/dev/null && ! command -v wget &>/dev/null; then
        missing+=("curl or wget")
    fi
    
    # Check for git
    if ! command -v git &>/dev/null; then
        missing+=("git")
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing[*]}"
        print_info "Please install them first:"
        
        case "$OS" in
            macos)
                echo "  brew install curl git"
                ;;
            linux)
                echo "  sudo apt-get install curl git  # Debian/Ubuntu"
                echo "  sudo yum install curl git      # RHEL/CentOS"
                ;;
        esac
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# =============================================================================
# INSTALL NODE.JS & PNPM
# =============================================================================

install_node() {
    print_section "INSTALLING NODE.JS & PNPM"
    
    if command -v node &>/dev/null; then
        local current_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$current_version" -ge "$NODE_VERSION" ]; then
            print_success "Node.js $(node -v) already installed"
        else
            print_warning "Node.js version $current_version found, need >= $NODE_VERSION"
            _install_nodejs
        fi
    else
        _install_nodejs
    fi
    
    # Install pnpm
    if ! command -v pnpm &>/dev/null; then
        print_step "Installing pnpm..."
        curl -fsSL https://get.pnpm.io/install.sh | sh -
        export PATH="$HOME/.local/share/pnpm:$PATH"
        print_success "pnpm installed"
    else
        print_success "pnpm $(pnpm -v) already installed"
    fi
    
    # Install Bun (required for terminal server)
    if ! command -v bun &>/dev/null; then
        print_step "Installing Bun..."
        curl -fsSL https://bun.sh/install | bash
        export PATH="$HOME/.bun/bin:$PATH"
        print_success "Bun installed"
    else
        print_success "Bun $(bun -v) already installed"
    fi
}

_install_nodejs() {
    print_step "Installing Node.js ${NODE_VERSION}..."
    
    case "$OS" in
        macos)
            if command -v brew &>/dev/null; then
                brew install node@${NODE_VERSION}
            else
                print_error "Homebrew required. Install from https://brew.sh"
                exit 1
            fi
            ;;
        linux)
            # Use NodeSource
            curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
    esac
    
    print_success "Node.js $(node -v) installed"
}

# =============================================================================
# INSTALL RUST
# =============================================================================

install_rust() {
    print_section "INSTALLING RUST TOOLCHAIN"
    
    if command -v rustc &>/dev/null && command -v cargo &>/dev/null; then
        print_success "Rust $(rustc --version) already installed"
    else
        print_step "Installing Rust..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
        print_success "Rust $(rustc --version) installed"
    fi
    
    # Add required targets
    rustup target add wasm32-unknown-unknown 2>/dev/null || true
    
    # Install cargo tools
    if ! command -v cargo-watch &>/dev/null; then
        cargo install cargo-watch 2>/dev/null || true
    fi
}

# =============================================================================
# INSTALL PYTHON
# =============================================================================

install_python() {
    print_section "INSTALLING PYTHON & UV"
    
    # Install uv (fast Python package manager)
    if ! command -v uv &>/dev/null; then
        print_step "Installing uv (Python package manager)..."
        curl -LsSf https://astral.sh/uv/install.sh | sh
        export PATH="$HOME/.cargo/bin:$PATH"
        print_success "uv installed"
    else
        print_success "uv already installed"
    fi
    
    # Ensure Python is available
    if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
        print_step "Installing Python ${PYTHON_VERSION}..."
        case "$OS" in
            macos)
                brew install python@${PYTHON_VERSION}
                ;;
            linux)
                sudo apt-get install -y python${PYTHON_VERSION} python${PYTHON_VERSION}-venv python3-pip
                ;;
        esac
    fi
    
    print_success "Python ready"
}

# =============================================================================
# INSTALL DOCKER (OPTIONAL)
# =============================================================================

install_docker() {
    print_section "INSTALLING DOCKER (Optional)"

    if command -v docker &>/dev/null; then
        print_success "Docker $(docker --version) already installed"
        return 0
    fi

    print_warning "Docker not found. It's optional but recommended for:"
    print_info "  - Chrome streaming gateway"
    print_info "  - Containerized services"
    print_info "  - Cloud deployment features"

    read -p "Install Docker? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        case "$OS" in
            macos)
                print_step "Please install Docker Desktop from https://docs.docker.com/desktop/install/mac-install/"
                open "https://docs.docker.com/desktop/install/mac-install/" 2>/dev/null || true
                ;;
            linux)
                curl -fsSL https://get.docker.com | sh
                sudo usermod -aG docker $USER
                print_warning "Please log out and back in for Docker permissions"
                ;;
        esac
    else
        print_warning "Skipping Docker installation"
    fi
}

# =============================================================================
# INSTALL CHROME STREAMING (OPTIONAL - REQUIRES DOCKER)
# =============================================================================

install_chrome_streaming() {
    print_section "CHROME STREAMING GATEWAY (Optional)"

    # Check if Docker is installed
    if ! command -v docker &>/dev/null; then
        print_warning "Docker not installed. Chrome Streaming requires Docker."
        print_info "Skipping Chrome Streaming installation."
        return 0
    fi

    # Check if already installed
    if docker image inspect a2r/chrome-stream &>/dev/null && command -v turnserver &>/dev/null; then
        print_success "Chrome Streaming already installed"
        return 0
    fi

    print_info "Chrome Streaming enables:"
    print_info "  • Real Google Chrome in browser capsule"
    print_info "  • Full Chrome Web Store access"
    print_info "  • Native extension installation"
    print_info "  • WebRTC video streaming"
    print_info ""
    print_info "This is RECOMMENDED for full browser functionality."

    read -p "Install Chrome Streaming now? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Run the Chrome Streaming installer
        if [ -f "$SCRIPT_DIR/install-chrome-streaming.sh" ]; then
            print_step "Running Chrome Streaming installer..."
            sudo "$SCRIPT_DIR/install-chrome-streaming.sh"
            print_success "Chrome Streaming installed!"
        else
            print_warning "Installer script not found at: $SCRIPT_DIR/install-chrome-streaming.sh"
            print_info "You can install it later with: sudo ./scripts/install-chrome-streaming.sh"
        fi
    else
        print_info "Skipping Chrome Streaming installation"
        print_info "You can install it later with: sudo ./scripts/install-chrome-streaming.sh"
    fi
}

# =============================================================================
# CLONE REPOSITORY
# =============================================================================

clone_repository() {
    print_section "CLONING REPOSITORY"
    
    if [ -d "$A2R_DIR" ]; then
        print_warning "Directory $A2R_DIR already exists"
        read -p "Remove and re-clone? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$A2R_DIR"
        else
            print_info "Using existing directory"
            cd "$A2R_DIR"
            return 0
        fi
    fi
    
    print_step "Creating workspace directory..."
    mkdir -p "$INSTALL_DIR"
    
    print_step "Cloning a2rchitect repository..."
    git clone "$REPO_URL" "$A2R_DIR"
    
    cd "$A2R_DIR"
    print_success "Repository cloned to $A2R_DIR"
}

# =============================================================================
# INSTALL PROJECT DEPENDENCIES
# =============================================================================

install_project_deps() {
    print_section "INSTALLING PROJECT DEPENDENCIES"
    
    cd "$A2R_DIR"
    
    # Install Node.js dependencies
    print_step "Installing Node.js dependencies (pnpm)..."
    pnpm install
    print_success "Node.js dependencies installed"
    
    # Install Playwright browsers (needed for browser automation)
    print_step "Installing Playwright browsers..."
    pnpm exec playwright install chromium 2>/dev/null || true
    print_success "Playwright browsers installed"
    
    # Build Rust workspace
    print_step "Building Rust workspace (this may take several minutes)..."
    cargo build --release --bin a2rchitech-api
    print_success "Rust API built"
    
    # Setup Python virtual environments
    print_step "Setting up Python services..."
    
    # Browser-use-service
    if [ -d "$A2R_DIR/4-services/browser-use-service" ]; then
        print_info "Setting up browser-use-service..."
        cd "$A2R_DIR/4-services/browser-use-service"
        uv venv .venv 2>/dev/null || python3 -m venv .venv
        source .venv/bin/activate
        pip install -r requirements.txt
        deactivate
    fi
    
    # Operator service
    if [ -d "$A2R_DIR/4-services/a2r-operator" ]; then
        print_info "Setting up operator service..."
        cd "$A2R_DIR/4-services/a2r-operator"
        uv venv .venv 2>/dev/null || python3 -m venv .venv
        source .venv/bin/activate
        pip install -r requirements.txt
        deactivate
    fi
    
    print_success "Python services configured"
}

# =============================================================================
# CREATE ENVIRONMENT FILES
# =============================================================================

create_env_files() {
    print_section "CREATING ENVIRONMENT FILES"
    
    cd "$A2R_DIR"
    
    # Main .env file
    if [ ! -f ".env" ]; then
        cat > ".env" << 'EOF'
# =============================================================================
# A2RCHITECT PLATFORM - ENVIRONMENT CONFIGURATION
# =============================================================================

# -----------------------------------------------------------------------------
# CORE API CONFIGURATION
# -----------------------------------------------------------------------------
A2RCHITECH_API_BIND=127.0.0.1:3010
A2RCHITECH_LEDGER_PATH=./data/a2rchitech.jsonl
A2RCHITECH_DB_PATH=./data/a2rchitech.db
A2RCHITECH_API_IDENTITY=api-service
A2RCHITECH_API_TENANT=default
A2RCHITECH_API_BOOTSTRAP_POLICY=true
A2RCHITECH_API_POLICY_ENFORCE=true

# -----------------------------------------------------------------------------
# SHELL UI CONFIGURATION
# -----------------------------------------------------------------------------
VITE_A2R_GATEWAY_URL=http://127.0.0.1:8013
VITE_A2R_API_VERSION=v1
VITE_ENABLE_DEBUG_LOGS=true
VITE_ENABLE_MOCK_SERVICES=false
VITE_ENABLE_SESSION_BRIDGE=false
VITE_ENABLE_VOICE_SERVICE=false
VITE_ENABLE_BROWSER_GATEWAY=false

# -----------------------------------------------------------------------------
# AI PROVIDER API KEYS (Required for AI features)
# Uncomment and fill in the keys you have:
# -----------------------------------------------------------------------------

# OpenAI (GPT-4, GPT-3.5, DALL-E, etc.)
# OPENAI_API_KEY=sk-...

# Anthropic (Claude)
# ANTHROPIC_API_KEY=sk-ant-...

# Google (Gemini)
# GOOGLE_API_KEY=...

# Mistral
# MISTRAL_API_KEY=...

# Groq (fast inference)
# GROQ_API_KEY=...

# DeepSeek
# DEEPSEEK_API_KEY=...

# Azure OpenAI (optional)
# AZURE_OPENAI_API_KEY=...
# AZURE_OPENAI_ENDPOINT=https://...

# Cohere (optional)
# COHERE_API_KEY=...

# -----------------------------------------------------------------------------
# CHROME STREAMING GATEWAY (Optional - requires Docker)
# -----------------------------------------------------------------------------
TURN_SECRET=change-this-secret-in-production
TURN_REALM=a2r.io
A2R_SESSION_ID=
A2R_TENANT_ID=
A2R_RESOLUTION=1920x1080
A2R_EXTENSION_MODE=managed
A2R_DISABLE_BACKGROUND_THROTTLING=false

# -----------------------------------------------------------------------------
# SERVICE PORTS (Change if you have conflicts)
# -----------------------------------------------------------------------------
A2R_API_PORT=3010
A2R_SHELL_UI_PORT=5177
A2R_TERMINAL_PORT=3000
A2R_VOICE_PORT=8001
A2R_WEBVM_PORT=8002
A2R_GATEWAY_PORT=8013
A2R_KERNEL_PORT=3004
A2R_MEMORY_PORT=3200
A2R_REGISTRY_PORT=8080

# -----------------------------------------------------------------------------
# OLLAMA (Local LLM - Optional)
# -----------------------------------------------------------------------------
OLLAMA_BASE_URL=http://127.0.0.1:11434

# -----------------------------------------------------------------------------
# GATEWAY AUTH (Optional)
# -----------------------------------------------------------------------------
# A2R_GATEWAY_TOKEN=
# A2R_GATEWAY_PASSWORD=
EOF
        print_success "Created .env file"
    else
        print_warning ".env file already exists"
    fi
    
    # Create data directories
    mkdir -p "$A2R_DIR/data"
    mkdir -p "$LOG_DIR"
    mkdir -p "$A2R_DIR/recordings"
    
    print_success "Environment files created"
}

# =============================================================================
# SETUP AI PROVIDER KEYS
# =============================================================================

setup_api_keys() {
    print_section "AI PROVIDER API KEYS"
    
    print_info "The platform works best with AI provider API keys."
    print_info "You can add them to $A2R_DIR/.env now or later."
    
    read -p "Would you like to configure API keys now? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        local env_file="$A2R_DIR/.env"
        
        # OpenAI
        read -p "OpenAI API Key (press Enter to skip): " openai_key
        if [ -n "$openai_key" ]; then
            sed -i.bak "s/# OPENAI_API_KEY=.*/OPENAI_API_KEY=$openai_key/" "$env_file" 2>/dev/null || \
            sed -i "s/# OPENAI_API_KEY=.*/OPENAI_API_KEY=$openai_key/" "$env_file"
        fi
        
        # Anthropic
        read -p "Anthropic API Key (press Enter to skip): " anthropic_key
        if [ -n "$anthropic_key" ]; then
            sed -i.bak "s/# ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$anthropic_key/" "$env_file" 2>/dev/null || \
            sed -i "s/# ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$anthropic_key/" "$env_file"
        fi
        
        # Google
        read -p "Google API Key (press Enter to skip): " google_key
        if [ -n "$google_key" ]; then
            sed -i.bak "s/# GOOGLE_API_KEY=.*/GOOGLE_API_KEY=$google_key/" "$env_file" 2>/dev/null || \
            sed -i "s/# GOOGLE_API_KEY=.*/GOOGLE_API_KEY=$google_key/" "$env_file"
        fi
        
        # Mistral
        read -p "Mistral API Key (press Enter to skip): " mistral_key
        if [ -n "$mistral_key" ]; then
            sed -i.bak "s/# MISTRAL_API_KEY=.*/MISTRAL_API_KEY=$mistral_key/" "$env_file" 2>/dev/null || \
            sed -i "s/# MISTRAL_API_KEY=.*/MISTRAL_API_KEY=$mistral_key/" "$env_file"
        fi
        
        # Groq
        read -p "Groq API Key (press Enter to skip): " groq_key
        if [ -n "$groq_key" ]; then
            sed -i.bak "s/# GROQ_API_KEY=.*/GROQ_API_KEY=$groq_key/" "$env_file" 2>/dev/null || \
            sed -i "s/# GROQ_API_KEY=.*/GROQ_API_KEY=$groq_key/" "$env_file"
        fi
        
        rm -f "$env_file.bak"
        print_success "API keys configured"
    fi
}

# =============================================================================
# CHECK PORT AVAILABILITY
# =============================================================================

check_ports() {
    print_section "CHECKING PORT AVAILABILITY"
    
    local occupied_ports=()
    
    for port in "${A2R_PORTS[@]}"; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            occupied_ports+=($port)
        fi
    done
    
    if [ ${#occupied_ports[@]} -eq 0 ]; then
        print_success "All required ports are available"
    else
        print_warning "The following ports are already in use: ${occupied_ports[*]}"
        print_info "You may need to stop existing services or change ports in .env"
    fi
}

# =============================================================================
# CREATE STARTUP SCRIPT
# =============================================================================

create_startup_script() {
    print_section "CREATING STARTUP SCRIPT"
    
    cat > "$A2R_DIR/start-dev.sh" << 'EOF'
#!/bin/bash
# =============================================================================
# A2RCHITECT PLATFORM - DEVELOPMENT STARTER
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║              A2RCHITECT PLATFORM                          ║"
    echo "║                 Development Mode                          ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }

# Cleanup function
cleanup() {
    echo ""
    print_status "Shutting down A2rchitect Platform..."
    
    # Kill processes by port
    for port in 3010 5177 8001 8002; do
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
    done
    
    # Kill electron
    pkill -f "electron.*desktop" 2>/dev/null || true
    
    print_success "Platform stopped"
}

trap cleanup EXIT INT TERM

print_header

# Check if API binary exists
if [ ! -f "./target/release/a2rchitech-api" ]; then
    print_status "Building Rust API..."
    cargo build --release --bin a2rchitech-api
fi

# Start API Server
print_status "Starting Rust API Server on port ${A2R_API_PORT:-3010}..."
./target/release/a2rchitech-api &
API_PID=$!
sleep 2

# Check if API is running
if ! kill -0 $API_PID 2>/dev/null; then
    echo "Failed to start API server. Check logs."
    exit 1
fi
print_success "API Server running (PID: $API_PID)"

# Start Electron Shell
print_status "Starting Electron Shell UI..."
cd "$SCRIPT_DIR/7-apps/shell/desktop"
export VITE_A2R_GATEWAY_URL="http://127.0.0.1:${A2R_API_PORT:-3010}"
npm run dev &
ELECTRON_PID=$!
sleep 3

print_success "Electron Shell starting..."

echo ""
echo -e "${GREEN}A2rchitect Platform is running!${NC}"
echo ""
echo "Services:"
echo "  API Server:    http://127.0.0.1:${A2R_API_PORT:-3010}"
echo "  Shell UI:      http://localhost:${A2R_SHELL_UI_PORT:-5177}"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for interrupt
wait
EOF

    chmod +x "$A2R_DIR/start-dev.sh"
    print_success "Created start-dev.sh"
}

# =============================================================================
# CREATE SERVICE MANAGER
# =============================================================================

create_service_manager() {
    cat > "$A2R_DIR/a2r.sh" << 'EOF'
#!/bin/bash
# =============================================================================
# A2RCHITECT PLATFORM - SERVICE MANAGER
# =============================================================================
# Usage: ./a2r.sh [command]
# Commands:
#   start       - Start all services
#   stop        - Stop all services
#   restart     - Restart all services
#   status      - Check service status
#   logs        - View logs
#   build       - Build all binaries
#   clean       - Clean build artifacts
#   update      - Update from git and rebuild
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs 2>/dev/null) || true
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[A2R]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }

check_service() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

cmd_start() {
    print_status "Starting A2rchitect Platform..."
    
    # Build if needed
    if [ ! -f "./target/release/a2rchitech-api" ]; then
        print_status "Building API server..."
        cargo build --release --bin a2rchitech-api
    fi
    
    # Start API
    if ! check_service "${A2R_API_PORT:-3010}"; then
n        print_status "Starting API server..."
        ./target/release/a2rchitech-api > ".logs/api.log" 2>&1 &
        sleep 2
    fi
    
    # Start Shell
    if ! check_service "${A2R_SHELL_UI_PORT:-5177}"; then
        print_status "Starting Shell UI..."
        cd "$SCRIPT_DIR/7-apps/shell/desktop"
        npm run dev > "$SCRIPT_DIR/.logs/shell.log" 2>&1 &
        cd "$SCRIPT_DIR"
    fi
    
    sleep 3
    cmd_status
}

cmd_stop() {
    print_status "Stopping services..."
    
    for port in "${A2R_API_PORT:-3010}" "${A2R_SHELL_UI_PORT:-5177}" "${A2R_VOICE_PORT:-8001}" "${A2R_WEBVM_PORT:-8002}"; do
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
    done
    
    pkill -f "electron.*desktop" 2>/dev/null || true
    pkill -f "a2rchitech-api" 2>/dev/null || true
    
    print_success "Services stopped"
}

cmd_status() {
    echo ""
    echo "A2rchitect Platform Status:"
    echo "─────────────────────────────────────"
    
    local services=(
        "API:${A2R_API_PORT:-3010}"
        "Shell UI:${A2R_SHELL_UI_PORT:-5177}"
        "Voice:${A2R_VOICE_PORT:-8001}"
        "WebVM:${A2R_WEBVM_PORT:-8002}"
    )
    
    for svc in "${services[@]}"; do
        local name=$(echo $svc | cut -d: -f1)
        local port=$(echo $svc | cut -d: -f2)
        
        if check_service "$port"; then
            print_success "$name (port $port)"
        else
            print_error "$name (port $port)"
        fi
    done
    echo ""
}

cmd_build() {
    print_status "Building A2rchitect Platform..."
    
    print_status "Building Rust workspace..."
    cargo build --release --bin a2rchitech-api
    
    print_status "Installing Node.js dependencies..."
    pnpm install
    
    print_success "Build complete"
}

cmd_clean() {
    print_status "Cleaning build artifacts..."
    cargo clean
    rm -rf node_modules
    rm -rf 7-apps/shell/desktop/node_modules
    rm -rf 7-apps/shell/web/node_modules
    rm -rf .logs/*.log
    print_success "Clean complete"
}

cmd_logs() {
    local log_file="${1:-.logs/api.log}"
    if [ -f "$log_file" ]; then
        tail -f "$log_file"
    else
        print_error "Log file not found: $log_file"
        echo "Available logs:"
        ls -la .logs/ 2>/dev/null || echo "  No logs directory"
    fi
}

cmd_update() {
    print_status "Updating A2rchitect Platform..."
    git pull
    cmd_build
    print_success "Update complete"
}

# Main command dispatcher
case "${1:-help}" in
    start|up)
        cmd_start
        ;;
    stop|down)
        cmd_stop
        ;;
    restart)
        cmd_stop
        sleep 2
        cmd_start
        ;;
    status)
        cmd_status
        ;;
    build)
        cmd_build
        ;;
    clean)
        cmd_clean
        ;;
    logs)
        cmd_logs "$2"
        ;;
    update)
        cmd_update
        ;;
    help|*)
        echo "A2rchitect Platform Service Manager"
        echo ""
        echo "Usage: ./a2r.sh [command]"
        echo ""
        echo "Commands:"
        echo "  start       Start all services"
        echo "  stop        Stop all services"
        echo "  restart     Restart all services"
        echo "  status      Check service status"
        echo "  build       Build all binaries"
        echo "  clean       Clean build artifacts"
        echo "  logs [file] View logs (default: api.log)"
        echo "  update      Update from git and rebuild"
        echo ""
        ;;
esac
EOF

    chmod +x "$A2R_DIR/a2r.sh"
    print_success "Created a2r.sh service manager"
}

# =============================================================================
# FINAL SUMMARY
# =============================================================================

print_summary() {
    print_section "SETUP COMPLETE!"
    
    echo ""
    echo -e "${GREEN}A2rchitect Platform has been successfully set up!${NC}"
    echo ""
    echo "Installation Directory: $A2R_DIR"
    echo ""
    echo "Quick Start Commands:"
    echo "  cd $A2R_DIR"
    echo "  ./a2r.sh start          # Start all services"
    echo "  ./a2r.sh status         # Check service status"
    echo "  ./a2r.sh stop           # Stop all services"
    echo "  ./start-dev.sh          # Start in dev mode with auto-reload"
    echo ""
    echo "Or use pnpm/npm commands:"
    echo "  pnpm dev                # Start development environment"
    echo "  pnpm shell              # Start Electron shell only"
    echo "  cargo run --bin a2rchitech-api  # Start API only"
    echo ""
    echo "Important Files:"
    echo "  .env                    # Environment configuration (edit this!)"
    echo "  a2r.sh                  # Service manager script"
    echo "  start-dev.sh            # Development starter"
    echo ""
    echo "Documentation:"
    echo "  README.md               # Platform overview"
    echo "  ARCHITECTURE.md         # Technical architecture"
    echo "  AGENTS.md               # Agent development guide"
    echo ""
    echo -e "${YELLOW}NOTE:${NC} Make sure to add your AI provider API keys to .env"
    echo "      The platform works best with OpenAI, Anthropic, or Groq keys."
    echo ""
    echo -e "${GREEN}Happy building with A2rchitect!${NC}"
    echo ""
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    print_header

    # Check if running on supported OS
    if [ "$OS" = "windows" ]; then
        print_error "Windows is not directly supported. Use WSL2 instead."
        exit 1
    fi

    # Run all setup steps
    check_prerequisites
    install_node
    install_rust
    install_python
    install_docker
    install_chrome_streaming  # NEW: Chrome Streaming after Docker
    clone_repository
    install_project_deps
    create_env_files
    setup_api_keys
    check_ports
    create_startup_script
    create_service_manager

    print_summary
}

# Run main if not sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
