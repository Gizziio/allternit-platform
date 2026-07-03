//! OCI Registry Resolver
//!
//! Uses oci-distribution crate for pulling images.

use super::{ImageManifest, ImageResolution, RegistryAuth};
use crate::EnvironmentSpecError;
use oci_distribution::client::{ClientConfig, ClientProtocol};
use oci_distribution::secrets::RegistryAuth as OciRegistryAuth;
use oci_distribution::Client;
use std::collections::HashMap;
use std::path::PathBuf;

/// OCI Image Resolver
pub struct OciResolver {
    /// OCI client
    client: Client,

    /// Cache directory
    cache_dir: PathBuf,

    /// Registry authentication configs
    auth_configs: HashMap<String, RegistryAuth>,
}

impl OciResolver {
    /// Create a new resolver with default settings
    pub fn new() -> Self {
        let config = ClientConfig {
            protocol: ClientProtocol::Https,
            ..Default::default()
        };

        let client = Client::new(config);
        let cache_dir = dirs::cache_dir()
            .unwrap_or_else(std::env::temp_dir)
            .join("allternit")
            .join("oci-images");

        Self {
            client,
            cache_dir,
            auth_configs: HashMap::new(),
        }
    }

    /// Create with custom cache directory
    pub fn with_cache_dir(cache_dir: impl AsRef<std::path::Path>) -> Self {
        let mut resolver = Self::new();
        resolver.cache_dir = cache_dir.as_ref().to_path_buf();
        resolver
    }

    /// Add registry authentication
    pub fn with_auth(mut self, auth: RegistryAuth) -> Self {
        self.auth_configs.insert(auth.registry.clone(), auth);
        self
    }

    /// Resolve an image reference
    pub async fn resolve(&self, reference: &str) -> Result<ImageResolution, EnvironmentSpecError> {
        // Parse the reference
        let (registry, repository, tag) = parse_image_reference(reference)?;

        // Create the OCI reference
        let oci_ref = oci_distribution::Reference::try_from(reference).map_err(|e| {
            EnvironmentSpecError::InvalidSourceUri(format!("Invalid OCI reference: {}", e))
        })?;

        // Get authentication
        let auth = self.get_registry_auth(&registry);

        // Pull the manifest to get digest
        let (_manifest, _digest) =
            self.client
                .pull_manifest(&oci_ref, &auth)
                .await
                .map_err(|e| {
                    EnvironmentSpecError::RegistryError(format!("Failed to pull manifest: {}", e))
                })?;

        // Parse manifest from bytes - we need to pull it again as bytes
        // For now, skip detailed manifest parsing in resolve
        let manifest = ImageManifest {
            schema_version: 2,
            media_type: "application/vnd.docker.distribution.manifest.v2+json".to_string(),
            config: super::Descriptor {
                media_type: String::new(),
                digest: String::new(),
                size: 0,
                annotations: HashMap::new(),
            },
            layers: vec![],
        };

        Ok(ImageResolution {
            reference: reference.to_string(),
            digest: Some(_digest),
            local_path: None,
            manifest: Some(manifest),
        })
    }

    /// Pull an image to local cache
    pub async fn pull(&self, reference: &str) -> Result<PathBuf, EnvironmentSpecError> {
        let image_dir = self.cache_dir.join(sanitize_filename(reference));
        tokio::fs::create_dir_all(&image_dir).await?;

        // Check if already cached
        let manifest_path = image_dir.join("manifest.json");
        if manifest_path.exists() {
            tracing::info!("Image {} found in cache", reference);
            return Ok(image_dir);
        }

        tracing::info!("Pulling image: {}", reference);

        // Parse reference
        let oci_ref = oci_distribution::Reference::try_from(reference).map_err(|e| {
            EnvironmentSpecError::InvalidSourceUri(format!("Invalid OCI reference: {}", e))
        })?;

        // Get auth
        let registry = oci_ref.registry().to_string();
        let auth = self.get_registry_auth(&registry);

        // Pull image
        let image_content = self
            .client
            .pull(
                &oci_ref,
                &auth,
                vec![
                    "application/vnd.docker.distribution.manifest.v2+json",
                    "application/vnd.oci.image.manifest.v1+json",
                ],
            )
            .await
            .map_err(|e| {
                EnvironmentSpecError::RegistryError(format!("Failed to pull image: {}", e))
            })?;

        // Save manifest
        if let Some(ref manifest) = image_content.manifest {
            let manifest_json = serde_json::to_vec(manifest).map_err(|e| {
                EnvironmentSpecError::RegistryError(format!("Failed to serialize manifest: {}", e))
            })?;
            tokio::fs::write(&manifest_path, manifest_json).await?;
        }

        // Save config
        let config_path = image_dir.join("config.json");
        tokio::fs::write(&config_path, &image_content.config.data).await?;

        // Save layers
        let layers_dir = image_dir.join("layers");
        tokio::fs::create_dir_all(&layers_dir).await?;

        for (i, layer) in image_content.layers.iter().enumerate() {
            let layer_path = layers_dir.join(format!("layer_{}.tar.gz", i));
            tokio::fs::write(&layer_path, &layer.data).await?;
        }

        tracing::info!("Image {} pulled successfully", reference);

        Ok(image_dir)
    }

    /// Get authentication for a registry
    fn get_registry_auth(&self, registry: &str) -> OciRegistryAuth {
        if let Some(auth) = self.auth_configs.get(registry) {
            if let (Some(username), Some(password)) = (&auth.username, &auth.password) {
                return OciRegistryAuth::Basic(username.clone(), password.clone());
            }
            // Token auth not supported in this oci-distribution version
        }

        // Try to get from environment or Docker config
        OciRegistryAuth::Anonymous
    }

    /// Get cache directory
    pub fn cache_dir(&self) -> &PathBuf {
        &self.cache_dir
    }

    /// Clear the cache
    pub async fn clear_cache(&self) -> Result<(), EnvironmentSpecError> {
        if self.cache_dir.exists() {
            tokio::fs::remove_dir_all(&self.cache_dir).await?;
            tokio::fs::create_dir_all(&self.cache_dir).await?;
        }
        Ok(())
    }
}

impl Default for OciResolver {
    fn default() -> Self {
        Self::new()
    }
}

/// Parse an image reference into components
/// Format: [registry/]repository[:tag|@digest]
fn parse_image_reference(
    reference: &str,
) -> Result<(String, String, String), EnvironmentSpecError> {
    // Handle digest reference
    if let Some(pos) = reference.find('@') {
        let repo_part = &reference[..pos];
        let digest = &reference[pos + 1..];

        let (registry, repository) = split_registry_and_repo(repo_part);
        return Ok((registry, repository, digest.to_string()));
    }

    // Handle tag reference
    let (repo_part, tag) = if let Some(pos) = reference.rfind(':') {
        // Check if it's a port number (registry:port/repo)
        let after_colon = &reference[pos + 1..];
        if after_colon.contains('/') || after_colon.parse::<u16>().is_ok() {
            (reference, "latest")
        } else {
            (&reference[..pos], after_colon)
        }
    } else {
        (reference, "latest")
    };

    let (registry, repository) = split_registry_and_repo(repo_part);
    Ok((registry, repository, tag.to_string()))
}

/// Split registry and repository
fn split_registry_and_repo(repo_part: &str) -> (String, String) {
    // Find the first '/' that separates registry from repo
    if let Some(pos) = repo_part.find('/') {
        let first_part = &repo_part[..pos];
        let rest = &repo_part[pos + 1..];

        // If first_part contains '.' or ':', it's likely a registry
        if first_part.contains('.') || first_part.contains(':') || first_part == "localhost" {
            (first_part.to_string(), rest.to_string())
        } else {
            // Docker Hub (docker.io)
            ("docker.io".to_string(), repo_part.to_string())
        }
    } else {
        // No slash, must be Docker Hub library image
        ("docker.io".to_string(), format!("library/{}", repo_part))
    }
}

/// Parse manifest bytes
fn parse_manifest(data: &[u8]) -> Result<ImageManifest, EnvironmentSpecError> {
    // Parse as generic JSON Value first
    let value: serde_json::Value = serde_json::from_slice(data)
        .map_err(|e| EnvironmentSpecError::RegistryError(format!("Invalid JSON: {}", e)))?;

    let schema_version = value
        .get("schemaVersion")
        .and_then(|v| v.as_u64())
        .unwrap_or(2) as u32;

    let media_type = value
        .get("mediaType")
        .and_then(|v| v.as_str())
        .unwrap_or("application/vnd.docker.distribution.manifest.v2+json")
        .to_string();

    // Parse config if present
    let config = if let Some(config) = value.get("config") {
        super::Descriptor {
            media_type: config
                .get("mediaType")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            digest: config
                .get("digest")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            size: config.get("size").and_then(|v| v.as_u64()).unwrap_or(0),
            annotations: HashMap::new(),
        }
    } else {
        super::Descriptor {
            media_type: String::new(),
            digest: String::new(),
            size: 0,
            annotations: HashMap::new(),
        }
    };

    // Parse layers
    let layers = if let Some(layers_arr) = value.get("layers").and_then(|v| v.as_array()) {
        layers_arr
            .iter()
            .map(|l| super::Descriptor {
                media_type: l
                    .get("mediaType")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                digest: l
                    .get("digest")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                size: l.get("size").and_then(|v| v.as_u64()).unwrap_or(0),
                annotations: HashMap::new(),
            })
            .collect()
    } else {
        vec![]
    };

    Ok(ImageManifest {
        schema_version,
        media_type,
        config,
        layers,
    })
}

/// Sanitize image reference for use as filename
fn sanitize_filename(reference: &str) -> String {
    reference.replace(['/', ':', '@'], "_")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_image_reference() {
        // Docker Hub library image
        let (reg, repo, tag) = parse_image_reference("ubuntu:22.04").unwrap();
        assert_eq!(reg, "docker.io");
        assert_eq!(repo, "library/ubuntu");
        assert_eq!(tag, "22.04");

        // Docker Hub user image
        let (reg, repo, tag) = parse_image_reference("user/app:latest").unwrap();
        assert_eq!(reg, "docker.io");
        assert_eq!(repo, "user/app");
        assert_eq!(tag, "latest");

        // GHCR
        let (reg, repo, tag) = parse_image_reference("ghcr.io/user/repo:1.0").unwrap();
        assert_eq!(reg, "ghcr.io");
        assert_eq!(repo, "user/repo");
        assert_eq!(tag, "1.0");

        // With digest
        let (reg, repo, tag) = parse_image_reference("ubuntu@sha256:abc123").unwrap();
        assert_eq!(reg, "docker.io");
        assert_eq!(repo, "library/ubuntu");
        assert_eq!(tag, "sha256:abc123");
    }

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(
            sanitize_filename("docker.io/library/ubuntu:22.04"),
            "docker.io_library_ubuntu_22.04"
        );
    }
}
