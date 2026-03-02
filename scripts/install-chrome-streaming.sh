#!/bin/bash

# =============================================================================
# A2RCHITECH PLATFORM - Chrome Streaming Gateway Installer
# =============================================================================
# Automated setup for Chrome streaming on any Linux VPS/server
# Run this ONCE after platform installation
# 
# Usage: ./install-chrome-streaming.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}     ${GREEN}A2R Chrome Streaming Gateway - Installer${NC}            ${CYAN}║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() { echo -e "${BLUE}[STEP $1]${NC} $2"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}!${NC} $1"; }
print_info() { echo -e "${CYAN}ℹ${NC} $1"; }

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
        echo "$OS $VERSION"
    else
        echo "unknown"
    fi
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then 
        print_error "Please run as root (sudo ./install-chrome-streaming.sh)"
        exit 1
    fi
}

# Check Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_warning "Docker not found. Installing..."
        install_docker
    else
        print_success "Docker already installed ($(docker --version))"
    fi
    
    if ! docker ps &> /dev/null; then
        print_warning "Docker daemon not running. Starting..."
        systemctl start docker
        systemctl enable docker
    fi
}

# Install Docker
install_docker() {
    print_step "1" "Installing Docker..."
    
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
    
    systemctl start docker
    systemctl enable docker
    
    print_success "Docker installed and running"
}

# Install Docker Compose
check_docker_compose() {
    if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
        print_warning "Docker Compose not found. Installing..."
        install_docker_compose
    else
        print_success "Docker Compose already installed"
    fi
}

install_docker_compose() {
    print_step "2" "Installing Docker Compose..."
    
    DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
    mkdir -p $DOCKER_CONFIG/cli-plugins/
    
    curl -SL https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64 \
        -o $DOCKER_CONFIG/cli-plugins/docker-compose
    
    chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose
    
    print_success "Docker Compose installed"
}

# Install coturn
install_coturn() {
    print_step "3" "Installing coturn (TURN server)..."
    
    if command -v turnserver &> /dev/null; then
        print_success "coturn already installed"
        return
    fi
    
    apt-get update
    apt-get install -y coturn
    
    print_success "coturn installed"
}

# Generate TURN secret
generate_turn_secret() {
    print_step "4" "Generating TURN secret..."
    
    TURN_SECRET=$(openssl rand -hex 32)
    
    print_success "TURN secret generated"
    echo "$TURN_SECRET"
}

# Setup .env file
setup_env() {
    print_step "5" "Setting up environment file..."
    
    ENV_FILE="/root/Desktop/a2rchitech-workspace/a2rchitech/.env"
    ENV_EXAMPLE="/root/Desktop/a2rchitech-workspace/a2rchitech/.env.example"
    
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$ENV_EXAMPLE" ]; then
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            
            # Generate and set TURN secret
            TURN_SECRET=$(generate_turn_secret)
            sed -i "s/TURN_SECRET=.*/TURN_SECRET=$TURN_SECRET/" "$ENV_FILE"
            
            print_success "Environment file created at $ENV_FILE"
        else
            print_error ".env.example not found at $ENV_EXAMPLE"
            exit 1
        fi
    else
        print_info "Environment file already exists"
        
        # Check if TURN_SECRET is set
        if grep -q "TURN_SECRET=change-this" "$ENV_FILE" 2>/dev/null; then
            TURN_SECRET=$(generate_turn_secret)
            sed -i "s/TURN_SECRET=.*/TURN_SECRET=$TURN_SECRET/" "$ENV_FILE"
            print_success "TURN secret updated in .env"
        fi
    fi
}

# Build Chrome stream image
build_chrome_image() {
    print_step "6" "Building Chrome stream Docker image..."
    
    CHROME_DIR="/root/Desktop/a2rchitech-workspace/a2rchitech/8-cloud/chrome-stream"
    
    if [ ! -d "$CHROME_DIR" ]; then
        print_error "Chrome streaming directory not found at $CHROME_DIR"
        exit 1
    fi
    
    cd "$CHROME_DIR"
    
    # Build image
    docker build -t a2r/chrome-stream .
    
    print_success "Chrome stream image built (a2r/chrome-stream)"
}

# Setup systemd service
setup_systemd() {
    print_step "7" "Setting up systemd services..."
    
    # Chrome streaming service
    cat > /etc/systemd/system/a2r-chrome-streaming.service << 'EOF'
[Unit]
Description=A2R Chrome Streaming Gateway
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/root/Desktop/a2rchitech-workspace/a2rchitech
ExecStart=/usr/bin/docker compose --profile chrome up -d
ExecStop=/usr/bin/docker compose --profile chrome down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

    # coturn configuration
    cat > /etc/turnserver.conf << 'EOF'
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
external-ip=YOUR_SERVER_IP  # Will be replaced below
realm=a2r.io
server-name=a2r-turn
lt-cred-mech
user=turnuser:$(openssl rand -hex 16)  # Will be replaced
pidfile=/var/run/turnserver.pid
log-file=/var/log/turnserver.log
no-cli
no-tcp-relay
no-multicast-peers
dynamic-ip-blacklist
stale-nonce=600
no-tls
no-dtls
EOF

    # Get server IP
    SERVER_IP=$(curl -s ifconfig.me)
    TURN_PASSWORD=$(openssl rand -hex 16)
    
    sed -i "s/external-ip=.*/external-ip=$SERVER_IP/" /etc/turnserver.conf
    sed -i "s/user=turnuser:.*/user=turnuser:$TURN_PASSWORD/" /etc/turnserver.conf
    
    # Enable and start services
    systemctl daemon-reload
    systemctl enable a2r-chrome-streaming
    systemctl enable coturn
    
    print_success "Systemd services configured"
}

# Configure firewall
configure_firewall() {
    print_step "8" "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw allow 3478/udp comment "Coturn TURN"
        ufw allow 3478/tcp comment "Coturn TURN TCP"
        ufw allow 5349/tcp comment "Coturn TURN TLS"
        ufw allow 8080/tcp comment "Chrome WebRTC signaling"
        ufw allow 8081/tcp comment "Chrome sidecar API"
        print_success "UFW firewall configured"
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-port=3478/udp
        firewall-cmd --permanent --add-port=3478/tcp
        firewall-cmd --permanent --add-port=5349/tcp
        firewall-cmd --permanent --add-port=8080/tcp
        firewall-cmd --permanent --add-port=8081/tcp
        firewall-cmd --reload
        print_success "firewalld configured"
    else
        print_warning "No firewall detected. Please manually open ports 3478, 5349, 8080, 8081"
    fi
}

# Start services
start_services() {
    print_step "9" "Starting Chrome streaming services..."
    
    cd /root/Desktop/a2rchitech-workspace/a2rchitech
    
    # Start coturn
    systemctl restart coturn
    
    # Start Chrome streaming
    docker compose --profile chrome up -d
    
    # Wait for health
    print_info "Waiting for services to be healthy..."
    sleep 30
    
    # Verify
    if curl -sf http://localhost:8081/health > /dev/null 2>&1; then
        print_success "Chrome sidecar is healthy"
    else
        print_warning "Chrome sidecar not yet healthy (may still be starting)"
    fi
}

# Print summary
print_summary() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}        ${CYAN}Chrome Streaming Gateway - Installation Complete${NC}   ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Services Started:${NC}"
    echo "  • Chrome Stream Container: $(docker ps --filter name=chrome-stream --format '{{.Status}}' | head -1)"
    echo "  • coturn (TURN server): $(systemctl is-active coturn)"
    echo ""
    echo -e "${BLUE}Ports Opened:${NC}"
    echo "  • 3478/udp - TURN server"
    echo "  • 3478/tcp - TURN server TCP"
    echo "  • 5349/tcp - TURN server TLS"
    echo "  • 8080/tcp - WebRTC signaling"
    echo "  • 8081/tcp - Chrome sidecar API"
    echo ""
    echo -e "${BLUE}Test Commands:${NC}"
    echo "  curl http://localhost:8081/health"
    echo "  docker logs a2r-chrome-stream"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Start the full platform: ./start-platform.sh"
    echo "  2. Open A2R Electron app"
    echo "  3. Click 'Open Chrome Browser' button"
    echo "  4. Chrome will stream inside the browser capsule"
    echo ""
    echo -e "${YELLOW}Note:${NC} Chrome streaming uses x86_64 emulation on ARM64 servers."
    echo "      For best performance, use an x86_64 VPS."
    echo ""
}

# Main
main() {
    print_header
    
    check_root
    
    OS_INFO=$(detect_os)
    print_info "Detected OS: $OS_INFO"
    
    if [[ ! "$OS_INFO" =~ ^ubuntu ]]; then
        print_warning "This script is tested on Ubuntu. Your OS: $OS_INFO"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    check_docker
    check_docker_compose
    install_coturn
    setup_env
    build_chrome_image
    setup_systemd
    configure_firewall
    start_services
    
    print_summary
}

# Run
main "$@"
