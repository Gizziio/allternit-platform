#!/bin/bash
#
# Configure Memory Agent to use VPS Ollama
#

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     Memory Agent - VPS Configuration                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Get VPS IP
if [ -z "$1" ]; then
    read -p "Enter your VPS IP address: " VPS_IP
else
    VPS_IP="$1"
fi

# Validate IP format (basic check)
if [[ ! $VPS_IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "❌ Invalid IP address format: $VPS_IP"
    exit 1
fi

echo ""
echo "Configuration:"
echo "  VPS IP: $VPS_IP"
echo "  Port: 11434"
echo "  Models: qwen3.5:0.8b, qwen3.5:2b, qwen3.5:4b"
echo ""

# Create .env file
cat > .env << EOF
# Ollama Configuration (VPS)
OLLAMA_HOST=$VPS_IP
OLLAMA_PORT=11434

# Models (matching your VPS - Qwen 3.5)
OLLAMA_INGEST_MODEL=qwen3.5:2b
OLLAMA_CONSOLIDATE_MODEL=qwen3.5:4b
OLLAMA_QUERY_MODEL=qwen3.5:2b

# HTTP API
MEMORY_ENABLE_HTTP_API=true
MEMORY_HTTP_PORT=3201

# Paths
MEMORY_WATCH_DIRECTORY=./inbox
MEMORY_DATABASE_PATH=./memory.db

# Consolidation
MEMORY_CONSOLIDATION_INTERVAL_MINUTES=30
EOF

echo "✅ Created .env file"
echo ""

# Test connection to VPS
echo "Testing connection to VPS Ollama..."
if curl -s --connect-timeout 5 "http://$VPS_IP:11434/api/tags" > /dev/null; then
    echo "✅ Successfully connected to VPS Ollama!"
    
    # Show available models on VPS
    echo ""
    echo "Models available on VPS:"
    curl -s "http://$VPS_IP:11434/api/tags" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for model in data.get('models', []):
    print(f\"  - {model['name']}\")
" 2>/dev/null || curl -s "http://$VPS_IP:11434/api/tags"
else
    echo "⚠️  Could not connect to VPS Ollama"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check VPS IP is correct: $VPS_IP"
    echo "  2. Ensure Ollama is running on VPS: ssh root@$VPS_IP 'systemctl status ollama'"
    echo "  3. Check firewall allows port 11434"
    echo "  4. Test manually: curl http://$VPS_IP:11434/api/tags"
    echo ""
    echo "Continuing anyway (you can fix connection later)..."
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     Configuration Complete!                              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Install dependencies: pnpm install"
echo "  2. Start memory agent:   pnpm run start:http"
echo "  3. Test query:           curl http://localhost:3201/api/query -d '{\"question\":\"Hello\"}'"
echo ""
echo "Or add to your ~/.zshrc for system-wide VPS usage:"
echo "  export OLLAMA_HOST=http://$VPS_IP:11434"
echo ""
