# Quick Test Guide

## Ready to Test

All services are now integrated with a **one-command startup**!

## One-Command Startup

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech

# Start everything (voice, webvm, kernel)
make dev

# Or directly
./dev/run.sh
```

**That's it!** The script will:
1. ✅ Build all services
2. ✅ Start Voice Service (port 8001)
3. ✅ Start WebVM Service (port 8002)
4. ✅ Start Kernel Service (port 3000)
5. ✅ Show you all service URLs
6. ✅ Cleanly stop all services on Ctrl+C

## Service Endpoints

| Service | URL | Purpose |
|---------|-----|---------|
| Voice Health | http://localhost:8001/health | Chatterbox TTS/VC status |
| WebVM Health | http://localhost:8002/health | Linux VM status |
| WebVM UI | http://localhost:8002/ | Browser-based Linux VM |
| Kernel Health | http://localhost:3000/health | Core API status |

## Test Scenarios

### 1. Voice Service

```bash
# Check health
curl http://localhost:8001/health

# List available models
curl http://localhost:8001/v1/voice/models

# Generate speech via API
curl -X POST http://localhost:8001/v1/voice/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, world!","voice":"default"}' | jq

# Generate speech via CLI
./target/release/a2rchitech voice tts "Hello from CLI!" --output /tmp/test.wav
```

### 2. WebVM Service

```bash
# Check health
curl http://localhost:8002/health

# Get service status
curl http://localhost:8002/api/v1/status | jq

# Create session via API
curl -X POST http://localhost:8002/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"memory_mb":512}' | jq

# Create session via CLI
./target/release/a2rchitech webvm create --memory-mb 512

# List sessions
./target/release/a2rchitech webvm list

# Open WebVM in browser
open http://localhost:8002/
```

### 3. Kernel Integration

```bash
# Start REPL to test voice/webvm tools
./target/release/a2rchitech repl

# In REPL:
> use tool voice.tts with text "Testing kernel voice tool"

> use tool webvm.session with memory_mb 512

> tools list
```

## Logs

All service logs are in the `logs/` directory:

```bash
# Follow voice service logs
tail -f logs/voice-service.log

# Follow webvm service logs
tail -f logs/webvm-service.log

# Follow kernel logs
tail -f logs/kernel.log

# View all logs
make logs
```

## Stopping Services

Press `Ctrl+C` in the terminal where you ran `make dev` or `./dev/run.sh`

Or stop manually:

```bash
make stop

# Or kill individually
pkill -f "voice-service"
pkill -f "webvm-service"
pkill -f "kernel"
```

## Next Steps

After verifying services work:

1. **Use Voice Service**: Generate speech for your applications
2. **Use WebVM**: Run Linux commands in your browser
3. **Kernel Tools**: Both services are available as tools in the kernel
4. **CLI Integration**: All commands are available via `a2 voice` and `a2 webvm`

## What to Expect

- **First startup**: May take 1-2 minutes to build and start services
- **Voice service**: May need to download Chatterbox models on first run (~350MB)
- **Subsequent startups**: Much faster as everything is already built

## Troubleshooting

**Port already in use**:
```bash
# Find and kill process using the port
lsof -ti:8001 | xargs kill -9
lsof -ti:8002 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

**Build fails**:
```bash
# Clean and rebuild
make clean
make build
```

**Python dependencies missing**:
```bash
# Reinstall voice service dependencies
make install-deps
```

---

**Ready? Run `make dev` and start exploring! 🚀**
