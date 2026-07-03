//! OCI Image Resolver
//!
//! Handles pulling and caching OCI images from registries.

use std::collections::HashMap;
use std::path::PathBuf;

pub mod cache;
pub mod oci;

pub use cache::ImageCache;
pub use oci::OciResolver;

/// Registry authentication configuration
#[derive(Debug, Clone)]
pub struct RegistryAuth {
    /// Registry hostname (e.g., "docker.io", "ghcr.io")
    pub registry: String,

    /// Username
    pub username: Option<String>,

    /// Password or token
    pub password: Option<String>,

    /// Use token authentication
    pub token: Option<String>,
}

/// Image resolution result
#[derive(Debug, Clone)]
pub struct ImageResolution {
    /// Full image reference (e.g., "docker.io/library/ubuntu:22.04")
    pub reference: String,

    /// Image digest (SHA256)
    pub digest: Option<String>,

    /// Local path to downloaded image
    pub local_path: Option<PathBuf>,

    /// Image manifest
    pub manifest: Option<ImageManifest>,
}

/// OCI Image Manifest
#[derive(Debug, Clone)]
pub struct ImageManifest {
    /// Schema version
    pub schema_version: u32,

    /// Media type
    pub media_type: String,

    /// Config descriptor
    pub config: Descriptor,

    /// Layer descriptors
    pub layers: Vec<Descriptor>,
}

/// Content descriptor
#[derive(Debug, Clone)]
pub struct Descriptor {
    /// Media type
    pub media_type: String,

    /// Digest (algorithm:hex)
    pub digest: String,

    /// Size in bytes
    pub size: u64,

    /// Annotations
    pub annotations: HashMap<String, String>,
}

/// Platform specification for multi-arch images
#[derive(Debug, Clone)]
pub struct Platform {
    /// Architecture (amd64, arm64, etc.)
    pub architecture: String,

    /// Operating system (linux, windows, etc.)
    pub os: String,

    /// OS version (for Windows)
    pub os_version: Option<String>,

    /// Variant (v7, v8 for ARM)
    pub variant: Option<String>,
}

impl Default for Platform {
    fn default() -> Self {
        Self {
            architecture: std::env::consts::ARCH.to_string(),
            os: std::env::consts::OS.to_string(),
            os_version: None,
            variant: None,
        }
    }
}
