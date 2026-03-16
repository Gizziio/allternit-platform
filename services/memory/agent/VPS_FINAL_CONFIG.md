# 🎉 Your VPS + Memory Agent - Final Configuration

**VPS Status**: ✅ Qwen 3.5 models installed and tested  
**Models**: qwen3.5:0.8b, qwen3.5:2b, qwen3.5:4b  
**Status**: Ready to connect!

---

## Quick Configuration

### Step 1: Run Configuration Script

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/4-services/memory/agent

# Replace with your actual VPS IP
./scripts/configure-vps.sh <YOUR_VPS_IP>
```

### Step 2: Install & Start

```bash
pnpm install
pnpm run start:http
```

### Step 3: Test

```bash
# Health check
curl http://localhost:3201/health

# Test query (uses VPS Qwen 3.5)
curl -X POST http://localhost:3201/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What model are you?"}'
```

---

## Your Qwen 3.5 Models

| Model | Size | Speed | Best For |
|-------|------|-------|----------|
| **qwen3.5:0.8b** | 1.0 GB | ⚡⚡⚡ Fastest | Testing, simple tasks |
| **qwen3.5:2b** | 2.7 GB | ⚡⚡ Fast | Ingestion, queries (default) |
| **qwen3.5:4b** | 3.4 GB | ⚡ Slower | Consolidation, reasoning (default) |

**Why Qwen 3.5?**
- ✅ 256K context window (8x larger than Qwen 2.5)
- ✅ Gated Delta Networks + MoE architecture
- ✅ Better reasoning capabilities
- ✅ Multimodal support (text + images)

---

## Configuration Details

### Environment Variables

```bash
# .env file (created by configure script)
OLLAMA_HOST=<YOUR_VPS_IP>
OLLAMA_PORT=11434
OLLAMA_INGEST_MODEL=qwen3.5:2b
OLLAMA_CONSOLIDATE_MODEL=qwen3.5:4b
OLLAMA_QUERY_MODEL=qwen3.5:2b
MEMORY_ENABLE_HTTP_API=true
MEMORY_HTTP_PORT=3201
```

### System-wide VPS Usage

Add to your `~/.zshrc`:

```bash
export OLLAMA_HOST=http://<YOUR_VPS_IP>:11434
export OLLAMA_PORT=11434
```

Then test:

```bash
source ~/.zshrc
ollama run qwen3.5:4b "Hello from my Mac!"
```

---

## Performance Expectations

| VPS Type | Model | Tokens/Second | Query Time |
|----------|-------|---------------|------------|
| **CPU (4 vCPU)** | qwen3.5:2b | ~15-25 t/s | ~2-4 seconds |
| **CPU (8 vCPU)** | qwen3.5:4b | ~10-15 t/s | ~4-6 seconds |
| **GPU (RTX 3090)** | qwen3.5:4b | ~50-80 t/s | ~1-2 seconds |

---

## Security Setup

### Option 1: Firewall (Recommended)

On your VPS:

```bash
ssh root@<YOUR_VPS_IP>

# Find your Mac's IP
curl ifconfig.me

# Allow only your IP
sudo ufw allow from <YOUR_MAC_IP> to any port 11434
sudo ufw reload

# Verify
sudo ufw status
```

### Option 2: SSH Tunnel (Most Secure)

```bash
# Create tunnel (keeps running)
ssh -L 11434:localhost:11434 root@<YOUR_VPS_IP>

# In another terminal, use locally
export OLLAMA_HOST=http://localhost:11434
ollama run qwen3.5:2b "Test"
```

---

## Daily Usage

```bash
# Start memory agent
cd 4-services/memory/agent
pnpm run start:http

# Or as daemon
pnpm run daemon start

# Check status
pnpm run daemon status

# View logs
pnpm run daemon logs

# Stop
pnpm run daemon stop
```

---

## Testing Your Setup

### Test 1: Direct Ollama Connection

```bash
export OLLAMA_HOST=http://<YOUR_VPS_IP>:11434
ollama list
```

Should show:
```
NAME            ID              SIZE
qwen3.5:0.8b    ...             1.0 GB
qwen3.5:2b      ...             2.7 GB
qwen3.5:4b      ...             3.4 GB
```

### Test 2: Run Model

```bash
ollama run qwen3.5:2b "What is your name?"
```

Should respond with Qwen 3.5 identity.

### Test 3: Memory Agent Health

```bash
curl http://localhost:3201/health
```

Should show all checks passing.

### Test 4: Query Memory

```bash
curl -X POST http://localhost:3201/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "Explain quantum computing in 2 sentences"}'
```

---

## Troubleshooting

### Connection Refused

```bash
# Check VPS is reachable
ping <YOUR_VPS_IP>

# Check Ollama on VPS
ssh root@<YOUR_VPS_IP> "systemctl status ollama"

# Test manually
curl http://<YOUR_VPS_IP>:11434/api/tags
```

### Model Too Slow

```bash
# Use smaller model temporarily
export OLLAMA_QUERY_MODEL=qwen3.5:0.8b

# Or edit .env
OLLAMA_QUERY_MODEL=qwen3.5:0.8b
```

### Out of Memory on VPS

```bash
# Check VPS memory
ssh root@<YOUR_VPS_IP> "free -h"

# Use smaller models
export OLLAMA_INGEST_MODEL=qwen3.5:0.8b
export OLLAMA_CONSOLIDATE_MODEL=qwen3.5:2b
export OLLAMA_QUERY_MODEL=qwen3.5:0.8b
```

---

## Integration Points

### CLI Commands

```bash
a2r memory query "What do we know about DAG validation?"
a2r memory stats
a2r memory consolidate
```

### Gateway API

Available at: `http://localhost:3201/api/v1/memory/*`

```bash
# Via gateway (once configured)
curl http://localhost:8013/api/v1/memory/query \
  -d '{"question": "Hello"}'
```

### Direct Memory Agent

```bash
# Health
curl http://localhost:3201/health

# Stats
curl http://localhost:3201/stats

# Query
curl -X POST http://localhost:3201/api/query \
  -d '{"question": "What is AI?"}'

# Ingest
curl -X POST http://localhost:3201/api/ingest \
  -d '{"content": "Meeting notes...", "source": "meeting-001"}'
```

---

## Model Switching

### For Testing (Fastest)

```bash
export OLLAMA_INGEST_MODEL=qwen3.5:0.8b
export OLLAMA_CONSOLIDATE_MODEL=qwen3.5:0.8b
export OLLAMA_QUERY_MODEL=qwen3.5:0.8b
```

### For Production (Best Quality)

```bash
export OLLAMA_INGEST_MODEL=qwen3.5:2b
export OLLAMA_CONSOLIDATE_MODEL=qwen3.5:4b
export OLLAMA_QUERY_MODEL=qwen3.5:2b
```

### For Balanced (Speed + Quality)

```bash
export OLLAMA_INGEST_MODEL=qwen3.5:2b
export OLLAMA_CONSOLIDATE_MODEL=qwen3.5:2b
export OLLAMA_QUERY_MODEL=qwen3.5:2b
```

---

## Next Steps

1. ✅ **Run configuration**:
   ```bash
   ./scripts/configure-vps.sh <YOUR_VPS_IP>
   ```

2. ✅ **Install dependencies**:
   ```bash
   pnpm install
   ```

3. ✅ **Start agent**:
   ```bash
   pnpm run start:http
   ```

4. ✅ **Test it**:
   ```bash
   curl http://localhost:3201/health
   ```

5. ✅ **Secure VPS** (recommended):
   ```bash
   ssh root@<YOUR_VPS_IP>
   sudo ufw allow from <YOUR_IP> to any port 11434
   ```

---

## Documentation

| File | Purpose |
|------|---------|
| `VPS_FINAL_CONFIG.md` | This file - Your setup |
| `VPS_QUICKSTART.md` | Quick reference |
| `INTEGRATION_GUIDE.md` | Developer guide |
| `README.md` | Main documentation |

---

**Your VPS with Qwen 3.5 is ready! Run the configure script to connect.** 🚀

```bash
./scripts/configure-vps.sh <YOUR_VPS_IP>
```
