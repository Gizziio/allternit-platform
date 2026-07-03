//! Image Converter
//!
//! Converts OCI images to formats suitable for different drivers:
//! - Process Driver: Direct mount (extract layers)
//! - Container Driver: OCI image (as-is)
//! - MicroVM Driver: rootfs + initramfs

use crate::{EnvironmentSpec, EnvironmentSpecError};
use std::path::PathBuf;

pub mod rootfs;

pub use rootfs::RootfsBuilder;

/// Image converter for different driver formats
pub struct ImageConverter {
    /// Cache directory for converted images
    cache_dir: PathBuf,
}

impl ImageConverter {
    /// Create a new converter
    pub fn new(cache_dir: PathBuf) -> Self {
        Self { cache_dir }
    }

    /// Convert environment spec to rootfs for MicroVM
    pub async fn to_rootfs(&self, spec: &EnvironmentSpec) -> Result<PathBuf, EnvironmentSpecError> {
        let builder = RootfsBuilder::new(&self.cache_dir);
        builder.build_rootfs(spec).await
    }

    /// Convert environment spec to initramfs
    pub async fn to_initramfs(
        &self,
        spec: &EnvironmentSpec,
    ) -> Result<PathBuf, EnvironmentSpecError> {
        let builder = RootfsBuilder::new(&self.cache_dir);
        builder.build_initramfs(spec).await
    }

    /// Convert to ext4 filesystem image
    pub async fn to_ext4(
        &self,
        spec: &EnvironmentSpec,
        size_mb: u32,
    ) -> Result<PathBuf, EnvironmentSpecError> {
        let builder = RootfsBuilder::new(&self.cache_dir);
        builder.build_ext4(spec, size_mb).await
    }
}
