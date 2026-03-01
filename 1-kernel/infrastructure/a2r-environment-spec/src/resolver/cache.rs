//! Image Cache Manager
//!
//! Manages local caching of OCI images with LRU eviction.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Cache entry metadata
#[derive(Debug, Clone)]
struct CacheEntry {
    /// Path to cached image
    path: PathBuf,

    /// Last access time
    last_accessed: SystemTime,

    /// Size in bytes
    size: u64,
}

/// Image cache with LRU eviction
pub struct ImageCache {
    /// Cache directory
    cache_dir: PathBuf,

    /// Maximum cache size in bytes (default: 10GB)
    max_size: u64,

    /// Current cache size
    current_size: u64,

    /// Cache entries
    entries: HashMap<String, CacheEntry>,
}

impl ImageCache {
    /// Create a new image cache
    pub fn new(cache_dir: impl AsRef<Path>) -> Result<Self, std::io::Error> {
        let cache_dir = cache_dir.as_ref().to_path_buf();
        std::fs::create_dir_all(&cache_dir)?;

        let mut cache = Self {
            cache_dir,
            max_size: 10 * 1024 * 1024 * 1024, // 10GB
            current_size: 0,
            entries: HashMap::new(),
        };

        // Load existing entries
        cache.load_existing()?;

        Ok(cache)
    }

    /// Set maximum cache size
    pub fn with_max_size(mut self, max_size: u64) -> Self {
        self.max_size = max_size;
        self
    }

    /// Load existing cache entries
    fn load_existing(&mut self) -> Result<(), std::io::Error> {
        let entries = std::fs::read_dir(&self.cache_dir)?;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                let metadata = entry.metadata()?;
                let size = Self::dir_size(&path)?;

                let cache_entry = CacheEntry {
                    path: path.clone(),
                    last_accessed: metadata.accessed().unwrap_or(SystemTime::now()),
                    size,
                };

                let key = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                self.entries.insert(key, cache_entry);
                self.current_size += size;
            }
        }

        Ok(())
    }

    /// Calculate directory size
    fn dir_size(path: &Path) -> Result<u64, std::io::Error> {
        let mut size = 0;

        for entry in walkdir::WalkDir::new(path) {
            let entry = entry?;
            if entry.file_type().is_file() {
                size += entry.metadata()?.len();
            }
        }

        Ok(size)
    }

    /// Get cache path for an image
    pub fn get_path(&self, image_ref: &str) -> PathBuf {
        let sanitized = sanitize_filename(image_ref);
        self.cache_dir.join(sanitized)
    }

    /// Check if image is cached
    pub fn is_cached(&self, image_ref: &str) -> bool {
        let sanitized = sanitize_filename(image_ref);
        self.entries.contains_key(&sanitized)
    }

    /// Record access to a cached image
    pub fn touch(&mut self, image_ref: &str) {
        let sanitized = sanitize_filename(image_ref);
        if let Some(entry) = self.entries.get_mut(&sanitized) {
            entry.last_accessed = SystemTime::now();
        }
    }

    /// Add a new entry to the cache
    pub fn add(&mut self, image_ref: &str, size: u64) -> Result<(), std::io::Error> {
        let sanitized = sanitize_filename(image_ref);
        let path = self.cache_dir.join(&sanitized);

        // Evict if necessary
        while self.current_size + size > self.max_size {
            if !self.evict_lru() {
                break; // Nothing left to evict
            }
        }

        let entry = CacheEntry {
            path,
            last_accessed: SystemTime::now(),
            size,
        };

        self.entries.insert(sanitized, entry);
        self.current_size += size;

        Ok(())
    }

    /// Evict least recently used entry
    fn evict_lru(&mut self) -> bool {
        if self.entries.is_empty() {
            return false;
        }

        // Find oldest entry
        let oldest = self
            .entries
            .iter()
            .min_by_key(|(_, entry)| entry.last_accessed)
            .map(|(k, _)| k.clone());

        if let Some(key) = oldest {
            if let Some(entry) = self.entries.remove(&key) {
                // Remove from disk
                let _ = std::fs::remove_dir_all(&entry.path);
                self.current_size -= entry.size;
                return true;
            }
        }

        false
    }

    /// Clear the entire cache
    pub fn clear(&mut self) -> Result<(), std::io::Error> {
        for entry in self.entries.values() {
            let _ = std::fs::remove_dir_all(&entry.path);
        }
        self.entries.clear();
        self.current_size = 0;
        Ok(())
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        CacheStats {
            entries: self.entries.len(),
            total_size: self.current_size,
            max_size: self.max_size,
            utilization: self.current_size as f64 / self.max_size as f64,
        }
    }
}

/// Cache statistics
#[derive(Debug, Clone)]
pub struct CacheStats {
    /// Number of cached images
    pub entries: usize,

    /// Total size in bytes
    pub total_size: u64,

    /// Maximum size in bytes
    pub max_size: u64,

    /// Cache utilization (0.0 - 1.0)
    pub utilization: f64,
}

/// Sanitize image reference for use as filename
fn sanitize_filename(reference: &str) -> String {
    reference.replace(['/', ':', '@', '.'], "_")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_cache_path() {
        let temp_dir = TempDir::new().unwrap();
        let cache = ImageCache::new(temp_dir.path()).unwrap();

        let path = cache.get_path("ubuntu:22.04");
        assert!(path.to_string_lossy().contains("ubuntu_22_04"));
    }

    #[test]
    fn test_cache_stats() {
        let temp_dir = TempDir::new().unwrap();
        let cache = ImageCache::new(temp_dir.path()).unwrap();

        let stats = cache.stats();
        assert_eq!(stats.entries, 0);
        assert_eq!(stats.total_size, 0);
    }
}
