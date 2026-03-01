# Terminal Server Setup - Quick Reference

## What is the Terminal Server?

The Terminal Server is a **headless HTTP API service** that provides unified access to AI models for the A2rchitect Web and Desktop applications. It runs on **port 4096** and acts as a central gateway to multiple AI providers.

## Architecture

```
Web App (Port 5177) ◄─────────────────────┐
                                           │ HTTP/WebSocket
Desktop App ◄──────────────────────────────┼──► Terminal Server (Port 4096)
                                           │     - /provider (AI models)
External Tools ◄───────────────────────────┘     - /session (Chat)
                                                  - /agent (Agents)
                                                         │
                    ┌────────────┬────────────┬────────┴────────┐
                    ▼            ▼            ▼                 ▼
               OpenAI      Anthropic      Google            Mistral
               GPT-4o      Claude 3.5     Gemini            etc.
```

## Setup Options

### Option 1: New Startup Script (Recommended)

```bash
# Use the pre-configured startup script
./dev/scripts/start-all-with-terminal.sh start

# Check status
./dev/scripts/start-all-with-terminal.sh status

# View logs
./dev/scripts/start-all-with-terminal.sh logs terminal

# Stop everything
./dev/scripts/start-all-with-terminal.sh stop
```

### Option 2: Patch Existing Script

```bash
# Integrate Terminal Server into existing start-all.sh
./dev/scripts/integrate-terminal-server.sh

# Then use as normal
./dev/scripts/start-all.sh start
```

### Option 3: Docker Compose

```bash
# Start with Docker
docker-compose -f docker-compose.with-terminal.yml up -d

# Scale the terminal server if needed
docker-compose -f docker-compose.with-terminal.yml up -d --scale terminal-server=2
```

### Option 4: Manual

```bash
cd 7-apps/shell/terminal
bun install
bun run src/index.ts serve --port 4096 --hostname 127.0.0.1
```

## Configuration

### 1. Environment Variables

Create `.env` in project root:

```bash
# Terminal Server
A2R_SERVER_PORT=4096
A2R_SERVER_HOST=127.0.0.1
A2R_SERVER_PASSWORD=optional_password

# AI Provider Keys (add your own)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
MISTRAL_API_KEY=...
GROQ_API_KEY=...
```

### 2. Web App Auto-Configuration

The startup script automatically creates:
```bash
# 7-apps/shell/web/.env.development.local
VITE_API_URL=http://127.0.0.1:4096
VITE_TERMINAL_SERVER=http://127.0.0.1:4096
```

## API Quick Reference

### Check Server Health
```bash
curl http://localhost:4096/doc
```

### List AI Providers
```bash
curl http://localhost:4096/provider | jq
```

### Create Chat Session
```bash
curl -X POST http://localhost:4096/session \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Session", "model": "openai/gpt-4o"}'
```

### Subscribe to Events (SSE)
```bash
curl http://localhost:4096/event
```

## Web App Integration

### Using the Hook

```typescript
import { useTerminalServer } from './hooks/useTerminalServer';

function ChatComponent() {
  const {
    providers,
    sessions,
    currentSession,
    messages,
    isLoading,
    isStreaming,
    error,
    isConnected,
    fetchProviders,
    createSession,
    sendMessage,
  } = useTerminalServer();

  // Fetch providers on mount
  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Create session
  const handleCreateSession = () => {
    createSession('New Chat', 'openai/gpt-4o');
  };

  // Send message
  const handleSend = (content: string) => {
    sendMessage(content);
  };

  return (
    <div>
      {!isConnected && <div>Terminal Server offline</div>}
      {/* ... */}
    </div>
  );
}
```

## Service Dependencies

Startup order (handled automatically):

1. **Terminal Server** (Port 4096) - Must start first
2. **Voice Service** (Port 8001) - Optional
3. **API Service** (Port 3000) - Uses Terminal Server
4. **OpenClaw** (Port 18789) - Optional
5. **Web App** (Port 5177) - Depends on Terminal Server

## Troubleshooting

### Terminal Server Won't Start
```bash
# Check port
lsof -i :4096

# Kill process
kill $(lsof -ti :4096)

# Check logs
tail -f .logs/terminal-server.log
```

### Web App Can't Connect
```bash
# Verify Terminal Server
curl http://localhost:4096/doc

# Check Web App env
cat 7-apps/shell/web/.env.development.local

# Restart Web App
./dev/scripts/start-all-with-terminal.sh restart
```

### Provider Authentication
```bash
# Set auth via CLI
cd 7-apps/shell/terminal
bun run src/index.ts auth set openai

# Or export env var
export OPENAI_API_KEY=sk-...
```

## Files Created

| File | Purpose |
|------|---------|
| `dev/scripts/start-all-with-terminal.sh` | Full startup script with Terminal Server |
| `dev/scripts/integrate-terminal-server.sh` | Patch script for existing start-all.sh |
| `docker-compose.with-terminal.yml` | Docker Compose with Terminal Server |
| `docs/TERMINAL_SERVER_INTEGRATION.md` | Full integration guide |
| `7-apps/shell/web/src/hooks/useTerminalServer.ts` | React hook for Terminal Server API |

## Next Steps

1. **Configure AI Keys**: Add your API keys to `.env`
2. **Start Services**: Run `./dev/scripts/start-all-with-terminal.sh start`
3. **Verify**: Check http://localhost:4096/doc
4. **Open Web App**: Navigate to http://localhost:5177
5. **Test**: Create a chat session and send a message

## Architecture Benefits

- **Single Configuration**: AI provider setup in one place
- **Multi-Client**: Web, Desktop, and tools share same backend
- **Security**: API keys stay on server
- **Extensibility**: Easy to add new AI providers
- **Caching**: Centralized response caching
- **Budget Control**: Unified rate limiting and metering

## Support

- Full docs: `docs/TERMINAL_SERVER_INTEGRATION.md`
- Terminal README: `7-apps/shell/terminal/README.md`
- API contracts: `UI_CONTRACTS.ts`
