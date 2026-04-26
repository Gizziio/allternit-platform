# Allternit Node Agent

[![Build Status](https://img.shields.io/github/actions/workflow/status/allternit/node/ci.yml)](https://github.com/allternit/node/actions)
[![Latest Release](https://img.shields.io/github/v/release/allternit/node)](https://github.com/allternit/node/releases)
[![Discord](https://img.shields.io/discord/allternit)](https://discord.gg/allternit)
[![License](https://img.shields.io/badge/license-MIT%2FApache--2.0-blue)](LICENSE)

**Allternit Node Agent** connects your infrastructure (VPS, local machines, edge devices) to the Allternit Control Plane, enabling secure agent orchestration, terminal access, and job execution.

## Features

- 🔌 **Reverse Tunnel Architecture** - No inbound firewall rules required
- 🐳 **Docker Integration** - Run agents in isolated containers
- 💻 **Web Terminal** - Browser-based PTY access via xterm.js
- 📁 **File Management** - Upload/download files via WebSocket
- 🔒 **Secure by Default** - mTLS, token auth, container sandboxing
- 📊 **Resource Monitoring** - CPU, memory, disk telemetry
- 🔄 **Auto-Reconnect** - Exponential backoff with jitter
- 🖥️ **Cross-Platform** - Linux, macOS, Windows support

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Allternit CONTROL PLANE (We Host)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Web UI    │  │   Scheduler │  │   Policy    │         │
│  │  (Browser)  │  │             │  │   Engine    │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         └────────────────┴────────────────┘                 │
│                          │                                  │
│                    ┌─────┴─────┐                            │
│                    │  Router   │                            │
│                    │ (WebSocket│                            │
│                    │  Server)  │                            │
│                    └─────┬─────┘                            │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           │ Secure WebSocket (WSS)
                           │ Reverse Tunnel
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                          │                                   │
│  ┌───────────────────────┴──────────────────────────────┐   │
│  │                  CLIENT VPS (You Host)                │   │
│  │                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │  Allternit Node    │  │   Docker     │  │  Execution │  │   │
│  │  │  Agent       │──│   Runtime    │──│   Kernel   │  │   │
│  │  │              │  │              │  │            │  │   │
│  │  │ • Register   │  │ • Sandboxes  │  │ • Codex    │  │   │
│  │  │ • Heartbeat  │  │ • Isolation  │  │ • WIH      │  │   │
│  │  │ • Pull Jobs  │  │ • Quotas     │  │ • CLI      │  │   │
│  │  │ • Stream Logs│  │ • Auto-clean │  │            │  │   │
│  │  └──────────────┘  └──────────────┘  └────────────┘  │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
│  User runs: curl -s https://allternit.com/install.sh | bash         │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Quick Start

### One-Line Install (Linux/macOS)

```bash
curl -sL https://install.allternit.com | ALLTERNIT_TOKEN=your_token bash
```

### Windows (PowerShell)

```powershell
# Run as Administrator
iwr -useb https://install.allternit.com/windows | iex
```

### Get Your Token

1. Visit [app.allternit.com](https://app.allternit.com/settings/nodes)
2. Click "Create Node"
3. Copy your authentication token

## Installation

### From Deployment Package

```bash
# Clone repository
git clone https://github.com/allternit/node.git
cd node/deploy

# Run installer
curl -sL https://raw.githubusercontent.com/allternit/node/main/deploy/install.sh | sudo ALLTERNIT_TOKEN=your_token bash
```

### Docker

```bash
docker run -d \
  --name allternit-node \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e ALLTERNIT_TOKEN=your_token \
  ghcr.io/allternit/node:latest
```

### From Source

```bash
cd cloud/allternit-node
cargo build --release
sudo cp target/release/allternit-node /opt/allternit/bin/
```

### Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ALLTERNIT_TOKEN` | Yes | - | Node authentication token |
| `ALLTERNIT_NODE_ID` | No | Auto-generated | Custom node ID |
| `ALLTERNIT_CONTROL_PLANE` | No | `wss://control.allternit.com` | Control plane URL |
| `ALLTERNIT_LABELS` | No | - | Comma-separated capabilities |
| `ALLTERNIT_MAX_CONCURRENT_JOBS` | No | `10` | Max parallel jobs |

See [deploy/README.md](deploy/README.md) for full configuration options.

## Usage

### Check Status

```bash
# Linux
sudo systemctl status allternit-node
sudo journalctl -u allternit-node -f

# macOS
launchctl list | grep allternit
tail -f /var/log/allternit/node.log

# Windows
Get-Service allternit-node
Get-EventLog -LogName Application -Source allternit-node -Newest 50
```

### Terminal Access

Once your node is online, access the terminal from the Allternit web UI:

1. Visit [app.allternit.com](https://app.allternit.com)
2. Select your node
3. Click "Terminal"

### File Management

Access files through the web UI or use the API:

```bash
# Upload file
curl -X POST https://control.allternit.com/api/v1/nodes/{node_id}/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@localfile.txt" \
  -F "path=/remote/path/file.txt"

# Download file
curl -X GET https://control.allternit.com/api/v1/nodes/{node_id}/files/download?path=/remote/file.txt \
  -H "Authorization: Bearer $TOKEN" \
  -o localfile.txt
```

### Run Jobs

Submit jobs via the web UI or API:

```bash
curl -X POST https://control.allternit.com/api/v1/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "node-xxx",
    "name": "test-job",
    "wih": {
      "handler": "shell",
      "task": {
        "type": "shell",
        "command": "echo Hello from Allternit"
      }
    }
  }'
```

## Building From Source

### Prerequisites

- Rust 1.70+
- Docker (for testing)
- protoc (for some dependencies)

### Build

```bash
# Clone repository
git clone https://github.com/allternit/node.git
cd node

# Build release
cargo build --release

# Binary location
./target/release/allternit-node
```

### Run Locally

```bash
# Development mode
ALLTERNIT_NODE_ID=dev-node \
ALLTERNIT_TOKEN=test-token \
ALLTERNIT_CONTROL_PLANE=ws://localhost:3000 \
cargo run
```

## Testing

```bash
# Unit tests
cargo test

# Integration tests
cargo test --test integration

# Test connection
./scripts/test-connection.sh
```

## Security

### Security Model

- **Outbound-only connections** - No inbound ports required
- **Token authentication** - Each node has a unique token
- **mTLS** - Mutual TLS for node-control plane communication
- **Container isolation** - Jobs run in Docker containers
- **Resource limits** - CPU, memory, disk quotas enforced
- **Audit logging** - All actions logged and auditable

### Security Hardening

The systemd service includes security hardening:

```ini
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=true
RestrictRealtime=true
SystemCallFilter=@system-service
```

## Troubleshooting

### Node Not Online

1. Check service status:
   ```bash
   sudo systemctl status allternit-node
   ```

2. Check logs:
   ```bash
   sudo journalctl -u allternit-node -n 50
   ```

3. Verify Docker:
   ```bash
   docker ps
   ```

4. Test connection:
   ```bash
   curl -I https://control.allternit.com
   ```

### Common Issues

**Docker Permission Denied**
```bash
sudo usermod -aG docker $USER
# Logout and login again
```

**Connection Refused**
- Check firewall allows outbound WSS on port 443
- Verify control plane URL is correct

**High Memory Usage**
- Check for stuck jobs: `docker ps`
- Restart service: `sudo systemctl restart allternit-node`

## Architecture Details

### Message Protocol

Communication uses JSON over WebSocket:

```json
// Node → Control Plane (Registration)
{
  "type": "node_register",
  "node_id": "node-abc123",
  "auth_token": "xxx",
  "hostname": "my-vps",
  "version": "0.1.0",
  "capabilities": {
    "docker": true,
    "gpu": false,
    "total_cpu": 4,
    "total_memory_gb": 8
  },
  "labels": ["production", "high-memory"]
}

// Control Plane → Node (Job Assignment)
{
  "type": "assign_job",
  "job": {
    "id": "job-xyz789",
    "name": "code-review",
    "wih": {
      "handler": "codex",
      "task": {"type": "shell", "command": "echo test"}
    }
  }
}
```

### Lifecycle States

```
[Installing] → [Starting] → [Connecting] → [Online]
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
                    ▼                       ▼                       ▼
                 [Idle]              [Running Job]          [Maintenance]
                    │                       │                       │
                    └───────────────────────┴───────────────────────┘
                                            │
                                            ▼
                                       [Offline]
                                            │
                                            ▼
                                     [Reconnecting]
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

Dual-licensed under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE).

## Support

- **Documentation**: [docs.allternit.com](https://docs.allternit.com)
- **Discord**: [discord.gg/allternit](https://discord.gg/allternit)
- **GitHub Issues**: [github.com/allternit/node/issues](https://github.com/allternit/node/issues)
- **Email**: support@allternit.com
