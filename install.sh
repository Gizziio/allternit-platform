#!/bin/bash
#
# A2R System Installer
# Sets up the complete A2R stack: Cloud Backend, Desktop, Extension, and Thin Client
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="${INSTALL_DIR:-$HOME/.a2r}"
CONFIG_DIR="${CONFIG_DIR:-$HOME/.config/a2r}"
LOG_DIR="${LOG_DIR:-$HOME/.logs/a2r}"
CLOUD_PORT=8080
DESKTOP_PORT=3010
NATIVE_PORT=3011

# Detect OS
OS="unknown"
ARCH="$(uname -m)"
case "$(uname -s)" in
    Linux*)     OS="linux";;
    Darwin*)    OS="macos";;
    CYGWIN*|MINGW*|MSYS*) OS="windows";;
esac

print_header() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║          A2R System Installer                             ║"
    echo "║  Cloud-Native Computer Use Architecture                   ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js 18+ required. Found: $(node -v)"
        exit 1
    fi
    print_success "Node.js $(node -v)"
    
    # Check npm/pnpm
    if command -v pnpm &> /dev/null; then
        PKG_MANAGER="pnpm"
        print_success "Package manager: pnpm"
    elif command -v npm &> /dev/null; then
        PKG_MANAGER="npm"
        print_success "Package manager: npm"
    else
        print_error "No package manager found (npm or pnpm)"
        exit 1
    fi
    
    # Check Chrome (for extension)
    CHROME_FOUND=false
    if [ "$OS" = "macos" ]; then
        if [ -d "/Applications/Google Chrome.app" ] || [ -d "$HOME/Applications/Google Chrome.app" ]; then
            CHROME_FOUND=true
        fi
    elif [ "$OS" = "linux" ]; then
        if command -v google-chrome &> /dev/null || command -v chromium &> /dev/null; then
            CHROME_FOUND=true
        fi
    fi
    
    if [ "$CHROME_FOUND" = true ]; then
        print_success "Google Chrome detected"
    else
        print_warning "Google Chrome not detected. Extension will need manual installation."
    fi
    
    print_success "Prerequisites check complete"
}

# Create directories
setup_directories() {
    print_info "Creating directories..."
    
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$CONFIG_DIR/chrome-extension"
    
    print_success "Directories created in $INSTALL_DIR"
}

# Install Cloud Backend
install_cloud_backend() {
    print_info "Installing Cloud Backend..."
    
    cd "7-apps/cloud-backend"
    
    # Install dependencies
    if [ "$PKG_MANAGER" = "pnpm" ]; then
        pnpm install
    else
        npm install
    fi
    
    # Build
    npm run build
    
    # Create systemd service file (Linux only)
    if [ "$OS" = "linux" ]; then
        create_cloud_service
    fi
    
    cd ../..
    print_success "Cloud Backend installed"
}

# Create systemd service for cloud backend (Linux)
create_cloud_service() {
    cat > "$INSTALL_DIR/a2r-cloud.service" << EOF
[Unit]
Description=A2R Cloud Backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PWD
ExecStart=$(which node) $PWD/dist/index.js
Restart=always
RestartSec=10
Environment=PORT=$CLOUD_PORT
Environment=HOST=0.0.0.0

[Install]
WantedBy=multi-user.target
EOF
    print_info "Systemd service created at $INSTALL_DIR/a2r-cloud.service"
    print_info "To enable: sudo cp $INSTALL_DIR/a2r-cloud.service /etc/systemd/system/"
}

# Install Desktop App
install_desktop() {
    print_info "Installing A2R Desktop..."
    
    cd "7-apps/shell/desktop"
    
    # Install dependencies
    if [ "$PKG_MANAGER" = "pnpm" ]; then
        pnpm install
    else
        npm install
    fi
    
    # Build native host
    cd native-host
    if [ "$PKG_MANAGER" = "pnpm" ]; then
        pnpm install
    else
        npm install
    fi
    cd ..
    
    cd ../../..
    print_success "A2R Desktop installed"
}

# Register native messaging host
register_native_host() {
    print_info "Registering Native Messaging Host..."
    
    NATIVE_HOST_DIR="7-apps/shell/desktop/native-host"
    EXTENSION_ID="com.a2r.desktop"
    
    if [ "$OS" = "macos" ]; then
        # macOS Chrome native messaging location
        NATIVE_PATH="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
        mkdir -p "$NATIVE_PATH"
        
        cat > "$NATIVE_PATH/$EXTENSION_ID.json" << EOF
{
  "name": "$EXTENSION_ID",
  "description": "A2R Desktop Native Messaging Host",
  "path": "$PWD/$NATIVE_HOST_DIR/dist/native-host.js",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://*/"
  ]
}
EOF
        
    elif [ "$OS" = "linux" ]; then
        # Linux Chrome native messaging location
        NATIVE_PATH="$HOME/.config/google-chrome/NativeMessagingHosts"
        mkdir -p "$NATIVE_PATH"
        
        cat > "$NATIVE_PATH/$EXTENSION_ID.json" << EOF
{
  "name": "$EXTENSION_ID",
  "description": "A2R Desktop Native Messaging Host",
  "path": "$PWD/$NATIVE_HOST_DIR/dist/native-host.js",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://*/"
  ]
}
EOF
    fi
    
    # Make native host executable
    chmod +x "$NATIVE_HOST_DIR/native-host.ts"
    
    print_success "Native Messaging Host registered"
}

# Install Chrome Extension
install_extension() {
    print_info "Installing Chrome Extension..."
    
    cd "7-apps/chrome-extension"
    
    # Install dependencies
    if [ "$PKG_MANAGER" = "pnpm" ]; then
        pnpm install
    else
        npm install
    fi
    
    # Build extension
    npm run build
    
    # Copy to install directory
    cp -r dist "$CONFIG_DIR/chrome-extension/"
    
    cd ../..
    print_success "Chrome Extension built and copied"
    
    print_info "To load the extension:"
    print_info "  1. Open Chrome → chrome://extensions"
    print_info "  2. Enable 'Developer mode'"
    print_info "  3. Click 'Load unpacked'"
    print_info "  4. Select: $CONFIG_DIR/chrome-extension"
}

# Install Thin Client
install_thin_client() {
    print_info "Installing Thin Client..."
    
    cd "7-apps/thin-client"
    
    # Install dependencies
    if [ "$PKG_MANAGER" = "pnpm" ]; then
        pnpm install
    else
        npm install
    fi
    
    # Build
    npm run build
    
    cd ../..
    
    # Copy pre-built packages if available
    if [ "$OS" = "macos" ]; then
        if [ "$ARCH" = "arm64" ]; then
            PKG_PATTERN="*-arm64.dmg"
        else
            PKG_PATTERN="*-x64.dmg"
        fi
        
        if ls 7-apps/thin-client/release/$PKG_PATTERN 1> /dev/null 2>&1; then
            cp 7-apps/thin-client/release/$PKG_PATTERN "$INSTALL_DIR/"
            print_success "Thin Client package copied to $INSTALL_DIR"
        fi
    fi
    
    print_success "Thin Client installed"
}

# Create launcher scripts
create_launchers() {
    print_info "Creating launcher scripts..."
    
    # Cloud Backend launcher
    cat > "$INSTALL_DIR/start-cloud.sh" << 'EOF'
#!/bin/bash
# Start A2R Cloud Backend

CLOUD_DIR="$(dirname "$0")/../7-apps/cloud-backend"
cd "$CLOUD_DIR"

export PORT=8080
export HOST=0.0.0.0

echo "Starting A2R Cloud Backend on port $PORT..."
node dist/index.js
EOF
    chmod +x "$INSTALL_DIR/start-cloud.sh"
    
    # Desktop launcher
    cat > "$INSTALL_DIR/start-desktop.sh" << 'EOF'
#!/bin/bash
# Start A2R Desktop

DESKTOP_DIR="$(dirname "$0")/../7-apps/shell/desktop"
cd "$DESKTOP_DIR"

echo "Starting A2R Desktop..."
npm run dev
EOF
    chmod +x "$INSTALL_DIR/start-desktop.sh"
    
    # Thin Client launcher
    cat > "$INSTALL_DIR/start-thin-client.sh" << 'EOF'
#!/bin/bash
# Start A2R Thin Client

THIN_CLIENT_DIR="$(dirname "$0")/../7-apps/thin-client"
cd "$THIN_CLIENT_DIR"

echo "Starting A2R Thin Client..."
npm start
EOF
    chmod +x "$INSTALL_DIR/start-thin-client.sh"
    
    # Full stack launcher
    cat > "$INSTALL_DIR/start-all.sh" << 'EOF'
#!/bin/bash
# Start all A2R components

SCRIPT_DIR="$(dirname "$0")"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          Starting A2R System                              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Start Cloud Backend
echo "[1/3] Starting Cloud Backend..."
$SCRIPT_DIR/start-cloud.sh &
CLOUD_PID=$!
sleep 2

# Start Desktop
echo "[2/3] Starting Desktop..."
$SCRIPT_DIR/start-desktop.sh &
DESKTOP_PID=$!
sleep 3

# Start Thin Client
echo "[3/3] Starting Thin Client..."
$SCRIPT_DIR/start-thin-client.sh &
THIN_PID=$!

echo ""
echo "All components started!"
echo "  - Cloud Backend PID: $CLOUD_PID"
echo "  - Desktop PID: $DESKTOP_PID"
echo "  - Thin Client PID: $THIN_PID"
echo ""
echo "Press Ctrl+C to stop all components"
echo ""

# Wait for all processes
wait
EOF
    chmod +x "$INSTALL_DIR/start-all.sh"
    
    print_success "Launcher scripts created in $INSTALL_DIR"
}

# Create configuration file
create_config() {
    print_info "Creating configuration..."
    
    cat > "$CONFIG_DIR/config.json" << EOF
{
  "version": "1.0.0",
  "installed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "components": {
    "cloud_backend": {
      "enabled": true,
      "port": $CLOUD_PORT,
      "host": "0.0.0.0"
    },
    "desktop": {
      "enabled": true,
      "port": $DESKTOP_PORT,
      "cowork_enabled": true
    },
    "thin_client": {
      "backend": "cloud",
      "cloud_url": "ws://localhost:$CLOUD_PORT/ws/extension",
      "desktop_port": $DESKTOP_PORT
    },
    "extension": {
      "mode": "cloud",
      "cloud_url": "ws://localhost:$CLOUD_PORT/ws/extension",
      "desktop_native_port": $NATIVE_PORT
    }
  }
}
EOF
    
    print_success "Configuration saved to $CONFIG_DIR/config.json"
}

# Print summary
print_summary() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          Installation Complete!                           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Installation directory: $INSTALL_DIR"
    echo "Configuration: $CONFIG_DIR"
    echo "Logs: $LOG_DIR"
    echo ""
    echo "Quick Start:"
    echo "  1. Start Cloud Backend:  $INSTALL_DIR/start-cloud.sh"
    echo "  2. Start Desktop:         $INSTALL_DIR/start-desktop.sh"
    echo "  3. Load Chrome Extension: chrome://extensions → Load unpacked"
    echo "     Location: $CONFIG_DIR/chrome-extension"
    echo "  4. Start Thin Client:     $INSTALL_DIR/start-thin-client.sh"
    echo ""
    echo "Or start everything at once:"
    echo "  $INSTALL_DIR/start-all.sh"
    echo ""
    echo "Ports:"
    echo "  - Cloud Backend:    $CLOUD_PORT"
    echo "  - Desktop Cowork:   $DESKTOP_PORT"
    echo "  - Native Messaging: $NATIVE_PORT"
    echo ""
    print_warning "Don't forget to load the Chrome Extension!"
    echo ""
}

# Main installation
main() {
    print_header
    
    # Check if running from correct directory
    if [ ! -d "7-apps" ]; then
        print_error "Please run this script from the project root directory"
        print_info "Expected: 7-apps/ directory should be present"
        exit 1
    fi
    
    check_prerequisites
    setup_directories
    install_cloud_backend
    install_desktop
    register_native_host
    install_extension
    install_thin_client
    create_launchers
    create_config
    
    print_summary
}

# Run main function
main "$@"
