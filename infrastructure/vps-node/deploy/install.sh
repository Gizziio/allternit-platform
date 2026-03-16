#!/bin/bash
#
# A2R Node Agent Installation Script
#
# Usage: 
#   curl -s https://a2r.io/install.sh | A2R_TOKEN=xxx bash
#   wget -qO- https://a2r.io/install.sh | A2R_TOKEN=xxx bash
#
# Environment variables:
#   A2R_TOKEN         - Required: Your node authentication token
#   A2R_NODE_ID       - Optional: Custom node ID (auto-generated if not provided)
#   A2R_CONTROL_PLANE - Optional: Control plane URL (default: wss://control.a2r.io)
#   A2R_VERSION       - Optional: Version to install (default: latest)
#   A2R_INSTALL_DIR   - Optional: Installation directory (default: /opt/a2r)
#   A2R_CONFIG_DIR    - Optional: Config directory (default: /etc/a2r)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration defaults
A2R_VERSION="${A2R_VERSION:-latest}"
A2R_INSTALL_DIR="${A2R_INSTALL_DIR:-/opt/a2r}"
A2R_CONFIG_DIR="${A2R_CONFIG_DIR:-/etc/a2r}"
A2R_SERVICE_NAME="a2r-node"
A2R_LOG_DIR="${A2R_LOG_DIR:-/var/log/a2r}"

# Track installation
INSTALL_START_TIME=$(date +%s)

#------------------------------------------------------------------------------
# Helper Functions
#------------------------------------------------------------------------------

log_info() {
    echo -e "${BLUE}→${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

print_banner() {
    echo -e "${CYAN}"
    echo "    ___    __  ______"
    echo "   /   |  /  |/  /   |  _    __"
    echo "  / /| | / /|_/ / /| | | |  / /"
    echo " / ___ |/ /  / / ___ | | | / /"
    echo "/_/  |_/_/  /_/_/  |_| |___/_/"
    echo "                      Node Agent"
    echo -e "${NC}"
    echo "Installing A2R Node Agent v${A2R_VERSION}..."
    echo ""
}

#------------------------------------------------------------------------------
# System Detection
#------------------------------------------------------------------------------

detect_arch() {
    ARCH=$(uname -m)
    case $ARCH in
        x86_64)
            A2R_ARCH="x86_64"
            ;;
        aarch64|arm64)
            A2R_ARCH="aarch64"
            ;;
        *)
            log_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
    log_info "Detected architecture: $A2R_ARCH"
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
        OS_NAME=$NAME
    elif [ "$(uname)" = "Darwin" ]; then
        OS="macos"
        OS_VERSION=$(sw_vers -productVersion)
        OS_NAME="macOS"
    else
        log_error "Cannot detect OS"
        exit 1
    fi
    log_info "Detected OS: $OS_NAME $OS_VERSION"
}

detect_init_system() {
    if [ -d /run/systemd/system ]; then
        INIT_SYSTEM="systemd"
    elif [ -d /Library/LaunchDaemons ] || [ -d /Library/LaunchAgents ]; then
        INIT_SYSTEM="launchd"
    else
        INIT_SYSTEM="unknown"
    fi
    log_info "Init system: $INIT_SYSTEM"
}

#------------------------------------------------------------------------------
# Prerequisites
#------------------------------------------------------------------------------

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run as root (use sudo)"
        echo ""
        echo "Example:"
        echo "  sudo bash $0"
        echo ""
        exit 1
    fi
}

check_token() {
    if [ -z "$A2R_TOKEN" ]; then
        log_error "A2R_TOKEN not set"
        echo ""
        echo "Get your node token from: https://app.a2r.io/settings/nodes"
        echo ""
        echo "Then run:"
        echo "  curl -s https://a2r.io/install.sh | A2R_TOKEN=your_token bash"
        echo ""
        exit 1
    fi
    log_info "Token validated"
}

check_dependencies() {
    echo ""
    log_info "Checking dependencies..."

    local missing_deps=()

    # Check curl or wget
    if command -v curl &> /dev/null; then
        DOWNLOADER="curl -fsSL"
        log_success "curl found"
    elif command -v wget &> /dev/null; then
        DOWNLOADER="wget -qO-"
        log_success "wget found"
    else
        log_error "curl or wget required"
        exit 1
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_warn "Docker not found"
        missing_deps+=("docker")
    else
        if docker info &> /dev/null; then
            log_success "Docker installed and running"
            DOCKER_VERSION=$(docker --version | cut -d' ' -f3)
            log_info "Docker version: $DOCKER_VERSION"
        else
            log_warn "Docker installed but not running"
            missing_deps+=("docker-service")
        fi
    fi

    # Install missing dependencies
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo ""
        log_warn "Missing dependencies: ${missing_deps[*]}"
        read -p "Install now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_dependencies "${missing_deps[@]}"
        else
            log_error "Cannot proceed without required dependencies"
            exit 1
        fi
    fi
}

install_dependencies() {
    for dep in "$@"; do
        case $dep in
            docker)
                log_info "Installing Docker..."
                if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
                    curl -fsSL https://get.docker.com | sh
                elif [ "$OS" = "centos" ] || [ "$OS" = "fedora" ]; then
                    dnf install -y docker
                    systemctl start docker
                elif [ "$OS" = "macos" ]; then
                    log_error "Please install Docker Desktop for macOS manually"
                    echo "https://docs.docker.com/desktop/install/mac-install/"
                    exit 1
                fi
                systemctl enable docker 2>/dev/null || true
                systemctl start docker 2>/dev/null || true
                usermod -aG docker $SUDO_USER 2>/dev/null || true
                log_success "Docker installed"
                ;;
            docker-service)
                log_info "Starting Docker service..."
                systemctl start docker 2>/dev/null || service docker start 2>/dev/null || true
                if docker info &> /dev/null; then
                    log_success "Docker started"
                else
                    log_error "Failed to start Docker"
                    exit 1
                fi
                ;;
            *)
                log_warn "Unknown dependency: $dep"
                ;;
        esac
    done
}

#------------------------------------------------------------------------------
# Binary Installation
#------------------------------------------------------------------------------

download_binary() {
    echo ""
    log_info "Downloading A2R Node Agent..."

    mkdir -p "$A2R_INSTALL_DIR/bin"

    # Determine download URL
    if [ "$A2R_VERSION" = "latest" ]; then
        DOWNLOAD_URL="https://github.com/a2r/node/releases/latest/download/a2r-node-linux-${A2R_ARCH}"
    else
        DOWNLOAD_URL="https://github.com/a2r/node/releases/download/${A2R_VERSION}/a2r-node-linux-${A2R_ARCH}"
    fi

    log_info "Downloading from: $DOWNLOAD_URL"

    if ! $DOWNLOADER "$DOWNLOAD_URL" -o "$A2R_INSTALL_DIR/bin/a2r-node" 2>/dev/null; then
        log_warn "Binary download failed, building from source..."
        build_from_source
    else
        chmod +x "$A2R_INSTALL_DIR/bin/a2r-node"
        log_success "Binary downloaded"
    fi

    # Create symlink in /usr/local/bin
    if [ -w /usr/local/bin ]; then
        ln -sf "$A2R_INSTALL_DIR/bin/a2r-node" /usr/local/bin/a2r-node
        log_success "Symlink created in /usr/local/bin"
    fi

    # Show binary info
    if [ -x "$A2R_INSTALL_DIR/bin/a2r-node" ]; then
        BINARY_SIZE=$(du -h "$A2R_INSTALL_DIR/bin/a2r-node" | cut -f1)
        log_info "Binary size: $BINARY_SIZE"
    fi
}

build_from_source() {
    log_info "Building from source..."

    # Check for Rust
    if ! command -v cargo &> /dev/null; then
        log_info "Installing Rust..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        if [ -f "$HOME/.cargo/env" ]; then
            source "$HOME/.cargo/env"
        fi
    fi

    # Clone repository
    TEMP_DIR=$(mktemp -d)
    log_info "Cloning repository to $TEMP_DIR..."
    
    if ! git clone --depth 1 https://github.com/a2r/node.git "$TEMP_DIR" 2>/dev/null; then
        log_error "Failed to clone repository"
        rm -rf "$TEMP_DIR"
        exit 1
    fi

    # Build
    cd "$TEMP_DIR"
    log_info "Building release binary..."
    cargo build --release

    # Install
    cp target/release/a2r-node "$A2R_INSTALL_DIR/bin/"
    chmod +x "$A2R_INSTALL_DIR/bin/a2r-node"

    # Cleanup
    rm -rf "$TEMP_DIR"
    cd - > /dev/null

    log_success "Built from source"
}

#------------------------------------------------------------------------------
# Configuration
#------------------------------------------------------------------------------

setup_config() {
    echo ""
    log_info "Setting up configuration..."

    mkdir -p "$A2R_CONFIG_DIR"
    mkdir -p "$A2R_LOG_DIR"

    # Generate node ID if not provided
    if [ -z "$A2R_NODE_ID" ]; then
        A2R_NODE_ID="node-$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 12 | head -n 1)"
        log_info "Generated node ID: $A2R_NODE_ID"
    fi

    # Set default control plane if not provided
    A2R_CONTROL_PLANE="${A2R_CONTROL_PLANE:-wss://control.a2r.io}"

    # Create config file
    cat > "$A2R_CONFIG_DIR/node.env" << EOF
# A2R Node Agent Configuration
# Generated: $(date -Iseconds)

# Node identification
A2R_NODE_ID=$A2R_NODE_ID
A2R_TOKEN=$A2R_TOKEN

# Control plane connection
A2R_CONTROL_PLANE=$A2R_CONTROL_PLANE

# Optional settings
# A2R_LABELS=gpu,high-memory
# A2R_MAX_CONCURRENT_JOBS=10
# A2R_LOG_LEVEL=info
EOF

    # Secure the config file
    chmod 600 "$A2R_CONFIG_DIR/node.env"
    chown root:root "$A2R_CONFIG_DIR/node.env"

    log_success "Configuration saved to $A2R_CONFIG_DIR/node.env"
    log_info "Node ID: $A2R_NODE_ID"
}

#------------------------------------------------------------------------------
# Service Installation
#------------------------------------------------------------------------------

install_systemd_service() {
    echo ""
    log_info "Installing systemd service..."

    # Get the script directory to find the service file
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SERVICE_FILE="$SCRIPT_DIR/services/a2r-node.service"

    # Check if service file exists, otherwise create it
    if [ -f "$SERVICE_FILE" ]; then
        cp "$SERVICE_FILE" "/etc/systemd/system/$A2R_SERVICE_NAME.service"
    else
        # Create service file inline
        cat > "/etc/systemd/system/$A2R_SERVICE_NAME.service" << 'EOF'
[Unit]
Description=A2R Node Agent
Documentation=https://docs.a2r.io
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
EnvironmentFile=/etc/a2r/node.env
ExecStart=/opt/a2r/bin/a2r-node
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=a2r-node

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=true

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF
    fi

    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable "$A2R_SERVICE_NAME"

    log_success "Systemd service installed and enabled"
}

install_launchd_service() {
    echo ""
    log_info "Installing launchd service..."

    LAUNCHD_PLIST="/Library/LaunchDaemons/io.a2r.node.plist"

    cat > "$LAUNCHD_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>io.a2r.node</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/opt/a2r/bin/a2r-node</string>
    </array>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>/var/log/a2r/node.log</string>
    
    <key>StandardErrorPath</key>
    <string>/var/log/a2r/node.err</string>
</dict>
</plist>
EOF

    # Set permissions
    chmod 644 "$LAUNCHD_PLIST"
    chown root:wheel "$LAUNCHD_PLIST"

    # Load the service
    launchctl load -w "$LAUNCHD_PLIST"

    log_success "Launchd service installed"
}

#------------------------------------------------------------------------------
# Service Management
#------------------------------------------------------------------------------

start_service() {
    echo ""
    log_info "Starting A2R Node Agent..."

    case $INIT_SYSTEM in
        systemd)
            systemctl start "$A2R_SERVICE_NAME"
            sleep 2
            
            if systemctl is-active --quiet "$A2R_SERVICE_NAME"; then
                log_success "A2R Node Agent is running"
            else
                log_error "Failed to start service"
                echo ""
                echo "Check logs with:"
                echo "  sudo journalctl -u $A2R_SERVICE_NAME -n 50"
                exit 1
            fi
            ;;
        launchd)
            launchctl kickstart -k system/io.a2r.node
            sleep 2
            
            if launchctl list | grep -q "io.a2r.node"; then
                log_success "A2R Node Agent is running"
            else
                log_error "Failed to start service"
                exit 1
            fi
            ;;
        *)
            log_warn "Unknown init system, starting manually..."
            "$A2R_INSTALL_DIR/bin/a2r-node" &
            log_success "A2R Node Agent started in background"
            ;;
    esac
}

#------------------------------------------------------------------------------
# Verification
#------------------------------------------------------------------------------

verify_installation() {
    echo ""
    log_info "Verifying installation..."

    local errors=0

    # Check binary
    if [ -x "$A2R_INSTALL_DIR/bin/a2r-node" ]; then
        log_success "Binary installed"
    else
        log_error "Binary not found"
        ((errors++))
    fi

    # Check config
    if [ -f "$A2R_CONFIG_DIR/node.env" ]; then
        log_success "Configuration file exists"
    else
        log_error "Configuration file not found"
        ((errors++))
    fi

    # Check service
    case $INIT_SYSTEM in
        systemd)
            if [ -f "/etc/systemd/system/$A2R_SERVICE_NAME.service" ]; then
                log_success "Systemd service installed"
            else
                log_error "Systemd service not found"
                ((errors++))
            fi
            ;;
        launchd)
            if [ -f "/Library/LaunchDaemons/io.a2r.node.plist" ]; then
                log_success "Launchd service installed"
            else
                log_error "Launchd service not found"
                ((errors++))
            fi
            ;;
    esac

    # Check Docker connectivity
    if docker info &> /dev/null; then
        log_success "Docker accessible"
    else
        log_warn "Docker not accessible"
        ((errors++))
    fi

    return $errors
}

#------------------------------------------------------------------------------
# Output
#------------------------------------------------------------------------------

print_summary() {
    local install_end_time=$(date +%s)
    local install_duration=$((install_end_time - INSTALL_START_TIME))

    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${GREEN}✓ Installation Complete!${NC}"
    echo ""
    echo "Node Details:"
    echo "  ┌─────────────────────────────────────────┐"
    echo "  │ Node ID:      $A2R_NODE_ID"
    echo "  │ Version:      $A2R_VERSION"
    echo "  │ Architecture: $A2R_ARCH"
    echo "  │ OS:           $OS $OS_VERSION"
    echo "  └─────────────────────────────────────────┘"
    echo ""
    echo "Installation Paths:"
    echo "  ┌─────────────────────────────────────────┐"
    printf "  │ %-14s %s\n" "Binary:" "$A2R_INSTALL_DIR/bin/a2r-node"
    printf "  │ %-14s %s\n" "Config:" "$A2R_CONFIG_DIR/node.env"
    printf "  │ %-14s %s\n" "Logs:" "$A2R_LOG_DIR"
    printf "  │ %-14s %s\n" "Service:" "$A2R_SERVICE_NAME"
    echo "  └─────────────────────────────────────────┘"
    echo ""
    echo "Useful Commands:"
    echo "  ┌─────────────────────────────────────────┐"
    
    case $INIT_SYSTEM in
        systemd)
            echo "  │ # Check status"
            echo "  │ sudo systemctl status $A2R_SERVICE_NAME"
            echo "  │"
            echo "  │ # View logs"
            echo "  │ sudo journalctl -u $A2R_SERVICE_NAME -f"
            echo "  │"
            echo "  │ # Restart service"
            echo "  │ sudo systemctl restart $A2R_SERVICE_NAME"
            ;;
        launchd)
            echo "  │ # Check status"
            echo "  │ launchctl list | grep a2r"
            echo "  │"
            echo "  │ # View logs"
            echo "  │ tail -f /var/log/a2r/node.log"
            echo "  │"
            echo "  │ # Restart service"
            echo "  │ sudo launchctl kickstart -k system/io.a2r.node"
            ;;
    esac
    
    echo "  │"
    echo "  │ # Check version"
    echo "  │ a2r-node --version"
    echo "  └─────────────────────────────────────────┘"
    echo ""
    echo "Next Steps:"
    echo "  1. Visit https://app.a2r.io to see your node"
    echo "  2. Node should appear online within 30 seconds"
    echo "  3. Start deploying agents and running jobs"
    echo ""
    echo "Support:"
    echo "  Documentation: https://docs.a2r.io"
    echo "  Discord:       https://discord.gg/a2r"
    echo "  GitHub:        https://github.com/a2r/node"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Installation completed in ${install_duration}s"
    echo ""
}

print_troubleshooting() {
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo ""
    echo "If your node doesn't appear online:"
    echo ""
    echo "1. Check service status:"
    case $INIT_SYSTEM in
        systemd)
            echo "   sudo systemctl status $A2R_SERVICE_NAME"
            ;;
        launchd)
            echo "   launchctl list | grep a2r"
            ;;
    esac
    echo ""
    echo "2. Check logs:"
    case $INIT_SYSTEM in
        systemd)
            echo "   sudo journalctl -u $A2R_SERVICE_NAME -n 50"
            ;;
        launchd)
            echo "   tail -f /var/log/a2r/node.log"
            ;;
    esac
    echo ""
    echo "3. Verify Docker is running:"
    echo "   docker ps"
    echo ""
    echo "4. Test connection to control plane:"
    echo "   curl -I $A2R_CONTROL_PLANE"
    echo ""
    echo "5. Check firewall settings:"
    echo "   Outbound WebSocket (WSS) on port 443 must be allowed"
    echo ""
}

#------------------------------------------------------------------------------
# Cleanup
#------------------------------------------------------------------------------

cleanup() {
    # Remove any temporary files
    rm -f /tmp/a2r-node-* 2>/dev/null || true
}

#------------------------------------------------------------------------------
# Main
#------------------------------------------------------------------------------

main() {
    print_banner
    check_root
    check_token
    detect_arch
    detect_os
    detect_init_system
    check_dependencies
    download_binary
    setup_config
    
    # Install service based on init system
    case $INIT_SYSTEM in
        systemd)
            install_systemd_service
            ;;
        launchd)
            install_launchd_service
            ;;
        *)
            log_warn "Unknown init system, skipping service installation"
            ;;
    esac
    
    start_service
    
    if verify_installation; then
        print_summary
    else
        log_error "Installation completed with errors"
        print_troubleshooting
        exit 1
    fi
    
    cleanup
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "A2R Node Agent Installation Script"
        echo ""
        echo "Usage:"
        echo "  $0                    # Run installation"
        echo "  $0 --help             # Show this help"
        echo "  $0 --uninstall        # Remove installation"
        echo ""
        echo "Environment Variables:"
        echo "  A2R_TOKEN         Your node authentication token (required)"
        echo "  A2R_NODE_ID       Custom node ID (optional, auto-generated)"
        echo "  A2R_CONTROL_PLANE Control plane URL (default: wss://control.a2r.io)"
        echo "  A2R_VERSION       Version to install (default: latest)"
        echo "  A2R_INSTALL_DIR   Installation directory (default: /opt/a2r)"
        echo "  A2R_CONFIG_DIR    Config directory (default: /etc/a2r)"
        echo ""
        exit 0
        ;;
    --uninstall)
        echo "Uninstalling A2R Node Agent..."
        case $INIT_SYSTEM in
            systemd)
                systemctl stop "$A2R_SERVICE_NAME" 2>/dev/null || true
                systemctl disable "$A2R_SERVICE_NAME" 2>/dev/null || true
                rm -f "/etc/systemd/system/$A2R_SERVICE_NAME.service"
                systemctl daemon-reload
                ;;
            launchd)
                launchctl unload -w "/Library/LaunchDaemons/io.a2r.node.plist" 2>/dev/null || true
                rm -f "/Library/LaunchDaemons/io.a2r.node.plist"
                ;;
        esac
        rm -rf "$A2R_INSTALL_DIR"
        rm -rf "$A2R_CONFIG_DIR"
        rm -f /usr/local/bin/a2r-node
        echo "Uninstallation complete"
        exit 0
        ;;
    *)
        main
        ;;
esac
