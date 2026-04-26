//! # Allternit Capsule
//!
//! Content-addressed, cryptographically signed deployment bundles for tools.
//!
//! ## What is a Capsule?
//!
//! A capsule is the unit of deployment in Allternit. It packages:
//! - A WASM component (the compiled tool)
//! - Metadata (name, version, description)
//! - ToolABI specification (inputs, outputs, capabilities)
//! - Cryptographic signature (for provenance)
//! - Content hash (for integrity)
//!
//! ## Capsule Format
//!
//! ```text
//! capsule.allternit (tar.gz archive)
//! ├── manifest.json       # CapsuleManifest
//! ├── component.wasm      # Compiled WASM component
//! ├── tool-abi.json       # ToolABI specification
//! ├── signature.json      # Publisher signature
//! └── assets/             # Optional static assets
//!     └── ...
//! ```
//!
//! ## Security Model
//!
//! - All capsules MUST be signed by a known publisher
//! - Content hash ensures integrity
//! - Capability requirements are declared upfront
//! - Policy engine validates before loading

pub mod bundle;
pub mod content_hash;
pub mod error;
pub mod manifest;
pub mod signing;
pub mod store;

pub use bundle::{CapsuleBundle, CapsuleBundler};
pub use content_hash::ContentHash;
pub use error::{CapsuleError, CapsuleResult};
pub use manifest::{Capabilities, CapsuleManifest, SafetyTier, ToolABISpec, WasmComponent};
pub use signing::{
    CapsuleSignature, KeyPair, SignatureAlgorithm, SignaturePolicy, SigningKey, VerifyingKey,
};
pub use store::{CapsuleStore, CapsuleStoreConfig};
