//! Pre-built image downloader
//!
//! Downloads VM images from GitHub Releases or other HTTP sources.

use anyhow::{Context, Result};
use indicatif::{ProgressBar, ProgressStyle};
use std::path::{Path, PathBuf};
use tracing::{debug, info, warn};

use crate::config::{Checksums, ImageMetadata};

/// GitHub Releases image downloader
pub struct ImageDownloader {
    repo: String,
    version: String,
    output_dir: PathBuf,
    client: reqwest::Client,
}

impl ImageDownloader {
    /// Create new downloader
    pub fn new(repo: &str, version: &str, output_dir: &Path) -> Self {
        Self {
            repo: repo.to_string(),
            version: version.trim_start_matches('v').to_string(),
            output_dir: output_dir.to_path_buf(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(300))
                .build()
                .expect("Failed to build HTTP client"),
        }
    }

    /// Check if images already exist
    pub async fn check_existing(&self) -> Result<bool> {
        let version_file = self.output_dir.join("version.json");
        
        if !version_file.exists() {
            return Ok(false);
        }

        let metadata: ImageMetadata = serde_json::from_str(
            &tokio::fs::read_to_string(&version_file).await?
        )?;

        // Check version match
        if metadata.version != self.version {
            info!("Existing version {} differs from requested {}", metadata.version, self.version);
            return Ok(false);
        }

        // Determine architecture suffix
        let arch = std::env::consts::ARCH;
        let arch_str = match arch {
            "x86_64" => "amd64",
            "aarch64" => "arm64",
            _ => arch,
        };

        // Check all files exist (try arch-specific names first)
        let kernel_exists =
            self.output_dir.join(format!("vmlinux-{}-allternit-{}", metadata.kernel_version, arch_str)).exists()
            || self.output_dir.join(format!("vmlinux-{}-allternit", metadata.kernel_version)).exists();
        let initrd_exists =
            self.output_dir.join(format!("initrd.img-{}-allternit-{}", metadata.kernel_version, arch_str)).exists()
            || self.output_dir.join(format!("initrd.img-{}-allternit", metadata.kernel_version)).exists();
        let rootfs_exists =
            self.output_dir.join(format!("ubuntu-22.04-allternit-v{}-{}.ext4", self.version, arch_str)).exists()
            || self.output_dir.join(format!("ubuntu-22.04-allternit-v{}.ext4", self.version)).exists();

        if !kernel_exists {
            info!("Missing kernel file");
            return Ok(false);
        }
        if !initrd_exists {
            info!("Missing initrd file");
            return Ok(false);
        }
        if !rootfs_exists {
            info!("Missing rootfs file");
            return Ok(false);
        }

        Ok(true)
    }

    /// Download all images
    pub async fn download(&self, verify: bool) -> Result<()> {
        let base_url = format!(
            "https://github.com/{}/releases/download/v{}",
            self.repo, self.version
        );

        info!("Downloading from: {}", base_url);

        // Get architecture
        let arch = std::env::consts::ARCH;
        let arch_str = match arch {
            "x86_64" => "amd64",
            "aarch64" => "arm64",
            _ => arch,
        };

        // Try to download metadata - first try arch-specific, then generic
        let metadata = match self.try_download_metadata(&base_url, arch_str).await {
            Ok(m) => m,
            Err(e) => {
                warn!("Failed to download arch-specific metadata: {}", e);
                // Fall back to generic metadata (for backwards compatibility)
                let generic_url = format!("{}/version-{}.json", base_url, self.version);
                match self.download_metadata(&generic_url).await {
                    Ok(m) => m,
                    Err(_) => {
                        // Also try amd64 suffix for x86_64
                        let amd64_url = format!("{}/version-{}-amd64.json", base_url, self.version);
                        self.download_metadata(&amd64_url).await
                            .context("Failed to download metadata. The images may not exist for this version.")?
                    }
                }
            }
        };

        // Download kernel - try arch-specific first, then generic
        let kernel_file = self.output_dir.join(format!("vmlinux-{}-allternit", metadata.kernel_version));
        let kernel_urls = [
            format!("{}/vmlinux-{}-allternit-{}", base_url, metadata.kernel_version, arch_str),
            format!("{}/vmlinux-{}-allternit", base_url, metadata.kernel_version),
        ];
        self.download_file_with_fallback(&kernel_urls, &kernel_file, "Linux kernel").await?;

        if verify {
            self.verify_checksum(&kernel_file, &metadata.checksums.vmlinux_sha256)?;
        }

        // Download initrd
        let initrd_file = self.output_dir.join(format!("initrd.img-{}-allternit", metadata.kernel_version));
        let initrd_urls = [
            format!("{}/initrd.img-{}-allternit-{}", base_url, metadata.kernel_version, arch_str),
            format!("{}/initrd.img-{}-allternit", base_url, metadata.kernel_version),
        ];
        self.download_file_with_fallback(&initrd_urls, &initrd_file, "Initial ramdisk").await?;

        if verify {
            self.verify_checksum(&initrd_file, &metadata.checksums.initrd_sha256)?;
        }

        // Download rootfs
        let rootfs_file = self.output_dir.join(format!("ubuntu-22.04-allternit-v{}.ext4.zst", self.version));
        let rootfs_urls = [
            format!("{}/ubuntu-22.04-allternit-v{}-{}.ext4.zst", base_url, self.version, arch_str),
            format!("{}/ubuntu-22.04-allternit-v{}.ext4.zst", base_url, self.version),
        ];
        self.download_file_with_fallback(&rootfs_urls, &rootfs_file, "Root filesystem").await?;

        // Decompress rootfs if needed
        let final_rootfs = self.output_dir.join(format!("ubuntu-22.04-allternit-v{}.ext4", self.version));
        if !final_rootfs.exists() {
            self.decompress_zstd(&rootfs_file, &final_rootfs).await?;
        }
        
        // Verify checksum of decompressed file
        if verify {
            self.verify_checksum(&final_rootfs, &metadata.checksums.rootfs_sha256)?;
        }

        // Write version file
        let version_file = self.output_dir.join("version.json");
        tokio::fs::write(&version_file, serde_json::to_string_pretty(&metadata)?).await?;

        info!("All files downloaded to {}", self.output_dir.display());
        Ok(())
    }

    /// Try to download metadata for a specific architecture
    async fn try_download_metadata(&self, base_url: &str, arch_str: &str) -> Result<ImageMetadata> {
        let metadata_url = format!("{}/version-{}-{}.json", base_url, self.version, arch_str);
        match self.download_metadata(&metadata_url).await {
            Ok(m) => Ok(m),
            Err(e) => {
                // If it's a 404, try the generic version
                if e.to_string().contains("404") {
                    let generic_url = format!("{}/version-{}.json", base_url, self.version);
                    self.download_metadata(&generic_url).await
                } else {
                    Err(e)
                }
            }
        }
    }

    /// Download a file trying multiple URLs
    async fn download_file_with_fallback(&self, urls: &[String], path: &Path, description: &str) -> Result<()> {
        let mut last_error = None;
        
        for (i, url) in urls.iter().enumerate() {
            match self.download_file(url, path, description).await {
                Ok(_) => return Ok(()),
                Err(e) => {
                    if i < urls.len() - 1 {
                        debug!("Failed to download from {}: {}, trying fallback", url, e);
                    }
                    last_error = Some(e);
                }
            }
        }
        
        Err(last_error.unwrap_or_else(|| anyhow::anyhow!("No URLs provided")))
    }

    /// Check for available updates
    pub async fn check_update(&self) -> Result<Option<String>> {
        let url = format!("https://api.github.com/repos/{}/releases/latest", self.repo);
        
        let response = self.client
            .get(&url)
            .header("User-Agent", "allternit-vm-image-builder")
            .send()
            .await
            .context("Failed to fetch latest release info")?;

        if !response.status().is_success() {
            anyhow::bail!("GitHub API returned: {}", response.status());
        }

        #[derive(serde::Deserialize)]
        struct ReleaseInfo {
            tag_name: String,
        }

        let release: ReleaseInfo = response.json().await?;
        let latest_version = release.tag_name.trim_start_matches('v');

        if latest_version != self.version {
            Ok(Some(latest_version.to_string()))
        } else {
            Ok(None)
        }
    }

    /// Verify existing images
    pub async fn verify(&self) -> Result<bool> {
        let version_file = self.output_dir.join("version.json");
        
        if !version_file.exists() {
            warn!("No version.json found");
            return Ok(false);
        }

        let metadata: ImageMetadata = serde_json::from_str(
            &tokio::fs::read_to_string(&version_file).await?
        )?;

        let files = [
            (
                self.output_dir.join(format!("vmlinux-{}-allternit", metadata.kernel_version)),
                &metadata.checksums.vmlinux_sha256,
                "kernel",
            ),
            (
                self.output_dir.join(format!("initrd.img-{}-allternit", metadata.kernel_version)),
                &metadata.checksums.initrd_sha256,
                "initrd",
            ),
            (
                self.output_dir.join(format!("ubuntu-22.04-allternit-v{}.ext4", self.version)),
                &metadata.checksums.rootfs_sha256,
                "rootfs",
            ),
        ];

        let mut all_valid = true;
        for (path, expected, name) in &files {
            match self.verify_checksum(path, expected) {
                Ok(_) => info!("✅ {} checksum valid", name),
                Err(e) => {
                    warn!("❌ {} checksum failed: {}", name, e);
                    all_valid = false;
                }
            }
        }

        Ok(all_valid)
    }

    /// Download metadata JSON
    async fn download_metadata(&self, url: &str) -> Result<ImageMetadata> {
        info!("Fetching metadata from {}", url);
        
        let response = self.client
            .get(url)
            .send()
            .await
            .with_context(|| format!("Failed to download metadata from {}", url))?;

        if !response.status().is_success() {
            anyhow::bail!("HTTP {}: Failed to download metadata", response.status());
        }

        let metadata: ImageMetadata = response.json().await?;
        info!("Image version: {}, built {}", metadata.version, metadata.build_date);
        
        Ok(metadata)
    }

    /// Download a file with progress bar
    async fn download_file(&self, url: &str, path: &Path, description: &str) -> Result<()> {
        if path.exists() {
            info!("{} already exists, skipping download", path.display());
            return Ok(());
        }

        info!("Downloading {} from {}", description, url);

        let response = self.client
            .get(url)
            .send()
            .await
            .with_context(|| format!("Failed to start download from {}", url))?;

        if !response.status().is_success() {
            anyhow::bail!("HTTP {}: Failed to download {}", response.status(), url);
        }

        let total_size = response.content_length().unwrap_or(0);
        
        // Create progress bar
        let pb = if total_size > 0 {
            let pb = ProgressBar::new(total_size);
            pb.set_style(
                ProgressStyle::default_bar()
                    .template("{msg} [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")
                    .expect("Invalid progress template")
                    .progress_chars("#>-")
            );
            pb.set_message(description.to_string());
            Some(pb)
        } else {
            info!("Downloading {} (size unknown)...", description);
            None
        };

        // Stream download
        let mut file = tokio::fs::File::create(path).await?;
        let mut stream = response.bytes_stream();
        let mut downloaded: u64 = 0;

        use futures::StreamExt;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            tokio::io::AsyncWriteExt::write_all(&mut file, &chunk).await?;
            downloaded += chunk.len() as u64;
            
            if let Some(ref pb) = pb {
                pb.set_position(downloaded);
            }
        }

        if let Some(pb) = pb {
            pb.finish_with_message(format!("{} downloaded", description));
        }

        info!("Downloaded {} bytes to {}", downloaded, path.display());
        Ok(())
    }

    /// Verify file checksum
    fn verify_checksum(&self, path: &Path, expected: &str) -> Result<()> {
        use sha2::{Digest, Sha256};
        use std::io::Read;

        let mut file = std::fs::File::open(path)?;
        let mut hasher = Sha256::new();
        std::io::copy(&mut file, &mut hasher)?;
        let result = hasher.finalize();
        let actual = hex::encode(result);

        if actual != expected {
            anyhow::bail!(
                "Checksum mismatch for {}:\n  Expected: {}\n  Actual: {}",
                path.display(),
                expected,
                actual
            );
        }

        Ok(())
    }

    /// Decompress zstd file
    async fn decompress_zstd(&self, input: &Path, output: &Path) -> Result<()> {
        info!("Decompressing {} -> {}", input.display(), output.display());

        let input_path = input.to_path_buf();
        let output_path = output.to_path_buf();

        // Use sync decompression in blocking task
        tokio::task::spawn_blocking(move || {
            use std::io::{Read, Write};
            
            let input_file = std::fs::File::open(&input_path)?;
            let output_file = std::fs::File::create(&output_path)?;
            
            let mut decoder = zstd::Decoder::new(input_file)?;
            let mut output_file = output_file;
            
            let mut buffer = [0u8; 8192];
            loop {
                let n = decoder.read(&mut buffer)?;
                if n == 0 {
                    break;
                }
                output_file.write_all(&buffer[..n])?;
            }
            
            Ok::<_, anyhow::Error>(())
        }).await??;

        info!("Decompressed successfully");
        Ok(())
    }
}
