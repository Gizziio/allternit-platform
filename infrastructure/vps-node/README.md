# A2R Node Agent

[![Build Status](https://img.shields.io/github/actions/workflow/status/a2r/node/ci.yml)](https://github.com/a2r/node/actions)
[![Latest Release](https://img.shields.io/github/v/release/a2r/node)](https://github.com/a2r/node/releases)
[![Discord](https://img.shields.io/discord/a2r)](https://discord.gg/a2r)
[![License](https://img.shields.io/badge/license-MIT%2FApache--2.0-blue)](LICENSE)

**A2R Node Agent** connects your infrastructure (VPS, local machines, edge devices) to the A2R Control Plane, enabling secure agent orchestration, terminal access, and job execution.

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
│              A2R CONTROL PLANE (We Host)                    │
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
│  │  │  A2R Node    │  │   Docker     │  │  Execution │  │   │
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
│  User runs: curl -s https://a2r.io/install.sh | bash         │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Quick Start

### One-Line Install (Linux/macOS)

```bash
curl -sL https://install.a2r.io | A2R_TOKEN=your_token bash
```

### Windows (PowerShell)

```powershell
# Run as Administrator
iwr -useb https://install.a2r.io/windows | iex
```

### Get Your Token

1. Visit [app.a2r.io](https://app.a2r.io/settings/nodes)
2. Click "Create Node"
3. Copy your authentication token

## Installation

### From Deployment Package

```bash
# Clone repository
git clone https://github.com/a2r/node.git
cd node/deploy

# Run installer
curl -sL https://raw.githubusercontent.com/a2r/node/main/deploy/install.sh | sudo A2R_TOKEN=your_token bash
```

### Docker

```bash
docker run -d \
  --name a2r-node \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e A2R_TOKEN=your_token \
  ghcr.io/a2r/node:latest
```

### From Source

```bash
cd 8-cloud/a2r-node
cargo build --release
sudo cp target/release/a2r-node /opt/a2r/bin/
```

### Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `A2R_TOKEN` | Yes | - | Node authentication token |
| `A2R_NODE_ID` | No | Auto-generated | Custom node ID |
| `A2R_CONTROL_PLANE` | No | `wss://control.a2r.io` | Control plane URL |
| `A2R_LABELS` | No | - | Comma-separated capabilities |
| `A2R_MAX_CONCURRENT_JOBS` | No | `10` | Max parallel jobs |

See [deploy/README.md](deploy/README.md) for full configuration options.

## Usage

### Check Status

```bash
# Linux
sudo systemctl status a2r-node
sudo journalctl -u a2r-node -f

# macOS
launchctl list | grep a2r
tail -f /var/log/a2r/node.log

# Windows
Get-Service a2r-node
Get-EventLog -LogName Application -Source a2r-node -Newest 50
```

### Terminal Access

Once your node is online, access the terminal from the A2R web UI:

1. Visit [app.a2r.io](https://app.a2r.io)
2. Select your node
3. Click "Terminal"

### File Management

Access files through the web UI or use the API:

```bash
# Upload file
curl -X POST https://control.a2r.io/api/v1/nodes/{node_id}/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@localfile.txt" \
  -F "path=/remote/path/file.txt"

# Download file
curl -X GET https://control.a2r.io/api/v1/nodes/{node_id}/files/download?path=/remote/file.txt \
  -H "Authorization: Bearer $TOKEN" \
  -o localfile.txt
```

### Run Jobs

Submit jobs via the web UI or API:

```bash
curl -X POST https://control.a2r.io/api/v1/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "node-xxx",
    "name": "test-job",
    "wih": {
      "handler": "shell",
      "task": {
        "type": "shell",
        "command": "echo Hello from A2R"
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
git clone https://github.com/a2r/node.git
cd node

# Build release
cargo build --release

# Binary location
./target/release/a2r-node
```

### Run Locally

```bash
# Development mode
A2R_NODE_ID=dev-node \
A2R_TOKEN=test-token \
A2R_CONTROL_PLANE=ws://localhost:3000 \
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
   sudo systemctl status a2r-node
   ```

2. Check logs:
   ```bash
   sudo journalctl -u a2r-node -n 50
   ```

3. Verify Docker:
   ```bash
   docker ps
   ```

4. Test connection:
   ```bash
   curl -I https://control.a2r.io
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
- Restart service: `sudo systemctl restart a2r-node`

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

- **Documentation**: [docs.a2r.io](https://docs.a2r.io)
- **Discord**: [discord.gg/a2r](https://discord.gg/a2r)
- **GitHub Issues**: [github.com/a2r/node/issues](https://github.com/a2r/node/issues)
- **Email**: support@a2r.io
