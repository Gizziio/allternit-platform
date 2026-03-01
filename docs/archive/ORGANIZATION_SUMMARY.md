# 7-Apps Directory Structure

This document summarizes the current structure of the 7-apps layer.

## Current Structure

### Application Suite
- `api/` - HTTP endpoints for orchestration and status hooks
- `cli/` - Command-line interface for agent operations
- `openwork/` - Experimental workspace for agent fleet orchestration

### Shared Components
- `shared/` - Shared utilities and libraries for applications

### Shell Applications
- `shell-electron/` - Electron-based shell application
- `shell-ui/` - Shell user interface components

### Support Systems
- `stubs/` - Mock implementations for testing and development
- `ts/` - TypeScript-based application implementations
- `ui/` - UI components for applications

### Legacy Components
- `_legacy/` - Legacy application components

## Documentation

The functionality and purpose of each component is documented in:
- README.md - Overview of the 7-apps layer
- ARCHITECTURE.md - Detailed architectural information
- POTENTIAL_IMPROVEMENTS.md - Planned enhancements

## Key Principles

The 7-apps layer follows these key principles:
- Provides top-level applications as packaged entrypoints
- Sits on top of services, kernel, and UI layers
- Pulls data from Gate/Vault for application functionality
- Follows platform standards for packaging and deployment
- Provides CLI, API, and other application interfaces