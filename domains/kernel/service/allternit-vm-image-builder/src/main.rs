//! Allternit VM Image Builder
//!
//! Builds VM images for the Allternit platform.
//!
//! # Platform Support
//!
//! ## macOS (Host Platform)
//! - **ONLY Download Mode Supported**
//! - Cannot build images locally (debootstrap requires Linux)
//! - Downloads pre-built images from GitHub Releases
//!
//! ## Linux (Host Platform)
//! - **Download Mode** (default): Fast, ~500MB download
//! - **Build Mode** (advanced): Build from source using debootstrap
//!
//! # Image Structure
//! ```
//! ~/.allternit/vm-images/
//! ├── vmlinux-6.5.0-allternit              # Linux kernel
//! ├── initrd.img-6.5.0-allternit           # Initial ramdisk
//! ├── ubuntu-22.04-allternit-v1.1.0.ext4   # Root filesystem
//! │   └── Contains:
//! │       ├── /usr/bin/allternit-vm-executor
//! │       ├── /usr/bin/node, npm
//! │       ├── /usr/bin/python3, pip3
//! │       ├── /usr/bin/docker
//! │       ├── /usr/bin/cargo
//! │       └── /etc/allternit/vm-executor.toml
//! └── version.json                   # Image metadata
//! ```
//!
//! # Usage
//! ```bash
//! # Download pre-built images (all platforms)
//! allternit-vm-image-builder download
//!
//! # Build locally from scratch (Linux ONLY)
//! allternit-vm-image-builder build --ubuntu-version 22.04
//!
//! # Check for updates
//! allternit-vm-image-builder check-update
//! ```

use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing::{info, warn};

mod builder;
mod config;
mod downloader;
mod tools;

use builder::LocalBuilder;
use config::ImageConfig;
use downloader::ImageDownloader;

/// Default GitHub repository for pre-built images
/// Uses the current repo's releases (Gizziio/allternit)
const DEFAULT_IMAGE_REPO: &str = "Gizziio/allternit-platform";

/// Default image version
const DEFAULT_IMAGE_VERSION: &str = "1.1.0";

/// CLI arguments
#[derive(Parser)]
#[command(
    name = "allternit-vm-image-builder",
    about = "Build or download VM images for Allternit",
    version,
    long_about = r#"
Allternit VM Image Builder

Downloads or builds VM images for the Allternit platform.

PLATFORM NOTES:
- macOS: Download mode only (cannot build locally)
- Linux: Download mode (default) or build mode (advanced)

EXAMPLES:
    # Download pre-built images (all platforms)
    allternit-vm-image-builder download

    # Build locally (Linux ONLY)
    allternit-vm-image-builder build --ubuntu-version 22.04

    # Check for updates
    allternit-vm-image-builder check-update
"#
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Output directory for images
    #[arg(short, long, default_value = None)]
    output_dir: Option<PathBuf>,

    /// Image version to download/build
    #[arg(short, long, default_value = DEFAULT_IMAGE_VERSION)]
    version: String,

    /// GitHub repository for pre-built images
    #[arg(long, default_value = DEFAULT_IMAGE_REPO)]
    repo: String,

    /// Force rebuild even if images exist
    #[arg(long)]
    force: bool,

    /// Architecture (x86_64, aarch64, auto-detect)
    #[arg(short, long, default_value = "auto")]
    arch: String,

    /// Enable verbose logging
    #[arg(short, long)]
    verbose: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Download pre-built images (default, all platforms)
    Download {
        /// Skip verification
        #[arg(long)]
        no_verify: bool,
    },
    /// Build images locally from scratch (Linux ONLY)
    Build {
        /// Ubuntu version
        #[arg(short, long, default_value = "22.04")]
        ubuntu_version: String,
        
        /// Include additional packages
        #[arg(short, long)]
        packages: Vec<String>,
        
        /// Skip toolchain installation
        #[arg(long)]
        no_toolchains: bool,
    },
    /// Check for image updates
    CheckUpdate,
    /// Verify existing images
    Verify,
    /// Clean up downloaded/built images
    Clean,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(
                    if cli.verbose {
                        "allternit_vm_image_builder=debug"
                    } else {
                        "allternit_vm_image_builder=info"
                    }
                    .parse()
                    .unwrap(),
                ),
        )
        .init();

    info!("╔══════════════════════════════════════════════════════════╗");
    info!("║     Allternit VM Image Builder v{}                        ║", env!("CARGO_PKG_VERSION"));
    info!("╚══════════════════════════════════════════════════════════╝");

    // Platform check
    let is_linux = cfg!(target_os = "linux");
    let is_macos = cfg!(target_os = "macos");

    if is_macos {
        info!("Platform: macOS (download mode only)");
    } else if is_linux {
        info!("Platform: Linux (download and build modes supported)");
    } else {
        warn!("Platform: {} (download mode recommended)", std::env::consts::OS);
    }

    // Determine output directory
    let output_dir = cli
        .output_dir
        .or_else(|| get_default_image_dir())
        .context("Failed to determine output directory. Use --output-dir or ensure $HOME is set")?;

    // Ensure output directory exists
    tokio::fs::create_dir_all(&output_dir).await.with_context(|| {
        format!("Failed to create output directory: {}", output_dir.display())
    })?;

    info!("Output directory: {}", output_dir.display());

    // Execute command
    match cli.command {
        Some(Commands::Download { no_verify }) => {
            info!("Mode: Download pre-built images");
            info!("Repository: {}", cli.repo);
            info!("Version: {}", cli.version);

            let downloader = ImageDownloader::new(&cli.repo, &cli.version, &output_dir);
            
            if !cli.force {
                match downloader.check_existing().await {
                    Ok(true) => {
                        info!("Images already exist. Use --force to re-download.");
                        return Ok(());
                    }
                    Ok(false) => {}
                    Err(e) => warn!("Failed to check existing images: {}", e),
                }
            }

            downloader.download(!no_verify).await?;
            info!("✅ Images downloaded successfully!");
        }
        
        None => {
            // Default to download with verify
            info!("Mode: Download pre-built images");
            info!("Repository: {}", cli.repo);
            info!("Version: {}", cli.version);

            let downloader = ImageDownloader::new(&cli.repo, &cli.version, &output_dir);
            
            if !cli.force {
                match downloader.check_existing().await {
                    Ok(true) => {
                        info!("Images already exist. Use --force to re-download.");
                        return Ok(());
                    }
                    Ok(false) => {}
                    Err(e) => warn!("Failed to check existing images: {}", e),
                }
            }

            downloader.download(true).await?;
            info!("✅ Images downloaded successfully!");
        }

        Some(Commands::Build {
            ubuntu_version,
            packages,
            no_toolchains,
        }) => {
            // Linux-only check
            if !is_linux {
                bail!(
                    "Local image building is only supported on Linux.\n\
                     Your platform: {}\n\n\
                     On macOS, please use download mode instead:\n\
                       allternit-vm-image-builder download\n\n\
                     If you need custom images on macOS, you can:\n\
                     1. Build on a Linux machine/VM and copy the images\n\
                     2. Use the CI/CD pipeline to build custom images\n\
                     3. Fork the repo and modify the GitHub Actions workflow",
                    std::env::consts::OS
                );
            }

            info!("Mode: Build images locally");
            info!("Ubuntu version: {}", ubuntu_version);
            info!("This will take 15-30 minutes...");

            // Check prerequisites
            if let Err(missing) = tools::verify_build_tools() {
                eprintln!("\n❌ Missing required tools:");
                for tool in missing {
                    eprintln!("   - {}", tool);
                }
                eprintln!("\nInstall on Ubuntu/Debian:");
                eprintln!("   sudo apt-get install debootstrap qemu-utils e2fsprogs");
                bail!("Prerequisites not met");
            }

            // Check disk space
            let required_mb = 10000; // 10 GB
            if !tools::check_disk_space(&output_dir, required_mb) {
                bail!(
                    "Insufficient disk space. Required: {} MB, Please free up space or use a different output directory.",
                    required_mb
                );
            }

            let config = ImageConfig {
                ubuntu_version,
                additional_packages: packages,
                include_toolchains: !no_toolchains,
                output_dir: output_dir.clone(),
            };

            let builder = LocalBuilder::new(config);
            builder.build().await?;
            
            info!("✅ Images built successfully!");
        }

        Some(Commands::CheckUpdate) => {
            info!("Checking for updates...");
            
            let downloader = ImageDownloader::new(&cli.repo, &cli.version, &output_dir);
            match downloader.check_update().await {
                Ok(Some(new_version)) => {
                    info!("Update available: {} -> {}", cli.version, new_version);
                    info!("Run 'allternit-vm-image-builder download' to update");
                }
                Ok(None) => {
                    info!("You have the latest version: {}", cli.version);
                }
                Err(e) => {
                    warn!("Failed to check for updates: {}", e);
                }
            }
        }

        Some(Commands::Verify) => {
            info!("Verifying existing images...");
            
            let downloader = ImageDownloader::new(&cli.repo, &cli.version, &output_dir);
            match downloader.verify().await {
                Ok(true) => {
                    info!("✅ All images verified successfully!");
                }
                Ok(false) => {
                    warn!("⚠️  Some images failed verification");
                    warn!("Run 'allternit-vm-image-builder --force' to re-download");
                }
                Err(e) => {
                    warn!("Failed to verify images: {}", e);
                }
            }
        }

        Some(Commands::Clean) => {
            info!("Cleaning up images in {}...", output_dir.display());
            
            match tokio::fs::remove_dir_all(&output_dir).await {
                Ok(_) => info!("✅ Images cleaned successfully!"),
                Err(e) => warn!("Failed to clean images: {}", e),
            }
        }
    }

    Ok(())
}

/// Get default image directory
fn get_default_image_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".allternit/vm-images"))
}
