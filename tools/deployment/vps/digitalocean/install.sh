#!/bin/bash

# Allternit Platform - DigitalOcean One-Click Install
#
# This script installs the Allternit Platform on a fresh DigitalOcean Droplet.
# Supports Ubuntu 20.04/22.04
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/allternit/allternit/main/8-cloud/vps-integrations/digitalocean/install.sh | bash
#
# Or download and run:
#   wget -O install.sh https://raw.githubusercontent.com/allternit/allternit/main/8-cloud/vps-integrations/digitalocean/install.sh
#   bash install.sh

set -e

# Configuration
Allternit_VERSION="${Allternit_VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/opt/allternit}"
DATA_DIR="${DATA_DIR:-/var/lib/allternit}"
LOG_DIR="${LOG_DIR:-/var/log/allternit}"
SYSTEMD_DIR="/etc/systemd/system"
Allternit_USER="allternit"
Allternit_PORT="${Allternit_PORT:-3000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
        log_info "Detected OS: $OS $VERSION"
    else
        log_error "Cannot detect OS. Only Ubuntu is supported."
        exit 1
    fi

    if [[ "$OS" != "ubuntu" ]]; then
        log_error "Only Ubuntu is supported. Detected: $OS"
        exit 1
    fi
}

# Update system packages
update_system() {
    log_info "Updating system packages..."
    apt-get update -qq
    apt-get upgrade -y -qq
    log_success "System packages updated"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    apt-get install -y -qq \
        curl \
        wget \
        git \
        jq \
        htop \
        ufw \
        fail2ban \
        docker.io \
        docker-compose \
        ca-certificates \
        gnupg \
        lsb-release \
        apt-transport-https \
        software-properties-common

    log_success "Dependencies installed"
}

# Create allternit user
create_user() {
    log_info "Creating Allternit user..."
    
    if id "$Allternit_USER" &>/dev/null; then
        log_warning "User $Allternit_USER already exists"
    else
        useradd -r -s /bin/false -d "$INSTALL_DIR" "$Allternit_USER"
        log_success "User $Allternit_USER created"
    fi
}

# Create directories
create_directories() {
    log_info "Creating directories..."
    
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$DATA_DIR"
    mkdir -p "$LOG_DIR"
    
    chown -R "$Allternit_USER:$Allternit_USER" "$INSTALL_DIR"
    chown -R "$Allternit_USER:$Allternit_USER" "$DATA_DIR"
    chown -R "$Allternit_USER:$Allternit_USER" "$LOG_DIR"
    
    log_success "Directories created"
}

# Install Docker (if not already installed)
install_docker() {
    if command -v docker &> /dev/null; then
        log_info "Docker already installed"
        return
    fi
    
    log_info "Installing Docker..."
    
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Set up the repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Start and enable Docker
    systemctl enable docker
    systemctl start docker
    
    log_success "Docker installed"
}

# Download Allternit Platform
download_allternit() {
    log_info "Downloading Allternit Platform $Allternit_VERSION..."
    
    cd "$INSTALL_DIR"
    
    # Get latest release if version is "latest"
    if [[ "$Allternit_VERSION" == "latest" ]]; then
        LATEST_VERSION=$(curl -s https://api.github.com/repos/allternit/allternit/releases/latest | jq -r .tag_name)
        Allternit_VERSION=$LATEST_VERSION
    fi
    
    # Download release
    DOWNLOAD_URL="https://github.com/allternit/allternit/archive/refs/tags/${Allternit_VERSION}.tar.gz"
    
    if wget -q --show-progress "$DOWNLOAD_URL" -O allternit.tar.gz; then
        tar -xzf allternit.tar.gz --strip-components=1
        rm allternit.tar.gz
        log_success "Allternit Platform $Allternit_VERSION downloaded"
    else
        log_error "Failed to download Allternit Platform"
        exit 1
    fi
}

# Configure firewall
configure_firewall() {
    log_info "Configuring firewall..."
    
    # Enable UFW if not already enabled
    if ! ufw status &>/dev/null; then
        ufw --force enable
    fi
    
    # Allow SSH
    ufw allow ssh
    
    # Allow Allternit port
    ufw allow "$Allternit_PORT"/tcp
    
    # Allow HTTP/HTTPS (for reverse proxy)
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    log_success "Firewall configured (port $Allternit_PORT open)"
}

# Create systemd service
create_systemd() {
    log_info "Creating systemd service..."
    
    cat > "$SYSTEMD_DIR/allternit.service" << EOF
[Unit]
Description=Allternit Platform
After=network.target docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/docker-compose -f docker-compose.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.yml down
User=$Allternit_USER

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable allternit
    
    log_success "Systemd service created"
}

# Create environment file
create_env() {
    log_info "Creating environment file..."
    
    cat > "$INSTALL_DIR/.env" << EOF
# Allternit Platform Configuration
Allternit_VERSION=$Allternit_VERSION
Allternit_PORT=$Allternit_PORT
Allternit_DATA_DIR=$DATA_DIR
Allternit_LOG_DIR=$LOG_DIR

# Database
DB_PASSWORD=$(openssl rand -base64 32)

# API Keys (generate your own)
Allternit_API_KEY=$(openssl rand -hex 32)

# Optional: External services
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
# GOOGLE_API_KEY=
EOF

    chmod 600 "$INSTALL_DIR/.env"
    chown "$Allternit_USER:$Allternit_USER" "$INSTALL_DIR/.env"
    
    log_success "Environment file created"
}

# Start Allternit Platform
start_allternit() {
    log_info "Starting Allternit Platform..."
    
    systemctl start allternit
    
    # Wait for service to be ready
    sleep 5
    
    if systemctl is-active --quiet allternit; then
        log_success "Allternit Platform started"
    else
        log_warning "Allternit Platform may still be starting. Check logs with: journalctl -u allternit -f"
    fi
}

# Print installation summary
print_summary() {
    echo ""
    echo "========================================"
    echo -e "${GREEN}Allternit Platform Installation Complete!${NC}"
    echo "========================================"
    echo ""
    echo "Version: $Allternit_VERSION"
    echo "Port: $Allternit_PORT"
    echo "Install Dir: $INSTALL_DIR"
    echo "Data Dir: $DATA_DIR"
    echo ""
    echo "Useful commands:"
    echo "  Start:   sudo systemctl start allternit"
    echo "  Stop:    sudo systemctl stop allternit"
    echo "  Status:  sudo systemctl status allternit"
    echo "  Logs:    sudo journalctl -u allternit -f"
    echo ""
    echo "Access the platform at:"
    echo "  http://$(hostname -I | awk '{print $1}':$Allternit_PORT"
    echo ""
    echo "========================================"
}

# Main installation
main() {
    echo ""
    echo "========================================"
    echo "  Allternit Platform - DigitalOcean Install"
    echo "========================================"
    echo ""
    
    check_root
    detect_os
    update_system
    install_dependencies
    install_docker
    create_user
    create_directories
    download_allternit
    create_env
    configure_firewall
    create_systemd
    start_allternit
    print_summary
}

# Run installation
main "$@"
