#!/bin/bash
#
# A2R Node E2E Test - Automated Deployment Script
#
# Usage: ./deploy-e2e-test.sh <vps-user> <vps-host> [control-plane-url]
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
VPS_USER="${1:-root}"
VPS_HOST="${2:-}"
CONTROL_PLANE_URL="${3:-ws://localhost:3000}"
NODE_ID="node-e2e-test-$(hostname | cut -c1-8)"
NODE_TOKEN="test-token-$(openssl rand -hex 16)"

print_banner() {
    echo -e "${BLUE}"
    echo "    ___    __  ______"
    echo "   /   |  /  |/  /   |  _    __"
    echo "  / /| | / /|_/ / /| | | |  / /"
    echo " / ___ |/ /  / / ___ | | | / /"
    echo "/_/  |_/_/  /_/_/  |_| |___/_/"
    echo "                      E2E Test Deployment"
    echo -e "${NC}"
    echo ""
}

check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    if [ -z "$VPS_HOST" ]; then
        echo -e "${RED}Error: VPS host is required${NC}"
        echo "Usage: $0 <vps-user> <vps-host> [control-plane-url]"
        echo "Example: $0 root 192.168.1.100 ws://localhost:3000"
        exit 1
    fi
    
    if ! command -v ssh &> /dev/null; then
        echo -e "${RED}Error: ssh not found${NC}"
        exit 1
    fi
    
    if ! command -v scp &> /dev/null; then
        echo -e "${RED}Error: scp not found${NC}"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}Installing jq...${NC}"
        if command -v apt-get &> /dev/null; then
            sudo apt-get install -y jq
        elif command -v brew &> /dev/null; then
            brew install jq
        fi
    fi
    
    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
    echo ""
}

build_node_agent() {
    echo -e "${YELLOW}Building A2R Node Agent...${NC}"
    
    cd "$(dirname "$0")"
    
    if [ ! -f "Cargo.toml" ]; then
        echo -e "${RED}Error: Not in a2r-node directory${NC}"
        exit 1
    fi
    
    cargo build --release
    
    if [ ! -f "target/release/a2r-node" ]; then
        echo -e "${RED}Error: Build failed${NC}"
        exit 1
    fi
    
    BINARY_SIZE=$(du -h target/release/a2r-node | cut -f1)
    echo -e "${GREEN}✓ Built node agent (${BINARY_SIZE})${NC}"
    echo ""
}

deploy_to_vps() {
    echo -e "${YELLOW}Deploying to VPS (${VPS_HOST})...${NC}"
    
    # Test SSH connection
    echo -e "${BLUE}→ Testing SSH connection...${NC}"
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" "echo 'Connection successful'" &> /dev/null; then
        echo -e "${RED}Error: Cannot connect to VPS via SSH${NC}"
        echo "Please ensure:"
        echo "  1. VPS is running"
        echo "  2. SSH is enabled"
        echo "  3. SSH keys are configured or password authentication is enabled"
        exit 1
    fi
    echo -e "${GREEN}✓ SSH connection successful${NC}"
    
    # Create directories
    echo -e "${BLUE}→ Creating directories...${NC}"
    ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p /opt/a2r/bin /etc/a2r /var/log/a2r"
    echo -e "${GREEN}✓ Directories created${NC}"
    
    # Transfer binary
    echo -e "${BLUE}→ Transferring binary...${NC}"
    scp target/release/a2r-node "${VPS_USER}@${VPS_HOST}:/opt/a2r/bin/"
    ssh "${VPS_USER}@${VPS_HOST}" "chmod +x /opt/a2r/bin/a2r-node"
    echo -e "${GREEN}✓ Binary transferred${NC}"
    
    # Install Docker
    echo -e "${BLUE}→ Installing Docker...${NC}"
    ssh "${VPS_USER}@${VPS_HOST}" << 'EOF'
        if ! command -v docker &> /dev/null; then
            curl -fsSL https://get.docker.com | sh
            systemctl start docker
            systemctl enable docker
        fi
        usermod -aG docker $USER 2>/dev/null || true
EOF
    echo -e "${GREEN}✓ Docker installed${NC}"
    
    # Create config
    echo -e "${BLUE}→ Creating configuration...${NC}"
    ssh "${VPS_USER}@${VPS_HOST}" << EOF
        cat > /etc/a2r/node.env << 'CONF'
# A2R Node Configuration
# Generated: $(date)

ALLTERNIT_NODE_ID=${NODE_ID}
ALLTERNIT_TOKEN=${NODE_TOKEN}
ALLTERNIT_CONTROL_PLANE=${CONTROL_PLANE_URL}
CONF
        chmod 600 /etc/a2r/node.env
        chown root:root /etc/a2r/node.env
EOF
    echo -e "${GREEN}✓ Configuration created${NC}"
    echo -e "${BLUE}  Node ID: ${NODE_ID}${NC}"
    echo -e "${BLUE}  Token: ${NODE_TOKEN}${NC}"
    
    # Install systemd service
    echo -e "${BLUE}→ Installing systemd service...${NC}"
    ssh "${VPS_USER}@${VPS_HOST}" << 'EOF'
        cat > /etc/systemd/system/a2r-node.service << 'SERVICE'
[Unit]
Description=A2R Node Agent
Documentation=https://docs.allternit.com
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

[Install]
WantedBy=multi-user.target
SERVICE
        systemctl daemon-reload
        systemctl enable a2r-node
EOF
    echo -e "${GREEN}✓ Systemd service installed${NC}"
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✓ Deployment Complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Node Details:"
    echo "  Node ID:  ${NODE_ID}"
    echo "  Token:    ${NODE_TOKEN}"
    echo "  Host:     ${VPS_HOST}"
    echo ""
    echo "Next Steps:"
    echo "  1. Start your control plane API server"
    echo "  2. Start the node agent: ssh ${VPS_USER}@${VPS_HOST} 'sudo systemctl start a2r-node'"
    echo "  3. Watch logs: ssh ${VPS_USER}@${VPS_HOST} 'sudo journalctl -u a2r-node -f'"
    echo "  4. Verify registration: curl http://localhost:3000/api/v1/nodes"
    echo ""
}

run_quick_test() {
    echo -e "${YELLOW}Running quick connectivity test...${NC}"
    
    # Start node agent
    echo -e "${BLUE}→ Starting node agent...${NC}"
    ssh "${VPS_USER}@${VPS_HOST}" "sudo systemctl start a2r-node"
    
    # Wait for connection
    echo -e "${BLUE}→ Waiting for node to connect (10 seconds)...${NC}"
    sleep 10
    
    # Check node status
    echo -e "${BLUE}→ Checking node status...${NC}"
    if curl -s http://localhost:3000/api/v1/nodes | jq -e ".connected | index(\"${NODE_ID}\")" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Node connected successfully!${NC}"
        
        # Show node details
        echo ""
        echo "Node Status:"
        curl -s http://localhost:3000/api/v1/nodes | jq ".all_nodes[] | select(.id == \"${NODE_ID}\")"
        
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}✓ E2E Test Deployment Successful!${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "Your node is now running and connected to the control plane."
        echo ""
        echo "Useful Commands:"
        echo "  # Watch node logs"
        echo "  ssh ${VPS_USER}@${VPS_HOST} 'sudo journalctl -u a2r-node -f'"
        echo ""
        echo "  # Submit a test job"
        echo "  curl -X POST http://localhost:3000/api/v1/jobs \\"
        echo "    -H 'Content-Type: application/json' \\"
        echo "    -d '{\"name\":\"test\",\"wih\":{\"handler\":\"shell\",\"task\":{\"type\":\"shell\",\"command\":\"echo hello\"}}}'"
        echo ""
        echo "  # Check job queue"
        echo "  curl http://localhost:3000/api/v1/jobs | jq '.'"
        echo ""
        echo "  # Stop node"
        echo "  ssh ${VPS_USER}@${VPS_HOST} 'sudo systemctl stop a2r-node'"
        echo ""
        
        return 0
    else
        echo -e "${RED}✗ Node not yet connected${NC}"
        echo ""
        echo "Troubleshooting:"
        echo "  1. Make sure control plane is running on ${CONTROL_PLANE_URL}"
        echo "  2. Check node logs: ssh ${VPS_USER}@${VPS_HOST} 'sudo journalctl -u a2r-node -f'"
        echo "  3. Check firewall settings on both machines"
        echo ""
        return 1
    fi
}

cleanup() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    
    ssh "${VPS_USER}@${VPS_HOST}" << 'EOF'
        sudo systemctl stop a2r-node
        sudo systemctl disable a2r-node
        sudo rm -f /etc/systemd/system/a2r-node.service
        sudo rm -rf /opt/a2r /etc/a2r /var/log/a2r
        systemctl daemon-reload
EOF
    
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Main
print_banner
check_prerequisites
build_node_agent
deploy_to_vps

if run_quick_test; then
    echo ""
    echo -e "${GREEN}All tests passed!${NC}"
else
    echo ""
    echo -e "${YELLOW}Test incomplete. Check troubleshooting steps above.${NC}"
fi
