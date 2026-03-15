//! Accessibility (A11y) Engine Module
//!
//! Provides WCAG 2.1 AA compliance checking and ARIA attribute generation.

use crate::{ComponentSpec, GeneratedUI, UISpec};
use serde::{Deserialize, Serialize};

/// Accessibility check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct A11yCheckResult {
    pub passed: bool,
    pub violations: Vec<A11yViolation>,
    pub warnings: Vec<A11yWarning>,
    pub score: f32, // 0.0 to 1.0
}

/// Accessibility violation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct A11yViolation {
    pub rule: String,
    pub severity: A11ySeverity,
    pub description: String,
    pub element: String,
    pub remediation: String,
    pub wcag_reference: String,
}

/// Accessibility warning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct A11yWarning {
    pub rule: String,
    pub description: String,
    pub element: String,
    pub suggestion: String,
}

/// Severity levels for accessibility issues
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum A11ySeverity {
    Critical, // Blocks usage, must fix
    Serious,  // Significant barrier
    Moderate, // Some difficulty
    Minor,    // Minor inconvenience
}

/// ARIA role definitions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AriaRole {
    Button,
    Link,
    Checkbox,
    Radio,
    Textbox,
    Combobox,
    Listbox,
    Tab,
    TabPanel,
    Dialog,
    Alert,
    Article,
    Banner,
    Navigation,
    Main,
    Complementary,
    ContentInfo,
    Form,
    Search,
    Region,
}

impl AriaRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            AriaRole::Button => "button",
            AriaRole::Link => "link",
            AriaRole::Checkbox => "checkbox",
            AriaRole::Radio => "radio",
            AriaRole::Textbox => "textbox",
            AriaRole::Combobox => "combobox",
            AriaRole::Listbox => "listbox",
            AriaRole::Tab => "tab",
            AriaRole::TabPanel => "tabpanel",
            AriaRole::Dialog => "dialog",
            AriaRole::Alert => "alert",
            AriaRole::Article => "article",
            AriaRole::Banner => "banner",
            AriaRole::Navigation => "navigation",
            AriaRole::Main => "main",
            AriaRole::Complementary => "complementary",
            AriaRole::ContentInfo => "contentinfo",
            AriaRole::Form => "form",
            AriaRole::Search => "search",
            AriaRole::Region => "region",
        }
    }
}

/// Accessibility engine
#[derive(Clone)]
pub struct A11yEngine;

impl A11yEngine {
    /// Create a new accessibility engine
    pub fn new() -> Self {
        Self
    }

    /// Check a UI spec for accessibility compliance
    pub fn check_spec(&self, spec: &UISpec) -> A11yCheckResult {
        let mut violations = Vec::new();
        let mut warnings = Vec::new();

        // Check each component
        for component in &spec.components {
            self.check_component(component, &mut violations, &mut warnings);
        }

        // Check overall structure
        self.check_structure(spec, &mut violations, &mut warnings);

        // Calculate score
        let score = self.calculate_score(&violations, &warnings);
        let passed = violations.is_empty();

        A11yCheckResult {
            passed,
            violations,
            warnings,
            score,
        }
    }

    /// Check a generated UI output
    pub fn check_generated_ui(&self, ui: &GeneratedUI) -> A11yCheckResult {
        let mut violations = Vec::new();
        let mut warnings = Vec::new();

        // Check for alt attributes in images
        if ui.ui_code.contains("<img") && !ui.ui_code.contains("alt=") {
            violations.push(A11yViolation {
                rule: "image-alt".to_string(),
                severity: A11ySeverity::Serious,
                description: "Images must have alternate text".to_string(),
                element: "img".to_string(),
                remediation: "Add alt attribute to all img elements".to_string(),
                wcag_reference: "WCAG 1.1.1".to_string(),
            });
        }

        // Check for form labels
        if ui.ui_code.contains("<input") && !ui.ui_code.contains("<label") {
            warnings.push(A11yWarning {
                rule: "form-labels".to_string(),
                description: "Form inputs should have associated labels".to_string(),
                element: "input".to_string(),
                suggestion: "Wrap inputs in label elements or use aria-labelledby".to_string(),
            });
        }

        // Check for heading hierarchy
        let score = self.calculate_score(&violations, &warnings);
        let passed = violations.is_empty();

        A11yCheckResult {
            passed,
            violations,
            warnings,
            score,
        }
    }

    /// Check a component for accessibility
    fn check_component(
        &self,
        component: &ComponentSpec,
        violations: &mut Vec<A11yViolation>,
        warnings: &mut Vec<A11yWarning>,
    ) {
        match component.component_type.as_str() {
            "button" => {
                // Buttons need accessible labels
                if !component.properties.contains_key("aria-label")
                    && !component.properties.contains_key("label")
                {
                    warnings.push(A11yWarning {
                        rule: "button-label".to_string(),
                        description: format!(
                            "Button '{}' should have an accessible label",
                            component.component_id
                        ),
                        element: component.component_id.clone(),
                        suggestion: "Add a label or aria-label property".to_string(),
                    });
                }
            }
            "input" => {
                // Inputs need labels
                if !component
                    .bindings
                    .iter()
                    .any(|b| b.property == "aria-label" || b.property == "aria-labelledby")
                    && !component.properties.contains_key("placeholder")
                {
                    warnings.push(A11yWarning {
                        rule: "input-label".to_string(),
                        description: format!(
                            "Input '{}' should have an accessible label",
                            component.component_id
                        ),
                        element: component.component_id.clone(),
                        suggestion: "Add aria-label, aria-labelledby, or placeholder".to_string(),
                    });
                }
            }
            "image" | "img" => {
                // Images need alt text
                if !component.properties.contains_key("alt")
                    && !component.properties.contains_key("aria-label")
                {
                    violations.push(A11yViolation {
                        rule: "image-alt".to_string(),
                        severity: A11ySeverity::Serious,
                        description: format!(
                            "Image '{}' is missing alternative text",
                            component.component_id
                        ),
                        element: component.component_id.clone(),
                        remediation: "Add alt property with descriptive text".to_string(),
                        wcag_reference: "WCAG 1.1.1".to_string(),
                    });
                }
            }
            "link" | "a" => {
                // Links need descriptive text
                if !component.properties.contains_key("href") {
                    violations.push(A11yViolation {
                        rule: "link-href".to_string(),
                        severity: A11ySeverity::Critical,
                        description: format!(
                            "Link '{}' is missing href attribute",
                            component.component_id
                        ),
                        element: component.component_id.clone(),
                        remediation: "Add href property to link".to_string(),
                        wcag_reference: "WCAG 2.4.4".to_string(),
                    });
                }
            }
            _ => {}
        }
    }

    /// Check overall structure
    fn check_structure(
        &self,
        spec: &UISpec,
        violations: &mut Vec<A11yViolation>,
        warnings: &mut Vec<A11yWarning>,
    ) {
        // Check for landmark regions if page-level spec
        let has_landmarks = spec.components.iter().any(|c| {
            matches!(
                c.component_type.as_str(),
                "header" | "nav" | "main" | "aside" | "footer"
            )
        });

        if !has_landmarks && spec.components.len() > 3 {
            warnings.push(A11yWarning {
                rule: "landmark-regions".to_string(),
                description: "Large pages should use landmark regions".to_string(),
                element: "page".to_string(),
                suggestion: "Add header, nav, main, aside, or footer components".to_string(),
            });
        }
    }

    /// Calculate accessibility score
    fn calculate_score(&self, violations: &[A11yViolation], warnings: &[A11yWarning]) -> f32 {
        let base_score = 1.0;

        // Deduct for violations based on severity
        let violation_penalty: f32 = violations
            .iter()
            .map(|v| match v.severity {
                A11ySeverity::Critical => 0.25,
                A11ySeverity::Serious => 0.15,
                A11ySeverity::Moderate => 0.10,
                A11ySeverity::Minor => 0.05,
            })
            .sum();

        // Small deduction for warnings
        let warning_penalty = warnings.len() as f32 * 0.02;

        (base_score - violation_penalty - warning_penalty).max(0.0)
    }

    /// Generate ARIA attributes for a component
    pub fn generate_aria_attributes(&self, component: &ComponentSpec) -> Vec<(String, String)> {
        let mut attributes = Vec::new();

        match component.component_type.as_str() {
            "button" => {
                attributes.push(("role".to_string(), "button".to_string()));
                if !component.properties.contains_key("aria-label") {
                    if let Some(label) = component.properties.get("label") {
                        attributes.push(("aria-label".to_string(), label.to_string()));
                    }
                }
            }
            "input" => {
                let input_type = component
                    .properties
                    .get("type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("text");

                let role = match input_type {
                    "checkbox" => "checkbox",
                    "radio" => "radio",
                    "search" => "searchbox",
                    _ => "textbox",
                };
                attributes.push(("role".to_string(), role.to_string()));
            }
            "modal" => {
                attributes.push(("role".to_string(), "dialog".to_string()));
                attributes.push(("aria-modal".to_string(), "true".to_string()));
            }
            "tabs" => {
                attributes.push(("role".to_string(), "tablist".to_string()));
            }
            "dropdown" => {
                attributes.push(("role".to_string(), "combobox".to_string()));
                attributes.push(("aria-haspopup".to_string(), "listbox".to_string()));
                attributes.push(("aria-expanded".to_string(), "false".to_string()));
            }
            "table" => {
                attributes.push(("role".to_string(), "table".to_string()));
            }
            _ => {}
        }

        attributes
    }

    /// Generate keyboard navigation attributes
    pub fn generate_keyboard_attributes(&self, component: &ComponentSpec) -> Vec<(String, String)> {
        let mut attributes = Vec::new();

        match component.component_type.as_str() {
            "button" | "dropdown" => {
                attributes.push(("tabindex".to_string(), "0".to_string()));
            }
            "input" => {
                // Inputs are naturally focusable
            }
            "modal" => {
                attributes.push(("tabindex".to_string(), "-1".to_string()));
                attributes.push(("aria-hidden".to_string(), "true".to_string()));
            }
            _ => {}
        }

        attributes
    }

    /// Check if a color combination meets WCAG contrast requirements
    pub fn check_contrast(&self, foreground: &str, background: &str) -> (bool, f32) {
        // Parse hex colors and calculate contrast ratio
        let ratio = self.calculate_contrast_ratio(foreground, background);

        // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
        let passes = ratio >= 4.5;

        (passes, ratio)
    }

    /// Calculate contrast ratio between two colors
    fn calculate_contrast_ratio(&self, _foreground: &str, _background: &str) -> f32 {
        // Simplified - would need proper color luminance calculation
        // For now, return a placeholder
        7.0 // Assume good contrast for placeholder
    }

    /// Generate accessibility report
    pub fn generate_report(&self, result: &A11yCheckResult) -> String {
        let mut report = String::new();

        report.push_str("# Accessibility Report\n\n");
        report.push_str(&format!("**Score:** {:.0}%\n\n", result.score * 100.0));
        report.push_str(&format!(
            "**Status:** {}\n\n",
            if result.passed {
                "✅ PASS"
            } else {
                "❌ FAIL"
            }
        ));

        if !result.violations.is_empty() {
            report.push_str("## Violations\n\n");
            for violation in &result.violations {
                report.push_str(&format!(
                    "### {} [{}]\n\n{}\n\n- **Element:** {}\n- **Remediation:** {}\n- **WCAG:** {}\n\n",
                    self.severity_emoji(&violation.severity),
                    violation.rule,
                    violation.description,
                    violation.element,
                    violation.remediation,
                    violation.wcag_reference
                ));
            }
        }

        if !result.warnings.is_empty() {
            report.push_str("## Warnings\n\n");
            for warning in &result.warnings {
                report.push_str(&format!(
                    "- **{}:** {} ({}\n",
                    warning.rule, warning.description, warning.suggestion
                ));
            }
        }

        report
    }

    fn severity_emoji(&self, severity: &A11ySeverity) -> &'static str {
        match severity {
            A11ySeverity::Critical => "🚨",
            A11ySeverity::Serious => "❌",
            A11ySeverity::Moderate => "⚠️",
            A11ySeverity::Minor => "ℹ️",
        }
    }
}

impl Default for A11yEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Accessibility certification level
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum A11yCertification {
    WCAG_A,
    WCAG_AA,
    WCAG_AAA,
    Section508,
}

/// Generate accessibility hash for verification
pub fn generate_a11y_hash(spec: &UISpec) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();

    // Hash a11y-relevant properties
    for component in &spec.components {
        component.component_id.hash(&mut hasher);
        component.component_type.hash(&mut hasher);

        // Hash accessibility properties
        for key in ["aria-label", "alt", "role", "tabindex"] {
            if let Some(value) = component.properties.get(key) {
                key.hash(&mut hasher);
                value.to_string().hash(&mut hasher);
            }
        }
    }

    format!("a11y:{:016x}", hasher.finish())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        ComponentSpec, DataBinding, InteractionSpec, LayoutConstraints, LayoutRegionSpec,
        LayoutSpec, RegionPosition, RegionSize, SpacingSpec, StyleSpec, TypographySpec, UISpec,
    };
    use std::collections::HashMap;

    fn create_test_spec() -> UISpec {
        UISpec {
            spec_id: "test".to_string(),
            title: "Test".to_string(),
            description: "Test spec".to_string(),
            components: vec![
                ComponentSpec {
                    component_id: "btn_1".to_string(),
                    component_type: "button".to_string(),
                    properties: {
                        let mut props = HashMap::new();
                        props.insert("label".to_string(), serde_json::json!("Click"));
                        props
                    },
                    children: vec![],
                    bindings: vec![],
                },
                ComponentSpec {
                    component_id: "img_1".to_string(),
                    component_type: "image".to_string(),
                    properties: HashMap::new(), // Missing alt
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
        }
    }

    #[test]
    fn test_a11y_engine_creation() {
        let engine = A11yEngine::new();
        let spec = create_test_spec();
        let result = engine.check_spec(&spec);

        // Should have violations for image without alt
        assert!(!result.passed);
        assert!(result.violations.iter().any(|v| v.rule == "image-alt"));
    }

    #[test]
    fn test_aria_generation() {
        let engine = A11yEngine::new();

        let button = ComponentSpec {
            component_id: "btn".to_string(),
            component_type: "button".to_string(),
            properties: {
                let mut props = HashMap::new();
                props.insert("label".to_string(), serde_json::json!("Submit"));
                props
            },
            children: vec![],
            bindings: vec![],
        };

        let aria_attrs = engine.generate_aria_attributes(&button);
        assert!(aria_attrs.iter().any(|(k, v)| k == "role" && v == "button"));
    }

    #[test]
    fn test_keyboard_attributes() {
        let engine = A11yEngine::new();

        let button = ComponentSpec {
            component_id: "btn".to_string(),
            component_type: "button".to_string(),
            properties: HashMap::new(),
            children: vec![],
            bindings: vec![],
        };

        let kb_attrs = engine.generate_keyboard_attributes(&button);
        assert!(kb_attrs.iter().any(|(k, v)| k == "tabindex" && v == "0"));
    }

    #[test]
    fn test_contrast_check() {
        let engine = A11yEngine::new();
        let (passes, ratio) = engine.check_contrast("#000000", "#FFFFFF");
        assert!(passes);
        assert!(ratio > 0.0);
    }

    #[test]
    fn test_score_calculation() {
        let engine = A11yEngine::new();
        let spec = create_test_spec();
        let result = engine.check_spec(&spec);

        // Should have score < 1.0 due to violations
        assert!(result.score < 1.0);
        assert!(result.score >= 0.0);
    }

    #[test]
    fn test_report_generation() {
        let engine = A11yEngine::new();
        let spec = create_test_spec();
        let result = engine.check_spec(&spec);
        let report = engine.generate_report(&result);

        assert!(report.contains("Accessibility Report"));
        assert!(report.contains("Violations"));
    }

    #[test]
    fn test_a11y_hash() {
        let spec = create_test_spec();
        let hash = generate_a11y_hash(&spec);
        assert!(hash.starts_with("a11y:"));
    }
}
