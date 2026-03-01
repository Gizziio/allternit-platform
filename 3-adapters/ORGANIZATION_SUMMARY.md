# 3-Adapters Directory Structure

This document summarizes the current structure of the 3-adapters layer.

## Current Structure

### Bridge Systems
- `a2r-bridges/` - Runtime bridges that interface the kernel with external workloads
  - `a2r-native-bridge/` - Native system bridges
  - `a2r-webvm/` - Web-based virtual machine bridges  
  - `io-daemon/` - I/O daemon for external communication

### Channel Systems
- `a2r-channels/` - Communication channels for external integrations

### Runtime Adapters
- `a2r-runtime/` - Runtime environment adapters

### Search Integration
- `a2r-search/` - Search service integration adapters

### Rust Components
- `rust/` - Rust-based adapter implementations
  - `extension-adapter/` - Extension system adapters
  - `marketplace/` - Marketplace integration adapters
  - `provider-adapter/` - Provider integration adapters
  - `skills/` - Skills integration adapters

### Vendor Integration
- `vendor/` - Vendor-specific integration materials and harvested vendor materials

### Support Systems
- `stubs/` - Mock implementations for testing and development
- `ts/` - TypeScript-based adapter implementations

## Documentation

The functionality and purpose of each component is documented in:
- README.md - Overview of the 3-adapters layer
- ARCHITECTURE.md - Detailed architectural information
- POTENTIAL_IMPROVEMENTS.md - Planned enhancements

## Key Principles

The 3-adapters layer follows these key principles:
- Adapters only translate data between systems (no application logic)
- Clear separation between platform and external systems
- Secure communication with external systems
- Standardized interfaces across different adapters