//! Spec Diff & Versioning Module
//!
//! Provides diff functionality for UI specifications.

use crate::{LayoutSpec, StyleSpec, UISpec};
use serde::{Deserialize, Serialize};

/// Difference between two specs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecDiff {
    pub has_changes: bool,
    pub component_changes: Vec<ComponentChange>,
    pub layout_changes: Vec<LayoutChange>,
    pub style_changes: Vec<StyleChange>,
    pub breaking_changes: Vec<BreakingChange>,
}

/// Component-level change
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentChange {
    pub change_type: ChangeType,
    pub component_id: String,
    pub description: String,
}

/// Layout-level change
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutChange {
    pub field: String,
    pub old_value: String,
    pub new_value: String,
}

/// Style-level change
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StyleChange {
    pub category: String,
    pub property: String,
    pub old_value: String,
    pub new_value: String,
}

/// Breaking change
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreakingChange {
    pub severity: Severity,
    pub description: String,
    pub migration_guide: String,
}

/// Type of change
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ChangeType {
    Added,
    Removed,
    Modified,
}

/// Severity of breaking change
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

/// Spec diff engine
#[derive(Clone)]
pub struct SpecDiffEngine;

impl SpecDiffEngine {
    /// Create a new diff engine
    pub fn new() -> Self {
        Self
    }

    /// Compute diff between two specs
    pub fn diff(&self, old_spec: &UISpec, new_spec: &UISpec) -> SpecDiff {
        let mut component_changes = Vec::new();
        let mut layout_changes = Vec::new();
        let mut style_changes = Vec::new();
        let mut breaking_changes = Vec::new();

        // Compare components
        self.diff_components(
            old_spec,
            new_spec,
            &mut component_changes,
            &mut breaking_changes,
        );

        // Compare layout
        self.diff_layout(&old_spec.layout, &new_spec.layout, &mut layout_changes);

        // Compare styles
        self.diff_styles(&old_spec.style, &new_spec.style, &mut style_changes);

        // Check for breaking changes in spec_id or major structural changes
        if old_spec.spec_id != new_spec.spec_id {
            breaking_changes.push(BreakingChange {
                severity: Severity::Critical,
                description: format!(
                    "Spec ID changed from '{}' to '{}'",
                    old_spec.spec_id, new_spec.spec_id
                ),
                migration_guide: "Update all references to the new spec ID".to_string(),
            });
        }

        let has_changes = !component_changes.is_empty()
            || !layout_changes.is_empty()
            || !style_changes.is_empty()
            || !breaking_changes.is_empty();

        SpecDiff {
            has_changes,
            component_changes,
            layout_changes,
            style_changes,
            breaking_changes,
        }
    }

    /// Diff components between specs
    fn diff_components(
        &self,
        old_spec: &UISpec,
        new_spec: &UISpec,
        changes: &mut Vec<ComponentChange>,
        breaking: &mut Vec<BreakingChange>,
    ) {
        let old_components: std::collections::HashMap<_, _> = old_spec
            .components
            .iter()
            .map(|c| (c.component_id.clone(), c))
            .collect();

        let new_components: std::collections::HashMap<_, _> = new_spec
            .components
            .iter()
            .map(|c| (c.component_id.clone(), c))
            .collect();

        // Find added components
        for (id, new_comp) in &new_components {
            if !old_components.contains_key(id) {
                changes.push(ComponentChange {
                    change_type: ChangeType::Added,
                    component_id: id.clone(),
                    description: format!(
                        "Added component '{}' of type '{}'",
                        id, new_comp.component_type
                    ),
                });
            }
        }

        // Find removed components
        for (id, old_comp) in &old_components {
            if !new_components.contains_key(id) {
                changes.push(ComponentChange {
                    change_type: ChangeType::Removed,
                    component_id: id.clone(),
                    description: format!(
                        "Removed component '{}' of type '{}'",
                        id, old_comp.component_type
                    ),
                });
                breaking.push(BreakingChange {
                    severity: Severity::High,
                    description: format!("Component '{}' was removed", id),
                    migration_guide: format!(
                        "Replace usage of '{}' with an alternative component",
                        id
                    ),
                });
            }
        }

        // Find modified components
        for (id, new_comp) in &new_components {
            if let Some(old_comp) = old_components.get(id) {
                if old_comp.component_type != new_comp.component_type {
                    changes.push(ComponentChange {
                        change_type: ChangeType::Modified,
                        component_id: id.clone(),
                        description: format!(
                            "Component '{}' changed from '{}' to '{}'",
                            id, old_comp.component_type, new_comp.component_type
                        ),
                    });
                    breaking.push(BreakingChange {
                        severity: Severity::Medium,
                        description: format!(
                            "Component '{}' type changed from '{}' to '{}'",
                            id, old_comp.component_type, new_comp.component_type
                        ),
                        migration_guide: format!(
                            "Update any code that depends on '{}' being of type '{}'",
                            id, old_comp.component_type
                        ),
                    });
                } else if old_comp.properties != new_comp.properties {
                    changes.push(ComponentChange {
                        change_type: ChangeType::Modified,
                        component_id: id.clone(),
                        description: format!("Component '{}' properties changed", id),
                    });
                }
            }
        }
    }

    /// Diff layout specs
    fn diff_layout(
        &self,
        old_layout: &LayoutSpec,
        new_layout: &LayoutSpec,
        changes: &mut Vec<LayoutChange>,
    ) {
        if old_layout.layout_type != new_layout.layout_type {
            changes.push(LayoutChange {
                field: "layout_type".to_string(),
                old_value: old_layout.layout_type.clone(),
                new_value: new_layout.layout_type.clone(),
            });
        }

        if old_layout.regions.len() != new_layout.regions.len() {
            changes.push(LayoutChange {
                field: "region_count".to_string(),
                old_value: old_layout.regions.len().to_string(),
                new_value: new_layout.regions.len().to_string(),
            });
        }
    }

    /// Diff style specs
    fn diff_styles(
        &self,
        old_style: &StyleSpec,
        new_style: &StyleSpec,
        changes: &mut Vec<StyleChange>,
    ) {
        if old_style.theme != new_style.theme {
            changes.push(StyleChange {
                category: "theme".to_string(),
                property: "theme".to_string(),
                old_value: old_style.theme.clone(),
                new_value: new_style.theme.clone(),
            });
        }

        // Diff colors
        for (name, old_value) in &old_style.colors {
            if let Some(new_value) = new_style.colors.get(name) {
                if old_value != new_value {
                    changes.push(StyleChange {
                        category: "colors".to_string(),
                        property: name.clone(),
                        old_value: old_value.clone(),
                        new_value: new_value.clone(),
                    });
                }
            } else {
                changes.push(StyleChange {
                    category: "colors".to_string(),
                    property: name.clone(),
                    old_value: old_value.clone(),
                    new_value: "(removed)".to_string(),
                });
            }
        }

        for (name, new_value) in &new_style.colors {
            if !old_style.colors.contains_key(name) {
                changes.push(StyleChange {
                    category: "colors".to_string(),
                    property: name.clone(),
                    old_value: "(added)".to_string(),
                    new_value: new_value.clone(),
                });
            }
        }
    }

    /// Generate migration guide from diff
    pub fn generate_migration_guide(&self, diff: &SpecDiff) -> String {
        let mut guide = String::new();

        guide.push_str("# Migration Guide\n\n");

        if !diff.breaking_changes.is_empty() {
            guide.push_str("## Breaking Changes\n\n");
            for change in &diff.breaking_changes {
                guide.push_str(&format!(
                    "### {}\n\n{}\n\n**Migration:** {}\n\n",
                    self.severity_emoji(&change.severity),
                    change.description,
                    change.migration_guide
                ));
            }
        }

        if !diff.component_changes.is_empty() {
            guide.push_str("## Component Changes\n\n");
            for change in &diff.component_changes {
                guide.push_str(&format!(
                    "- {}: {}\n",
                    self.change_type_emoji(&change.change_type),
                    change.description
                ));
            }
            guide.push('\n');
        }

        guide
    }

    fn severity_emoji(&self, severity: &Severity) -> &'static str {
        match severity {
            Severity::Low => "🟢 Low",
            Severity::Medium => "🟡 Medium",
            Severity::High => "🔴 High",
            Severity::Critical => "🚨 Critical",
        }
    }

    fn change_type_emoji(&self, change_type: &ChangeType) -> &'static str {
        match change_type {
            ChangeType::Added => "✅ Added",
            ChangeType::Removed => "❌ Removed",
            ChangeType::Modified => "📝 Modified",
        }
    }

    /// Check if diff contains breaking changes
    pub fn has_breaking_changes(&self, diff: &SpecDiff) -> bool {
        !diff.breaking_changes.is_empty()
    }

    /// Get summary of changes
    pub fn summarize(&self, diff: &SpecDiff) -> String {
        format!(
            "Changes: {} components, {} layout, {} style, {} breaking",
            diff.component_changes.len(),
            diff.layout_changes.len(),
            diff.style_changes.len(),
            diff.breaking_changes.len()
        )
    }
}

impl Default for SpecDiffEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Version info for a spec
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecVersion {
    pub version: String,
    pub spec_id: String,
    pub hash: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub changes_from_previous: Option<SpecDiff>,
}

/// Version history for a spec
pub struct SpecVersionHistory {
    versions: Vec<SpecVersion>,
}

impl SpecVersionHistory {
    /// Create new version history
    pub fn new() -> Self {
        Self {
            versions: Vec::new(),
        }
    }

    /// Add a new version
    pub fn add_version(&mut self, version: SpecVersion) {
        self.versions.push(version);
    }

    /// Get all versions
    pub fn get_versions(&self) -> &[SpecVersion] {
        &self.versions
    }

    /// Get latest version
    pub fn latest(&self) -> Option<&SpecVersion> {
        self.versions.last()
    }

    /// Get version by version string
    pub fn get_version(&self, version: &str) -> Option<&SpecVersion> {
        self.versions.iter().find(|v| v.version == version)
    }

    /// Get diff between two versions
    pub fn diff_versions(&self, v1: &str, v2: &str) -> Option<SpecDiff> {
        let version1 = self.get_version(v1)?;
        let version2 = self.get_version(v2)?;

        // In a real implementation, we'd fetch the actual specs and diff them
        // For now, return the stored diff
        version2.changes_from_previous.clone()
    }
}

impl Default for SpecVersionHistory {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        ComponentSpec, DataBinding, InteractionSpec, LayoutConstraints, LayoutRegionSpec,
        LayoutSpec, RegionPosition, RegionSize, SpacingSpec, StyleSpec, TypographySpec, UISpec,
    };
    use std::collections::HashMap;

    fn create_test_spec(id: &str, component_count: usize) -> UISpec {
        let components: Vec<_> = (0..component_count)
            .map(|i| ComponentSpec {
                component_id: format!("comp_{}", i),
                component_type: "button".to_string(),
                properties: HashMap::new(),
                children: vec![],
                bindings: vec![],
            })
            .collect();

        UISpec {
            spec_id: id.to_string(),
            title: "Test".to_string(),
            description: "Test spec".to_string(),
            components,
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
        }
    }

    #[test]
    fn test_diff_engine_creation() {
        let engine = SpecDiffEngine::new();
        let spec = create_test_spec("test", 2);
        let diff = engine.diff(&spec, &spec);
        assert!(!diff.has_changes);
    }

    #[test]
    fn test_component_added() {
        let engine = SpecDiffEngine::new();
        let old_spec = create_test_spec("test", 1);
        let new_spec = create_test_spec("test", 2);

        let diff = engine.diff(&old_spec, &new_spec);
        assert!(diff.has_changes);
        assert_eq!(diff.component_changes.len(), 1);
        assert_eq!(diff.component_changes[0].change_type, ChangeType::Added);
    }

    #[test]
    fn test_component_removed() {
        let engine = SpecDiffEngine::new();
        let old_spec = create_test_spec("test", 2);
        let new_spec = create_test_spec("test", 1);

        let diff = engine.diff(&old_spec, &new_spec);
        assert!(diff.has_changes);
        assert!(diff.breaking_changes.len() > 0);
    }

    #[test]
    fn test_spec_id_change() {
        let engine = SpecDiffEngine::new();
        let old_spec = create_test_spec("old_id", 1);
        let new_spec = create_test_spec("new_id", 1);

        let diff = engine.diff(&old_spec, &new_spec);
        assert!(diff.has_changes);
        assert!(diff
            .breaking_changes
            .iter()
            .any(|c| c.severity == Severity::Critical));
    }

    #[test]
    fn test_has_breaking_changes() {
        let engine = SpecDiffEngine::new();
        let old_spec = create_test_spec("test", 2);
        let new_spec = create_test_spec("test", 1);

        let diff = engine.diff(&old_spec, &new_spec);
        assert!(engine.has_breaking_changes(&diff));
    }

    #[test]
    fn test_summarize() {
        let engine = SpecDiffEngine::new();
        let old_spec = create_test_spec("test", 1);
        let new_spec = create_test_spec("test", 2);

        let diff = engine.diff(&old_spec, &new_spec);
        let summary = engine.summarize(&diff);
        assert!(summary.contains("1 components"));
    }

    #[test]
    fn test_version_history() {
        let mut history = SpecVersionHistory::new();

        let version = SpecVersion {
            version: "1.0.0".to_string(),
            spec_id: "test".to_string(),
            hash: "abc123".to_string(),
            timestamp: chrono::Utc::now(),
            changes_from_previous: None,
        };

        history.add_version(version);
        assert_eq!(history.get_versions().len(), 1);
        assert!(history.latest().is_some());
    }
}
