//! Hash Verification Module
//!
//! Provides content-addressable hashing for UI components and specs.

use crate::{ComponentSpec, GeneratedUI, UISpec};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

/// Hash utilities for deterministic UI generation
#[derive(Clone)]
pub struct HashEngine;

impl HashEngine {
    /// Create a new hash engine
    pub fn new() -> Self {
        Self
    }

    /// Compute hash of a UI spec
    pub fn hash_spec(&self, spec: &UISpec) -> String {
        let mut hasher = DefaultHasher::new();
        spec.spec_id.hash(&mut hasher);
        spec.title.hash(&mut hasher);
        spec.description.hash(&mut hasher);
        spec.components.len().hash(&mut hasher);
        spec.layout.layout_type.hash(&mut hasher);
        spec.style.theme.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }

    /// Compute hash of a component spec
    pub fn hash_component(&self, component: &ComponentSpec) -> String {
        let mut hasher = DefaultHasher::new();
        component.component_id.hash(&mut hasher);
        component.component_type.hash(&mut hasher);

        // Hash properties in deterministic order
        let mut props: Vec<_> = component.properties.iter().collect();
        props.sort_by(|a, b| a.0.cmp(b.0));
        for (key, value) in props {
            key.hash(&mut hasher);
            value.to_string().hash(&mut hasher);
        }

        component.children.len().hash(&mut hasher);
        component.bindings.len().hash(&mut hasher);

        format!("{:016x}", hasher.finish())
    }

    /// Compute hash of a generated UI
    pub fn hash_generated_ui(&self, ui: &GeneratedUI) -> String {
        let mut hasher = DefaultHasher::new();
        ui.spec_id.hash(&mut hasher);
        ui.ui_code.hash(&mut hasher);
        ui.ui_type.hash(&mut hasher);
        ui.components_generated.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }

    /// Compute content-addressable hash
    /// This hash only depends on the content, not metadata
    pub fn content_hash(&self, content: &str) -> String {
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }

    /// Compute hierarchical hash for a spec with all components
    pub fn hierarchical_hash(&self, spec: &UISpec) -> HierarchicalHash {
        let spec_hash = self.hash_spec(spec);

        let component_hashes: Vec<_> = spec
            .components
            .iter()
            .map(|c| (c.component_id.clone(), self.hash_component(c)))
            .collect();

        // Combine all component hashes
        let mut hasher = DefaultHasher::new();
        for (_, hash) in &component_hashes {
            hash.hash(&mut hasher);
        }
        let combined_components = format!("{:016x}", hasher.finish());

        HierarchicalHash {
            spec_hash,
            component_hashes,
            combined_components,
        }
    }

    /// Diff two hashes and return differences
    pub fn diff_hashes(&self, hash1: &str, hash2: &str) -> HashDiff {
        if hash1 == hash2 {
            HashDiff::Identical
        } else {
            HashDiff::Different {
                hash1: hash1.to_string(),
                hash2: hash2.to_string(),
            }
        }
    }

    /// Verify a hash matches expected content
    pub fn verify_hash(&self, content: &str, expected_hash: &str) -> bool {
        let computed = self.content_hash(content);
        computed == expected_hash
    }
}

impl Default for HashEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Hierarchical hash structure
#[derive(Debug, Clone)]
pub struct HierarchicalHash {
    pub spec_hash: String,
    pub component_hashes: Vec<(String, String)>,
    pub combined_components: String,
}

/// Hash difference result
#[derive(Debug, Clone)]
pub enum HashDiff {
    Identical,
    Different { hash1: String, hash2: String },
}

/// Hash cache for performance
pub struct HashCache {
    cache: std::collections::HashMap<String, String>,
}

impl HashCache {
    /// Create a new hash cache
    pub fn new() -> Self {
        Self {
            cache: std::collections::HashMap::new(),
        }
    }

    /// Get cached hash or compute
    pub fn get_or_compute(&mut self, key: &str, content: &str) -> String {
        if let Some(hash) = self.cache.get(key) {
            return hash.clone();
        }

        let engine = HashEngine::new();
        let hash = engine.content_hash(content);
        self.cache.insert(key.to_string(), hash.clone());
        hash
    }

    /// Invalidate cache entry
    pub fn invalidate(&mut self, key: &str) {
        self.cache.remove(key);
    }

    /// Clear all cache
    pub fn clear(&mut self) {
        self.cache.clear();
    }
}

impl Default for HashCache {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        ComponentSpec, DataBinding, LayoutConstraints, LayoutRegionSpec, LayoutSpec,
        RegionPosition, RegionSize, SpacingSpec, StyleSpec, TypographySpec,
    };
    use std::collections::HashMap;

    #[test]
    fn test_hash_engine_creation() {
        let engine = HashEngine::new();
        let hash = engine.content_hash("test content");
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 16); // 16 hex chars
    }

    #[test]
    fn test_content_hash_determinism() {
        let engine = HashEngine::new();
        let hash1 = engine.content_hash("same content");
        let hash2 = engine.content_hash("same content");
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_content_hash_different() {
        let engine = HashEngine::new();
        let hash1 = engine.content_hash("content a");
        let hash2 = engine.content_hash("content b");
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_hash_component() {
        let engine = HashEngine::new();

        let mut properties = HashMap::new();
        properties.insert("label".to_string(), serde_json::json!("Click"));

        let component = ComponentSpec {
            component_id: "btn_1".to_string(),
            component_type: "button".to_string(),
            properties,
            children: vec![],
            bindings: vec![],
        };

        let hash = engine.hash_component(&component);
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 16);
    }

    #[test]
    fn test_hierarchical_hash() {
        let engine = HashEngine::new();

        let spec = UISpec {
            spec_id: "test_spec".to_string(),
            title: "Test".to_string(),
            description: "Test spec".to_string(),
            components: vec![
                ComponentSpec {
                    component_id: "btn_1".to_string(),
                    component_type: "button".to_string(),
                    properties: HashMap::new(),
                    children: vec![],
                    bindings: vec![],
                },
                ComponentSpec {
                    component_id: "input_1".to_string(),
                    component_type: "input".to_string(),
                    properties: HashMap::new(),
                    children: vec![],
                    bindings: vec![],
                },
            ],
            layout: LayoutSpec {
                layout_type: "flex".to_string(),
                constraints: LayoutConstraints::default(),
                regions: vec![],
            },
            style: StyleSpec {
                theme: "light".to_string(),
                colors: HashMap::new(),
                typography: TypographySpec {
                    font_family: "Arial".to_string(),
                    font_sizes: HashMap::new(),
                    line_heights: HashMap::new(),
                },
                spacing: SpacingSpec {
                    scale: vec![4, 8, 16],
                    unit: "px".to_string(),
                },
            },
            interactions: vec![],
            created_at: chrono::Utc::now(),
        };

        let hierarchical = engine.hierarchical_hash(&spec);
        assert!(!hierarchical.spec_hash.is_empty());
        assert_eq!(hierarchical.component_hashes.len(), 2);
        assert!(!hierarchical.combined_components.is_empty());
    }

    #[test]
    fn test_hash_diff() {
        let engine = HashEngine::new();

        let diff = engine.diff_hashes("abc123", "abc123");
        assert!(matches!(diff, HashDiff::Identical));

        let diff = engine.diff_hashes("abc123", "def456");
        assert!(matches!(diff, HashDiff::Different { .. }));
    }

    #[test]
    fn test_verify_hash() {
        let engine = HashEngine::new();
        let content = "test content";
        let hash = engine.content_hash(content);

        assert!(engine.verify_hash(content, &hash));
        assert!(!engine.verify_hash("different content", &hash));
    }

    #[test]
    fn test_hash_cache() {
        let mut cache = HashCache::new();

        // First call computes
        let hash1 = cache.get_or_compute("key1", "content1");

        // Second call returns cached
        let hash2 = cache.get_or_compute("key1", "content1");
        assert_eq!(hash1, hash2);

        // Different key computes new hash
        let hash3 = cache.get_or_compute("key2", "content2");
        assert_ne!(hash1, hash3);

        // Invalidate and recompute
        cache.invalidate("key1");
        let hash4 = cache.get_or_compute("key1", "content1");
        assert_eq!(hash1, hash4); // Same content = same hash
    }
}
