#!/bin/bash
#
# Allternit Node Agent Installation Script
# Supports: Ubuntu, Debian, CentOS, RHEL, Fedora, Alpine Linux
#
# This script:
# - Detects OS and architecture
# - Installs Docker if not present
# - Pulls Allternit agent Docker image
# - Sets up systemd service
# - Configures networking and firewall
# - Sets up log rotation
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
Allternit_VERSION="${Allternit_VERSION:-latest}"
Allternit_DIR="/opt/allternit"
Allternit_CONFIG_DIR="/etc/allternit"
Allternit_LOG_DIR="/var/log/allternit"
Allternit_USER="allternit"
Allternit_GROUP="allternit"

# Detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
        OS_NAME=$PRETTY_NAME
    elif [[ -f /etc/redhat-release ]]; then
        OS=$(cat /etc/redhat-release | awk '{print tolower($1)}')
        OS_VERSION=$(cat /etc/redhat-release | grep -oE '[0-9]+\.[0-9]+' | head -1)
        OS_NAME=$(cat /etc/redhat-release)
    elif [[ -f /etc/alpine-release ]]; then
        OS="alpine"
        OS_VERSION=$(cat /etc/alpine-release)
        OS_NAME="Alpine Linux $OS_VERSION"
    else
        log_error "Unable to detect operating system"
        exit 1
    fi
    
    log_info "Detected OS: $OS_NAME"
}

# Detect architecture
detect_arch() {
    ARCH=$(uname -m)
    case $ARCH in
        x86_64|amd64)
            ARCH="amd64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        *)
            log_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
    log_info "Detected architecture: $ARCH"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if running as root or has sudo
    if [[ $EUID -ne 0 ]]; then
        if ! sudo -n true 2>/dev/null; then
            log_error "This script must be run as root or with passwordless sudo"
            exit 1
        fi
    fi
    
    # Check memory (minimum 1GB)
    local total_mem
    total_mem=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo "0")
    if [[ $total_mem -lt 1024 ]]; then
        log_warn "Low memory detected: ${total_mem}MB (recommended: 2048MB+)"
    fi
    
    # Check disk space (minimum 5GB)
    local available_disk
    available_disk=$(df -BG / | awk 'NR==2{gsub(/G/,"");print $4}' 2>/dev/null || echo "0")
    if [[ $available_disk -lt 5 ]]; then
        log_warn "Low disk space: ${available_disk}GB available (recommended: 10GB+)"
    fi
    
    log_success "Prerequisites check passed"
}

# Install Docker
install_docker() {
    log_info "Installing Docker..."
    
    if command -v docker &> /dev/null; then
        local docker_version
        docker_version=$(docker --version | awk '{print $3}' | tr -d ',')
        log_info "Docker already installed: $docker_version"
        return 0
    fi
    
    case $OS in
        ubuntu|debian)
            install_docker_debian
            ;;
        centos|rhel|fedora|rocky|almalinux)
            install_docker_rhel
            ;;
        alpine)
            install_docker_alpine
            ;;
        amzn|amazon)
            install_docker_amazon
            ;;
        *)
            install_docker_generic
            ;;
    esac
    
    # Start Docker service
    if command -v systemctl &> /dev/null; then
        systemctl enable docker
        systemctl start docker
    elif command -v rc-service &> /dev/null; then
        rc-update add docker boot
        rc-service docker start || true
    fi
    
    # Verify installation
    if ! docker --version &> /dev/null; then
        log_error "Docker installation failed"
        exit 1
    fi
    
    log_success "Docker installed successfully"
}

install_docker_debian() {
    export DEBIAN_FRONTEND=noninteractive
    
    apt-get update
    apt-get install -y ca-certificates curl gnupg lsb-release
    
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Add repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_docker_rhel() {
    yum install -y yum-utils
    
    if command -v dnf &> /dev/null; then
        dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo || \
        yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    else
        yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    fi
    
    yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
}

install_docker_alpine() {
    apk add --no-cache docker docker-cli-compose
}

install_docker_amazon() {
    yum update -y
    yum install -y docker
    usermod -aG docker ec2-user 2>/dev/null || true
}

install_docker_generic() {
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
    rm -f /tmp/get-docker.sh
}

# Create Allternit user and directories
setup_directories() {
    log_info "Setting up Allternit directories..."
    
    # Create user
    if ! id "$Allternit_USER" &>/dev/null; then
        useradd -r -s /bin/false -d "$Allternit_DIR" -m "$Allternit_USER"
        log_info "Created user: $Allternit_USER"
    fi
    
    # Create directories
    mkdir -p "$Allternit_DIR"/{config,data,logs,scripts}
    mkdir -p "$Allternit_CONFIG_DIR"
    mkdir -p "$Allternit_LOG_DIR"
    
    # Set permissions
    chown -R "$Allternit_USER:$Allternit_GROUP" "$Allternit_DIR"
    chown -R "$Allternit_USER:$Allternit_GROUP" "$Allternit_LOG_DIR"
    chmod 750 "$Allternit_DIR"
    chmod 755 "$Allternit_CONFIG_DIR"
    chmod 600 "$Allternit_CONFIG_DIR"/config.json 2>/dev/null || true
    
    log_success "Directories created"
}

# Configure firewall
configure_firewall() {
    log_info "Configuring firewall..."
    
    # Define ports to open
    local ports=(80 443 8080 9090 9091)
    
    # ufw (Ubuntu/Debian)
    if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
        for port in "${ports[@]}"; do
            ufw allow "$port/tcp" comment "Allternit Agent" 2>/dev/null || true
        done
        log_info "Configured ufw firewall"
    fi
    
    # firewalld (RHEL/CentOS/Fedora)
    if command -v firewall-cmd &> /dev/null && systemctl is-active firewalld &>/dev/null; then
        for port in "${ports[@]}"; do
            firewall-cmd --permanent --add-port="$port/tcp" 2>/dev/null || true
        done
        firewall-cmd --reload 2>/dev/null || true
        log_info "Configured firewalld"
    fi
    
    # iptables fallback
    if command -v iptables &> /dev/null; then
        for port in "${ports[@]}"; do
            iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || \
            iptables -I INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || true
        done
        
        # Save rules
        if command -v iptables-save &> /dev/null; then
            iptables-save > /etc/iptables/rules.v4 2>/dev/null || \
            iptables-save > /etc/sysconfig/iptables 2>/dev/null || true
        fi
    fi
}

# Setup log rotation
setup_log_rotation() {
    log_info "Setting up log rotation..."
    
    cat > /etc/logrotate.d/allternit-agent << 'EOF'
/var/log/allternit/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 allternit allternit
    sharedscripts
    postrotate
        /usr/bin/docker kill --signal="USR1" allternit-agent 2>/dev/null || true
    endscript
}
EOF
    
    log_success "Log rotation configured"
}

# Create systemd service
create_systemd_service() {
    log_info "Creating systemd service..."
    
    cat > /etc/systemd/system/allternit-agent.service << EOF
[Unit]
Description=Allternit Node Agent
Documentation=https://docs.allternit.io
Requires=docker.service
After=docker.service network.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$Allternit_DIR
User=root
Group=root

# Pull images and start
ExecStartPre=-/usr/bin/docker compose -f $Allternit_DIR/docker-compose.yml pull
ExecStartPre=-/usr/bin/docker compose -f $Allternit_DIR/docker-compose.yml down

ExecStart=/usr/bin/docker compose -f $Allternit_DIR/docker-compose.yml up -d

ExecStop=/usr/bin/docker compose -f $Allternit_DIR/docker-compose.yml down
ExecReload=/usr/bin/docker compose -f $Allternit_DIR/docker-compose.yml restart

# Restart policy
Restart=no

# Environment
Environment="Allternit_CONFIG_DIR=$Allternit_CONFIG_DIR"
Environment="Allternit_LOG_DIR=$Allternit_LOG_DIR"

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd
    systemctl daemon-reload
    systemctl enable allternit-agent
    
    log_success "Systemd service created"
}

# Setup Docker network
setup_docker_network() {
    log_info "Setting up Docker network..."
    
    # Create allternit network if it doesn't exist
    if ! docker network inspect allternit-network &>/dev/null; then
        docker network create \
            --driver bridge \
            --subnet=172.20.0.0/16 \
            --gateway=172.20.0.1 \
            --opt com.docker.network.bridge.name=allternit-br0 \
            allternit-network || true
    fi
    
    log_success "Docker network configured"
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    # Check Docker
    if ! docker --version &>/dev/null; then
        log_error "Docker is not installed or not running"
        exit 1
    fi
    
    # Check Docker Compose
    if ! docker compose version &>/dev/null && ! docker-compose --version &>/dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check configuration files
    if [[ ! -f "$Allternit_DIR/docker-compose.yml" ]]; then
        log_error "Docker Compose file not found"
        exit 1
    fi
    
    # Validate docker-compose
    if ! docker compose -f "$Allternit_DIR/docker-compose.yml" config &>/dev/null; then
        log_error "Docker Compose configuration is invalid"
        exit 1
    fi
    
    # Check systemd service
    if [[ ! -f /etc/systemd/system/allternit-agent.service ]]; then
        log_error "Systemd service file not found"
        exit 1
    fi
    
    log_success "Installation verification passed"
}

# Main installation function
main() {
    log_info "======================================"
    log_info "Allternit Node Agent Installer"
    log_info "Version: $Allternit_VERSION"
    log_info "======================================"
    
    detect_os
    detect_arch
    check_prerequisites
    install_docker
    setup_directories
    configure_firewall
    setup_log_rotation
    create_systemd_service
    setup_docker_network
    verify_installation
    
    log_success "======================================"
    log_success "Allternit Agent installation completed!"
    log_success "======================================"
    log_info ""
    log_info "Next steps:"
    log_info "  1. Start the agent: sudo systemctl start allternit-agent"
    log_info "  2. Check status: sudo systemctl status allternit-agent"
    log_info "  3. View logs: sudo journalctl -u allternit-agent -f"
    log_info "  4. Docker logs: docker compose -f $Allternit_DIR/docker-compose.yml logs -f"
    log_info ""
    log_info "Configuration file: $Allternit_CONFIG_DIR/config.json"
    log_info "Data directory: $Allternit_DIR/data"
    log_info "Log directory: $Allternit_LOG_DIR"
}

# Handle script interruption
trap 'log_error "Installation interrupted"; exit 1' INT TERM

# Run main function
main "$@"
