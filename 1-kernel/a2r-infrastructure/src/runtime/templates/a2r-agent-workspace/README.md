# A2R Agent Workspace

Isolated execution environment for AI agents with browsers, Node.js, Python, and common automation tools. Sandboxed and resource-limited for secure agent execution.

## Overview

The A2R Agent Workspace provides a secure, containerized environment where AI agents can execute tasks without affecting the host system. It includes:

- **Isolated Execution**: Each agent runs in its own container with restricted resources
- **Browser Automation**: Chromium, Firefox, and WebKit with Playwright support
- **Multi-language Support**: Node.js 20, Python 3.11, Deno runtime
- **Security**: Firejail sandboxing, seccomp profiles, AppArmor policies
- **Vector Memory**: ChromaDB for persistent agent memory
- **Resource Limits**: Configurable CPU, memory, and disk quotas

## Quick Start

```bash
# Copy environment configuration
cp .env.example .env

# Edit .env with your settings
nano .env

# Build and start
make build
make start

# Check health
make health
```

## Services

| Service | Description | Port |
|---------|-------------|------|
| `agent-workspace` | Main agent execution container | 3000, 9222 |
| `sandbox-browser` | Isolated browser for web tasks | 3001, 9222 |
| `vector-db` | ChromaDB for agent memory | 8000 |
| `file-store` | MinIO for persistent file storage | 9000, 9001 |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_ID` | `default` | Unique agent identifier |
| `MAX_CPU` | `2` | CPU cores limit |
| `MAX_MEMORY` | `4G` | Memory limit |
| `ENABLE_NETWORK` | `true` | Allow external network |
| `SANDBOX_ENABLED` | `true` | Enable Firejail sandbox |
| `TASK_TIMEOUT` | `3600` | Default task timeout (seconds) |

### Resource Limits

Resource limits are enforced via:
- Docker container limits (cgroups v2)
- Firejail sandbox restrictions
- Process-level ulimit settings

## Available Tools

### Browsers
- **Chromium** - Headless/headed browser automation
- **Firefox** - Mozilla browser support
- **WebKit** - Safari engine via Playwright
- **Playwright** - Cross-browser automation framework
- **Puppeteer** - Chrome DevTools Protocol library

### Python Packages
- **Web Scraping**: `beautifulsoup4`, `scrapy`, `requests`, `httpx`
- **Data Processing**: `pandas`, `numpy`, `polars`
- **Document Processing**: `pypdf`, `pdfplumber`, `python-docx`, `markdown`
- **Image Processing**: `pillow`, `opencv-python-headless`
- **Vector DB**: `chromadb`

### System Tools
- `curl`, `wget` - HTTP clients
- `git` - Version control
- `jq` - JSON processor
- `pandoc` - Document conversion
- `imagemagick` - Image manipulation
- `ffmpeg` - Video/audio processing
- `firejail` - Sandboxing

## Task Execution

### Execute a Shell Command
```bash
docker-compose exec agent-workspace execute-task -c "ls -la"
```

### Execute Python Code
```bash
docker-compose exec agent-workspace execute-task -p "print('Hello, World!')"
```

### Execute from JSON File
```bash
docker-compose exec agent-workspace execute-task /path/to/task.json
```

### Task JSON Format
```json
{
  "type": "python",
  "name": "example-task",
  "description": "Example task",
  "code": "import pandas as pd; print(pd.__version__)",
  "timeout": 300,
  "env": {
    "MY_VAR": "value"
  }
}
```

## API Endpoints

The agent workspace exposes a health check API on port 3000:

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Quick health check |
| `GET /health/full` | Full system status |
| `GET /tools` | List available tools |
| `GET /browsers` | Browser status |
| `GET /resources` | Resource usage |
| `GET /packages/python` | Python packages |

## Security

### Sandboxing
- **Firejail**: Process-level sandboxing
- **Seccomp**: System call filtering
- **AppArmor**: Mandatory access control
- **Read-only root**: Immutable base filesystem

### Network Isolation
- Internal Docker network for service communication
- Optional external network restriction
- DNS filtering

### Resource Constraints
- CPU quotas (cgroups)
- Memory limits
- Disk quotas
- Process limits

## Development

```bash
# Start in foreground mode
make start-fg

# Open shell in container
make shell

# View logs
make logs

# Run tests
make test
```

## Troubleshooting

### Container fails to start
```bash
# Check logs
make logs

# Verify configuration
docker-compose config

# Rebuild without cache
make dev-build
```

### Browser automation issues
```bash
# Check browser status
curl http://localhost:3000/browsers | jq

# Verify Playwright installation
docker-compose exec agent-workspace npx playwright install
```

### Resource limits exceeded
```bash
# Check current usage
make resources

# Increase limits in .env
MAX_CPU=4
MAX_MEMORY=8G
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Host System                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              A2R Agent Workspace                         ││
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   ││
│  │  │   Agent     │  │   Sandbox    │  │   Vector     │   ││
│  │  │  Workspace  │──│   Browser    │──│     DB       │   ││
│  │  │             │  │              │  │  (ChromaDB)  │   ││
│  │  └─────────────┘  └──────────────┘  └──────────────┘   ││
│  │  ┌─────────────┐  ┌──────────────┐                      ││
│  │  │ File Store  │  │   Monitor    │                      ││
│  │  │   (MinIO)   │  │              │                      ││
│  │  └─────────────┘  └──────────────┘                      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## License

Copyright (c) 2024 A2R. All rights reserved.

## Support

For issues and feature requests, please contact the A2R team.
