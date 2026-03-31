//! Capsule bundle creation and extraction.

use crate::content_hash::ContentHash;
use crate::error::{CapsuleError, CapsuleResult};
use crate::manifest::CapsuleManifest;
use crate::signing::SigningKey;

use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use std::io::Read;
use std::path::Path;
use tar::{Archive, Builder};
use tracing::{debug, info};

/// A capsule bundle ready for distribution.
pub struct CapsuleBundle {
    /// The manifest
    pub manifest: CapsuleManifest,

    /// Raw bundle bytes
    pub bytes: Vec<u8>,
}

impl CapsuleBundle {
    fn compute_content_hash(&self) -> CapsuleResult<ContentHash> {
        let decoder = GzDecoder::new(&self.bytes[..]);
        let mut archive = Archive::new(decoder);
        let mut archive_bytes = Vec::new();

        {
            let encoder = GzEncoder::new(&mut archive_bytes, Compression::default());
            let mut builder = Builder::new(encoder);

            for entry in archive.entries()? {
                let mut entry = entry?;
                let path_str = entry.path()?.to_string_lossy().into_owned();

                if path_str == "manifest.json" || path_str == "tool-abi.json" {
                    continue;
                }

                let mut content = Vec::new();
                entry.read_to_end(&mut content)?;

                let mut header = tar::Header::new_gnu();
                header.set_size(content.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                builder.append_data(&mut header, path_str.as_str(), &content[..])?;
            }

            builder.finish()?;
        }

        Ok(ContentHash::hash(&archive_bytes))
    }

    /// Load a bundle from a file.
    pub fn from_file(path: impl AsRef<Path>) -> CapsuleResult<Self> {
        let bytes = std::fs::read(path.as_ref())?;
        Self::from_bytes(bytes)
    }

    /// Load a bundle from bytes.
    pub fn from_bytes(bytes: Vec<u8>) -> CapsuleResult<Self> {
        // Decompress
        let decoder = GzDecoder::new(&bytes[..]);
        let mut archive = Archive::new(decoder);

        // Find and parse manifest
        let mut manifest: Option<CapsuleManifest> = None;

        for entry in archive.entries()? {
            let mut entry = entry?;
            let path = entry.path()?;

            if path.to_string_lossy() == "manifest.json" {
                let mut content = String::new();
                entry.read_to_string(&mut content)?;
                manifest = Some(serde_json::from_str(&content)?);
                break;
            }
        }

        let manifest = manifest.ok_or_else(|| CapsuleError::MissingFile("manifest.json".into()))?;

        Ok(Self { manifest, bytes })
    }

    /// Verify the bundle's integrity and signature.
    pub fn verify(&self) -> CapsuleResult<()> {
        // Compute content hash
        let actual_hash = self.compute_content_hash()?;

        // Compare with manifest
        if actual_hash != self.manifest.content_hash {
            return Err(CapsuleError::ContentHashMismatch {
                expected: self.manifest.content_hash.to_hex(),
                actual: actual_hash.to_hex(),
            });
        }

        // Verify signature
        self.manifest
            .signature
            .verify(&self.manifest.content_hash)?;

        info!("Capsule {} verified successfully", self.manifest.full_id());

        Ok(())
    }

    /// Extract the WASM component bytes.
    pub fn extract_wasm(&self) -> CapsuleResult<Vec<u8>> {
        let decoder = GzDecoder::new(&self.bytes[..]);
        let mut archive = Archive::new(decoder);

        let wasm_path = &self.manifest.wasm_component.path;

        for entry in archive.entries()? {
            let mut entry = entry?;
            let path = entry.path()?;

            if path.to_string_lossy() == *wasm_path {
                let mut wasm_bytes = Vec::new();
                entry.read_to_end(&mut wasm_bytes)?;

                // Verify WASM hash
                let actual_hash = ContentHash::hash(&wasm_bytes);
                if actual_hash != self.manifest.wasm_component.hash {
                    return Err(CapsuleError::ContentHashMismatch {
                        expected: self.manifest.wasm_component.hash.to_hex(),
                        actual: actual_hash.to_hex(),
                    });
                }

                return Ok(wasm_bytes);
            }
        }

        Err(CapsuleError::MissingFile(wasm_path.clone()))
    }

    /// Save to a file.
    pub fn save(&self, path: impl AsRef<Path>) -> CapsuleResult<()> {
        std::fs::write(path, &self.bytes)?;
        Ok(())
    }

    /// Get the bundle size in bytes.
    pub fn size(&self) -> usize {
        self.bytes.len()
    }
}

/// Builder for creating capsule bundles.
pub struct CapsuleBundler {
    /// WASM component path
    wasm_path: Option<std::path::PathBuf>,

    /// Additional files to include
    files: Vec<(String, Vec<u8>)>,

    /// Partial manifest (needs signature and hash)
    manifest_builder: Option<ManifestBuilder>,
}

impl CapsuleBundler {
    /// Create a new bundler.
    pub fn new() -> Self {
        Self {
            wasm_path: None,
            files: Vec::new(),
            manifest_builder: None,
        }
    }

    /// Set the WASM component.
    pub fn wasm_component(mut self, path: impl AsRef<Path>) -> Self {
        self.wasm_path = Some(path.as_ref().to_path_buf());
        self
    }

    /// Add an additional file.
    pub fn add_file(mut self, archive_path: impl Into<String>, content: Vec<u8>) -> Self {
        self.files.push((archive_path.into(), content));
        self
    }

    /// Set the manifest builder.
    pub fn manifest(mut self, builder: ManifestBuilder) -> Self {
        self.manifest_builder = Some(builder);
        self
    }

    /// Build the bundle.
    pub fn build(self, signing_key: &SigningKey) -> CapsuleResult<CapsuleBundle> {
        let wasm_path = self.wasm_path.ok_or_else(|| {
            CapsuleError::BundleCreationFailed("WASM component path required".into())
        })?;

        let manifest_builder = self.manifest_builder.ok_or_else(|| {
            CapsuleError::BundleCreationFailed("Manifest builder required".into())
        })?;

        // Read WASM bytes
        let wasm_bytes = std::fs::read(&wasm_path)?;
        let wasm_hash = ContentHash::hash(&wasm_bytes);

        debug!(
            "WASM component: {} bytes, hash: {}",
            wasm_bytes.len(),
            wasm_hash.short()
        );

        // Build manifest (without final signature and content hash)
        let mut manifest =
            manifest_builder.build_partial(wasm_hash.clone(), wasm_bytes.len() as u64)?;

        // Create archive in memory (without manifest first, to compute hash)
        let mut archive_bytes = Vec::new();
        {
            let encoder = GzEncoder::new(&mut archive_bytes, Compression::default());
            let mut builder = Builder::new(encoder);

            // Add WASM component
            let mut header = tar::Header::new_gnu();
            header.set_size(wasm_bytes.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            builder.append_data(&mut header, "component.wasm", &wasm_bytes[..])?;

            // Add additional files
            for (path, content) in &self.files {
                let mut header = tar::Header::new_gnu();
                header.set_size(content.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                builder.append_data(&mut header, path, &content[..])?;
            }

            builder.finish()?;
        }

        // Compute content hash (of archive without manifest)
        let content_hash = ContentHash::hash(&archive_bytes);
        manifest.content_hash = content_hash.clone();

        // Sign the content hash
        manifest.signature = signing_key.sign_capsule(&content_hash);

        // Now rebuild archive with manifest included
        let mut final_bytes = Vec::new();
        {
            let encoder = GzEncoder::new(&mut final_bytes, Compression::default());
            let mut builder = Builder::new(encoder);

            // Add manifest first
            let manifest_json = serde_json::to_vec_pretty(&manifest)?;
            let mut header = tar::Header::new_gnu();
            header.set_size(manifest_json.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            builder.append_data(&mut header, "manifest.json", &manifest_json[..])?;

            // Add WASM component
            let mut header = tar::Header::new_gnu();
            header.set_size(wasm_bytes.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            builder.append_data(&mut header, "component.wasm", &wasm_bytes[..])?;

            // Add tool-abi.json
            let tool_abi_json = serde_json::to_vec_pretty(&manifest.tool_abi)?;
            let mut header = tar::Header::new_gnu();
            header.set_size(tool_abi_json.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            builder.append_data(&mut header, "tool-abi.json", &tool_abi_json[..])?;

            // Add additional files
            for (path, content) in &self.files {
                let mut header = tar::Header::new_gnu();
                header.set_size(content.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                builder.append_data(&mut header, path, &content[..])?;
            }

            builder.finish()?;
        }

        info!(
            "Created capsule bundle: {} ({} bytes)",
            manifest.full_id(),
            final_bytes.len()
        );

        Ok(CapsuleBundle {
            manifest,
            bytes: final_bytes,
        })
    }
}

impl Default for CapsuleBundler {
    fn default() -> Self {
        Self::new()
    }
}

/// Builder for capsule manifests.
pub struct ManifestBuilder {
    id: String,
    version: semver::Version,
    name: String,
    description: String,
    tool_abi: crate::manifest::ToolABISpec,
    capabilities: crate::manifest::Capabilities,
    homepage: Option<String>,
    license: Option<String>,
    keywords: Vec<String>,
}

impl ManifestBuilder {
    /// Create a new manifest builder.
    pub fn new(
        id: impl Into<String>,
        version: semver::Version,
        name: impl Into<String>,
        description: impl Into<String>,
        tool_abi: crate::manifest::ToolABISpec,
    ) -> Self {
        Self {
            id: id.into(),
            version,
            name: name.into(),
            description: description.into(),
            tool_abi,
            capabilities: crate::manifest::Capabilities::default(),
            homepage: None,
            license: None,
            keywords: Vec::new(),
        }
    }

    /// Set capabilities.
    pub fn capabilities(mut self, capabilities: crate::manifest::Capabilities) -> Self {
        self.capabilities = capabilities;
        self
    }

    /// Set homepage.
    pub fn homepage(mut self, url: impl Into<String>) -> Self {
        self.homepage = Some(url.into());
        self
    }

    /// Set license.
    pub fn license(mut self, license: impl Into<String>) -> Self {
        self.license = Some(license.into());
        self
    }

    /// Add keywords.
    pub fn keywords(mut self, keywords: Vec<String>) -> Self {
        self.keywords = keywords;
        self
    }

    /// Build partial manifest (needs wasm hash and size).
    fn build_partial(
        self,
        wasm_hash: ContentHash,
        wasm_size: u64,
    ) -> CapsuleResult<CapsuleManifest> {
        use crate::manifest::WasmComponent;
        use crate::signing::CapsuleSignature;

        Ok(CapsuleManifest {
            id: self.id,
            version: self.version,
            name: self.name,
            description: self.description,
            tool_abi: self.tool_abi,
            wasm_component: WasmComponent {
                path: "component.wasm".into(),
                hash: wasm_hash,
                size_bytes: wasm_size,
                wit_world: "tool-component".into(),
                min_runtime_version: None,
            },
            capabilities: self.capabilities,
            signature: CapsuleSignature::placeholder(), // Will be replaced
            content_hash: ContentHash::hash(b"placeholder"), // Will be replaced
            created_at: chrono::Utc::now(),
            homepage: self.homepage,
            license: self.license,
            keywords: self.keywords,
        })
    }
}
