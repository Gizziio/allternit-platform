//! # Allternit WASM Runtime
//!
//! Sandboxed WebAssembly runtime for executing dynamic tools in the Allternit agentic OS.
//!
//! ## Design Principles
//!
//! - **Default Deny**: Tools have zero capabilities unless explicitly granted
//! - **Isolation**: Each tool runs in its own sandbox
//! - **Auditable**: All executions are logged to the event ledger
//! - **Deterministic**: Same inputs produce same outputs (for replay)
//!
//! ## Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────┐
//! │                    WasmRuntime                          │
//! │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
//! │  │   Engine    │  │   Linker    │  │ Component Cache │ │
//! │  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
//! │         │                │                   │          │
//! │         └────────────────┼───────────────────┘          │
//! │                          ▼                              │
//! │  ┌─────────────────────────────────────────────────┐   │
//! │  │              ToolHostState                       │   │
//! │  │  - WASI Context (with capability grants)         │   │
//! │  │  - Policy Engine reference                       │   │
//! │  │  - Event Ledger for audit                        │   │
//! │  └─────────────────────────────────────────────────┘   │
//! └─────────────────────────────────────────────────────────┘
//! ```

pub mod bindings;
pub mod capabilities;
pub mod engine;
pub mod error;
pub mod host;
pub mod host_functions;
pub mod instance;
pub mod manifest;
pub mod sandbox;

pub use capabilities::{Capability, CapabilityGrant, CapabilitySet};
pub use engine::{WasmRuntime, WasmRuntimeConfig};
pub use error::{WasmRuntimeError, WasmRuntimeResult};
pub use host::ToolHostState;
pub use instance::WasmToolInstance;
pub use manifest::{CapsuleManifest, FunctionDefinition, MemoryConfig, ModuleSource};
pub use sandbox::SandboxConfig;
