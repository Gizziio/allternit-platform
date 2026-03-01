# A2rchitech Development Utilities

This document describes the development utility scripts available in the A2rchitech project to help with development, debugging, and system management.

## dev-utils.sh

The `dev-utils.sh` script provides various utility functions for development and debugging. It's designed to make common development tasks easier and more efficient.

### Installation

The script is located at `scripts/dev-utils.sh` and is executable by default.

### Usage

```bash
./scripts/dev-utils.sh [command] [argument]
```

### Commands

#### Status
Show the current status of all A2rchitech services:

```bash
./scripts/dev-utils.sh status
# or
./scripts/dev-utils.sh s
```

This will show whether each service (Voice, WebVM, Kernel, Shell UI) is running and provide the URLs for accessing each service.

#### Logs
View recent logs from specific services or all services:

```bash
# View all service logs
./scripts/dev-utils.sh logs
./scripts/dev-utils.sh logs all
./scripts/dev-utils.sh logs a

# View specific service logs
./scripts/dev-utils.sh logs voice
./scripts/dev-utils.sh logs v
./scripts/dev-utils.sh logs webvm
./scripts/dev-utils.sh logs w
./scripts/dev-utils.sh logs kernel
./scripts/dev-utils.sh logs k
./scripts/dev-utils.sh logs shell
./scripts/dev-utils.sh logs s
```

#### Clean
Clean up build artifacts and temporary files:

```bash
./scripts/dev-utils.sh clean
# or
./scripts/dev-utils.sh c
```

This removes the `target` directory, clears log files, and cleans up temporary directories.

#### Build
Build specific components or all components:

```bash
# Build all components
./scripts/dev-utils.sh build all
./scripts/dev-utils.sh build

# Build specific component
./scripts/dev-utils.sh build kernel
./scripts/dev-utils.sh build voice
./scripts/dev-utils.sh build webvm
./scripts/dev-utils.sh build cli
```

#### Tests
Run different types of tests:

```bash
# Run all tests
./scripts/dev-utils.sh test all
./scripts/dev-utils.sh test

# Run specific test types
./scripts/dev-utils.sh test unit
./scripts/dev-utils.sh test integration
./scripts/dev-utils.sh test int
```

#### System Info
Show system information relevant to the A2rchitech development environment:

```bash
./scripts/dev-utils.sh info
# or
./scripts/dev-utils.sh i
```

This shows the system architecture, installed tools (Rust, Cargo, Node, Python), and disk usage.

#### Restart Services
Restart specific services or all services:

```bash
# Restart all services
./scripts/dev-utils.sh restart all
./scripts/dev-utils.sh restart

# Restart specific service
./scripts/dev-utils.sh restart voice
./scripts/dev-utils.sh restart webvm
./scripts/dev-utils.sh restart kernel
```

#### Help
Get help information about available commands:

```bash
./scripts/dev-utils.sh help
# or
./scripts/dev-utils.sh h
./scripts/dev-utils.sh -h
./scripts/dev-utils.sh --help
```

## Benefits

The development utilities provide:

1. **Centralized Management**: All common development tasks accessible through a single script
2. **Quick Status Checks**: Easily see which services are running
3. **Log Monitoring**: Quickly access logs for debugging
4. **Efficient Building**: Build specific components without rebuilding everything
5. **System Information**: Get relevant system info for troubleshooting
6. **Service Management**: Restart services when needed without stopping everything

## Integration with Existing Workflow

The dev-utils.sh script complements the existing Makefile and dev/run.sh scripts:

- Use `make dev` to start the development environment
- Use `./scripts/dev-utils.sh status` to check service status
- Use `./scripts/dev-utils.sh logs` to monitor logs
- Use `./scripts/dev-utils.sh restart` to restart specific services
- Use `make stop` to stop all services when done

This provides a more granular approach to managing the development environment compared to the all-or-nothing approach of the existing scripts.