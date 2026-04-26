//! Rootfs Builder
//!
//! Converts OCI container images to Firecracker-compatible rootfs images.

use crate::{EnvironmentSpec, EnvironmentSpecError};
use std::path::{Path, PathBuf};
use tokio::io::AsyncWriteExt;

/// Rootfs builder for MicroVM driver
pub struct RootfsBuilder {
    /// Output directory
    output_dir: PathBuf,
}

impl RootfsBuilder {
    /// Create a new rootfs builder
    pub fn new(output_dir: impl AsRef<Path>) -> Self {
        Self {
            output_dir: output_dir.as_ref().to_path_buf(),
        }
    }

    /// Build a rootfs from an environment spec
    pub async fn build_rootfs(
        &self,
        spec: &EnvironmentSpec,
    ) -> Result<PathBuf, EnvironmentSpecError> {
        let rootfs_name = format!("rootfs_{}.ext4", sanitize_name(&spec.image));
        let rootfs_path = self.output_dir.join(&rootfs_name);

        // Check if already built
        if rootfs_path.exists() {
            tracing::info!("Rootfs already exists: {}", rootfs_path.display());
            return Ok(rootfs_path);
        }

        tracing::info!("Building rootfs for: {}", spec.image);

        // Create working directory
        let work_dir = self
            .output_dir
            .join(format!("work_{}", sanitize_name(&spec.image)));
        tokio::fs::create_dir_all(&work_dir).await?;

        // Pull and extract the image
        let image_dir = self.pull_image(&spec.image).await?;

        // Extract layers
        let rootfs_dir = work_dir.join("rootfs");
        self.extract_layers(&image_dir, &rootfs_dir).await?;

        // Apply post-create commands as chroot scripts
        if !spec.post_create_commands.is_empty() {
            self.apply_post_create(&rootfs_dir, &spec.post_create_commands)
                .await?;
        }

        // Create ext4 filesystem
        self.create_ext4_image(&rootfs_dir, &rootfs_path, 1024)
            .await?;

        // Cleanup work directory
        let _ = tokio::fs::remove_dir_all(&work_dir).await;

        tracing::info!("Rootfs built: {}", rootfs_path.display());

        Ok(rootfs_path)
    }

    /// Build initramfs for early boot
    pub async fn build_initramfs(
        &self,
        spec: &EnvironmentSpec,
    ) -> Result<PathBuf, EnvironmentSpecError> {
        let initramfs_name = format!("initramfs_{}.cpio.gz", sanitize_name(&spec.image));
        let initramfs_path = self.output_dir.join(&initramfs_name);

        if initramfs_path.exists() {
            return Ok(initramfs_path);
        }

        tracing::info!("Building initramfs for: {}", spec.image);

        // Create working directory
        let work_dir = self
            .output_dir
            .join(format!("initramfs_work_{}", sanitize_name(&spec.image)));
        tokio::fs::create_dir_all(&work_dir).await?;

        // Create initramfs contents
        self.create_initramfs_contents(&work_dir, spec).await?;

        // Create cpio archive
        self.create_cpio_archive(&work_dir, &initramfs_path).await?;

        // Cleanup
        let _ = tokio::fs::remove_dir_all(&work_dir).await;

        Ok(initramfs_path)
    }

    /// Build ext4 filesystem image
    pub async fn build_ext4(
        &self,
        spec: &EnvironmentSpec,
        size_mb: u32,
    ) -> Result<PathBuf, EnvironmentSpecError> {
        let image_name = format!("image_{}_{}mb.ext4", sanitize_name(&spec.image), size_mb);
        let image_path = self.output_dir.join(&image_name);

        if image_path.exists() {
            return Ok(image_path);
        }

        // Create working directory with rootfs contents
        let work_dir = self
            .output_dir
            .join(format!("ext4_work_{}", sanitize_name(&spec.image)));
        let rootfs_dir = work_dir.join("rootfs");
        tokio::fs::create_dir_all(&rootfs_dir).await?;

        // Pull and extract image
        let image_dir = self.pull_image(&spec.image).await?;
        self.extract_layers(&image_dir, &rootfs_dir).await?;

        // Create ext4 image
        self.create_ext4_image(&rootfs_dir, &image_path, size_mb)
            .await?;

        // Cleanup
        let _ = tokio::fs::remove_dir_all(&work_dir).await;

        Ok(image_path)
    }

    /// Pull an OCI image to local cache
    async fn pull_image(&self, image_ref: &str) -> Result<PathBuf, EnvironmentSpecError> {
        let cache_dir = self.output_dir.join("oci-cache");
        let image_dir = cache_dir.join(sanitize_name(image_ref));

        if image_dir.exists() {
            tracing::debug!("Image already cached: {}", image_ref);
            return Ok(image_dir);
        }

        // Use skopeo or crane to pull the image
        if which::which("skopeo").is_ok() {
            self.pull_with_skopeo(image_ref, &image_dir).await
        } else if which::which("crane").is_ok() {
            self.pull_with_crane(image_ref, &image_dir).await
        } else {
            Err(EnvironmentSpecError::ConversionError(
                "Neither skopeo nor crane found. Install one to pull images.".to_string(),
            ))
        }
    }

    /// Pull using skopeo
    async fn pull_with_skopeo(
        &self,
        image_ref: &str,
        dest: &Path,
    ) -> Result<PathBuf, EnvironmentSpecError> {
        tokio::fs::create_dir_all(dest).await?;

        let output = tokio::process::Command::new("skopeo")
            .args([
                "copy",
                &format!("docker://{}", image_ref),
                &format!("dir:{}", dest.display()),
            ])
            .output()
            .await?;

        if !output.status.success() {
            return Err(EnvironmentSpecError::ConversionError(format!(
                "skopeo failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        Ok(dest.to_path_buf())
    }

    /// Pull using crane
    async fn pull_with_crane(
        &self,
        image_ref: &str,
        dest: &Path,
    ) -> Result<PathBuf, EnvironmentSpecError> {
        tokio::fs::create_dir_all(dest).await?;

        // Pull and export as tarball
        let tar_path = dest.join("image.tar");

        let output = tokio::process::Command::new("crane")
            .args(["pull", image_ref, tar_path.to_str().unwrap()])
            .output()
            .await?;

        if !output.status.success() {
            return Err(EnvironmentSpecError::ConversionError(format!(
                "crane failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        // Extract tarball
        let output = tokio::process::Command::new("tar")
            .args([
                "-xf",
                tar_path.to_str().unwrap(),
                "-C",
                dest.to_str().unwrap(),
            ])
            .output()
            .await?;

        if !output.status.success() {
            return Err(EnvironmentSpecError::ConversionError(format!(
                "tar extraction failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        // Remove tarball
        let _ = tokio::fs::remove_file(&tar_path).await;

        Ok(dest.to_path_buf())
    }

    /// Extract OCI layers to directory
    async fn extract_layers(
        &self,
        image_dir: &Path,
        rootfs_dir: &Path,
    ) -> Result<(), EnvironmentSpecError> {
        tokio::fs::create_dir_all(rootfs_dir).await?;

        // Read manifest
        let manifest_path = image_dir.join("manifest.json");
        if !manifest_path.exists() {
            // Try alternative locations
            let manifest = find_manifest(image_dir).await?;
            if let Some(manifest) = manifest {
                return self
                    .extract_from_manifest(&manifest, image_dir, rootfs_dir)
                    .await;
            }
        }

        // Standard OCI layout
        let manifest = tokio::fs::read_to_string(&manifest_path).await?;
        self.extract_from_manifest(&manifest, image_dir, rootfs_dir)
            .await
    }

    /// Extract layers from manifest
    async fn extract_from_manifest(
        &self,
        manifest: &str,
        image_dir: &Path,
        rootfs_dir: &Path,
    ) -> Result<(), EnvironmentSpecError> {
        let manifest: serde_json::Value = serde_json::from_str(manifest).map_err(|e| {
            EnvironmentSpecError::ConversionError(format!("Invalid manifest: {}", e))
        })?;

        // Get layers from manifest
        let layers = manifest
            .get("layers")
            .and_then(|l| l.as_array())
            .ok_or_else(|| {
                EnvironmentSpecError::ConversionError("No layers in manifest".to_string())
            })?;

        for layer in layers {
            let digest = layer
                .get("digest")
                .and_then(|d| d.as_str())
                .ok_or_else(|| {
                    EnvironmentSpecError::ConversionError("Layer without digest".to_string())
                })?;

            // Convert digest to filename
            let layer_file = digest.replace(':', "_");
            let layer_path = image_dir.join(&layer_file);

            if layer_path.exists() {
                // Extract layer (gzip tarball)
                self.extract_layer(&layer_path, rootfs_dir).await?;
            }
        }

        Ok(())
    }

    /// Extract a single layer tarball
    async fn extract_layer(
        &self,
        layer_path: &Path,
        rootfs_dir: &Path,
    ) -> Result<(), EnvironmentSpecError> {
        // Use tar to extract
        let output = tokio::process::Command::new("tar")
            .args([
                "-xzf",
                layer_path.to_str().unwrap(),
                "-C",
                rootfs_dir.to_str().unwrap(),
            ])
            .output()
            .await?;

        if !output.status.success() {
            // Some layers might be empty or have different format, log warning
            tracing::warn!(
                "Failed to extract layer {}: {}",
                layer_path.display(),
                String::from_utf8_lossy(&output.stderr)
            );
        }

        Ok(())
    }

    /// Apply post-create commands inside chroot
    async fn apply_post_create(
        &self,
        rootfs_dir: &Path,
        commands: &[String],
    ) -> Result<(), EnvironmentSpecError> {
        // Create a script to run inside chroot
        let script_path = rootfs_dir.join("tmp/post-create.sh");
        tokio::fs::create_dir_all(rootfs_dir.join("tmp")).await?;

        let script_content = format!("#!/bin/sh\nset -e\n{}\n", commands.join("\n"));

        let mut file = tokio::fs::File::create(&script_path).await?;
        file.write_all(script_content.as_bytes()).await?;
        drop(file);

        // Make executable
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = tokio::fs::metadata(&script_path).await?.permissions();
            perms.set_mode(0o755);
            tokio::fs::set_permissions(&script_path, perms).await?;
        }

        // Run in chroot (requires root)
        let output = tokio::process::Command::new("chroot")
            .arg(rootfs_dir)
            .arg("/tmp/post-create.sh")
            .output()
            .await?;

        if !output.status.success() {
            return Err(EnvironmentSpecError::ConversionError(format!(
                "Post-create script failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        // Clean up script
        let _ = tokio::fs::remove_file(&script_path).await;

        Ok(())
    }

    /// Create ext4 filesystem image from directory
    async fn create_ext4_image(
        &self,
        rootfs_dir: &Path,
        output_path: &Path,
        size_mb: u32,
    ) -> Result<(), EnvironmentSpecError> {
        // Create empty file
        let file = tokio::fs::File::create(output_path).await?;
        file.set_len(size_mb as u64 * 1024 * 1024).await?;
        drop(file);

        // Create ext4 filesystem
        let output = tokio::process::Command::new("mkfs.ext4")
            .args([
                "-q",
                "-d",
                rootfs_dir.to_str().unwrap(),
                output_path.to_str().unwrap(),
            ])
            .output()
            .await?;

        if !output.status.success() {
            return Err(EnvironmentSpecError::ConversionError(format!(
                "mkfs.ext4 failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        Ok(())
    }

    /// Create initramfs contents
    async fn create_initramfs_contents(
        &self,
        work_dir: &Path,
        spec: &EnvironmentSpec,
    ) -> Result<(), EnvironmentSpecError> {
        // Create basic initramfs structure
        let dirs = [
            "bin", "sbin", "etc", "lib", "lib64", "proc", "sys", "dev", "tmp", "run", "var",
            "root", "usr/bin", "usr/sbin",
        ];

        for dir in &dirs {
            tokio::fs::create_dir_all(work_dir.join(dir)).await?;
        }

        // Create init script
        let init_script = r#"#!/bin/sh
# Allternit Initramfs Init

mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
mount -t tmpfs none /tmp

echo "Allternit MicroVM starting..."

# Mount root filesystem
mkdir -p /newroot
mount /dev/vda /newroot

# Switch to root filesystem
exec switch_root /newroot /sbin/init
"#;

        let init_path = work_dir.join("init");
        let mut file = tokio::fs::File::create(&init_path).await?;
        file.write_all(init_script.as_bytes()).await?;
        drop(file);

        // Make executable
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = tokio::fs::metadata(&init_path).await?.permissions();
            perms.set_mode(0o755);
            tokio::fs::set_permissions(&init_path, perms).await?;
        }

        // Copy essential binaries (busybox or similar)
        // This would require having a minimal rootfs template

        Ok(())
    }

    /// Create cpio.gz archive
    async fn create_cpio_archive(
        &self,
        source_dir: &Path,
        output_path: &Path,
    ) -> Result<(), EnvironmentSpecError> {
        // Use find + cpio to create archive
        let output = tokio::process::Command::new("sh")
            .arg("-c")
            .arg(format!(
                "cd {} && find . | cpio -o -H newc | gzip > {}",
                source_dir.display(),
                output_path.display()
            ))
            .output()
            .await?;

        if !output.status.success() {
            return Err(EnvironmentSpecError::ConversionError(format!(
                "cpio failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        Ok(())
    }
}

/// Find manifest in OCI layout
async fn find_manifest(image_dir: &Path) -> Result<Option<String>, EnvironmentSpecError> {
    // Try manifest.json first
    let manifest_path = image_dir.join("manifest.json");
    if manifest_path.exists() {
        let content = tokio::fs::read_to_string(&manifest_path).await?;
        return Ok(Some(content));
    }

    // Try OCI layout
    let oci_layout = image_dir.join("oci-layout");
    if oci_layout.exists() {
        // Look for index.json
        let index_path = image_dir.join("index.json");
        if index_path.exists() {
            let index = tokio::fs::read_to_string(&index_path).await?;
            // Parse index to find manifest
            return Ok(Some(index));
        }
    }

    Ok(None)
}

/// Sanitize name for filesystem
fn sanitize_name(name: &str) -> String {
    name.replace(['/', ':', '@', '.'], "_")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_name() {
        assert_eq!(
            sanitize_name("docker.io/library/ubuntu:22.04"),
            "docker_io_library_ubuntu_22_04"
        );
    }
}
