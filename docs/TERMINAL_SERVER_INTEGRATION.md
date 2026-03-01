# Terminal Server Integration Guide

## Overview

The **Terminal Server** is a core component of the A2rchitect workspace that provides **unified AI model APIs** to both the Web and Desktop applications. It acts as a central gateway for accessing multiple AI providers (OpenAI, Anthropic, Google, Mistral, etc.) through a single, consistent HTTP API.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         A2rchitect Workspace                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐      ┌──────────────────┐      ┌──────────────┐  │
│  │   Web App        │      │   Desktop App    │      │  Other       │  │
│  │   (React/Vite)   │◄────►│   (Electron)     │◄────►│  Clients     │  │
│  │   Port: 5177     │      │   Port: 3000     │      │              │  │
│  └────────┬─────────┘      └────────┬─────────┘      └──────┬───────┘  │
│           │                         │                       │          │
│           └─────────────────────────┼───────────────────────┘          │
│                                     │                                  │
│                                     ▼                                  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    TERMINAL SERVER                               │  │
│  │                    Port: 4096                                    │  │
│  │                                                                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │  │
│  │  │ /provider   │  │ /session    │  │ /agent      │  │ /event  │ │  │
│  │  │ List Models │  │ Chat API    │  │ Agent Mgmt  │  │  (SSE)  │ │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────┬────┘ │  │
│  │         └─────────────────┴─────────────────┴─────────────┘      │  │
│  │                              │                                    │  │
│  │                    ┌─────────▼──────────┐                         │  │
│  │                    │  Vercel AI SDK     │                         │  │
│  │                    │  Provider Router   │                         │  │
│  │                    └─────────┬──────────┘                         │  │
│  └──────────────────────────────┼───────────────────────────────────┘  │
│                                 │                                       │
│         ┌───────────┬───────────┼───────────┬───────────┐              │
│         ▼           ▼           ▼           ▼           ▼              │
│    ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐         │
│    │OpenAI  │  │Anthropic│  │Google  │  │Mistral │  │Groq    │         │
│    │GPT-4o  │  │Claude   │  │Gemini  │  │        │  │Llama   │         │
│    └────────┘  └────────┘  └────────┘  └────────┘  └────────┘         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Option 1: Using the Startup Script (Recommended)

```bash
# Start all services including Terminal Server
./dev/scripts/start-all-with-terminal.sh start

# Check status
./dev/scripts/start-all-with-terminal.sh status

# View Terminal Server logs
./dev/scripts/start-all-with-terminal.sh logs terminal

# Stop all services
./dev/scripts/start-all-with-terminal.sh stop
```

### Option 2: Using Docker Compose

```bash
# Start with Terminal Server
docker-compose -f docker-compose.with-terminal.yml up -d

# View logs
docker-compose -f docker-compose.with-terminal.yml logs -f terminal-server

# Stop
docker-compose -f docker-compose.with-terminal.yml down
```

### Option 3: Manual Start

```bash
cd 7-apps/shell/terminal

# Install dependencies
bun install

# Start server
bun run src/index.ts serve --port 4096 --hostname 127.0.0.1
```

## API Endpoints

Once running, the Terminal Server provides these key endpoints:

### AI Provider Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /provider` | GET | List all available AI providers and models |
| `GET /provider/auth` | GET | Get authentication methods for providers |
| `POST /provider/:id/oauth/authorize` | POST | Initiate OAuth flow for provider |
| `POST /provider/:id/oauth/callback` | POST | Complete OAuth callback |

### Chat Sessions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /session` | GET | List all chat sessions |
| `POST /session` | POST | Create new chat session |
| `GET /session/:id` | GET | Get session details |
| `POST /session/:id/init` | POST | Initialize session with AGENTS.md |
| `DELETE /session/:id` | DELETE | Delete session |

### Agent Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /agent` | GET | List available AI agents |
| `GET /skill` | GET | List available skills |

### Real-time Events

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /event` | GET | Server-Sent Events (SSE) stream |

### System

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /doc` | GET | OpenAPI documentation |
| `GET /path` | GET | Get system paths |
| `GET /lsp` | GET | LSP server status |

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Terminal Server Configuration
A2R_SERVER_PORT=4096
A2R_SERVER_HOST=127.0.0.1
A2R_SERVER_PASSWORD=your_secure_password  # Optional: enable basic auth

# AI Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
MISTRAL_API_KEY=...
GROQ_API_KEY=...
COHERE_API_KEY=...
AZURE_OPENAI_API_KEY=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### Web App Configuration

The Web App automatically configures itself when using the startup script. For manual setup:

```bash
# In 7-apps/shell/web/.env.development.local
VITE_API_URL=http://127.0.0.1:4096
VITE_TERMINAL_SERVER=http://127.0.0.1:4096
```

## Usage Examples

### 1. List Available Models

```bash
curl http://localhost:4096/provider | jq
```

Response:
```json
{
  "all": [
    {
      "id": "openai",
      "name": "OpenAI",
      "models": ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"]
    },
    {
      "id": "anthropic",
      "name": "Anthropic",
      "models": ["claude-3-5-sonnet", "claude-3-5-haiku"]
    }
  ],
  "connected": ["openai", "anthropic"]
}
```

### 2. Create a Chat Session

```bash
curl -X POST http://localhost:4096/session \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My AI Session",
    "model": "openai/gpt-4o"
  }' | jq
```

### 3. Subscribe to Events (SSE)

```javascript
const eventSource = new EventSource('http://localhost:4096/event');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data);
};
```

### 4. From Web App

```typescript
// Using the runtime service
import { getRuntimeSettings, updateRuntimeSettings } from './services/runtimeService';

// Get current settings
const settings = await getRuntimeSettings();

// Update driver configuration
await updateRuntimeSettings({
  driver: {
    driver_type: 'process',
    isolation_level: 'standard',
    enabled: true
  }
});
```

## Integration with Web App

The Web App (`7-apps/shell/web`) is pre-configured to use the Terminal Server:

1. **Startup Script**: Automatically creates `.env.development.local` pointing to Terminal Server
2. **Service Layer**: `runtimeService.ts` provides TypeScript API client
3. **Model Selector**: UI component fetches available models from `/provider`
4. **Chat Interface**: Creates sessions via `/session` endpoint

### Service Architecture

```
Web App (React)
    │
    ▼
runtimeService.ts  ──►  fetch()  ──►  Terminal Server
    │                                      │
    │                              ┌───────┴───────┐
    │                              ▼               ▼
    │                         Provider.ts    Session.ts
    │                              │               │
    │                    ┌─────────┴─────────┐     │
    │                    ▼                   ▼     ▼
    │               OpenAI SDK      Anthropic SDK  etc.
    │
    ▼
Event Stream (SSE) ◄── /event endpoint
```

## Provider Support

The Terminal Server supports these AI providers out of the box:

| Provider | Models | Auth Method |
|----------|--------|-------------|
| OpenAI | GPT-4o, o1, o3-mini, etc. | API Key |
| Anthropic | Claude 3.5 Sonnet, Haiku, etc. | API Key |
| Google | Gemini 1.5/2.0 Pro/Flash | API Key |
| Mistral | Mistral Large, Medium, Small | API Key |
| Groq | Llama 3, Mixtral | API Key |
| Cohere | Command R, Command R+ | API Key |
| Azure | GPT-4, GPT-3.5 | Azure AD |
| AWS Bedrock | Claude, Llama, etc. | AWS IAM |
| OpenRouter | 100+ models | API Key |
| Ollama | Local models | None |

## Troubleshooting

### Terminal Server Won't Start

```bash
# Check if port is in use
lsof -i :4096

# Kill existing processes
kill $(lsof -ti :4096)

# Check logs
cat .logs/terminal-server.log
```

### Web App Can't Connect

```bash
# Verify Terminal Server is running
curl http://localhost:4096/doc

# Check Web App env
cat 7-apps/shell/web/.env.development.local

# Should contain:
# VITE_API_URL=http://127.0.0.1:4096
```

### Provider Authentication Issues

```bash
# Check configured providers
curl http://localhost:4096/provider

# Set API key via CLI
cd 7-apps/shell/terminal
bun run src/index.ts auth set openai

# Or set environment variable
export OPENAI_API_KEY=sk-...
```

## Architecture Decisions

### Why Terminal Server as a Separate Service?

1. **Single Source of Truth**: All AI model configuration in one place
2. **Multi-Client Support**: Web, Desktop, and external tools can share the same AI backend
3. **Resource Management**: Centralized rate limiting, budget metering, and caching
4. **Provider Abstraction**: Easy to add new providers without changing client code
5. **Security**: API keys stay on the server, not in browser/electron apps

### Port Allocation

| Service | Port | Purpose |
|---------|------|---------|
| Terminal Server | 4096 | AI Model API |
| Web App | 5177 | React Development Server |
| API Service | 3000 | Core Rust API |
| Voice Service | 8001 | TTS/STT Service |
| OpenClaw | 18789 | Agent Gateway |

## Next Steps

1. **Configure AI Providers**: Add your API keys to `.env`
2. **Start Services**: Run `./dev/scripts/start-all-with-terminal.sh start`
3. **Open Web App**: Navigate to http://localhost:5177
4. **Start Chatting**: Select a model and begin interacting with AI

## Related Documentation

- `7-apps/shell/terminal/README.md` - Terminal TUI documentation
- `7-apps/shell/web/README.md` - Web App documentation
- `ARCHITECTURE.md` - Overall system architecture
- `UI_CONTRACTS.ts` - API contracts between UI and backend
