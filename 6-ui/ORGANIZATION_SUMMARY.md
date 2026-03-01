# 6-UI Directory Structure

This document summarizes the current structure of the 6-ui layer.

## Current Structure

### Platform UI Components
- `a2r-platform/` - UI platform primitives and vendor wrappers used by all shell apps

### Shell Applications
- `shell-ui/` - Shell applications that provide the primary user interface

### Canvas Monitoring
- `canvas-monitor/` - Canvas monitoring and visualization tools

### Rust Components
- `rust/` - Rust-based UI components and utilities

### Support Systems
- `stubs/` - Mock implementations for UI testing and development
- `ts/` - TypeScript-based UI implementations

## Documentation

The functionality and purpose of each component is documented in:
- README.md - Overview of the 6-ui layer
- ARCHITECTURE.md - Detailed architectural information
- POTENTIAL_IMPROVEMENTS.md - Planned enhancements

## Key Principles

The 6-ui layer follows these key principles:
- Provides user-facing UI platforms and components
- Renders DAGs, receipts, memory workflows, and other platform data
- Consumes Gate/Ledger event stream through core/types exports
- Avoids direct calls into kernel internals
- Provides consistent user experience across platforms