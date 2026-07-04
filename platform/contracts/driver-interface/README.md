# allternit-driver-interface

Core trait definitions for execution drivers. This crate provides the
abstraction layer that separates the control plane from execution substrate
implementations such as processes, micro-VMs, containers, and WASM runtimes.

## Architecture

```text
Control Plane
      ↓
Driver Interface (this crate)
      ↓
Driver Implementations:
  - Process Driver
  - MicroVM Driver (Firecracker, Apple Virtualization.framework)
  - Container Driver
  - WASM Driver
```

## Usage

```rust
use allternit_driver_interface::{ExecutionDriver, ExecutionRequest, DriverConfig};

// Implement ExecutionDriver for your substrate
```

## License

MIT
