# Allternit Node Agent Installation System

Complete automated installation system for deploying Allternit agents to VPS and cloud instances.

## Features

- **Fully Automated Installation**: Zero manual steps required after calling `install()`
- **Multi-OS Support**: Ubuntu, Debian, CentOS, RHEL, Fedora, Alpine Linux, Windows Server
- **Docker Integration**: Automatic Docker installation and configuration
- **Systemd/Windows Services**: Complete service setup with auto-restart
- **Health Monitoring**: Built-in health checks and metrics
- **Rollback on Failure**: Automatic cleanup if installation fails
- **Secure Configuration**: Generates secure tokens and API keys automatically

## Quick Start

```typescript
import { AgentInstaller, AgentConfigurator } from './agent';

const installer = new AgentInstaller();

// Install on a VPS
const result = await installer.install({
  host: '192.168.1.100',
  port: 22,
  username: 'root',
  privateKeyPath: '/path/to/ssh/key',
  provider: 'aws',
  region: 'us-east-1'
});

if (result.success) {
  console.log('Agent installed:', result.config.serverId);
  console.log('API Endpoint:', result.config.apiEndpoint);
  console.log('Install time:', result.installTime, 'ms');
}
```

## File Structure

```
agent/
├── AgentInstaller.ts          # Main installation orchestrator
├── AgentConfig.ts             # Configuration management
├── health-check.ts            # Health check implementation
├── DockerCompose.yml          # Docker Compose for Allternit services
├── index.ts                   # Module exports
├── install-scripts/
│   ├── install.sh            # Linux installation script
│   └── install.ps1           # Windows PowerShell installation
└── README.md                  # This file
```

## API Reference

### AgentInstaller

Main class for installing, upgrading, and managing Allternit agents.

#### Methods

- `install(target, options)`: Install Allternit agent on a VPS
- `uninstall(target)`: Remove Allternit agent from a VPS
- `upgrade(target, version)`: Upgrade Allternit agent to a new version
- `checkStatus(target)`: Check current agent status

### AgentConfigurator

Manages configuration generation and validation.

#### Methods

- `generateConfig(vps, customConfig)`: Generate agent configuration
- `validateConfig(config)`: Validate configuration object
- `applyConfig(target, config)`: Apply configuration to a VPS
- `loadConfig(target)`: Load current configuration from a VPS

### HealthChecker

Provides comprehensive health checking.

#### Methods

- `checkHealth()`: Run complete health check
- `getSystemMetrics()`: Get detailed system metrics
- `getContainerInfo()`: Get Docker container information

## Installation Scripts

### Linux (install.sh)

- Detects OS (Ubuntu, Debian, CentOS, Alpine, etc.)
- Installs Docker if not present
- Creates systemd service
- Configures firewall (ufw/firewalld/iptables)
- Sets up log rotation

### Windows (install.ps1)

- Detects Windows version
- Installs Docker Desktop/DockerMsftProvider
- Creates Scheduled Task for service management
- Configures Windows Firewall
- Sets up log rotation

## Docker Compose Services

The `DockerCompose.yml` defines the following services:

- **allternit-agent**: Main Allternit agent container
- **traefik**: Reverse proxy and load balancer
- **redis**: Caching and session storage
- **promtail**: Log shipping to Loki
- **node-exporter**: Host metrics (optional)
- **cadvisor**: Container metrics (optional)

## Configuration

Example generated configuration:

```json
{
  "serverId": "allternit-aws-abcd1234-xyz789",
  "datacenter": "aws",
  "region": "us-east-1",
  "apiEndpoint": "https://192.168.1.100:8080",
  "authToken": "secure-random-token-64-chars",
  "apiKey": "secure-api-key-32-chars",
  "dockerNetwork": "allternit-network",
  "maxContainers": 50,
  "resourceLimits": {
    "cpuPercent": 80,
    "memoryLimit": "4g",
    "diskLimit": "50g",
    "maxContainers": 50
  },
  "logLevel": "info",
  "features": {
    "autoUpdate": true,
    "healthChecks": true,
    "metricsExport": true
  }
}
```

## Health Check Endpoints

The agent exposes the following health endpoints:

- `GET /health` - Complete health check with all components
- `GET /health/ready` - Readiness probe (for Kubernetes)
- `GET /health/live` - Liveness probe (for Kubernetes)

## Error Handling

The installer provides detailed error information:

```typescript
const result = await installer.install(target);

if (!result.success) {
  console.error('Install failed:', result.message);
  console.error('Errors:', result.errors);
  console.error('Logs:', result.logs);
}
```

## Rollback

If installation fails, the system automatically:

1. Stops any running services
2. Removes Docker containers
3. Deletes configuration files
4. Cleans up directories
5. Returns detailed error logs

## Security

- All API keys and tokens are cryptographically secure
- Configuration files have restricted permissions (600)
- TLS is enabled by default
- Firewall rules are configured automatically
- Docker socket access is controlled

## Requirements

### Target VPS Requirements

- Linux: Ubuntu 18.04+, Debian 10+, CentOS 7+, RHEL 7+, Alpine 3.12+
- Windows: Server 2019+, Windows 10/11
- Architecture: x86_64/amd64 or arm64/aarch64
- Memory: Minimum 1GB RAM (2GB recommended)
- Disk: Minimum 10GB free space
- Network: Internet access for Docker image pulls

### SSH Access

The installer requires:
- Root access or passwordless sudo
- SSH key or password authentication
- Port 22 (or custom port) access

## Testing

Run health checks:

```typescript
import { healthChecker } from './agent';

const health = await healthChecker.checkHealth();
console.log('Status:', health.status);
console.log('Components:', health.checks);
```

## Troubleshooting

### Installation Fails

1. Check SSH connectivity
2. Verify root/sudo access
3. Check system requirements
4. Review installation logs in `result.logs`

### Service Won't Start

1. Check Docker is running: `docker version`
2. Check logs: `journalctl -u allternit-agent -f`
3. Verify configuration: `cat /etc/allternit/config.json`
4. Check ports: `netstat -tlnp | grep 8080`

### Health Check Failing

1. Check container status: `docker ps`
2. View container logs: `docker logs allternit-agent`
3. Check resource usage: `df -h && free -m`
4. Verify network: `ping 8.8.8.8`

## License

MIT
