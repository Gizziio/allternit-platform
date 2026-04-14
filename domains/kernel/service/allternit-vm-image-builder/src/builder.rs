//! Local image builder
//!
//! Builds VM images from scratch using debootstrap and chroot.
//! This provides full transparency and customization.

use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::process::Command;
use tracing::{debug, info, warn};

use crate::config::{ImageConfig, DEFAULT_PACKAGES, TOOLCHAINS};

/// Local image builder
pub struct LocalBuilder {
    config: ImageConfig,
    work_dir: PathBuf,
}

impl LocalBuilder {
    /// Create new builder
    pub fn new(config: ImageConfig) -> Self {
        let work_dir = config.output_dir.join(".build");
        Self { config, work_dir }
    }

    /// Build images locally
    pub async fn build(&self) -> Result<()> {
        info!("Starting local image build...");
        info!("Work directory: {}", self.work_dir.display());

        // Clean and create work directory
        if self.work_dir.exists() {
            tokio::fs::remove_dir_all(&self.work_dir).await?;
        }
        tokio::fs::create_dir_all(&self.work_dir).await?;

        // Step 1: Build rootfs
        self.build_rootfs().await?;

        // Step 2: Install guest agent
        self.install_guest_agent().await?;

        // Step 3: Install toolchains
        if self.config.include_toolchains {
            self.install_toolchains().await?;
        }

        // Step 4: Configure system
        self.configure_system().await?;

        // Step 5: Create disk image
        self.create_disk_image().await?;

        // Step 6: Get kernel
        self.get_kernel().await?;

        // Cleanup
        tokio::fs::remove_dir_all(&self.work_dir).await.ok();

        info!("✅ Local image build complete!");
        info!("Images in: {}", self.config.output_dir.display());

        Ok(())
    }

    /// Build rootfs using debootstrap
    async fn build_rootfs(&self) -> Result<()> {
        info!("Building rootfs with Ubuntu {}...", self.config.ubuntu_version);

        let rootfs_dir = self.work_dir.join("rootfs");
        tokio::fs::create_dir_all(&rootfs_dir).await?;

        // Check for debootstrap
        let debootstrap_check = Command::new("which")
            .arg("debootstrap")
            .output()
            .await?;

        if !debootstrap_check.status.success() {
            anyhow::bail!(
                "debootstrap not found. Install it:\n  Ubuntu/Debian: sudo apt-get install debootstrap\n  macOS: brew install debootstrap (requires Linux VM)"
            );
        }

        // Run debootstrap
        let suite = format!("ubuntu-{}-server-cloudimg-amd64-root.tar.gz", self.config.ubuntu_version);
        let url = format!(
            "http://cloud-images.ubuntu.com/releases/{}/release/{}-server-cloudimg-amd64-root.tar.gz",
            self.config.ubuntu_version,
            self.config.ubuntu_version
        );

        // Alternative: Use debootstrap directly
        info!("Running debootstrap...");
        let status = Command::new("sudo")
            .args(&[
                "debootstrap",
                &self.config.ubuntu_version,
                rootfs_dir.to_str().unwrap(),
                "http://archive.ubuntu.com/ubuntu/",
            ])
            .status()
            .await
            .context("Failed to run debootstrap")?;

        if !status.success() {
            anyhow::bail!("debootstrap failed");
        }

        info!("Rootfs created at {}", rootfs_dir.display());
        Ok(())
    }

    /// Install a2r-vm-executor into rootfs
    async fn install_guest_agent(&self) -> Result<()> {
        info!("Installing a2r-vm-executor...");

        let rootfs_dir = self.work_dir.join("rootfs");
        let executor_bin = rootfs_dir.join("usr/bin/a2r-vm-executor");

        // Build the guest agent for the target architecture
        info!("Building a2r-vm-executor for x86_64-unknown-linux-gnu...");
        
        let status = Command::new("cargo")
            .args(&[
                "build",
                "--release",
                "--target", "x86_64-unknown-linux-gnu",
                "-p", "a2r-vm-executor",
            ])
            .current_dir("/Users/macbook") // Workspace root
            .status()
            .await
            .context("Failed to build a2r-vm-executor")?;

        if !status.success() {
            warn!("Failed to build a2r-vm-executor with cross-compilation");
            warn!("Attempting native build...");
            
            // Fallback: build natively (if on Linux)
            let status = Command::new("cargo")
                .args(&[
                    "build",
                    "--release",
                    "-p", "a2r-vm-executor",
                ])
                .status()
                .await?;

            if !status.success() {
                anyhow::bail!("Failed to build a2r-vm-executor");
            }
        }

        // Copy binary to rootfs
        let source = if status.success() {
            "/Users/macbook/target/x86_64-unknown-linux-gnu/release/a2r-vm-executor"
        } else {
            "/Users/macbook/target/release/a2r-vm-executor"
        };

        tokio::fs::copy(source, &executor_bin).await
            .with_context(|| format!("Failed to copy executor to rootfs"))?;

        // Make executable
        let _ = Command::new("sudo")
            .args(&["chmod", "+x", executor_bin.to_str().unwrap()])
            .status()
            .await;

        info!("a2r-vm-executor installed");
        Ok(())
    }

    /// Install toolchains into rootfs
    async fn install_toolchains(&self) -> Result<()> {
        info!("Installing toolchains...");

        let rootfs_dir = self.work_dir.join("rootfs");

        // Update package list
        self.chroot_cmd("apt-get update").await?;

        // Install default packages
        let packages = DEFAULT_PACKAGES.join(" ");
        self.chroot_cmd(&format!("apt-get install -y {}", packages)).await?;

        // Install additional packages
        if !self.config.additional_packages.is_empty() {
            let extra = self.config.additional_packages.join(" ");
            self.chroot_cmd(&format!("apt-get install -y {}", extra)).await?;
        }

        // Install toolchains
        for toolchain in TOOLCHAINS {
            info!("Installing {}...", toolchain.name);
            self.chroot_cmd(toolchain.install_cmd).await?;
        }

        // Clean up
        self.chroot_cmd("apt-get clean").await?;
        self.chroot_cmd("rm -rf /var/lib/apt/lists/*").await?;

        info!("Toolchains installed");
        Ok(())
    }

    /// Configure the system
    async fn configure_system(&self) -> Result<()> {
        info!("Configuring system...");

        let rootfs_dir = self.work_dir.join("rootfs");
        let a2r_dir = rootfs_dir.join("etc/a2r");
        tokio::fs::create_dir_all(&a2r_dir).await?;

        // Create vm-executor config
        let config_content = r#"# A2R VM Executor Configuration
# This file is managed by a2r-vm-image-builder

vsock_port = 8080
log_level = "info"
max_sessions = 50
session_timeout_secs = 3600
workspace_path = "/workspace"

[sandbox]
use_bubblewrap = true
bwrap_path = "/usr/bin/bwrap"
network = "host"
max_memory_mb = 2048
read_only_root = true

[sandbox.default_mounts]
source = "/workspace"
destination = "/workspace"
read_only = false

[toolchains]
node_path = "/usr/bin/node"
npm_path = "/usr/bin/npm"
python_path = "/usr/bin/python3"
pip_path = "/usr/bin/pip3"
docker_path = "/usr/bin/docker"
cargo_path = "/usr/bin/cargo"
git_path = "/usr/bin/git"
"#;

        tokio::fs::write(a2r_dir.join("vm-executor.toml"), config_content).await?;

        // Create systemd service (for systems that use systemd)
        let systemd_dir = rootfs_dir.join("etc/systemd/system");
        tokio::fs::create_dir_all(&systemd_dir).await?;

        let service_content = r#"[Unit]
Description=A2R VM Executor
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/a2r-vm-executor
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
"#;

        tokio::fs::write(systemd_dir.join("a2r-vm-executor.service"), service_content).await?;

        // Enable service
        self.chroot_cmd("systemctl enable a2r-vm-executor").await.ok();

        info!("System configured");
        Ok(())
    }

    /// Create disk image from rootfs
    async fn create_disk_image(&self) -> Result<()> {
        info!("Creating disk image...");

        let rootfs_dir = self.work_dir.join("rootfs");
        let image_path = self.config.output_dir.join(
            format!("ubuntu-22.04-a2r-v1.1.0.ext4")
        );

        // Calculate required size
        let size_output = Command::new("sudo")
            .args(&["du", "-sb", rootfs_dir.to_str().unwrap()])
            .output()
            .await?;

        let size_str = String::from_utf8_lossy(&size_output.stdout);
        let size_bytes: u64 = size_str
            .split_whitespace()
            .next()
            .unwrap_or("0")
            .parse()
            .unwrap_or(0);

        // Add 20% margin
        let image_size_mb = ((size_bytes * 12) / 10) / (1024 * 1024) + 100;

        info!("Creating {} MB disk image...", image_size_mb);

        // Create sparse file
        let status = Command::new("truncate")
            .args(&["-s", &format!("{}M", image_size_mb), image_path.to_str().unwrap()])
            .status()
            .await?;

        if !status.success() {
            anyhow::bail!("Failed to create disk image file");
        }

        // Format as ext4
        let status = Command::new("mkfs.ext4")
            .args(&["-F", image_path.to_str().unwrap()])
            .status()
            .await?;

        if !status.success() {
            anyhow::bail!("Failed to format disk image");
        }

        // Mount and copy rootfs
        let mount_dir = self.work_dir.join("mnt");
        tokio::fs::create_dir_all(&mount_dir).await?;

        Command::new("sudo")
            .args(&["mount", image_path.to_str().unwrap(), mount_dir.to_str().unwrap()])
            .status()
            .await?;

        // Copy files
        let status = Command::new("sudo")
            .args(&[
                "cp", "-a",
                &format!("{}/.", rootfs_dir.to_str().unwrap()),
                mount_dir.to_str().unwrap(),
            ])
            .status()
            .await?;

        if !status.success() {
            warn!("Some files may not have copied correctly");
        }

        // Unmount
        Command::new("sudo")
            .args(&["umount", mount_dir.to_str().unwrap()])
            .status()
            .await?;

        info!("Disk image created: {}", image_path.display());
        Ok(())
    }

    /// Get kernel for VM
    async fn get_kernel(&self) -> Result<()> {
        info!("Getting Linux kernel...");

        // Download kernel from Ubuntu
        let kernel_version = "6.5.0";
        let kernel_file = self.config.output_dir.join(format!("vmlinux-{}-a2r", kernel_version));
        let initrd_file = self.config.output_dir.join(format!("initrd.img-{}-a2r", kernel_version));

        // For macOS VMs with Apple Virtualization, we need a specific kernel
        // Download from Ubuntu cloud images
        let url = format!(
            "http://cloud-images.ubuntu.com/releases/22.04/release/unpacked/ubuntu-22.04-server-cloudimg-amd64-vmlinuz-generic"
        );

        info!("Downloading kernel from {}...", url);
        
        let response = reqwest::get(&url).await?;
        if response.status().is_success() {
            let bytes = response.bytes().await?;
            tokio::fs::write(&kernel_file, bytes).await?;
            info!("Kernel downloaded to {}", kernel_file.display());
        } else {
            warn!("Failed to download kernel, VM may not boot");
        }

        // Download initrd
        let initrd_url = format!(
            "http://cloud-images.ubuntu.com/releases/22.04/release/unpacked/ubuntu-22.04-server-cloudimg-amd64-initrd-generic"
        );

        info!("Downloading initrd from {}...", initrd_url);
        
        let response = reqwest::get(&initrd_url).await?;
        if response.status().is_success() {
            let bytes = response.bytes().await?;
            tokio::fs::write(&initrd_file, bytes).await?;
            info!("Initrd downloaded to {}", initrd_file.display());
        }

        Ok(())
    }

    /// Run command in chroot
    async fn chroot_cmd(&self, cmd: &str) -> Result<()> {
        let rootfs_dir = self.work_dir.join("rootfs");
        
        debug!("chroot {} {}", rootfs_dir.display(), cmd);

        let status = Command::new("sudo")
            .args(&[
                "chroot",
                rootfs_dir.to_str().unwrap(),
                "/bin/bash",
                "-c",
                cmd,
            ])
            .status()
            .await?;

        if !status.success() {
            warn!("Chroot command failed: {}", cmd);
        }

        Ok(())
    }
}
