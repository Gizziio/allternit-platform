# 0003. Rust-First Substrate Strategy

Date: 2026-02-04

## Status
Accepted

## Context
As A2Rchitech scales, core data structures and execution logic need to be high-performance and memory-safe. While TypeScript is excellent for orchestration and UI, it lacks the raw performance required for low-level kernel operations and large-scale data processing.

## Decision
Establish a Rust-first strategy for the Substrate (Layer 0) and high-performance Kernel modules:
1.  Initialize `a2r-substrate` in Rust to house shared types and primitives.
2.  Port the `ExecutionEngine` to Rust to minimize overhead during tool execution.
3.  Expose Rust logic to TypeScript via FFI or WASM where necessary.

## Consequences
- **Performance**: Significant reduction in latency for core operations.
- **Safety**: Strong typing and memory safety at the foundation layer.
- **Complexity**: Increased overhead for cross-language (TS/Rust) data serialization.

