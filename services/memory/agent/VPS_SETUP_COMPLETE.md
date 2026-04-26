# ✅ Memory Agent + Your VPS - Setup Complete!

**Date**: March 8, 2026  
**VPS Status**: Ollama installed with Qwen 2.5 models  
**Local Status**: Memory agent configured for VPS connection

---

## Your Setup

### VPS (Remote)
```
IP: <YOUR_VPS_IP>
Port: 11434
Models: qwen2.5:1.5b, qwen2.5:3b, qwen2.5:7b
Status: ✅ Running as systemd service
```

### Local (Your Mac)
```
Location: 4-services/memory/agent/
HTTP API: Port 3201
Database: SQLite (memory.db)
Status: Ready to configure
```

---

## Quick Start (3 Steps)

### Step 1: Configure VPS Connection

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/4-services/memory/agent

# Run the configuration script
./scripts/configure-vps.sh <YOUR_VPS_IP>
```

This will:
- Create `.env` file with your VPS IP
- Test connection to VPS Ollama
- Show available models

### Step 2: Install Dependencies

```bash
pnpm install
```

### Step 3: Start Memory Agent

```bash
pnpm run start:http
```

---

## Test It!

### Test 1: Health Check
```bash
curl http://localhost:3201/health
```

### Test 2: Query Memory
```bash
curl -X POST http://localhost:3201/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is artificial intelligence?"}'
```

### Test 3: Direct Ollama (VPS)
```bash
# Set VPS as Ollama host
export OLLAMA_HOST=http://<YOUR_VPS_IP>:11434

# Run model
ollama run qwen2.5:3b "Hello from my Mac!"
```

---

## Configuration Files Created

| File | Purpose |
|------|---------|
| `4-services/memory/agent/.env.example` | Template configuration |
| `4-services/memory/agent/scripts/configure-vps.sh` | VPS setup script |
| `4-services/memory/agent/VPS_QUICKSTART.md` | Detailed VPS guide |
| `4-services/memory/agent/VPS_OLLAMA_SETUP.md` | VPS installation guide |

---

## Model Configuration

Your VPS has these models:

| Model | Size | Speed | Best For |
|-------|------|-------|----------|
| **qwen2.5:1.5b** | ~1GB | ⚡⚡⚡ Fastest | Testing, simple queries |
| **qwen2.5:3b** | ~2GB | ⚡⚡ Fast | Ingestion, general queries |
| **qwen2.5:7b** | ~4GB | ⚡ Slower | Complex consolidation |

**Default Configuration:**
- Ingest: `qwen2.5:3b`
- Consolidate: `qwen2.5:7b`
- Query: `qwen2.5:3b`

**Change Models:**
Edit `.env` file:
```bash
OLLAMA_INGEST_MODEL=qwen2.5:1.5b
OLLAMA_CONSOLIDATE_MODEL=qwen2.5:7b
OLLAMA_QUERY_MODEL=qwen2.5:1.5b
```

---

## Environment Variables

All configurable via `.env` or environment:

```bash
# VPS Connection
OLLAMA_HOST=<YOUR_VPS_IP>
OLLAMA_PORT=11434

# Models
OLLAMA_INGEST_MODEL=qwen2.5:3b
OLLAMA_CONSOLIDATE_MODEL=qwen2.5:7b
OLLAMA_QUERY_MODEL=qwen2.5:3b

# HTTP API
MEMORY_ENABLE_HTTP_API=true
MEMORY_HTTP_PORT=3201

# Paths
MEMORY_WATCH_DIRECTORY=./inbox
MEMORY_DATABASE_PATH=./memory.db
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Your Mac (Local)                                        │
│                                                          │
│  ┌────────────────┐      ┌────────────────┐            │
│  │ Memory Agent   │──────│ HTTP API       │            │
│  │ (TypeScript)   │      │ Port 3201      │            │
│  └────────────────┘      └────────────────┘            │
│         │                                               │
│         │ HTTP                                          │
│         │                                               │
└─────────┼───────────────────────────────────────────────┘
          │
          │ Internet
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│  Your VPS (Remote)                                       │
│                                                          │
│  ┌────────────────┐      ┌────────────────┐            │
│  │ Ollama         │──────│ Qwen 2.5       │            │
│  │ Port 11434     │      │ Models         │            │
│  └────────────────┘      └────────────────┘            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Security Checklist

- [ ] Configure VPS firewall (UFW)
- [ ] Allow only your Mac's IP
- [ ] Or use SSH tunnel for maximum security

### Configure Firewall (On VPS)

```bash
# SSH to VPS
ssh root@<YOUR_VPS_IP>

# Find your Mac's public IP
curl ifconfig.me

# Allow only your IP
sudo ufw allow from <YOUR_MAC_IP> to any port 11434
sudo ufw reload

# Check status
sudo ufw status
```

### Or Use SSH Tunnel (Most Secure)

```bash
# Create tunnel
ssh -L 11434:localhost:11434 root@<YOUR_VPS_IP>

# Use locally
export OLLAMA_HOST=http://localhost:11434
```

---

## Daily Usage

```bash
# 1. Navigate to agent
cd 4-services/memory/agent

# 2. Start (foreground)
pnpm run start:http

# Or start as daemon
pnpm run daemon start

# 3. Check status
pnpm run daemon status

# 4. View logs
pnpm run daemon logs

# 5. Stop
pnpm run daemon stop
```

---

## Integration with allternit

### CLI Commands

```bash
# Query memory
allternit memory query "What do we know about DAG validation?"

# Show stats
allternit memory stats

# Trigger consolidation
allternit memory consolidate
```

### Gateway API

```python
# 4-services/gateway/src/main.py
@app.post("/api/v1/memory/query")
async def memory_query(request: MemoryQueryRequest):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"http://localhost:3201/api/query",
            json={"question": request.question}
        )
        return response.json()
```

### Rust Services

```rust
// 4-services/memory/src/memory_agent_adapter.rs
let adapter = MemoryAgentAdapter::with_url("http://localhost:3201")?;
let result = adapter.query(&MemoryQuery {
    query: "Previous executions".to_string(),
    limit: Some(10),
    ..Default::default()
}).await?;
```

---

## Troubleshooting

### "Connection refused"

```bash
# Check VPS IP
ping <YOUR_VPS_IP>

# Check Ollama on VPS
ssh root@<YOUR_VPS_IP> "systemctl status ollama"

# Test manually
curl http://<YOUR_VPS_IP>:11434/api/tags
```

### "Model not found"

```bash
# List models on VPS
OLLAMA_HOST=http://<YOUR_VPS_IP>:11434 ollama list

# Pull missing model
ssh root@<YOUR_VPS_IP> "ollama pull qwen2.5:3b"
```

### Slow responses

```bash
# Check VPS resources
ssh root@<YOUR_VPS_IP> "htop"

# Use smaller model
export OLLAMA_QUERY_MODEL=qwen2.5:1.5b
```

---

## Next Steps

1. **Run configuration script**:
   ```bash
   ./scripts/configure-vps.sh <YOUR_VPS_IP>
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Start memory agent**:
   ```bash
   pnpm run start:http
   ```

4. **Test it**:
   ```bash
   curl http://localhost:3201/health
   ```

5. **Secure your VPS**:
   ```bash
   ssh root@<YOUR_VPS_IP>
   sudo ufw allow from <YOUR_IP> to any port 11434
   ```

---

## Documentation

| Document | Location |
|----------|----------|
| Quick Start | `VPS_QUICKSTART.md` |
| Full Setup Guide | `VPS_OLLAMA_SETUP.md` |
| Integration Guide | `INTEGRATION_GUIDE.md` |
| Implementation | `IMPLEMENTATION_SUMMARY.md` |

---

**Ready to go! Just run the configuration script with your VPS IP.** 🚀

```bash
./scripts/configure-vps.sh <YOUR_VPS_IP>
```
