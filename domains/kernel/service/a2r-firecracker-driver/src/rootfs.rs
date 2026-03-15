//! # Rootfs Creation and Management
//!
//! Handles creation of VM root filesystems from OCI images or base filesystems.
//!
//! ## Determinism Features (Phase 2)
//!
//! - **Timestamp Normalization**: All files in the rootfs get the same deterministic timestamp
//!   when an envelope is provided. This ensures reproducible filesystem hashes across runs.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::SystemTime;
use tokio::fs;
use tokio::process::Command;
use tracing::{debug, error, info, info_span, instrument, warn, Instrument};
use walkdir::WalkDir;

use crate::{DriverError, MicroVM};

/// Global counter for unique container names
static CONTAINER_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Guard to ensure container cleanup on scope exit
/// Uses synchronous cleanup since Drop cannot be async
struct CleanupGuard {
    cmd: &'static str,
    name: String,
}

impl CleanupGuard {
    fn new(cmd: &'static str, name: impl Into<String>) -> Self {
        Self {
            cmd,
            name: name.into(),
        }
    }
}

impl Drop for CleanupGuard {
    fn drop(&mut self) {
        // Use synchronous command execution since Drop cannot be async
        // This ensures cleanup happens even on panic
        let _ = std::process::Command::new(self.cmd)
            .args(["rm", "-f", &self.name])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .output();
        debug!(container_name = %self.name, "Cleaned up container");
    }
}

/// Defer cleanup macro - ensures cleanup runs on all exit paths (success, error, panic)
macro_rules! defer_cleanup {
    ($cmd:expr, $name:expr) => {
        let _cleanup = CleanupGuard::new($cmd, $name);
    };
}

/// Rootfs builder for MicroVMs
pub struct RootfsBuilder {
    /// Cache directory for OCI layers
    cache_dir: PathBuf,
}

impl RootfsBuilder {
    /// Create a new rootfs builder
    pub fn new(cache_dir: PathBuf) -> Self {
        Self { cache_dir }
    }

    /// Create rootfs for a VM from the environment spec
    ///
    /// When `base_time` is provided (deterministic mode), all file timestamps
    /// in the rootfs are normalized to this value for reproducibility.
    #[tracing::instrument(
        skip(self, vm, vm_root_dir, base_time),
        fields(
            vm_id = %vm.id,
            image = %image_ref,
            deterministic = base_time.is_some()
        )
    )]
    pub async fn create_rootfs(
        &self,
        vm: &MicroVM,
        image_ref: &str,
        vm_root_dir: &Path,
        base_time: Option<SystemTime>,
    ) -> Result<PathBuf, DriverError> {
        let rootfs_path = vm_root_dir.join(format!("{}-rootfs.ext4", vm.id));
        let disk_size = vm.vm_config.disk_mib as u64 * 1024 * 1024;

        info!(
            event = "rootfs.create.start",
            vm_id = %vm.id,
            image = %image_ref,
            path = %rootfs_path.display(),
            size_bytes = disk_size,
            disk_mib = vm.vm_config.disk_mib,
            deterministic = base_time.is_some(),
            "Creating rootfs"
        );

        // Create sparse file
        Self::create_sparse_file(&rootfs_path, disk_size).await?;

        // If image is specified, try to extract it; otherwise create minimal rootfs
        if !image_ref.is_empty() && image_ref != "scratch" {
            let vm_id_str = vm.id.to_string();
            match self
                .extract_oci_image(image_ref, &rootfs_path, &vm_id_str, base_time)
                .instrument(info_span!("extract_oci", vm_id = %vm.id, image = %image_ref))
                .await
            {
                Ok(_) => {
                    info!(
                        event = "rootfs.oci.complete",
                        vm_id = %vm.id,
                        image = %image_ref,
                        "OCI image extracted successfully"
                    );
                    return Ok(rootfs_path);
                }
                Err(e) => {
                    warn!(
                        event = "rootfs.oci_failed",
                        vm_id = %vm.id,
                        image = %image_ref,
                        error = %e,
                        "Failed to extract OCI image, falling back to minimal rootfs"
                    );
                }
            }
        }

        // Create minimal rootfs with busybox/alpine
        self.create_minimal_rootfs(&rootfs_path)
            .instrument(info_span!("minimal_rootfs", vm_id = %vm.id))
            .await
            .map_err(|e| {
                error!(
                    event = "rootfs.minimal_failed",
                    vm_id = %vm.id,
                    error = %e,
                    "Failed to create minimal rootfs"
                );
                e
            })?;

        info!(
            event = "rootfs.create.complete",
            vm_id = %vm.id,
            path = %rootfs_path.display(),
            rootfs_type = "minimal",
            "Rootfs created successfully"
        );

        Ok(rootfs_path)
    }

    /// Generate a unique container name
    /// Format: a2r-{vm_id_short}-{timestamp}-{counter}
    fn generate_unique_container_name(vm_id: &str) -> String {
        let vm_id_short = &vm_id[..vm_id.len().min(12)];
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let counter = CONTAINER_COUNTER.fetch_add(1, Ordering::SeqCst);
        format!("a2r-{}-{}-{}", vm_id_short, timestamp, counter)
    }

    /// Verify that a container name is available (not in use)
    /// Returns true if the name is free, false if it's already taken
    async fn verify_container_name_available(
        name: &str,
        runtime: &str,
    ) -> Result<bool, DriverError> {
        let output = Command::new(runtime)
            .args(["inspect", name])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to run {} inspect: {}", runtime, e),
            })?;

        // If inspect succeeds (exit code 0), container exists (name taken)
        // If inspect fails (non-zero exit), container doesn't exist (name available)
        Ok(!output.status.success())
    }

    /// Create a sparse file for the rootfs
    async fn create_sparse_file(path: &Path, size: u64) -> Result<(), DriverError> {
        // Create parent directory if needed
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| DriverError::InternalError {
                    message: format!("Failed to create parent directory: {}", e),
                })?;
        }

        // Try fallocate first (fastest), fall back to dd
        let output = Command::new("fallocate")
            .args(["-l", &format!("{}", size), &path.to_string_lossy()])
            .output()
            .await;

        if let Ok(output) = output {
            if output.status.success() {
                return Ok(());
            }
        }

        // Fall back to dd
        let output = Command::new("dd")
            .args([
                "if=/dev/zero",
                &format!("of={}", path.to_string_lossy()),
                "bs=1M",
                &format!("count={}", size / 1024 / 1024),
            ])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create rootfs file: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!("dd failed: {}", String::from_utf8_lossy(&output.stderr)),
            });
        }

        Ok(())
    }

    /// Extract OCI image to rootfs
    ///
    /// When `base_time` is provided, normalizes all file timestamps after extraction
    /// to ensure reproducible rootfs hashes across different runs.
    #[tracing::instrument(
        skip(self, rootfs_path, base_time),
        fields(image = %image_ref, vm_id)
    )]
    async fn extract_oci_image(
        &self,
        image_ref: &str,
        rootfs_path: &Path,
        vm_id: &str,
        base_time: Option<SystemTime>,
    ) -> Result<(), DriverError> {
        debug!(
            event = "rootfs.extract.start",
            image = %image_ref,
            vm_id = %vm_id,
            "Extracting OCI image"
        );

        let extract_dir = self
            .cache_dir
            .join("extract")
            .join(blake3::hash(image_ref.as_bytes()).to_hex().to_string());

        // Create extraction directory
        fs::create_dir_all(&extract_dir)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create extract dir: {}", e),
            })?;

        // Try using skopeo + umoci (preferred method)
        if self.command_exists("skopeo").await && self.command_exists("umoci").await {
            info!(
                event = "rootfs.using_skopeo_umoci",
                image = %image_ref,
                "Using skopeo + umoci for OCI extraction"
            );
            self.extract_with_skopeo_umoci(image_ref, &extract_dir)
                .instrument(info_span!("extract_skopeo", image = %image_ref))
                .await
                .map_err(|e| {
                    error!(
                        event = "rootfs.skopeo_failed",
                        image = %image_ref,
                        error = %e,
                        "skopeo/umoci extraction failed"
                    );
                    e
                })?;
        }
        // Try using buildah
        else if self.command_exists("buildah").await {
            info!(
                event = "rootfs.using_buildah",
                image = %image_ref,
                "Using buildah for OCI extraction"
            );
            self.extract_with_buildah(image_ref, &extract_dir, vm_id)
                .instrument(info_span!("extract_buildah", image = %image_ref, vm_id = %vm_id))
                .await
                .map_err(|e| {
                    error!(
                        event = "rootfs.buildah_failed",
                        image = %image_ref,
                        error = %e,
                        "buildah extraction failed"
                    );
                    e
                })?;
        }
        // Try using podman
        else if self.command_exists("podman").await {
            info!(
                event = "rootfs.using_podman",
                image = %image_ref,
                "Using podman for OCI extraction"
            );
            self.extract_with_podman(image_ref, &extract_dir, vm_id)
                .instrument(info_span!("extract_podman", image = %image_ref, vm_id = %vm_id))
                .await
                .map_err(|e| {
                    error!(
                        event = "rootfs.podman_failed",
                        image = %image_ref,
                        error = %e,
                        "podman extraction failed"
                    );
                    e
                })?;
        }
        // Try using docker
        else if self.command_exists("docker").await {
            info!(
                event = "rootfs.using_docker",
                image = %image_ref,
                "Using docker for OCI extraction"
            );
            self.extract_with_docker(image_ref, &extract_dir, vm_id)
                .instrument(info_span!("extract_docker", image = %image_ref, vm_id = %vm_id))
                .await
                .map_err(|e| {
                    error!(
                        event = "rootfs.docker_failed",
                        image = %image_ref,
                        error = %e,
                        "docker extraction failed"
                    );
                    e
                })?;
        } else {
            error!(
                event = "rootfs.no_tool",
                image = %image_ref,
                "No OCI extraction tool found"
            );
            return Err(DriverError::InternalError {
                message: "No OCI extraction tool found (skopeo, buildah, podman, or docker)"
                    .to_string(),
            });
        }

        // Create and mount ext4, copy contents with optional timestamp normalization
        self.copy_to_ext4(&extract_dir, rootfs_path, base_time)
            .instrument(
                info_span!("copy_to_ext4", image = %image_ref, deterministic = base_time.is_some()),
            )
            .await
            .map_err(|e| {
                error!(
                    event = "rootfs.copy_failed",
                    image = %image_ref,
                    error = %e,
                    "Failed to copy to ext4"
                );
                e
            })?;

        info!(
            event = "rootfs.extract.complete",
            image = %image_ref,
            vm_id = %vm_id,
            "OCI image extracted successfully"
        );

        Ok(())
    }

    /// Extract image using skopeo + umoci
    #[tracing::instrument(skip(self, extract_dir), fields(image = %image_ref))]
    async fn extract_with_skopeo_umoci(
        &self,
        image_ref: &str,
        extract_dir: &Path,
    ) -> Result<(), DriverError> {
        debug!(
            event = "rootfs.skopeo.start",
            image = %image_ref,
            extract_dir = %extract_dir.display(),
            "Starting skopeo extraction"
        );
        let oci_dir = extract_dir.join("oci");
        let rootfs_dir = extract_dir.join("rootfs");

        fs::create_dir_all(&oci_dir)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create OCI dir: {}", e),
            })?;
        fs::create_dir_all(&rootfs_dir)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create rootfs dir: {}", e),
            })?;

        // Copy image to local OCI layout
        let output = Command::new("skopeo")
            .args([
                "copy",
                &format!("docker://{}", image_ref),
                &format!("oci:{}", oci_dir.display()),
            ])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to run skopeo: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "skopeo copy failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Unpack OCI layout to rootfs
        let output = Command::new("umoci")
            .args([
                "unpack",
                "--image",
                &format!("{}", oci_dir.display()),
                &format!("{}", rootfs_dir.display()),
            ])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to run umoci: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "umoci unpack failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        Ok(())
    }

    /// Extract image using buildah
    #[tracing::instrument(skip(self, extract_dir), fields(image = %image_ref, vm_id))]
    async fn extract_with_buildah(
        &self,
        image_ref: &str,
        extract_dir: &Path,
        vm_id: &str,
    ) -> Result<(), DriverError> {
        debug!(
            event = "rootfs.buildah.start",
            image = %image_ref,
            vm_id = %vm_id,
            "Starting buildah extraction"
        );
        let rootfs_dir = extract_dir.join("rootfs");
        fs::create_dir_all(&rootfs_dir)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create rootfs dir: {}", e),
            })?;

        // Generate unique container name for this extraction
        let container_name = Self::generate_unique_container_name(vm_id);

        // Pre-flight check: verify container name is available
        if !Self::verify_container_name_available(&container_name, "buildah").await? {
            return Err(DriverError::InternalError {
                message: format!("Container name '{}' is already in use", container_name),
            });
        }

        info!(
            event = "rootfs.buildah.container",
            container_name = %container_name,
            image = %image_ref,
            "Using unique container name for buildah extraction"
        );

        // Create container from image (instead of mounting image directly)
        let output = Command::new("buildah")
            .args(["from", "--name", &container_name, image_ref])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to run buildah from: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "buildah from failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Set up cleanup guard to ensure container is removed on all exit paths
        defer_cleanup!("buildah", &container_name);

        // Mount the container
        let output = Command::new("buildah")
            .args(["mount", &container_name])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to run buildah mount: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "buildah mount failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        let mount_point = String::from_utf8_lossy(&output.stdout).trim().to_string();

        // Copy contents
        let output = Command::new("cp")
            .args([
                "-a",
                &format!("{}/.", mount_point),
                &format!("{}/", rootfs_dir.display()),
            ])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to copy rootfs: {}", e),
            })?;

        // Unmount (cleanup guard will remove the container)
        let _ = Command::new("buildah")
            .args(["unmount", &container_name])
            .output()
            .await;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: "Failed to copy rootfs contents".to_string(),
            });
        }

        Ok(())
    }

    /// Extract image using podman
    #[tracing::instrument(skip(self, extract_dir), fields(image = %image_ref, vm_id))]
    async fn extract_with_podman(
        &self,
        image_ref: &str,
        extract_dir: &Path,
        vm_id: &str,
    ) -> Result<(), DriverError> {
        debug!(
            event = "rootfs.podman.start",
            image = %image_ref,
            vm_id = %vm_id,
            "Starting podman extraction"
        );
        let rootfs_dir = extract_dir.join("rootfs");
        fs::create_dir_all(&rootfs_dir)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create rootfs dir: {}", e),
            })?;

        // Generate unique container name for this extraction
        let container_name = Self::generate_unique_container_name(vm_id);

        // Pre-flight check: verify container name is available
        if !Self::verify_container_name_available(&container_name, "podman").await? {
            return Err(DriverError::InternalError {
                message: format!("Container name '{}' is already in use", container_name),
            });
        }

        info!(
            event = "rootfs.podman.container",
            container_name = %container_name,
            image = %image_ref,
            "Using unique container name for podman extraction"
        );

        // Create container from image
        let output = Command::new("podman")
            .args(["create", "--name", &container_name, image_ref])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to run podman create: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "podman create failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Set up cleanup guard to ensure container is removed on all exit paths
        defer_cleanup!("podman", &container_name);

        // Export container filesystem
        let output = Command::new("podman")
            .args([
                "export",
                "-o",
                &format!("{}/rootfs.tar", extract_dir.display()),
                &container_name,
            ])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to run podman export: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "podman export failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Extract tar
        let output = Command::new("tar")
            .args([
                "-xf",
                &format!("{}/rootfs.tar", extract_dir.display()),
                "-C",
                &format!("{}", rootfs_dir.display()),
            ])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to extract tar: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "tar extraction failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Clean up tar
        let _ = fs::remove_file(format!("{}/rootfs.tar", extract_dir.display())).await;

        // Cleanup guard will remove the container when _cleanup goes out of scope
        Ok(())
    }

    /// Extract image using docker
    #[tracing::instrument(skip(self, extract_dir), fields(image = %image_ref, vm_id))]
    async fn extract_with_docker(
        &self,
        image_ref: &str,
        extract_dir: &Path,
        vm_id: &str,
    ) -> Result<(), DriverError> {
        debug!(
            event = "rootfs.docker.start",
            image = %image_ref,
            vm_id = %vm_id,
            "Starting docker extraction"
        );
        let rootfs_dir = extract_dir.join("rootfs");
        fs::create_dir_all(&rootfs_dir)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create rootfs dir: {}", e),
            })?;

        // Generate unique container name for this extraction
        let container_name = Self::generate_unique_container_name(vm_id);

        // Pre-flight check: verify container name is available
        if !Self::verify_container_name_available(&container_name, "docker").await? {
            return Err(DriverError::InternalError {
                message: format!("Container name '{}' is already in use", container_name),
            });
        }

        info!(
            event = "rootfs.docker.container",
            container_name = %container_name,
            image = %image_ref,
            "Using unique container name for docker extraction"
        );

        // Create container from image
        let output = Command::new("docker")
            .args(["create", "--name", &container_name, image_ref])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to run docker create: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "docker create failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Set up cleanup guard to ensure container is removed on all exit paths
        defer_cleanup!("docker", &container_name);

        // Export container filesystem
        let output = Command::new("docker")
            .args([
                "export",
                "-o",
                &format!("{}/rootfs.tar", extract_dir.display()),
                &container_name,
            ])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to run docker export: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "docker export failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Extract tar
        let output = Command::new("tar")
            .args([
                "-xf",
                &format!("{}/rootfs.tar", extract_dir.display()),
                "-C",
                &format!("{}", rootfs_dir.display()),
            ])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to extract tar: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "tar extraction failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Clean up tar
        let _ = fs::remove_file(format!("{}/rootfs.tar", extract_dir.display())).await;

        // Cleanup guard will remove the container when _cleanup goes out of scope
        Ok(())
    }

    /// Copy directory contents to ext4 filesystem
    ///
    /// When `base_time` is provided, normalizes all file timestamps to ensure
    /// reproducible rootfs hashes across different runs.
    #[tracing::instrument(
        skip(self, source_dir, rootfs_path, base_time),
        fields(
            source_dir = %source_dir.display(),
            rootfs_path = %rootfs_path.display(),
            deterministic = base_time.is_some()
        )
    )]
    async fn copy_to_ext4(
        &self,
        source_dir: &Path,
        rootfs_path: &Path,
        base_time: Option<SystemTime>,
    ) -> Result<(), DriverError> {
        debug!(
            event = "rootfs.copy_ext4.start",
            source_dir = %source_dir.display(),
            rootfs_path = %rootfs_path.display(),
            deterministic = base_time.is_some(),
            "Copying to ext4 filesystem"
        );
        // Format as ext4
        let output = Command::new("mkfs.ext4")
            .args(["-F", &rootfs_path.to_string_lossy()])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to format rootfs: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "mkfs.ext4 failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Mount and copy
        let mount_point = format!("/tmp/a2r-mount-{}", uuid::Uuid::new_v4());
        fs::create_dir_all(&mount_point)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create mount point: {}", e),
            })?;

        // Mount
        let output = Command::new("mount")
            .args([&rootfs_path.to_string_lossy(), mount_point.as_str()])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to mount rootfs: {}", e),
            })?;

        if !output.status.success() {
            // Clean up
            let _ = fs::remove_dir(&mount_point).await;
            return Err(DriverError::InternalError {
                message: format!("mount failed: {}", String::from_utf8_lossy(&output.stderr)),
            });
        }

        // Find actual rootfs (may be in rootfs/ subdirectory from umoci)
        let source_rootfs = if source_dir.join("rootfs").exists() {
            source_dir.join("rootfs")
        } else {
            source_dir.to_path_buf()
        };

        // Copy contents
        let output = Command::new("cp")
            .args([
                "-a",
                &format!("{}/.", source_rootfs.display()),
                &format!("{}/", mount_point),
            ])
            .output()
            .await
            .map_err(|e| {
                let _ = Command::new("umount").arg(&mount_point).output();
                DriverError::InternalError {
                    message: format!("Failed to copy to rootfs: {}", e),
                }
            })?;

        if !output.status.success() {
            let _ = Command::new("umount").arg(&mount_point).output().await;
            let _ = fs::remove_dir(&mount_point).await;
            return Err(DriverError::InternalError {
                message: "Failed to copy rootfs contents".to_string(),
            });
        }

        // Ensure essential directories exist
        for dir in &["dev", "proc", "sys", "tmp", "run", "var", "etc"] {
            let _ = fs::create_dir_all(format!("{}/{}", mount_point, dir)).await;
        }

        // Normalize timestamps if in deterministic mode
        if let Some(time) = base_time {
            if let Err(e) = self.normalize_timestamps(&mount_point, time).await {
                warn!(
                    event = "rootfs.timestamp_warning",
                    error = %e,
                    "Failed to normalize timestamps, continuing without normalization"
                );
                // Don't fail the entire operation for timestamp normalization issues
            } else {
                info!(
                    event = "rootfs.timestamp_normalized",
                    "Timestamps normalized for reproducible rootfs"
                );
            }
        }

        // Unmount
        let _ = Command::new("sync").output().await;
        let _ = Command::new("umount").arg(&mount_point).output().await;
        let _ = fs::remove_dir(&mount_point).await;

        info!(
            event = "rootfs.copy_ext4.complete",
            rootfs_path = %rootfs_path.display(),
            "Ext4 filesystem created successfully"
        );

        Ok(())
    }

    /// Normalize all timestamps in a directory tree to a fixed value
    ///
    /// This ensures reproducible filesystem hashes by setting all file and directory
    /// timestamps to the same deterministic value.
    #[tracing::instrument(skip(self), fields(path, timestamp = ?base_time))]
    async fn normalize_timestamps(
        &self,
        path: &str,
        base_time: SystemTime,
    ) -> Result<(), DriverError> {
        debug!(
            event = "rootfs.normalize.start",
            path = path,
            "Normalizing timestamps for deterministic rootfs"
        );
        let start = std::time::Instant::now();
        let mut files_processed = 0;

        // Convert SystemTime to seconds/nanoseconds for utime
        let duration = base_time
            .duration_since(SystemTime::UNIX_EPOCH)
            .map_err(|_| DriverError::InternalError {
                message: "Invalid base time for timestamp normalization".to_string(),
            })?;

        let timestamp_secs = duration.as_secs() as i64;

        // Walk the directory tree
        for entry in WalkDir::new(path) {
            let entry = entry.map_err(|e| DriverError::InternalError {
                message: format!("Failed to read directory entry: {}", e),
            })?;

            let file_path = entry.path();

            // Set both access and modification times
            // Use File::set_times instead of deprecated utime crate
            if let Err(e) = std::fs::File::open(file_path).and_then(|f| {
                let times = std::fs::FileTimes::new()
                    .set_accessed(
                        std::time::SystemTime::UNIX_EPOCH
                            + std::time::Duration::from_secs(timestamp_secs as u64),
                    )
                    .set_modified(
                        std::time::SystemTime::UNIX_EPOCH
                            + std::time::Duration::from_secs(timestamp_secs as u64),
                    );
                f.set_times(times)
            }) {
                // Log warning but continue - some files might not be accessible
                debug!("Could not set timestamp for {}: {}", file_path.display(), e);
            }

            files_processed += 1;
        }

        info!(
            event = "rootfs.normalize.complete",
            files_processed = files_processed,
            duration_ms = start.elapsed().as_millis() as u64,
            "Normalized timestamps for reproducible rootfs"
        );

        Ok(())
    }

    /// Create minimal rootfs with busybox
    #[tracing::instrument(skip(self), fields(rootfs_path = %rootfs_path.display()))]
    async fn create_minimal_rootfs(&self, rootfs_path: &Path) -> Result<(), DriverError> {
        debug!(
            event = "rootfs.minimal.start",
            rootfs_path = %rootfs_path.display(),
            "Creating minimal rootfs with busybox"
        );

        // Check for pre-built minimal rootfs
        let minimal_rootfs = self.cache_dir.join("minimal-rootfs.tar.gz");

        if minimal_rootfs.exists() {
            // Extract pre-built rootfs
            self.extract_minimal_rootfs(&minimal_rootfs, rootfs_path)
                .await?;
        } else {
            // Create empty ext4 - guest agent will need to be added separately
            let output = Command::new("mkfs.ext4")
                .args(["-F", &rootfs_path.to_string_lossy()])
                .output()
                .await
                .map_err(|e| DriverError::InternalError {
                    message: format!("Failed to format rootfs: {}", e),
                })?;

            if !output.status.success() {
                return Err(DriverError::InternalError {
                    message: format!(
                        "mkfs.ext4 failed: {}",
                        String::from_utf8_lossy(&output.stderr)
                    ),
                });
            }
        }

        Ok(())
    }

    /// Extract pre-built minimal rootfs
    async fn extract_minimal_rootfs(
        &self,
        tar_path: &Path,
        rootfs_path: &Path,
    ) -> Result<(), DriverError> {
        // Format as ext4
        let output = Command::new("mkfs.ext4")
            .args(["-F", &rootfs_path.to_string_lossy()])
            .output()
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to format rootfs: {}", e),
            })?;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "mkfs.ext4 failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        // Mount
        let mount_point = format!("/tmp/a2r-mount-{}", uuid::Uuid::new_v4());
        fs::create_dir_all(&mount_point)
            .await
            .map_err(|e| DriverError::InternalError {
                message: format!("Failed to create mount point: {}", e),
            })?;

        let output = Command::new("mount")
            .args([&rootfs_path.to_string_lossy(), mount_point.as_str()])
            .output()
            .await
            .map_err(|e| {
                let _ = fs::remove_dir(&mount_point);
                DriverError::InternalError {
                    message: format!("Failed to mount rootfs: {}", e),
                }
            })?;

        if !output.status.success() {
            let _ = fs::remove_dir(&mount_point).await;
            return Err(DriverError::InternalError {
                message: format!("mount failed: {}", String::from_utf8_lossy(&output.stderr)),
            });
        }

        // Extract tar
        let output = Command::new("tar")
            .args(["-xzf", &tar_path.to_string_lossy(), "-C", &mount_point])
            .output()
            .await
            .map_err(|e| {
                let _ = Command::new("umount").arg(&mount_point).output();
                DriverError::InternalError {
                    message: format!("Failed to extract rootfs: {}", e),
                }
            })?;

        // Unmount
        let _ = Command::new("sync").output().await;
        let _ = Command::new("umount").arg(&mount_point).output().await;
        let _ = fs::remove_dir(&mount_point).await;

        if !output.status.success() {
            return Err(DriverError::InternalError {
                message: format!(
                    "tar extraction failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
            });
        }

        Ok(())
    }

    /// Check if a command exists
    async fn command_exists(&self, cmd: &str) -> bool {
        Command::new("which")
            .arg(cmd)
            .output()
            .await
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}
