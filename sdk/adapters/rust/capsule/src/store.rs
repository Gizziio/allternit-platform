//! Capsule storage backend.

use crate::bundle::CapsuleBundle;
use crate::content_hash::ContentHash;
use crate::error::{CapsuleError, CapsuleResult};
use crate::manifest::CapsuleManifest;
use crate::signing::SignaturePolicy;

use semver::Version;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use tracing::{debug, info, warn};

/// Configuration for the capsule store.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleStoreConfig {
    /// Directory for storing capsules
    pub storage_path: PathBuf,

    /// Maximum cache size in MB
    pub max_cache_mb: u64,

    /// Whether to verify capsules on load
    pub verify_on_load: bool,

    /// Signature policy enforcement
    pub signature_policy: SignaturePolicy,
}

impl Default for CapsuleStoreConfig {
    fn default() -> Self {
        Self {
            storage_path: PathBuf::from(".a2r/capsules"),
            max_cache_mb: 1024, // 1GB
            verify_on_load: true,
            signature_policy: SignaturePolicy::default(),
        }
    }
}

/// A store for capsule bundles.
///
/// Provides content-addressed storage and retrieval of capsules.
pub struct CapsuleStore {
    config: CapsuleStoreConfig,

    /// In-memory index of available capsules
    index: Arc<RwLock<CapsuleIndex>>,

    /// Cache of loaded manifests
    manifest_cache: Arc<RwLock<HashMap<String, CapsuleManifest>>>,
}

impl CapsuleStore {
    /// Create a new capsule store.
    pub fn new(config: CapsuleStoreConfig) -> CapsuleResult<Self> {
        // Ensure storage directory exists
        std::fs::create_dir_all(&config.storage_path)?;

        let store = Self {
            config,
            index: Arc::new(RwLock::new(CapsuleIndex::default())),
            manifest_cache: Arc::new(RwLock::new(HashMap::new())),
        };

        // Scan existing capsules
        store.rebuild_index()?;

        Ok(store)
    }

    /// Add a capsule to the store.
    pub fn add(&self, bundle: CapsuleBundle) -> CapsuleResult<()> {
        // Verify if configured
        if self.config.verify_on_load {
            self.verify_bundle(&bundle)?;
        }

        let capsule_id = &bundle.manifest.id;
        let version = &bundle.manifest.version;
        let content_hash = &bundle.manifest.content_hash;

        // Check if already exists
        if self.contains_version(capsule_id, version)? {
            return Err(CapsuleError::AlreadyExists(format!(
                "{}@{}",
                capsule_id, version
            )));
        }

        // Store file by content hash
        let file_path = self.capsule_path(content_hash);
        std::fs::create_dir_all(file_path.parent().unwrap())?;
        bundle.save(&file_path)?;

        // Update index
        {
            let mut index = self
                .index
                .write()
                .map_err(|_| CapsuleError::StorageError("Index lock poisoned".into()))?;

            index.add_entry(CapsuleIndexEntry {
                id: capsule_id.clone(),
                version: version.clone(),
                content_hash: content_hash.clone(),
                file_path: file_path.clone(),
            });
        }

        // Cache manifest
        {
            let mut cache = self
                .manifest_cache
                .write()
                .map_err(|_| CapsuleError::StorageError("Cache lock poisoned".to_string()))?;

            let manifest = bundle.manifest.clone();
            cache.insert(content_hash.to_hex(), manifest);
        }

        info!("Added capsule: {}@{}", capsule_id, version);
        Ok(())
    }

    /// Get a capsule by ID and optional version.
    ///
    /// If version is None, returns the latest version.
    pub fn get(&self, capsule_id: &str, version: Option<&Version>) -> CapsuleResult<CapsuleBundle> {
        let entry = match version {
            Some(v) => self.get_entry(capsule_id, v)?,
            None => self.get_latest_entry(capsule_id)?,
        };

        let bundle = CapsuleBundle::from_file(&entry.file_path)?;

        if self.config.verify_on_load {
            self.verify_bundle(&bundle)?;
        }

        Ok(bundle)
    }

    /// Get a capsule by content hash.
    pub fn get_by_hash(&self, content_hash: &ContentHash) -> CapsuleResult<CapsuleBundle> {
        let file_path = self.capsule_path(content_hash);
        if !file_path.exists() {
            return Err(CapsuleError::CapsuleNotFound(content_hash.to_hex()));
        }

        let bundle = CapsuleBundle::from_file(&file_path)?;

        if self.config.verify_on_load {
            self.verify_bundle(&bundle)?;
        }

        Ok(bundle)
    }

    /// Get just the manifest (faster than loading full bundle).
    pub fn get_manifest(
        &self,
        capsule_id: &str,
        version: Option<&Version>,
    ) -> CapsuleResult<CapsuleManifest> {
        let entry = match version {
            Some(v) => self.get_entry(capsule_id, v)?,
            None => self.get_latest_entry(capsule_id)?,
        };

        // Check cache first
        if let Ok(cache) = self.manifest_cache.read() {
            if let Some(manifest) = cache.get(&entry.content_hash.to_hex()) {
                return Ok(manifest.clone());
            }
        }

        // Load from disk
        let bundle = CapsuleBundle::from_file(&entry.file_path)?;
        let manifest = bundle.manifest.clone();

        // Update cache
        if let Ok(mut cache) = self.manifest_cache.write() {
            cache.insert(entry.content_hash.to_hex(), manifest.clone());
        }

        Ok(manifest)
    }

    fn verify_bundle(&self, bundle: &CapsuleBundle) -> CapsuleResult<()> {
        bundle.verify()?;
        self.config
            .signature_policy
            .check(&bundle.manifest.signature)?;
        Ok(())
    }

    /// List all capsule IDs.
    pub fn list_ids(&self) -> CapsuleResult<Vec<String>> {
        let index = self
            .index
            .read()
            .map_err(|_| CapsuleError::StorageError("Index lock poisoned".into()))?;

        Ok(index.capsules.keys().cloned().collect())
    }

    /// List all versions of a capsule.
    pub fn list_versions(&self, capsule_id: &str) -> CapsuleResult<Vec<Version>> {
        let index = self
            .index
            .read()
            .map_err(|_| CapsuleError::StorageError("Index lock poisoned".into()))?;

        let entries = index
            .capsules
            .get(capsule_id)
            .ok_or_else(|| CapsuleError::CapsuleNotFound(capsule_id.into()))?;

        let mut versions: Vec<_> = entries.iter().map(|e| e.version.clone()).collect();
        versions.sort();
        Ok(versions)
    }

    /// Check if a specific version exists.
    pub fn contains_version(&self, capsule_id: &str, version: &Version) -> CapsuleResult<bool> {
        let index = self
            .index
            .read()
            .map_err(|_| CapsuleError::StorageError("Index lock poisoned".into()))?;

        Ok(index
            .capsules
            .get(capsule_id)
            .map(|entries| entries.iter().any(|e| &e.version == version))
            .unwrap_or(false))
    }

    /// Remove a capsule version.
    pub fn remove(&self, capsule_id: &str, version: &Version) -> CapsuleResult<()> {
        let entry = self.get_entry(capsule_id, version)?;

        // Remove file
        std::fs::remove_file(&entry.file_path)?;

        // Update index
        {
            let mut index = self
                .index
                .write()
                .map_err(|_| CapsuleError::StorageError("Index lock poisoned".into()))?;

            if let Some(entries) = index.capsules.get_mut(capsule_id) {
                entries.retain(|e| &e.version != version);
                if entries.is_empty() {
                    index.capsules.remove(capsule_id);
                }
            }
        }

        // Clear from cache
        {
            if let Ok(mut cache) = self.manifest_cache.write() {
                cache.remove(&entry.content_hash.to_hex());
            }
        }

        info!("Removed capsule: {}@{}", capsule_id, version);
        Ok(())
    }

    /// Rebuild the index from disk.
    fn rebuild_index(&self) -> CapsuleResult<()> {
        let mut index = self
            .index
            .write()
            .map_err(|_| CapsuleError::StorageError("Index lock poisoned".into()))?;

        index.capsules.clear();

        // Scan storage directory
        for entry in walkdir::WalkDir::new(&self.config.storage_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map(|ext| ext == "allternit")
                    .unwrap_or(false)
            })
        {
            match CapsuleBundle::from_file(entry.path()) {
                Ok(bundle) => {
                    index.add_entry(CapsuleIndexEntry {
                        id: bundle.manifest.id.clone(),
                        version: bundle.manifest.version.clone(),
                        content_hash: bundle.manifest.content_hash.clone(),
                        file_path: entry.path().to_path_buf(),
                    });
                    debug!("Indexed capsule: {}", bundle.manifest.full_id());
                }
                Err(e) => {
                    warn!("Failed to index capsule at {:?}: {}", entry.path(), e);
                }
            }
        }

        info!(
            "Indexed {} capsules ({} unique)",
            index.total_versions(),
            index.capsules.len()
        );

        Ok(())
    }

    /// Get the file path for a content hash.
    fn capsule_path(&self, hash: &ContentHash) -> PathBuf {
        let hex = hash.to_hex();
        self.config
            .storage_path
            .join(&hex[..2])
            .join(format!("{}.a2r", hex))
    }

    /// Get an index entry for a specific version.
    fn get_entry(&self, capsule_id: &str, version: &Version) -> CapsuleResult<CapsuleIndexEntry> {
        let index = self
            .index
            .read()
            .map_err(|_| CapsuleError::StorageError("Index lock poisoned".into()))?;

        let entries = index
            .capsules
            .get(capsule_id)
            .ok_or_else(|| CapsuleError::CapsuleNotFound(capsule_id.into()))?;

        entries
            .iter()
            .find(|e| &e.version == version)
            .cloned()
            .ok_or_else(|| CapsuleError::CapsuleNotFound(format!("{}@{}", capsule_id, version)))
    }

    /// Get the latest version entry.
    fn get_latest_entry(&self, capsule_id: &str) -> CapsuleResult<CapsuleIndexEntry> {
        let index = self
            .index
            .read()
            .map_err(|_| CapsuleError::StorageError("Index lock poisoned".into()))?;

        let entries = index
            .capsules
            .get(capsule_id)
            .ok_or_else(|| CapsuleError::CapsuleNotFound(capsule_id.into()))?;

        entries
            .iter()
            .max_by(|a, b| a.version.cmp(&b.version))
            .cloned()
            .ok_or_else(|| CapsuleError::CapsuleNotFound(capsule_id.into()))
    }
}

/// Index of available capsules.
#[derive(Default)]
struct CapsuleIndex {
    /// Map from capsule ID to list of versions
    capsules: HashMap<String, Vec<CapsuleIndexEntry>>,
}

impl CapsuleIndex {
    fn add_entry(&mut self, entry: CapsuleIndexEntry) {
        self.capsules
            .entry(entry.id.clone())
            .or_default()
            .push(entry);
    }

    fn total_versions(&self) -> usize {
        self.capsules.values().map(|v| v.len()).sum()
    }
}

/// An entry in the capsule index.
#[derive(Clone)]
struct CapsuleIndexEntry {
    id: String,
    version: Version,
    content_hash: ContentHash,
    file_path: PathBuf,
}

// Add walkdir as a dependency
mod walkdir {
    use std::fs;
    use std::path::{Path, PathBuf};

    pub struct WalkDir {
        root: PathBuf,
    }

    impl WalkDir {
        pub fn new(root: impl AsRef<Path>) -> Self {
            Self {
                root: root.as_ref().to_path_buf(),
            }
        }
    }

    impl IntoIterator for WalkDir {
        type Item = Result<DirEntry, std::io::Error>;
        type IntoIter = WalkDirIter;

        fn into_iter(self) -> Self::IntoIter {
            let stack = vec![self.root];
            WalkDirIter { stack }
        }
    }

    pub struct WalkDirIter {
        stack: Vec<PathBuf>,
    }

    impl Iterator for WalkDirIter {
        type Item = Result<DirEntry, std::io::Error>;

        fn next(&mut self) -> Option<Self::Item> {
            while let Some(path) = self.stack.pop() {
                if path.is_dir() {
                    match fs::read_dir(&path) {
                        Ok(entries) => {
                            for e in entries.flatten() {
                                self.stack.push(e.path());
                            }
                        }
                        Err(e) => return Some(Err(e)),
                    }
                } else {
                    return Some(Ok(DirEntry { path }));
                }
            }
            None
        }
    }

    pub struct DirEntry {
        path: PathBuf,
    }

    impl DirEntry {
        pub fn path(&self) -> &Path {
            &self.path
        }
    }
}
