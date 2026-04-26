//! Tambo Engine Node-API Bindings
//!
//! Provides TypeScript/JavaScript access to the Rust Tambo engine.

use allternit_tambo_integration::{GenerationConfig, TamboEngine, UISpec, UIType};
use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};

// =============================================================================
// TypeScript Types (mirrored from Rust)
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsUISpec {
    pub spec_id: String,
    pub title: String,
    pub description: String,
    pub components: Vec<TsComponentSpec>,
    pub layout: TsLayoutSpec,
    pub style: TsStyleSpec,
    pub interactions: Vec<TsInteractionSpec>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsComponentSpec {
    pub component_id: String,
    pub component_type: String,
    pub properties: serde_json::Value,
    pub children: Vec<String>,
    pub bindings: Vec<TsDataBinding>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsDataBinding {
    pub property: String,
    pub source: String,
    pub transform: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsLayoutSpec {
    pub layout_type: String,
    pub constraints: TsLayoutConstraints,
    pub regions: Vec<TsLayoutRegionSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsLayoutConstraints {
    pub min_width: Option<u32>,
    pub max_width: Option<u32>,
    pub min_height: Option<u32>,
    pub max_height: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsLayoutRegionSpec {
    pub region_id: String,
    pub region_type: String,
    pub position: TsRegionPosition,
    pub size: TsRegionSize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsRegionPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsRegionSize {
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsStyleSpec {
    pub theme: String,
    pub colors: std::collections::HashMap<String, String>,
    pub typography: TsTypographySpec,
    pub spacing: TsSpacingSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsTypographySpec {
    pub font_family: String,
    pub font_sizes: std::collections::HashMap<String, u32>,
    pub line_heights: std::collections::HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsSpacingSpec {
    pub scale: Vec<u32>,
    pub unit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsInteractionSpec {
    pub interaction_id: String,
    pub trigger: String,
    pub action: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsGeneratedUI {
    pub generation_id: String,
    pub spec_id: String,
    pub ui_code: String,
    pub ui_type: String,
    pub components_generated: u32,
    pub confidence: f64,
    pub generation_hash: Option<String>,
}

// =============================================================================
// Conversion Functions
// =============================================================================

fn ts_spec_to_rust(ts: TsUISpec) -> UISpec {
    UISpec {
        spec_id: ts.spec_id,
        title: ts.title,
        description: ts.description,
        components: ts
            .components
            .into_iter()
            .map(|c| allternit_tambo_integration::ComponentSpec {
                component_id: c.component_id,
                component_type: c.component_type,
                properties: c
                    .properties
                    .as_object()
                    .map(|o| o.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
                    .unwrap_or_default(),
                children: c.children,
                bindings: c
                    .bindings
                    .into_iter()
                    .map(|b| allternit_tambo_integration::DataBinding {
                        property: b.property,
                        source: b.source,
                        transform: b.transform,
                    })
                    .collect(),
            })
            .collect(),
        layout: allternit_tambo_integration::LayoutSpec {
            layout_type: ts.layout.layout_type,
            constraints: allternit_tambo_integration::LayoutConstraints {
                min_width: ts.layout.constraints.min_width,
                max_width: ts.layout.constraints.max_width,
                min_height: ts.layout.constraints.min_height,
                max_height: ts.layout.constraints.max_height,
            },
            regions: ts
                .layout
                .regions
                .into_iter()
                .map(|r| allternit_tambo_integration::LayoutRegionSpec {
                    region_id: r.region_id,
                    region_type: r.region_type,
                    position: allternit_tambo_integration::RegionPosition {
                        x: r.position.x as f32,
                        y: r.position.y as f32,
                    },
                    size: allternit_tambo_integration::RegionSize {
                        width: r.size.width as f32,
                        height: r.size.height as f32,
                    },
                })
                .collect(),
        },
        style: allternit_tambo_integration::StyleSpec {
            theme: ts.style.theme,
            colors: ts.style.colors,
            typography: allternit_tambo_integration::TypographySpec {
                font_family: ts.style.typography.font_family,
                font_sizes: ts.style.typography.font_sizes,
                line_heights: ts
                    .style
                    .typography
                    .line_heights
                    .into_iter()
                    .map(|(k, v)| (k, v as f32))
                    .collect(),
            },
            spacing: allternit_tambo_integration::SpacingSpec {
                scale: ts.style.spacing.scale,
                unit: ts.style.spacing.unit,
            },
        },
        interactions: ts
            .interactions
            .into_iter()
            .map(|i| allternit_tambo_integration::InteractionSpec {
                interaction_id: i.interaction_id,
                trigger: i.trigger,
                action: i.action,
                target: i.target,
                parameters: std::collections::HashMap::new(),
            })
            .collect(),
        created_at: chrono::DateTime::parse_from_rfc3339(&ts.created_at)
            .unwrap_or_else(|_| {
                chrono::DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z").unwrap()
            })
            .with_timezone(&chrono::Utc),
    }
}

fn rust_ui_to_ts(rust: allternit_tambo_integration::GeneratedUI) -> TsGeneratedUI {
    TsGeneratedUI {
        generation_id: rust.generation_id,
        spec_id: rust.spec_id,
        ui_code: rust.ui_code,
        ui_type: format!("{:?}", rust.ui_type),
        components_generated: rust.components_generated as u32,
        confidence: rust.confidence as f64,
        generation_hash: rust.generation_hash,
    }
}

// =============================================================================
// Tambo Engine NAPI Wrapper
// =============================================================================

#[napi]
pub struct TamboEngineNapi {
    engine: TamboEngine,
}

#[napi]
impl TamboEngineNapi {
    #[napi(constructor)]
    pub fn new() -> Self {
        // Initialize with defaults
        let engine = TamboEngine::new();
        Self { engine }
    }

    /// Initialize engine with default components (async)
    #[napi]
    pub async fn init_with_defaults() -> Self {
        let engine = TamboEngine::init_with_defaults().await;
        Self { engine }
    }

    /// Generate UI (standard mode)
    #[napi]
    pub async fn generate_ui(&self, spec: TsUISpec, ui_type: String) -> Result<TsGeneratedUI> {
        let rust_spec = ts_spec_to_rust(spec);
        let ui_type = match ui_type.as_str() {
            "react" => UIType::React,
            "vue" => UIType::Vue,
            "svelte" => UIType::Svelte,
            "angular" => UIType::Angular,
            "web_components" => UIType::WebComponents,
            _ => UIType::PlainHtml,
        };

        let result = self
            .engine
            .generate_ui(&rust_spec, ui_type)
            .await
            .map_err(|e| Error::from_reason(format!("Generation failed: {}", e)))?;

        Ok(rust_ui_to_ts(result))
    }

    /// Generate UI with validation
    #[napi]
    pub async fn generate_ui_validated(
        &self,
        spec: TsUISpec,
        ui_type: String,
    ) -> Result<TsGeneratedUI> {
        let rust_spec = ts_spec_to_rust(spec);
        let ui_type = match ui_type.as_str() {
            "react" => UIType::React,
            "vue" => UIType::Vue,
            "svelte" => UIType::Svelte,
            "angular" => UIType::Angular,
            "web_components" => UIType::WebComponents,
            "svelte" => UIType::Svelte,
            _ => UIType::PlainHtml,
        };

        let result = self
            .engine
            .generate_ui_validated(&rust_spec, ui_type)
            .await
            .map_err(|e| Error::from_reason(format!("Validated generation failed: {}", e)))?;

        Ok(rust_ui_to_ts(result))
    }

    /// Generate UI with reproducibility (seed-based)
    #[napi]
    pub async fn generate_ui_reproducible(
        &self,
        spec: TsUISpec,
        ui_type: String,
        seed: f64,
    ) -> Result<TsGeneratedUI> {
        let rust_spec = ts_spec_to_rust(spec);
        let ui_type = match ui_type.as_str() {
            "react" => UIType::React,
            "vue" => UIType::Vue,
            "svelte" => UIType::Svelte,
            "angular" => UIType::Angular,
            "web_components" => UIType::WebComponents,
            _ => UIType::PlainHtml,
        };

        let config = GenerationConfig::reproducible(seed as u64);
        let result = self
            .engine
            .generate_ui_reproducible(&rust_spec, ui_type, config)
            .await
            .map_err(|e| Error::from_reason(format!("Reproducible generation failed: {}", e)))?;

        Ok(rust_ui_to_ts(result))
    }

    /// Save generation state
    #[napi]
    pub async fn save_generation_state(
        &self,
        generation_id: String,
        spec_id: String,
        state: String,
    ) -> Result<()> {
        let state_value: serde_json::Value = serde_json::from_str(&state)
            .map_err(|e| Error::from_reason(format!("Invalid JSON state: {}", e)))?;
        self.engine
            .save_generation_state(&generation_id, &spec_id, state_value)
            .await
            .map_err(|e| Error::from_reason(format!("Failed to save state: {}", e)))
    }

    /// Load generation state
    #[napi]
    pub async fn load_generation_state(&self, generation_id: String) -> Result<Option<String>> {
        let result = self
            .engine
            .load_generation_state(&generation_id)
            .await
            .map_err(|e| Error::from_reason(format!("Failed to load state: {}", e)))?;

        Ok(result.map(|s| s.state.to_string()))
    }

    // =========================================================================
    // Hash Engine Methods
    // =========================================================================

    /// Hash arbitrary content
    #[napi]
    pub fn hash_content(&self, content: String) -> String {
        self.engine.hash_engine().content_hash(&content)
    }

    /// Verify content against expected hash
    #[napi]
    pub fn verify_hash(&self, content: String, expected_hash: String) -> bool {
        self.engine
            .hash_engine()
            .verify_hash(&content, &expected_hash)
    }

    // =========================================================================
    // Spec Diff Engine Methods
    // =========================================================================

    /// Compare two specs and return differences
    #[napi]
    pub fn diff_specs(&self, old_spec: TsUISpec, new_spec: TsUISpec) -> Result<TsSpecDiff> {
        let old = ts_spec_to_rust(old_spec);
        let new = ts_spec_to_rust(new_spec);

        let diff = self.engine.spec_diff_engine().diff(&old, &new);
        Ok(rust_diff_to_ts(diff))
    }

    /// Check if spec diff has breaking changes
    #[napi]
    pub fn has_breaking_changes(&self, diff: TsSpecDiff) -> bool {
        let rust_diff = ts_diff_to_rust(diff);
        self.engine
            .spec_diff_engine()
            .has_breaking_changes(&rust_diff)
    }

    /// Generate human-readable summary of changes
    #[napi]
    pub fn summarize_changes(&self, diff: TsSpecDiff) -> String {
        let rust_diff = ts_diff_to_rust(diff);
        self.engine.spec_diff_engine().summarize(&rust_diff)
    }

    // =========================================================================
    // Accessibility (A11y) Engine Methods
    // =========================================================================

    /// Validate spec for accessibility
    #[napi]
    pub fn validate_a11y(&self, spec: TsUISpec) -> TsA11yResult {
        let rust_spec = ts_spec_to_rust(spec);
        let result = self.engine.a11y_engine().check_spec(&rust_spec);
        rust_a11y_to_ts(result)
    }

    /// Validate generated UI for accessibility
    #[napi]
    pub fn validate_ui_a11y(&self, ui: TsGeneratedUI) -> TsA11yResult {
        let rust_ui = allternit_tambo_integration::GeneratedUI {
            generation_id: ui.generation_id,
            spec_id: ui.spec_id,
            ui_code: ui.ui_code,
            ui_type: match ui.ui_type.as_str() {
                "React" => UIType::React,
                "Vue" => UIType::Vue,
                "Svelte" => UIType::Svelte,
                "Angular" => UIType::Angular,
                "WebComponents" => UIType::WebComponents,
                _ => UIType::PlainHtml,
            },
            components_generated: ui.components_generated as usize,
            confidence: ui.confidence as f32,
            created_at: chrono::Utc::now(),
            generation_hash: ui.generation_hash,
        };
        let result = self.engine.a11y_engine().check_generated_ui(&rust_ui);
        rust_a11y_to_ts(result)
    }

    /// Generate accessibility report
    #[napi]
    pub fn generate_a11y_report(&self, result: TsA11yResult) -> String {
        let rust_result = ts_a11y_to_rust(result);
        self.engine.a11y_engine().generate_report(&rust_result)
    }
}

// =============================================================================
// Additional TypeScript Types for New Engines
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsSpecDiff {
    pub has_changes: bool,
    pub component_changes: Vec<TsComponentChange>,
    pub layout_changes: Vec<TsLayoutChange>,
    pub style_changes: Vec<TsStyleChange>,
    pub breaking_changes: Vec<TsBreakingChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsComponentChange {
    pub change_type: String,
    pub component_id: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsLayoutChange {
    pub field: String,
    pub old_value: String,
    pub new_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsStyleChange {
    pub category: String,
    pub property: String,
    pub old_value: String,
    pub new_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsBreakingChange {
    pub severity: String,
    pub description: String,
    pub migration_guide: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsA11yResult {
    pub passed: bool,
    pub score: f64,
    pub violations: Vec<TsA11yViolation>,
    pub warnings: Vec<TsA11yWarning>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsA11yViolation {
    pub rule: String,
    pub severity: String,
    pub description: String,
    pub element: String,
    pub remediation: String,
    pub wcag_reference: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi(object)]
pub struct TsA11yWarning {
    pub rule: String,
    pub description: String,
    pub element: String,
    pub suggestion: String,
}

// =============================================================================
// Conversion Functions for New Types
// =============================================================================

fn rust_diff_to_ts(diff: allternit_tambo_integration::SpecDiff) -> TsSpecDiff {
    TsSpecDiff {
        has_changes: diff.has_changes,
        component_changes: diff
            .component_changes
            .into_iter()
            .map(|c| TsComponentChange {
                change_type: format!("{:?}", c.change_type),
                component_id: c.component_id,
                description: c.description,
            })
            .collect(),
        layout_changes: diff
            .layout_changes
            .into_iter()
            .map(|l| TsLayoutChange {
                field: l.field,
                old_value: l.old_value,
                new_value: l.new_value,
            })
            .collect(),
        style_changes: diff
            .style_changes
            .into_iter()
            .map(|s| TsStyleChange {
                category: s.category,
                property: s.property,
                old_value: s.old_value,
                new_value: s.new_value,
            })
            .collect(),
        breaking_changes: diff
            .breaking_changes
            .into_iter()
            .map(|b| TsBreakingChange {
                severity: format!("{:?}", b.severity),
                description: b.description,
                migration_guide: b.migration_guide,
            })
            .collect(),
    }
}

fn ts_diff_to_rust(diff: TsSpecDiff) -> allternit_tambo_integration::SpecDiff {
    use allternit_tambo_integration::{
        BreakingChange, ChangeType, ComponentChange, LayoutChange, Severity, StyleChange,
    };

    allternit_tambo_integration::SpecDiff {
        has_changes: diff.has_changes,
        component_changes: diff
            .component_changes
            .into_iter()
            .map(|c| ComponentChange {
                change_type: match c.change_type.as_str() {
                    "Added" => ChangeType::Added,
                    "Removed" => ChangeType::Removed,
                    _ => ChangeType::Modified,
                },
                component_id: c.component_id,
                description: c.description,
            })
            .collect(),
        layout_changes: diff
            .layout_changes
            .into_iter()
            .map(|l| LayoutChange {
                field: l.field,
                old_value: l.old_value,
                new_value: l.new_value,
            })
            .collect(),
        style_changes: diff
            .style_changes
            .into_iter()
            .map(|s| StyleChange {
                category: s.category,
                property: s.property,
                old_value: s.old_value,
                new_value: s.new_value,
            })
            .collect(),
        breaking_changes: diff
            .breaking_changes
            .into_iter()
            .map(|b| BreakingChange {
                severity: match b.severity.as_str() {
                    "Critical" => Severity::Critical,
                    "High" => Severity::High,
                    "Medium" => Severity::Medium,
                    _ => Severity::Low,
                },
                description: b.description,
                migration_guide: b.migration_guide,
            })
            .collect(),
    }
}

fn rust_a11y_to_ts(result: allternit_tambo_integration::A11yCheckResult) -> TsA11yResult {
    TsA11yResult {
        passed: result.passed,
        score: result.score as f64,
        violations: result
            .violations
            .into_iter()
            .map(|v| TsA11yViolation {
                rule: v.rule,
                severity: format!("{:?}", v.severity),
                description: v.description,
                element: v.element,
                remediation: v.remediation,
                wcag_reference: v.wcag_reference,
            })
            .collect(),
        warnings: result
            .warnings
            .into_iter()
            .map(|w| TsA11yWarning {
                rule: w.rule,
                description: w.description,
                element: w.element,
                suggestion: w.suggestion,
            })
            .collect(),
    }
}

fn ts_a11y_to_rust(result: TsA11yResult) -> allternit_tambo_integration::A11yCheckResult {
    use allternit_tambo_integration::{A11ySeverity, A11yViolation, A11yWarning};

    allternit_tambo_integration::A11yCheckResult {
        passed: result.passed,
        score: result.score as f32,
        violations: result
            .violations
            .into_iter()
            .map(|v| A11yViolation {
                rule: v.rule,
                severity: match v.severity.as_str() {
                    "Critical" => A11ySeverity::Critical,
                    "Serious" => A11ySeverity::Serious,
                    "Moderate" => A11ySeverity::Moderate,
                    _ => A11ySeverity::Minor,
                },
                description: v.description,
                element: v.element,
                remediation: v.remediation,
                wcag_reference: v.wcag_reference,
            })
            .collect(),
        warnings: result
            .warnings
            .into_iter()
            .map(|w| A11yWarning {
                rule: w.rule,
                description: w.description,
                element: w.element,
                suggestion: w.suggestion,
            })
            .collect(),
    }
}

// =============================================================================
// Module Exports
// =============================================================================

#[napi]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
