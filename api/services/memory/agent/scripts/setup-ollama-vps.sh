#!/bin/bash
#
# Ollama VPS Setup Script
# Installs Ollama and pulls Qwen 3.5 models on a remote VPS
#

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     Ollama VPS Setup - Qwen 3.5                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Configuration
OLLAMA_HOST="${OLLAMA_HOST:-0.0.0.0}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"
MODELS="${MODELS:-qwen3.5:2b qwen3.5:4b}"

echo "Configuration:"
echo "  Host: $OLLAMA_HOST"
echo "  Port: $OLLAMA_PORT"
echo "  Models: $MODELS"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (sudo ./setup-ollama-vps.sh)"
    exit 1
fi

# Install Ollama
echo "Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

# Create ollama user if not exists
if ! id -u ollama >/dev/null 2>&1; then
    echo "Creating ollama user..."
    useradd -r -s /bin/false -m ollama
fi

# Create systemd service
echo "Creating systemd service..."
cat > /etc/systemd/system/ollama.service << EOF
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Environment="OLLAMA_HOST=$OLLAMA_HOST:$OLLAMA_PORT"
Restart=always
RestartSec=3
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

[Install]
WantedBy=default.target
EOF

# Reload systemd and start service
echo "Starting Ollama service..."
systemctl daemon-reload
systemctl enable ollama
systemctl start ollama

# Wait for service to be ready
echo "Waiting for Ollama to start..."
sleep 5

# Check if running
if systemctl is-active --quiet ollama; then
    echo "✅ Ollama service is running"
else
    echo "❌ Ollama service failed to start"
    exit 1
fi

# Pull models
echo ""
echo "Pulling models..."
for model in $MODELS; do
    echo "  → Pulling $model..."
    sudo -u ollama ollama pull $model
done

# Show installed models
echo ""
echo "Installed models:"
sudo -u ollama ollama list

# Configure firewall (if ufw is available)
if command -v ufw &> /dev/null; then
    echo ""
    echo "Configuring firewall..."
    ufw allow $OLLAMA_PORT/tcp comment "Ollama API"
    ufw reload
fi

# Show connection info
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     Setup Complete!                                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Ollama is running on: http://$OLLAMA_HOST:$OLLAMA_PORT"
echo ""
echo "To test locally:"
echo "  ollama run qwen3.5:2b \"Hello\""
echo ""
echo "To connect from your local machine:"
echo "  export OLLAMA_HOST=http://<VPS_IP>:$OLLAMA_PORT"
echo "  ollama list"
echo ""
echo "Or add to your ~/.zshrc:"
echo "  export OLLAMA_HOST=http://<VPS_IP>:$OLLAMA_PORT"
echo ""

# Show system info
echo "System Info:"
echo "  CPU: $(nproc) cores"
echo "  Memory: $(free -h | awk '/^Mem:/{print $2}')"
echo "  Disk: $(df -h / | awk 'NR==2{print $4}' ) free"
echo ""
