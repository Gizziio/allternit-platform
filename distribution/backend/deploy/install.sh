#!/bin/bash
#
# A2R Backend Installer
# Self-hosted A2R platform - Native binary installation (NO Docker)
#
# Usage: 
#   curl -s https://install.a2r.io/backend | sudo bash
#
# Environment variables:
#   A2R_VERSION       - Version to install (default: latest)
#   A2R_INSTALL_DIR   - Installation directory (default: /opt/a2r)
#   A2R_CONFIG_DIR    - Config directory (default: /etc/a2r)
#   A2R_DATA_DIR      - Data directory (default: /var/lib/a2r)
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
A2R_DATA_DIR="${A2R_DATA_DIR:-/var/lib/a2r}"
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
    echo "    _    ____  ____  "
    echo "   / \\  |  _ \\|  _ \\ "
    echo "  / _ \\ | |_) | |_) |"
    echo " / ___ \\|  _ <|  __/ "
    echo "/_/   \\_\\_| \\_\\_|    "
    echo -e "${NC}"
    echo "Backend Server Installer"
    echo "======================="
    echo ""
    echo "Self-hosted A2R platform - native binary installation"
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
    log_info "Architecture: $A2R_ARCH"
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
    log_info "OS: $OS_NAME $OS_VERSION"
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
        echo "  curl -s https://install.a2r.io/backend | sudo bash"
        echo ""
        exit 1
    fi
}

check_dependencies() {
    echo ""
    log_info "Checking dependencies..."

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
}

#------------------------------------------------------------------------------
# Binary Installation
#------------------------------------------------------------------------------

download_binaries() {
    echo ""
    log_info "Downloading A2R Backend..."

    mkdir -p "$A2R_INSTALL_DIR/bin"

    # Determine download URL
    if [ "$A2R_VERSION" = "latest" ]; then
        BASE_URL="https://github.com/a2r/backend/releases/latest/download"
    else
        BASE_URL="https://github.com/a2r/backend/releases/download/${A2R_VERSION}"
    fi

    # Download each binary
    BINARIES=("a2r-api" "a2r-kernel" "a2r-memory" "a2r-workspace" "a2r-web")
    
    for binary in "${BINARIES[@]}"; do
        download_binary "$binary"
    done

    # Create symlinks
    if [ -w /usr/local/bin ]; then
        for binary in "${BINARIES[@]}"; do
            ln -sf "$A2R_INSTALL_DIR/bin/$binary" /usr/local/bin/$binary 2>/dev/null || true
        done
        log_success "Symlinks created in /usr/local/bin"
    fi
}

download_binary() {
    local binary=$1
    local download_url="$BASE_URL/${binary}-linux-${A2R_ARCH}"
    local output_path="$A2R_INSTALL_DIR/bin/$binary"

    log_info "Downloading: $binary"

    if ! $DOWNLOADER "$download_url" -o "$output_path" 2>/dev/null; then
        log_warn "Download failed for $binary"
        return 1
    fi

    chmod +x "$output_path"
    local size=$(du -h "$output_path" | cut -f1)
    log_success "$binary downloaded ($size)"
}

#------------------------------------------------------------------------------
# Configuration
#------------------------------------------------------------------------------

setup_config() {
    echo ""
    log_info "Setting up configuration..."

    mkdir -p "$A2R_CONFIG_DIR"
    mkdir -p "$A2R_DATA_DIR"
    mkdir -p "$A2R_LOG_DIR"

    # Generate secrets
    local jwt_secret=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
    local api_key=$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | xxd -p)

    # Create main config
    cat > "$A2R_CONFIG_DIR/backend.yaml" << EOF
# A2R Backend Configuration
# Generated: $(date -Iseconds)

server:
  host: 0.0.0.0
  port: 4096

api:
  cors_origins:
    - "http://localhost:3000"
    - "http://localhost:3001"
    - "http://localhost:5173"
    - "https://*.a2r.dev"

# Security
security:
  jwt_secret: "$jwt_secret"
  api_key: "$api_key"
  session_timeout: 1440

# Database (SQLite default)
database:
  type: sqlite
  path: $A2R_DATA_DIR/a2r.db

# Storage
storage:
  data_dir: $A2R_DATA_DIR
  logs_dir: $A2R_LOG_DIR

# Services
services:
  kernel:
    enabled: true
    port: 3004
  memory:
    enabled: true
    port: 3200
  workspace:
    enabled: true
    port: 3021
  web_ui:
    enabled: true
    port: 3001

# Logging
logging:
  level: info
  format: json
  file: $A2R_LOG_DIR/a2r.log
EOF

    chmod 640 "$A2R_CONFIG_DIR/backend.yaml"
    log_success "Config: $A2R_CONFIG_DIR/backend.yaml"
}

#------------------------------------------------------------------------------
# Service Installation
#------------------------------------------------------------------------------

install_systemd_services() {
    echo ""
    log_info "Installing systemd services..."

    # Main API service
    cat > /etc/systemd/system/a2r-api.service << EOF
[Unit]
Description=A2R Backend API Server
Documentation=https://docs.a2r.io
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=a2r
Group=a2r
WorkingDirectory=$A2R_INSTALL_DIR
ExecStart=$A2R_INSTALL_DIR/bin/a2r-api
ExecReload=/bin/kill -HUP \$MAINPID
Environment=A2R_CONFIG=$A2R_CONFIG_DIR/backend.yaml
Environment=RUST_LOG=info

Restart=always
RestartSec=5
TimeoutStartSec=30
TimeoutStopSec=30

StandardOutput=journal
StandardError=journal
SyslogIdentifier=a2r-api

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$A2R_DATA_DIR $A2R_LOG_DIR

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

    # Kernel service
    cat > /etc/systemd/system/a2r-kernel.service << EOF
[Unit]
Description=A2R Kernel Service
Documentation=https://docs.a2r.io
After=network.target a2r-api.service

[Service]
Type=simple
User=a2r
Group=a2r
WorkingDirectory=$A2R_INSTALL_DIR
ExecStart=$A2R_INSTALL_DIR/bin/a2r-kernel
Environment=A2R_CONFIG=$A2R_CONFIG_DIR/backend.yaml
Environment=RUST_LOG=info

Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Memory service
    cat > /etc/systemd/system/a2r-memory.service << EOF
[Unit]
Description=A2R Memory Service
Documentation=https://docs.a2r.io
After=network.target a2r-api.service

[Service]
Type=simple
User=a2r
Group=a2r
WorkingDirectory=$A2R_INSTALL_DIR
ExecStart=$A2R_INSTALL_DIR/bin/a2r-memory
Environment=A2R_CONFIG=$A2R_CONFIG_DIR/backend.yaml
Environment=RUST_LOG=info

Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Web UI service
    cat > /etc/systemd/system/a2r-web.service << EOF
[Unit]
Description=A2R Web UI
Documentation=https://docs.a2r.io
After=network.target a2r-api.service

[Service]
Type=simple
User=a2r
Group=a2r
WorkingDirectory=$A2R_INSTALL_DIR/web
ExecStart=$A2R_INSTALL_DIR/bin/a2r-web
Environment=NODE_ENV=production
Environment=PORT=3001

Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Reload and enable
    systemctl daemon-reload
    systemctl enable a2r-api
    systemctl enable a2r-kernel
    systemctl enable a2r-memory
    systemctl enable a2r-web

    log_success "Systemd services installed"
}

install_launchd_services() {
    echo ""
    log_info "Installing launchd services..."

    # Create launchd plist for API
    cat > /Library/LaunchDaemons/io.a2r.backend.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>io.a2r.backend</string>
    <key>ProgramArguments</key>
    <array>
        <string>$A2R_INSTALL_DIR/bin/a2r-api</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>A2R_CONFIG</key>
        <string>$A2R_CONFIG_DIR/backend.yaml</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$A2R_LOG_DIR/api.log</string>
    <key>StandardErrorPath</key>
    <string>$A2R_LOG_DIR/api.err</string>
</dict>
</plist>
EOF

    chmod 644 /Library/LaunchDaemons/io.a2r.backend.plist
    launchctl load -w /Library/LaunchDaemons/io.a2r.backend.plist 2>/dev/null || true

    log_success "Launchd service installed"
}

create_service_user() {
    if [ "$OS" = "macos" ]; then
        return
    fi

    if ! id "a2r" &>/dev/null; then
        log_info "Creating a2r service user..."
        useradd --system --no-create-home \
            --home-dir "$A2R_DATA_DIR" \
            --shell /usr/sbin/nologin \
            a2r
    fi

    # Set ownership
    chown -R a2r:a2r "$A2R_DATA_DIR"
    chown -R a2r:a2r "$A2R_LOG_DIR"
    chown root:root "$A2R_INSTALL_DIR"
    chmod 755 "$A2R_INSTALL_DIR"
}

#------------------------------------------------------------------------------
# Service Management
#------------------------------------------------------------------------------

start_services() {
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        echo ""
        log_info "Starting services..."
        
        systemctl start a2r-api
        sleep 2
        systemctl start a2r-kernel
        systemctl start a2r-memory
        systemctl start a2r-web
        
        log_success "Services started"
    elif [ "$INIT_SYSTEM" = "launchd" ]; then
        launchctl kickstart -k system/io.a2r.backend 2>/dev/null || true
        log_success "Service started"
    fi
}

#------------------------------------------------------------------------------
# Verification
#------------------------------------------------------------------------------

verify_installation() {
    echo ""
    log_info "Verifying installation..."

    local errors=0

    # Check binaries
    for binary in a2r-api a2r-kernel a2r-memory; do
        if [ -x "$A2R_INSTALL_DIR/bin/$binary" ]; then
            log_success "$binary installed"
        else
            log_error "$binary not found"
            ((errors++))
        fi
    done

    # Check config
    if [ -f "$A2R_CONFIG_DIR/backend.yaml" ]; then
        log_success "Configuration created"
    else
        log_error "Configuration missing"
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
    
    # Get server IP
    local ip=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")

    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${GREEN}✓ A2R Backend Installation Complete!${NC}"
    echo ""
    echo "Your A2R server is ready:"
    echo "  ┌─────────────────────────────────────────┐"
    echo "  │  API:    http://$ip:4096"
    echo "  │  Web UI: http://$ip:3001"
    echo "  └─────────────────────────────────────────┘"
    echo ""
    echo "Installation:"
    echo "  Binaries: $A2R_INSTALL_DIR/bin/"
    echo "  Config:   $A2R_CONFIG_DIR/backend.yaml"
    echo "  Data:     $A2R_DATA_DIR/"
    echo "  Logs:     $A2R_LOG_DIR/"
    echo ""
    echo "Commands:"
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        echo "  sudo systemctl status a2r-api      # Check API status"
        echo "  sudo journalctl -u a2r-api -f      # View API logs"
        echo "  sudo systemctl restart a2r-api     # Restart API"
    fi
    echo ""
    echo "Connect your A2R Desktop:"
    echo "  1. Open A2R Desktop"
    echo "  2. Enter: http://$ip:4096"
    echo "  3. Start using your self-hosted A2R!"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Installation completed in ${install_duration}s"
    echo ""
}

#------------------------------------------------------------------------------
# Main
#------------------------------------------------------------------------------

main() {
    print_banner
    detect_arch
    detect_os
    detect_init_system
    check_root
    check_dependencies
    download_binaries
    setup_config
    create_service_user
    
    # Install services based on init system
    case $INIT_SYSTEM in
        systemd)
            install_systemd_services
            ;;
        launchd)
            install_launchd_services
            ;;
        *)
            log_warn "Unknown init system - manual service setup required"
            ;;
    esac
    
    if verify_installation; then
        start_services
        print_summary
    else
        log_error "Installation completed with errors"
        exit 1
    fi
}

# Handle arguments
case "${1:-}" in
    --help|-h)
        echo "A2R Backend Installer"
        echo ""
        echo "Usage:"
        echo "  curl -s https://install.a2r.io/backend | sudo bash"
        echo ""
        echo "Environment Variables:"
        echo "  A2R_VERSION       Version to install (default: latest)"
        echo "  A2R_INSTALL_DIR   Installation directory (default: /opt/a2r)"
        echo "  A2R_CONFIG_DIR    Config directory (default: /etc/a2r)"
        echo ""
        exit 0
        ;;
    --uninstall)
        echo "Uninstalling A2R Backend..."
        if [ "$INIT_SYSTEM" = "systemd" ]; then
            systemctl stop a2r-api a2r-kernel a2r-memory a2r-web 2>/dev/null || true
            systemctl disable a2r-api a2r-kernel a2r-memory a2r-web 2>/dev/null || true
            rm -f /etc/systemd/system/a2r-*.service
            systemctl daemon-reload
        fi
        rm -rf "$A2R_INSTALL_DIR" "$A2R_CONFIG_DIR" "$A2R_DATA_DIR" "$A2R_LOG_DIR"
        echo "Uninstallation complete"
        exit 0
        ;;
    *)
        main
        ;;
esac
