# Memory Agent - VPS Quick Start Guide

**Your VPS Setup**: Ollama with Qwen 2.5 models

---

## VPS Configuration Summary

| Component | Value |
|-----------|-------|
| **Ollama Host** | `<VPS_IP>:11434` |
| **Models** | qwen2.5:1.5b, qwen2.5:3b, qwen2.5:7b |
| **Status** | ✅ Running as systemd service |
| **Access** | Remote (0.0.0.0:11434) |

---

## Option 1: Quick Configuration (Recommended)

```bash
# Navigate to memory agent
cd /Users/macbook/Desktop/allternit-workspace/allternit/services/memory/agent

# Run configuration script
./scripts/configure-vps.sh <YOUR_VPS_IP>

# Install dependencies
pnpm install

# Start memory agent
pnpm run start:http
```

---

## Option 2: Manual Configuration

### Step 1: Set Environment Variables

Add to your `~/.zshrc` or create `.env` file:

```bash
# ~/.zshrc
export OLLAMA_HOST=http://<YOUR_VPS_IP>:11434
export OLLAMA_PORT=11434
```

Or create `.env` in the agent directory:

```bash
# services/memory/agent/.env
OLLAMA_HOST=<YOUR_VPS_IP>
OLLAMA_PORT=11434
OLLAMA_INGEST_MODEL=qwen2.5:3b
OLLAMA_CONSOLIDATE_MODEL=qwen2.5:7b
OLLAMA_QUERY_MODEL=qwen2.5:3b
```

### Step 2: Test Connection

```bash
# Test VPS connection
curl http://<YOUR_VPS_IP>:11434/api/tags

# Should show:
# {"models":[{"name":"qwen2.5:1.5b",...},{"name":"qwen2.5:3b",...},{"name":"qwen2.5:7b",...}]}
```

### Step 3: Install & Start

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/services/memory/agent

pnpm install

pnpm run start:http
```

---

## Testing

### Test 1: Health Check

```bash
curl http://localhost:3201/health
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "ollama": true,
    "database": true,
    "fileWatcher": true,
    "httpServer": true
  },
  "uptime": "0d 0h 1m 30s"
}
```

### Test 2: Simple Query

```bash
curl -X POST http://localhost:3201/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is 2+2?"}'
```

### Test 3: Model Test (Direct Ollama)

```bash
# Using VPS models from your Mac
export OLLAMA_HOST=http://<YOUR_VPS_IP>:11434

ollama run qwen2.5:3b "Hello from my Mac!"
```

---

## Model Selection Guide

| Model | Speed | Capability | Use Case |
|-------|-------|------------|----------|
| **qwen2.5:1.5b** | ⚡⚡⚡ Fastest | Basic | Simple queries, testing |
| **qwen2.5:3b** | ⚡⚡ Fast | Good | Ingestion, general queries |
| **qwen2.5:7b** | ⚡ Slower | Best | Complex consolidation, insights |

**Recommended Configuration:**
- **Ingest**: qwen2.5:3b (balanced speed/quality)
- **Consolidate**: qwen2.5:7b (best reasoning)
- **Query**: qwen2.5:3b (fast responses)

---

## Performance Expectations

Based on typical VPS setups:

| VPS Type | Model | Tokens/Second | Query Time |
|----------|-------|---------------|------------|
| **CPU (4 vCPU)** | qwen2.5:3b | ~15-25 t/s | ~2-4 seconds |
| **CPU (8 vCPU)** | qwen2.5:7b | ~10-15 t/s | ~4-6 seconds |
| **GPU (RTX 3090)** | qwen2.5:7b | ~50-80 t/s | ~1-2 seconds |

---

## Troubleshooting

### Connection Refused

```bash
# Check VPS IP is correct
ping <YOUR_VPS_IP>

# Check Ollama is running on VPS
ssh root@<YOUR_VPS_IP> "systemctl status ollama"

# Check firewall
ssh root@<YOUR_VPS_IP> "ufw status | grep 11434"
```

### Slow Responses

```bash
# Check VPS resources
ssh root@<YOUR_VPS_IP> "htop"

# Try smaller model
export OLLAMA_INGEST_MODEL=qwen2.5:1.5b
export OLLAMA_QUERY_MODEL=qwen2.5:1.5b
```

### Models Not Found

```bash
# List models on VPS
OLLAMA_HOST=http://<YOUR_VPS_IP>:11434 ollama list

# Pull missing model
ssh root@<YOUR_VPS_IP> "ollama pull qwen2.5:3b"
```

---

## Security Recommendations

### 1. Restrict Firewall Access

On your VPS:

```bash
# Allow only your Mac's IP
sudo ufw allow from <YOUR_MAC_IP> to any port 11434
sudo ufw reload

# Find your Mac's public IP
curl ifconfig.me
```

### 2. Use SSH Tunnel (Most Secure)

```bash
# Create SSH tunnel instead of exposing port
ssh -L 11434:localhost:11434 root@<YOUR_VPS_IP>

# Then use locally
export OLLAMA_HOST=http://localhost:11434
```

### 3. Add Authentication (Optional)

See `VPS_OLLAMA_SETUP.md` for nginx reverse proxy setup with auth.

---

## Daily Usage

```bash
# Start memory agent
cd services/memory/agent
pnpm run start:http

# Ingest a file
echo "Meeting notes: We decided on microservices" > inbox/notes.txt

# Query memory
curl -X POST http://localhost:3201/api/query \
  -d '{"question": "What did we decide about architecture?"}'

# Check stats
curl http://localhost:3201/stats

# Stop agent
pnpm run daemon stop
```

---

## CLI Integration

Once the memory agent is running:

```bash
# From anywhere in allternit
a2r memory query "What do we know about DAG validation?"
a2r memory stats
a2r memory consolidate
```

---

## Quick Reference

```bash
# Configuration
./scripts/configure-vps.sh <IP>

# Start
pnpm run start:http

# Daemon mode
pnpm run daemon start
pnpm run daemon status
pnpm run daemon logs

# Test
curl http://localhost:3201/health
curl http://localhost:3201/stats
curl -X POST http://localhost:3201/api/query -d '{"question":"Hello"}'

# Direct Ollama (VPS)
export OLLAMA_HOST=http://<IP>:11434
ollama run qwen2.5:3b "Test"
```

---

**Need Help?**

1. Check connection: `curl http://<VPS_IP>:11434/api/tags`
2. Check logs: `pnpm run daemon logs`
3. Review docs: `cat INTEGRATION_GUIDE.md`
