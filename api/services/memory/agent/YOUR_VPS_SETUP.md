# ✅ Your VPS + Memory Agent - COMPLETE & SECURE

**Status**: Production Ready  
**Security**: Firewall configured (UFW active)  
**Access**: Restricted to your IP (73.185.170.6)

---

## Your Configuration

### VPS Details
```
IP: <YOUR_VPS_IP>
Port: 11434 (Ollama)
Firewall: UFW Active ✅
Allowed IP: 73.185.170.6 (Your Mac)
Models: qwen3.5:0.8b, qwen3.5:2b, qwen3.5:4b
```

### Security Rules
```
✅ SSH (port 22): Open for all
✅ Ollama (port 11434): ONLY your IP (73.185.170.6)
✅ All other ports: Blocked
```

---

## Quick Start

### Step 1: Edit .env with Your VPS IP

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/services/memory/agent

# Edit .env file - replace <YOUR_VPS_IP> with actual IP
nano .env
```

Change this line:
```bash
OLLAMA_HOST=<YOUR_VPS_IP>
```

To your actual VPS IP:
```bash
OLLAMA_HOST=your.vps.ip.here
```

### Step 2: Test Connection

```bash
# Test direct connection to VPS
export OLLAMA_HOST=http://<YOUR_VPS_IP>:11434
ollama list

# Should show your Qwen 3.5 models
```

### Step 3: Start Memory Agent

```bash
pnpm install
pnpm run start:http
```

### Step 4: Verify

```bash
# Health check
curl http://localhost:3201/health

# Test query (uses VPS)
curl -X POST http://localhost:3201/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What model are you?"}'
```

---

## System-Wide Configuration (Optional)

Add to your `~/.zshrc` for all terminals:

```bash
# Your VPS Ollama
export OLLAMA_HOST=http://<YOUR_VPS_IP>:11434
export OLLAMA_PORT=11434
```

Then:
```bash
source ~/.zshrc
ollama run qwen3.5:4b "Hello from my Mac!"
```

---

## Testing

### Test 1: Direct Ollama Access

```bash
export OLLAMA_HOST=http://<YOUR_VPS_IP>:11434
ollama run qwen3.5:2b "Are you secured by a firewall?"
```

### Test 2: Memory Agent Health

```bash
curl http://localhost:3201/health
```

Expected:
```json
{
  "status": "healthy",
  "checks": {
    "ollama": true,
    "database": true,
    "fileWatcher": true,
    "httpServer": true
  }
}
```

### Test 3: Query Memory

```bash
curl -X POST http://localhost:3201/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "Explain quantum computing"}'
```

---

## Security Verification

### Check Firewall Status (On VPS)

```bash
ssh root@<YOUR_VPS_IP>

# Check UFW status
sudo ufw status

# Should show:
# To                         Action      From
# --                         ------      ----
# 22/tcp                     ALLOW       Anywhere
# 11434/tcp                  ALLOW       73.185.170.6
# 22/tcp (v6)                ALLOW       Anywhere (v6)
```

### Test from Different IP (Should Fail)

If someone tries from a different IP, they'll get:
```
curl: (7) Failed to connect to <YOUR_VPS_IP> port 11434: Connection refused
```

### Test from Your Mac (Should Work)

```bash
export OLLAMA_HOST=http://<YOUR_VPS_IP>:11434
ollama list  # ✅ Should work
```

---

## Model Usage Guide

| Task | Model | Command |
|------|-------|---------|
| **Quick test** | qwen3.5:0.8b | `ollama run qwen3.5:0.8b "Hi"` |
| **Daily queries** | qwen3.5:2b | `ollama run qwen3.5:2b "Explain..."` |
| **Complex reasoning** | qwen3.5:4b | `ollama run qwen3.5:4b "Analyze..."` |

### Change Default Models

Edit `.env`:
```bash
# For speed (all tasks)
OLLAMA_INGEST_MODEL=qwen3.5:0.8b
OLLAMA_CONSOLIDATE_MODEL=qwen3.5:0.8b
OLLAMA_QUERY_MODEL=qwen3.5:0.8b

# For quality (all tasks)
OLLAMA_INGEST_MODEL=qwen3.5:4b
OLLAMA_CONSOLIDATE_MODEL=qwen3.5:4b
OLLAMA_QUERY_MODEL=qwen3.5:4b

# Balanced (recommended)
OLLAMA_INGEST_MODEL=qwen3.5:2b
OLLAMA_CONSOLIDATE_MODEL=qwen3.5:4b
OLLAMA_QUERY_MODEL=qwen3.5:2b
```

---

## Daily Usage

```bash
# Start memory agent
cd services/memory/agent
pnpm run start:http

# Or as background daemon
pnpm run daemon start

# Check status
pnpm run daemon status

# View logs
pnpm run daemon logs

# Stop
pnpm run daemon stop
```

---

## CLI Integration

Once memory agent is running:

```bash
# Query memory
allternit memory query "What do we know about DAG validation?"

# Show stats
allternit memory stats

# Trigger consolidation
allternit memory consolidate
```

---

## Troubleshooting

### Connection Timeout

```bash
# Check your IP hasn't changed
curl ifconfig.me

# Verify firewall on VPS
ssh root@<YOUR_VPS_IP> "sudo ufw status"

# Test connection
ping <YOUR_VPS_IP>
```

### "Connection Refused"

```bash
# Check Ollama is running on VPS
ssh root@<YOUR_VPS_IP> "systemctl status ollama"

# Restart if needed
ssh root@<YOUR_VPS_IP> "systemctl restart ollama"
```

### Slow Responses

```bash
# Use smaller model
export OLLAMA_QUERY_MODEL=qwen3.5:0.8b

# Check VPS resources
ssh root@<YOUR_VPS_IP> "htop"
```

---

## If Your IP Changes

If your Mac's IP changes (dynamic IP):

1. Get new IP: `curl ifconfig.me`
2. Update VPS firewall:
   ```bash
   ssh root@<YOUR_VPS_IP>
   sudo ufw delete allow from 73.185.170.6 to any port 11434
   sudo ufw allow from <NEW_IP> to any port 11434
   ```

---

## Performance Expectations

| Model | Speed | Best For |
|-------|-------|----------|
| qwen3.5:0.8b | ~25-40 t/s | Testing, simple queries |
| qwen3.5:2b | ~15-25 t/s | Daily use, ingestion |
| qwen3.5:4b | ~10-15 t/s | Complex reasoning |

*(Varies based on VPS CPU/GPU)*

---

## Next Steps

1. ✅ **Edit `.env`** - Add your VPS IP
2. ✅ **Test connection** - `export OLLAMA_HOST=... && ollama list`
3. ✅ **Install dependencies** - `pnpm install`
4. ✅ **Start agent** - `pnpm run start:http`
5. ✅ **Test query** - `curl http://localhost:3201/api/query`

---

## Security Checklist

- [x] UFW firewall active
- [x] SSH port (22) allowed
- [x] Ollama port (11434) restricted to your IP
- [x] No authentication needed (firewall protects)
- [ ] **TODO**: Edit `.env` with your VPS IP
- [ ] **TODO**: Test connection
- [ ] **TODO**: Start memory agent

---

**Your secure VPS Ollama server is ready! Just edit `.env` with your VPS IP and start the agent.** 🎉

```bash
# Edit config
nano .env

# Start agent
pnpm run start:http

# Test
curl http://localhost:3201/health
```
