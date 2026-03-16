# Ollama VPS Setup Guide

## Overview

Run Ollama with larger/faster models on a VPS and connect your local memory agent to it.

**Benefits:**
- ✅ Faster inference (dedicated resources)
- ✅ Larger models (qwen3.5:4b, 7b, 14b+)
- ✅ No local disk/CPU usage
- ✅ 24/7 availability

---

## Step 1: VPS Setup

### Requirements

- **Minimum**: 2 vCPU, 4 GB RAM, 20 GB SSD
- **Recommended**: 4 vCPU, 8 GB RAM, 40 GB SSD
- **With GPU**: Any NVIDIA GPU (RTX 3060+, A10, A100)

### Supported Providers

| Provider | Instance | Price/Month | Notes |
|----------|----------|-------------|-------|
| **Hetzner** | CPX31 | ~€13 | Best value CPU |
| **DigitalOcean** | premium-4vcpu-8gb | $24 | Good balance |
| **Lambda Labs** | 1x RTX 3090 | $0.60/hr | GPU option |
| **RunPod** | RTX 4090 | $0.70/hr | Fast GPU |
| **AWS** | g4dn.xlarge | ~$100 | Enterprise |

### Install on VPS

```bash
# SSH into your VPS
ssh root@<VPS_IP>

# Download setup script
curl -o setup.sh https://raw.githubusercontent.com/a2rchitech/a2rchitech/main/4-services/memory/agent/scripts/setup-ollama-vps.sh

# Make executable and run
chmod +x setup-ollama.sh
sudo ./setup-ollama.sh
```

### Manual Install (if script fails)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Configure to listen on all interfaces
sudo systemctl stop ollama
sudo OLLAMA_HOST=0.0.0.0:11434 ollama serve &

# Or edit systemd service
sudo nano /etc/systemd/system/ollama.service
# Add: Environment="OLLAMA_HOST=0.0.0.0:11434"

sudo systemctl daemon-reload
sudo systemctl restart ollama
```

### Pull Models

```bash
# Pull Qwen 3.5 models
ollama pull qwen3.5:2b      # 2.7 GB
ollama pull qwen3.5:4b      # 3.4 GB

# Optional: larger models if you have RAM
ollama pull qwen3.5:7b      # 5.2 GB
ollama pull qwen3.5:14b     # 9.1 GB (needs 16GB+ RAM)
```

### Configure Firewall

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 11434/tcp
sudo ufw reload

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=11434/tcp
sudo firewall-cmd --reload

# AWS Security Groups
# Add inbound rule: TCP 11434 from your IP
```

---

## Step 2: Connect Local Machine to VPS

### Option A: Environment Variable (Recommended)

Add to your `~.zshrc` or `~/.bashrc`:

```bash
export OLLAMA_HOST=http://<VPS_IP>:11434
```

Then reload:
```bash
source ~/.zshrc
```

### Option B: Per-Command

```bash
OLLAMA_HOST=http://<VPS_IP>:11434 ollama run qwen3.5:2b "Hello"
```

### Option C: For Memory Agent

Create `.env` in memory directory:

```bash
# memory/.env
OLLAMA_HOST=<VPS_IP>
OLLAMA_PORT=11434
```

---

## Step 3: Test Connection

```bash
# From your local machine
ollama list

# Should show VPS models
# NAME          ID              SIZE
# qwen3.5:2b    324d162be6ca    2.7 GB
# qwen3.5:4b    abc123...       3.4 GB

# Test inference
ollama run qwen3.5:2b "What is 2+2?"

# Benchmark speed
time ollama run qwen3.5:2b "Write a short poem about coding"
```

---

## Step 4: Update Memory Agent Configuration

Edit `memory/src/types/memory.types.ts`:

```typescript
export const DEFAULT_CONFIG: MemoryAgentConfig = {
  watchDirectory: './inbox',
  databasePath: './memory.db',
  ollamaHost: '<VPS_IP>',  // Your VPS IP
  ollamaPort: 11434,
  ingestModel: 'qwen3.5:2b',
  consolidateModel: 'qwen3.5:4b',
  queryModel: 'qwen3.5:2b',
  consolidationIntervalMinutes: 30,
  enableHttpApi: false,
};
```

---

## Performance Comparison

| Setup | Model | Tokens/Second | Latency |
|-------|-------|---------------|---------|
| **Local (M1)** | qwen3.5:2b | ~5-10 t/s | Medium |
| **VPS (CPU)** | qwen3.5:2b | ~15-25 t/s | Fast |
| **VPS (RTX 3090)** | qwen3.5:4b | ~50-80 t/s | Very Fast |
| **VPS (A100)** | qwen3.5:14b | ~100+ t/s | Instant |

---

## Security Considerations

### 1. Restrict Access by IP

```bash
# UFW - allow only your IP
sudo ufw allow from <YOUR_IP> to any port 11434
```

### 2. Add Authentication (Optional)

Create nginx reverse proxy with auth:

```nginx
# /etc/nginx/sites-available/ollama
server {
    listen 11434;
    server_name _;

    location / {
        auth_basic "Ollama API";
        auth_basic_user_file /etc/nginx/.htpasswd;
        
        proxy_pass http://127.0.0.1:11434;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. SSH Tunnel (Most Secure)

```bash
# Create SSH tunnel instead of exposing port
ssh -L 11434:localhost:11434 root@<VPS_IP>

# Then use locally
export OLLAMA_HOST=http://localhost:11434
```

---

## Troubleshooting

### Connection Refused

```bash
# Check if Ollama is listening
sudo netstat -tlnp | grep 11434

# Should show: 0.0.0.0:11434
# If shows 127.0.0.1:11434, edit OLLAMA_HOST
```

### Slow Performance

```bash
# Check VPS resources
htop
free -h

# Check if GPU is being used (if applicable)
nvidia-smi
```

### Models Not Showing

```bash
# Pull models again
ollama pull qwen3.5:2b

# Check Ollama logs
sudo journalctl -u ollama -f
```

---

## Cost Estimates

| Provider | Instance | Monthly Cost | Models |
|----------|----------|--------------|--------|
| Hetzner | CPX31 | €13 | qwen3.5:2b, 4b |
| DigitalOcean | 4vCPU/8GB | $24 | qwen3.5:2b, 4b, 7b |
| Lambda Labs | 1x RTX 3090 | ~$400 | All models |
| RunPod | RTX 4090 | ~$500 | All models |

**Recommendation**: Start with Hetzner or DigitalOcean for CPU inference (~$15-25/month). Upgrade to GPU if you need faster response times.

---

## Quick Commands Reference

```bash
# VPS: Check Ollama status
sudo systemctl status ollama

# VPS: View logs
sudo journalctl -u ollama -f

# VPS: Restart Ollama
sudo systemctl restart ollama

# Local: Test connection
OLLAMA_HOST=http://<VPS_IP>:11434 ollama list

# Local: Benchmark
OLLAMA_HOST=http://<VPS_IP>:11434 time ollama run qwen3.5:2b "Hello"

# Local: Monitor (in real-time)
watch -n1 'OLLAMA_HOST=http://<VPS_IP>:11434 ollama list'
```
