#!/bin/bash

# A2R Platform - Hetzner One-Click Install
#
# This script installs the A2R Platform on a fresh Hetzner Cloud server.
# Supports Ubuntu 20.04/22.04
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/a2rchitech/a2rchitech/main/8-cloud/vps-integrations/hetzner/install.sh | bash

set -e

# Configuration
A2R_VERSION="${A2R_VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/opt/a2rchitech}"
DATA_DIR="${DATA_DIR:-/var/lib/a2rchitech}"
LOG_DIR="${LOG_DIR:-/var/log/a2rchitech}"
SYSTEMD_DIR="/etc/systemd/system"
A2R_USER="a2r"
A2R_PORT="${A2R_PORT:-3000}"

# Hetzner-specific: Enable backup configuration
ENABLE_BACKUP="${ENABLE_BACKUP:-true}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/a2rchitech}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
        log_info "Detected OS: $OS $VERSION"
    else
        log_error "Cannot detect OS"
        exit 1
    fi
}

update_system() {
    log_info "Updating system packages..."
    apt-get update -qq
    apt-get upgrade -y -qq
    log_success "System updated"
}

install_dependencies() {
    log_info "Installing dependencies..."
    apt-get install -y -qq \
        curl wget git jq htop ufw fail2ban \
        docker.io docker-compose ca-certificates \
        gnupg lsb-release apt-transport-https \
        software-properties-common \
        rsync cron
    log_success "Dependencies installed"
}

create_user() {
    log_info "Creating A2R user..."
    if id "$A2R_USER" &>/dev/null; then
        log_warning "User $A2R_USER already exists"
    else
        useradd -r -s /bin/false -d "$INSTALL_DIR" "$A2R_USER"
    fi
    log_success "User created"
}

create_directories() {
    log_info "Creating directories..."
    mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$LOG_DIR"
    
    # Hetzner-specific: Create backup directory
    if [[ "$ENABLE_BACKUP" == "true" ]]; then
        mkdir -p "$BACKUP_DIR"
        chown "$A2R_USER:$A2R_USER" "$BACKUP_DIR"
        log_info "Backup directory created: $BACKUP_DIR"
    fi
    
    chown -R "$A2R_USER:$A2R_USER" "$INSTALL_DIR"
    chown -R "$A2R_USER:$A2R_USER" "$DATA_DIR"
    chown -R "$A2R_USER:$A2R_USER" "$LOG_DIR"
    log_success "Directories created"
}

install_docker() {
    if command -v docker &> /dev/null; then
        log_info "Docker already installed"
        return
    fi
    
    log_info "Installing Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    systemctl enable docker
    systemctl start docker
    log_success "Docker installed"
}

download_a2r() {
    log_info "Downloading A2R Platform $A2R_VERSION..."
    cd "$INSTALL_DIR"
    
    if [[ "$A2R_VERSION" == "latest" ]]; then
        LATEST_VERSION=$(curl -s https://api.github.com/repos/a2rchitech/a2rchitech/releases/latest | jq -r .tag_name)
        A2R_VERSION=$LATEST_VERSION
    fi
    
    DOWNLOAD_URL="https://github.com/a2rchitech/a2rchitech/archive/refs/tags/${A2R_VERSION}.tar.gz"
    
    if wget -q --show-progress "$DOWNLOAD_URL" -O a2r.tar.gz; then
        tar -xzf a2r.tar.gz --strip-components=1
        rm a2r.tar.gz
        log_success "A2R Platform $A2R_VERSION downloaded"
    else
        log_error "Failed to download"
        exit 1
    fi
}

configure_firewall() {
    log_info "Configuring firewall..."
    
    if ! ufw status &>/dev/null; then
        ufw --force enable
    fi
    
    ufw allow ssh
    ufw allow "$A2R_PORT"/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    log_success "Firewall configured"
}

create_systemd() {
    log_info "Creating systemd service..."
    
    cat > "$SYSTEMD_DIR/a2rchitech.service" << EOF
[Unit]
Description=A2R Platform
After=network.target docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/docker-compose -f docker-compose.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.yml down
User=$A2R_USER

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable a2rchitech
    log_success "Systemd service created"
}

create_env() {
    log_info "Creating environment file..."
    
    cat > "$INSTALL_DIR/.env" << EOF
# A2R Platform Configuration
A2R_VERSION=$A2R_VERSION
A2R_PORT=$A2R_PORT
A2R_DATA_DIR=$DATA_DIR
A2R_LOG_DIR=$LOG_DIR

# Database
DB_PASSWORD=$(openssl rand -base64 32)

# API Keys
A2R_API_KEY=$(openssl rand -hex 32)

# Hetzner-specific: Backup configuration
BACKUP_ENABLED=$ENABLE_BACKUP
BACKUP_DIR=$BACKUP_DIR
EOF

    chmod 600 "$INSTALL_DIR/.env"
    chown "$A2R_USER:$A2R_USER" "$INSTALL_DIR/.env"
    log_success "Environment file created"
}

# Hetzner-specific: Setup backup cron job
setup_backups() {
    if [[ "$ENABLE_BACKUP" != "true" ]]; then
        log_info "Backups disabled"
        return
    fi
    
    log_info "Setting up automatic backups..."
    
    cat > /etc/cron.daily/a2r-backup << 'EOF'
#!/bin/bash
# A2R Platform Daily Backup

BACKUP_DIR="/var/backups/a2rchitech"
DATA_DIR="/var/lib/a2rchitech"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
tar -czf "$BACKUP_DIR/a2r-backup-$DATE.tar.gz" "$DATA_DIR" 2>/dev/null

# Keep only last 7 backups
find "$BACKUP_DIR" -name "a2r-backup-*.tar.gz" -mtime +7 -delete
EOF

    chmod +x /etc/cron.daily/a2r-backup
    log_success "Daily backups configured"
}

start_a2r() {
    log_info "Starting A2R Platform..."
    systemctl start a2rchitech
    sleep 5
    
    if systemctl is-active --quiet a2rchitech; then
        log_success "A2R Platform started"
    else
        log_warning "Check logs: journalctl -u a2rchitech -f"
    fi
}

print_summary() {
    echo ""
    echo "========================================"
    echo -e "${GREEN}A2R Platform Installation Complete!${NC}"
    echo "========================================"
    echo ""
    echo "Version: $A2R_VERSION"
    echo "Port: $A2R_PORT"
    echo "Install Dir: $INSTALL_DIR"
    echo "Backup Dir: $BACKUP_DIR"
    echo ""
    echo "Commands:"
    echo "  Start:  sudo systemctl start a2rchitech"
    echo "  Stop:   sudo systemctl stop a2rchitech"
    echo "  Status: sudo systemctl status a2rchitech"
    echo "  Logs:   sudo journalctl -u a2rchitech -f"
    echo ""
    echo "Access: http://$(hostname -I | awk '{print $1}':$A2R_PORT"
    echo ""
    if [[ "$ENABLE_BACKUP" == "true" ]]; then
        echo "Backups: Daily at /var/backups/a2rchitech"
    fi
    echo "========================================"
}

main() {
    echo ""
    echo "========================================"
    echo "  A2R Platform - Hetzner Install"
    echo "========================================"
    echo ""
    
    check_root
    detect_os
    update_system
    install_dependencies
    install_docker
    create_user
    create_directories
    download_a2r
    create_env
    configure_firewall
    create_systemd
    setup_backups
    start_a2r
    print_summary
}

main "$@"
