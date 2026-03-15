//! Component Registry with Deterministic Selection
//!
//! Provides a registry of component templates with inverted index for
//! deterministic component selection based on spec keywords.
//!
//! Key features:
//! - BTreeSet for deterministic ordering
//! - Inverted index for fast keyword → component lookup
//! - Thread-safe with RwLock

use crate::ComponentTemplate;
use std::collections::{BTreeSet, HashMap};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Component registry with deterministic selection
#[derive(Clone)]
pub struct ComponentRegistry {
    components: Arc<RwLock<HashMap<String, ComponentTemplate>>>,
    index: Arc<RwLock<ComponentIndex>>,
    defaults: Arc<RwLock<Vec<ComponentTemplate>>>,
}

/// Inverted index for component lookup
#[derive(Debug, Clone, Default)]
pub struct ComponentIndex {
    // Maps keywords → component IDs (BTreeSet for deterministic ordering)
    index: HashMap<String, BTreeSet<String>>,
}

impl ComponentRegistry {
    /// Create a new component registry
    pub fn new() -> Self {
        Self {
            components: Arc::new(RwLock::new(HashMap::new())),
            index: Arc::new(RwLock::new(ComponentIndex::default())),
            defaults: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Create registry with default templates
    pub async fn with_defaults() -> Self {
        let registry = Self::new();

        // Register default templates
        let defaults = vec![
            ComponentTemplate {
                template_id: "btn-001".to_string(),
                component_type: "button".to_string(),
                template_code: r#"<button id="{{id}}" class="btn btn-primary">{{label}}</button>"#.to_string(),
                properties: vec!["id".to_string(), "label".to_string()],
                keywords: vec!["button".to_string(), "click".to_string(), "action".to_string()],
            },
            ComponentTemplate {
                template_id: "inp-001".to_string(),
                component_type: "input".to_string(),
                template_code: r#"<input id="{{id}}" type="{{type}}" placeholder="{{placeholder}}" />"#.to_string(),
                properties: vec!["id".to_string(), "type".to_string(), "placeholder".to_string()],
                keywords: vec!["input".to_string(), "text".to_string(), "form".to_string()],
            },
            ComponentTemplate {
                template_id: "card-001".to_string(),
                component_type: "card".to_string(),
                template_code: r#"<div id="{{id}}" class="card"><div class="card-header">{{title}}</div><div class="card-body">{{content}}</div></div>"#.to_string(),
                properties: vec!["id".to_string(), "title".to_string(), "content".to_string()],
                keywords: vec!["card".to_string(), "container".to_string(), "panel".to_string()],
            },
            ComponentTemplate {
                template_id: "cont-001".to_string(),
                component_type: "container".to_string(),
                template_code: r#"<div id="{{id}}" class="container">{{content}}</div>"#.to_string(),
                properties: vec!["id".to_string(), "content".to_string()],
                keywords: vec!["container".to_string(), "wrapper".to_string(), "div".to_string()],
            },
        ];

        // Register defaults
        for template in defaults {
            registry.register_template(template).await;
        }

        registry
    }

    /// Register a component template
    pub async fn register_template(&self, template: ComponentTemplate) {
        let mut components = self.components.write().await;
        let mut index = self.index.write().await;

        // Insert into components map
        components.insert(template.template_id.clone(), template.clone());

        // Update inverted index
        for keyword in &template.keywords {
            index
                .index
                .entry(keyword.clone())
                .or_insert_with(BTreeSet::new)
                .insert(template.template_id.clone());
        }
    }

    /// Select components deterministically based on spec keywords
    pub async fn select_components(&self, keywords: &[String]) -> Vec<ComponentTemplate> {
        let index = self.index.read().await;
        let components = self.components.read().await;

        // Use BTreeSet for deterministic ordering
        let mut selected_ids = BTreeSet::new();

        // Find all components matching any keyword
        for keyword in keywords {
            if let Some(component_ids) = index.index.get(keyword) {
                selected_ids.extend(component_ids.iter().cloned());
            }
        }

        // Convert IDs to templates (maintaining BTreeSet order)
        selected_ids
            .iter()
            .filter_map(|id| components.get(id).cloned())
            .collect()
    }

    /// Get a specific template by ID
    pub async fn get_template(&self, template_id: &str) -> Option<ComponentTemplate> {
        let components = self.components.read().await;
        components.get(template_id).cloned()
    }

    /// Get all templates
    pub async fn get_all_templates(&self) -> Vec<ComponentTemplate> {
        let components = self.components.read().await;
        components.values().cloned().collect()
    }

    /// Get component types (unique)
    pub async fn get_component_types(&self) -> Vec<String> {
        let components = self.components.read().await;
        let types: BTreeSet<String> = components
            .values()
            .map(|t| t.component_type.clone())
            .collect();
        types.into_iter().collect()
    }

    /// Remove a template
    pub async fn remove_template(&self, template_id: &str) -> bool {
        let mut components = self.components.write().await;
        let mut index = self.index.write().await;

        if let Some(template) = components.remove(template_id) {
            // Remove from index
            for keyword in &template.keywords {
                if let Some(ids) = index.index.get_mut(keyword) {
                    ids.remove(template_id);
                    if ids.is_empty() {
                        index.index.remove(keyword);
                    }
                }
            }
            return true;
        }

        false
    }
}

impl Default for ComponentRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ComponentIndex {
    /// Insert a component into the index
    pub fn insert(&mut self, template_id: String, keywords: Vec<String>) {
        for keyword in keywords {
            self.index
                .entry(keyword)
                .or_default()
                .insert(template_id.clone());
        }
    }

    /// Remove a component from the index
    pub fn remove(&mut self, template_id: &str) {
        for ids in self.index.values_mut() {
            ids.remove(template_id);
        }

        // Clean up empty entries
        self.index.retain(|_, ids| !ids.is_empty());
    }

    /// Find components by keyword
    pub fn find(&self, keyword: &str) -> Option<&BTreeSet<String>> {
        self.index.get(keyword)
    }

    /// Get all keywords in the index
    pub fn all_keywords(&self) -> Vec<&String> {
        self.index.keys().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_registry_creation() {
        let registry = ComponentRegistry::new();
        let templates = registry.get_all_templates().await;
        assert_eq!(templates.len(), 0);
    }

    #[tokio::test]
    async fn test_registry_with_defaults() {
        let registry = ComponentRegistry::with_defaults().await;
        let templates = registry.get_all_templates().await;
        assert!(templates.len() >= 4); // At least default templates
    }

    #[tokio::test]
    async fn test_deterministic_selection() {
        let registry = ComponentRegistry::with_defaults().await;

        // Select components with same keywords multiple times
        let keywords = vec!["button".to_string(), "click".to_string()];

        let result1 = registry.select_components(&keywords).await;
        let result2 = registry.select_components(&keywords).await;
        let result3 = registry.select_components(&keywords).await;

        // Results should be identical (deterministic)
        assert_eq!(result1.len(), result2.len());
        assert_eq!(result2.len(), result3.len());

        for (a, b) in result1.iter().zip(result2.iter()) {
            assert_eq!(a.template_id, b.template_id);
        }
    }

    #[tokio::test]
    async fn test_register_template() {
        let registry = ComponentRegistry::new();

        let template = ComponentTemplate {
            template_id: "custom-001".to_string(),
            component_type: "custom".to_string(),
            template_code: "<custom>{{content}}</custom>".to_string(),
            properties: vec!["content".to_string()],
            keywords: vec!["custom".to_string(), "special".to_string()],
        };

        registry.register_template(template).await;

        let retrieved = registry.get_template("custom-001").await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().component_type, "custom");
    }

    #[tokio::test]
    async fn test_component_types() {
        let registry = ComponentRegistry::with_defaults().await;
        let types = registry.get_component_types().await;

        // Should have unique types in sorted order (BTreeSet)
        assert!(types.contains(&"button".to_string()));
        assert!(types.contains(&"input".to_string()));

        // Verify sorted order
        let mut sorted_types = types.clone();
        sorted_types.sort();
        assert_eq!(types, sorted_types);
    }

    #[tokio::test]
    async fn test_remove_template() {
        let registry = ComponentRegistry::new();

        let template = ComponentTemplate {
            template_id: "temp-001".to_string(),
            component_type: "temp".to_string(),
            template_code: "<temp/>".to_string(),
            properties: vec![],
            keywords: vec!["temp".to_string()],
        };

        registry.register_template(template).await;

        // Verify it exists
        assert!(registry.get_template("temp-001").await.is_some());

        // Remove it
        let removed = registry.remove_template("temp-001").await;
        assert!(removed);

        // Verify it's gone
        assert!(registry.get_template("temp-001").await.is_none());

        // Verify it's removed from index
        let selected = registry.select_components(&vec!["temp".to_string()]).await;
        assert!(selected.is_empty());
    }

    #[tokio::test]
    async fn test_keyword_indexing() {
        let registry = ComponentRegistry::new();

        // Register template with multiple keywords
        let template = ComponentTemplate {
            template_id: "multi-001".to_string(),
            component_type: "multi".to_string(),
            template_code: "<multi/>".to_string(),
            properties: vec![],
            keywords: vec!["alpha".to_string(), "beta".to_string(), "gamma".to_string()],
        };

        registry.register_template(template).await;

        // Should be findable by any keyword
        let result_alpha = registry.select_components(&vec!["alpha".to_string()]).await;
        let result_beta = registry.select_components(&vec!["beta".to_string()]).await;
        let result_gamma = registry.select_components(&vec!["gamma".to_string()]).await;

        assert_eq!(result_alpha.len(), 1);
        assert_eq!(result_beta.len(), 1);
        assert_eq!(result_gamma.len(), 1);

        assert_eq!(result_alpha[0].template_id, result_beta[0].template_id);
        assert_eq!(result_beta[0].template_id, result_gamma[0].template_id);
    }
}
