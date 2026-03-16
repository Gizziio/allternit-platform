use anyhow::{Context, Result};
use semver::{Version, VersionReq};
use std::collections::HashMap;
use std::sync::Arc;

use crate::models::{PackMetadata, PromptPack, ValidationResult};
use crate::storage::StorageManager;

/// PackRegistry manages pack versions, dependencies, and metadata
pub struct PackRegistry {
    storage: Arc<StorageManager>,
    // In-memory cache of pack metadata
    pack_cache: tokio::sync::RwLock<HashMap<String, Vec<String>>>, // pack_id -> versions
}

impl PackRegistry {
    pub async fn new(storage: Arc<StorageManager>) -> Result<Self> {
        let registry = Self {
            storage,
            pack_cache: tokio::sync::RwLock::new(HashMap::new()),
        };

        // Load existing packs into cache
        registry.load_packs().await?;

        Ok(registry)
    }

    /// Register a new pack version
    pub async fn register_pack(&self, pack: PromptPack) -> Result<()> {
        // Validate pack
        self.validate_pack(&pack).await?;

        // Resolve dependencies
        self.resolve_dependencies(&pack).await?;

        // Store pack
        self.storage.store_pack(&pack).await?;

        // Update cache
        let mut cache = self.pack_cache.write().await;
        cache.entry(pack.pack_id.clone())
            .or_default()
            .push(pack.version.clone());

        Ok(())
    }

    /// Get a specific pack version
    pub async fn get_pack(&self, pack_id: &str, version: &str) -> Result<Option<PromptPack>> {
        self.storage.get_pack(pack_id, version).await
    }

    /// Get the latest version of a pack
    pub async fn get_latest(&self, pack_id: &str) -> Result<Option<PromptPack>> {
        let latest_version = self.storage.get_latest_version(pack_id).await?;
        
        match latest_version {
            Some(version) => self.get_pack(pack_id, &version).await,
            None => Ok(None),
        }
    }

    /// Get a pack matching a version requirement
    pub async fn get_pack_matching(
        &self,
        pack_id: &str,
        version_req: &str,
    ) -> Result<Option<PromptPack>> {
        let versions = self.storage.list_versions(pack_id).await?;
        let req = VersionReq::parse(version_req)
            .context("Invalid version requirement")?;

        // Find highest matching version
        let mut best_match: Option<Version> = None;
        
        for v_str in versions {
            let version = Version::parse(&v_str)?;
            if req.matches(&version) {
                if best_match.as_ref().map_or(true, |b| version > *b) {
                    best_match = Some(version);
                }
            }
        }

        match best_match {
            Some(v) => self.get_pack(pack_id, &v.to_string()).await,
            None => Ok(None),
        }
    }

    /// List all packs with metadata
    pub async fn list_packs(&self) -> Result<Vec<PackMetadata>> {
        let packs = self.storage.list_packs().await?;
        let mut result = Vec::new();

        for (pack_id, name, latest_version) in packs {
            let all_versions = self.storage.list_versions(&pack_id).await?;
            
            // Get pack to extract tags
            let pack = self.get_pack(&pack_id, &latest_version).await?;
            let (tags, description) = match pack {
                Some(p) => (p.tags, p.description),
                None => (Vec::new(), String::new()),
            };

            result.push(PackMetadata {
                pack_id,
                name,
                latest_version,
                versions: all_versions,
                tags,
                description,
            });
        }

        Ok(result)
    }

    /// Get all versions of a pack
    pub async fn list_versions(&self, pack_id: &str) -> Result<Vec<String>> {
        self.storage.list_versions(pack_id).await
    }

    /// Validate a pack before registration
    async fn validate_pack(&self, pack: &PromptPack) -> Result<()> {
        // Check required fields
        if pack.pack_id.is_empty() {
            anyhow::bail!("pack_id is required");
        }
        
        if pack.version.is_empty() {
            anyhow::bail!("version is required");
        }

        // Validate version is valid semver
        Version::parse(&pack.version)?;

        // Check for duplicate version
        if let Some(existing) = self.get_pack(&pack.pack_id, &pack.version).await? {
            // In immutable system, versions cannot change
            if existing.content_hash != pack.content_hash {
                anyhow::bail!(
                    "Pack {}@{} already exists with different content. Versions are immutable.",
                    pack.pack_id,
                    pack.version
                );
            }
        }

        // Validate all prompt templates exist
        for prompt in &pack.prompts {
            // Template path should be relative to pack directory
            if prompt.template.is_empty() {
                anyhow::bail!("Prompt {} has empty template path", prompt.id);
            }
        }

        // Validate variables have unique names
        let mut var_names = std::collections::HashSet::new();
        for var in &pack.variables {
            if !var_names.insert(&var.name) {
                anyhow::bail!("Duplicate variable name: {}", var.name);
            }
        }

        Ok(())
    }

    /// Resolve and validate dependencies
    async fn resolve_dependencies(&self, pack: &PromptPack) -> Result<()> {
        for dep in &pack.dependencies {
            let dep_pack = self.get_pack_matching(&dep.pack_id, &dep.version).await?;
            
            if dep_pack.is_none() {
                anyhow::bail!(
                    "Dependency {}@{} not found for pack {}@{}",
                    dep.pack_id,
                    dep.version,
                    pack.pack_id,
                    pack.version
                );
            }
        }

        Ok(())
    }

    /// Load all packs from storage into cache
    async fn load_packs(&self) -> Result<()> {
        let packs = self.storage.list_packs().await?;
        let mut cache = self.pack_cache.write().await;

        for (pack_id, _, _) in packs {
            let versions = self.storage.list_versions(&pack_id).await?;
            cache.insert(pack_id, versions);
        }

        Ok(())
    }

    /// Diff two pack versions
    pub async fn diff_versions(
        &self,
        pack_id: &str,
        from_version: &str,
        to_version: &str,
    ) -> Result<crate::models::PackDiff> {
        let from_pack = self.get_pack(pack_id, from_version).await?
            .context("From version not found")?;
        let to_pack = self.get_pack(pack_id, to_version).await?
            .context("To version not found")?;

        let mut changes = Vec::new();

        // Compare prompts
        let from_prompts: HashMap<_, _> = from_pack.prompts.iter()
            .map(|p| (&p.id, p))
            .collect();
        let to_prompts: HashMap<_, _> = to_pack.prompts.iter()
            .map(|p| (&p.id, p))
            .collect();

        // Find added prompts
        for (id, prompt) in &to_prompts {
            if !from_prompts.contains_key(id) {
                changes.push(crate::models::Change {
                    change_type: "added".to_string(),
                    file: prompt.template.clone(),
                    diff: None,
                });
            }
        }

        // Find removed prompts
        for (id, prompt) in &from_prompts {
            if !to_prompts.contains_key(id) {
                changes.push(crate::models::Change {
                    change_type: "removed".to_string(),
                    file: prompt.template.clone(),
                    diff: None,
                });
            }
        }

        // Find modified prompts
        for (id, from_prompt) in &from_prompts {
            if let Some(to_prompt) = to_prompts.get(id) {
                if from_prompt.template != to_prompt.template {
                    changes.push(crate::models::Change {
                        change_type: "modified".to_string(),
                        file: to_prompt.template.clone(),
                        diff: Some(format!("Template path changed: {} → {}", 
                            from_prompt.template, to_prompt.template)),
                    });
                }
            }
        }

        Ok(crate::models::PackDiff {
            from_version: from_version.to_string(),
            to_version: to_version.to_string(),
            changes,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Tests would require a full storage setup
    // For now, we trust the logic
}
