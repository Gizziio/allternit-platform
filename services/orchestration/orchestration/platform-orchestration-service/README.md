# Allternitchitech Platform Orchestrator

The Allternitchitech Platform Orchestrator is a unified binary that starts and manages all services in the Allternitchitech platform.

## Overview

The orchestrator provides a single command to start all platform services in the correct order, making it easy to run the complete Allternitchitech platform with one command.

## Features

- **Unified Startup**: Single command to start all platform services
- **Proper Ordering**: Services start in the correct dependency order
- **Background Management**: Services run in background processes
- **Centralized Control**: Single point of control for the entire platform
- **Graceful Shutdown**: Proper cleanup when stopping services

## Usage

### Starting the Platform

```bash
# Using the platform orchestrator binary
cargo run -p allternit-platform

# Or using the CLI command
cargo run -p allternit-cli -- up
```

### Available Commands

- `a2 up` - Start all platform services
- `a2 down` - Stop all platform services  
- `a2 status` - Check platform health
- `a2 doctor` - Run system diagnostics

## Services Managed

The orchestrator starts the following services in order:

1. **Memory Service** - Distributed memory management
2. **Kernel Service** - Main API and orchestration layer
3. **WebVM Service** - Virtual machine management
4. **Voice Service** - Audio processing and synthesis
5. **IO Daemon** - Input/output management
6. **Observation Service** - Monitoring and observability
7. **Canvas Monitor** - UI canvas management
8. **Framework Service** - Core framework components
9. **Local Inference** - Local AI model inference
10. **Pattern Service** - Pattern recognition and processing

## Architecture

The orchestrator follows Unix philosophy principles:
- **Modularity**: Each service runs independently
- **Single Responsibility**: Each service has a focused purpose
- **Composability**: Services can be combined and orchestrated
- **Transparency**: Clear interfaces and observable behavior

## Ports Used

- Memory Service: Port 3008
- Kernel Service: Port 8080 (main API)
- WebVM Service: Port 3001
- Voice Service: Port 3002
- IO Daemon: Port 3003
- Observation Service: Port 3004
- Canvas Monitor: Port 3005
- Framework Service: Port 3006
- Local Inference: Port 3007
- Pattern Service: Port 3010

## Shutdown

Press `Ctrl+C` to gracefully shut down all services. The orchestrator will terminate all managed processes.

## Troubleshooting

If services fail to start:
1. Check that required ports are available
2. Verify all dependencies are installed
3. Run `a2 doctor` for system diagnostics
4. Check individual service logs for errors

## Development

For development, individual services can still be run separately:
```bash
cargo run -p kernel
cargo run -p allternit-memory
# etc.
```

The orchestrator is ideal for production deployments or when running the complete platform.