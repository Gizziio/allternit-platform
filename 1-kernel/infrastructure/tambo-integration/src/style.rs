//! Style Engine Module
//!
//! Generates CSS styles from specifications.

use crate::{StyleSpec, TamboError};

/// Generated style
#[derive(Debug, Clone)]
pub struct Style {
    pub css: String,
}

/// Style engine
#[derive(Clone)]
pub struct StyleEngine {
    css_variables: bool,
}

impl StyleEngine {
    /// Create a new style engine
    pub fn new() -> Self {
        Self {
            css_variables: true,
        }
    }

    /// Generate styles from spec
    pub fn generate(&self, spec: &StyleSpec) -> Result<Style, TamboError> {
        let mut css = String::new();

        // Generate CSS variables
        if self.css_variables {
            css.push_str(":root {\n");

            // Colors
            for (name, value) in &spec.colors {
                css.push_str(&format!("  --color-{}: {};\n", name, value));
            }

            // Font sizes
            for (name, size) in &spec.typography.font_sizes {
                css.push_str(&format!("  --font-size-{}: {}px;\n", name, size));
            }

            // Spacing
            for (i, space) in spec.spacing.scale.iter().enumerate() {
                css.push_str(&format!(
                    "  --space-{}: {}{};\n",
                    i, space, spec.spacing.unit
                ));
            }

            css.push_str("}\n\n");
        }

        // Generate typography styles
        css.push_str(&self.generate_typography(&spec.typography));

        // Generate theme-specific styles
        css.push_str(&self.generate_theme_styles(&spec.theme));

        Ok(Style { css })
    }

    /// Generate typography styles
    fn generate_typography(&self, typography: &crate::TypographySpec) -> String {
        let mut css = String::new();

        css.push_str("body {\n");
        css.push_str(&format!("  font-family: {};\n", typography.font_family));
        css.push_str("}\n\n");

        for (name, size) in &typography.font_sizes {
            css.push_str(&format!(".text-{} {{ font-size: {}px; }}\n", name, size));
        }

        css
    }

    /// Generate theme-specific styles
    fn generate_theme_styles(&self, theme: &str) -> String {
        match theme {
            "dark" => {
                let mut css = String::new();
                css.push_str(".theme-dark {\n");
                css.push_str("  background-color: #1a1a1a;\n");
                css.push_str("  color: #ffffff;\n");
                css.push_str("}\n");
                css
            }
            "light" => {
                let mut css = String::new();
                css.push_str(".theme-light {\n");
                css.push_str("  background-color: #ffffff;\n");
                css.push_str("  color: #1a1a1a;\n");
                css.push_str("}\n");
                css
            }
            _ => String::new(),
        }
    }

    /// Generate Tailwind CSS config
    pub fn generate_tailwind_config(&self, spec: &StyleSpec) -> String {
        let mut config = String::new();

        config.push_str("module.exports = {\n");
        config.push_str("  content: ['./src/**/*.{js,jsx,ts,tsx}'],\n");
        config.push_str("  theme: {\n");
        config.push_str("    extend: {\n");

        // Colors
        config.push_str("      colors: {\n");
        for (name, value) in &spec.colors {
            config.push_str(&format!("        '{}': '{}',\n", name, value));
        }
        config.push_str("      },\n");

        // Font sizes
        config.push_str("      fontSize: {\n");
        for (name, size) in &spec.typography.font_sizes {
            config.push_str(&format!("        '{}': '{}px',\n", name, size));
        }
        config.push_str("      },\n");

        // Spacing
        config.push_str("      spacing: {\n");
        for (i, space) in spec.spacing.scale.iter().enumerate() {
            config.push_str(&format!(
                "        '{}': '{}{}',\n",
                i, space, spec.spacing.unit
            ));
        }
        config.push_str("      },\n");

        config.push_str("    },\n");
        config.push_str("  },\n");
        config.push_str("  plugins: [],\n");
        config.push_str("};\n");

        config
    }

    /// Convert style spec to Tailwind classes
    pub fn to_tailwind_classes(&self, spec: &StyleSpec) -> Vec<String> {
        let mut classes = vec!["bg-white".to_string()];

        // Theme-based classes
        if spec.theme.as_str() == "dark" {
            classes.push("dark".to_string())
        }

        // Typography
        if !spec.typography.font_family.is_empty() {
            classes.push(format!("font-[{}]", spec.typography.font_family));
        }

        // Spacing utilities
        for (i, _space) in spec.spacing.scale.iter().enumerate() {
            classes.push(format!("m-{}", i));
        }

        classes
    }

    /// Generate CSS-in-JS (styled-components/emotion)
    pub fn generate_css_in_js(&self, spec: &StyleSpec, component_name: &str) -> String {
        let mut code = String::new();

        code.push_str(&format!("const {} = styled.div`\n", component_name));

        // Theme colors
        code.push_str("  ${props => props.theme.colors && `\n");
        for (name, value) in &spec.colors {
            code.push_str(&format!("    --color-{}: {};\n", name, value));
        }
        code.push_str("  `}\n\n");

        // Typography
        code.push_str(&format!(
            "  font-family: {};\n",
            spec.typography.font_family
        ));

        // Spacing
        code.push_str("  ${props => props.theme.spacing && `\n");
        for (i, space) in spec.spacing.scale.iter().enumerate() {
            code.push_str(&format!(
                "    --space-{}: {}{};\n",
                i, space, spec.spacing.unit
            ));
        }
        code.push_str("  `}\n");

        code.push_str("`;\n");

        code
    }
}

impl Default for StyleEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{SpacingSpec, TypographySpec};
    use std::collections::HashMap;

    #[test]
    fn test_style_engine_creation() {
        let engine = StyleEngine::new();
        assert!(engine.css_variables);
    }

    #[test]
    fn test_style_generation() {
        let engine = StyleEngine::new();
        let mut colors = HashMap::new();
        colors.insert("primary".to_string(), "#3b82f6".to_string());

        let mut font_sizes = HashMap::new();
        font_sizes.insert("base".to_string(), 16);

        let spec = StyleSpec {
            theme: "light".to_string(),
            colors,
            typography: TypographySpec {
                font_family: "Arial".to_string(),
                font_sizes,
                line_heights: HashMap::new(),
            },
            spacing: SpacingSpec {
                scale: vec![4, 8, 16],
                unit: "px".to_string(),
            },
        };

        let style = engine.generate(&spec).unwrap();
        assert!(style.css.contains(":root"));
        assert!(style.css.contains("--color-primary"));
        assert!(style.css.contains("font-family: Arial"));
    }

    #[test]
    fn test_typography_generation() {
        let engine = StyleEngine::new();
        let typography = TypographySpec {
            font_family: "Inter".to_string(),
            font_sizes: HashMap::new(),
            line_heights: HashMap::new(),
        };

        let css = engine.generate_typography(&typography);
        assert!(css.contains("font-family: Inter"));
    }

    #[test]
    fn test_dark_theme_generation() {
        let engine = StyleEngine::new();
        let css = engine.generate_theme_styles("dark");
        assert!(css.contains(".theme-dark"));
        assert!(css.contains("#1a1a1a"));
    }

    #[test]
    fn test_light_theme_generation() {
        let engine = StyleEngine::new();
        let css = engine.generate_theme_styles("light");
        assert!(css.contains(".theme-light"));
        assert!(css.contains("#ffffff"));
    }

    #[test]
    fn test_unknown_theme() {
        let engine = StyleEngine::new();
        let css = engine.generate_theme_styles("unknown");
        assert!(css.is_empty());
    }

    #[test]
    fn test_tailwind_config_generation() {
        let engine = StyleEngine::new();
        let mut colors = HashMap::new();
        colors.insert("primary".to_string(), "#3b82f6".to_string());

        let mut font_sizes = HashMap::new();
        font_sizes.insert("lg".to_string(), 18);

        let spec = StyleSpec {
            theme: "light".to_string(),
            colors,
            typography: TypographySpec {
                font_family: "Inter".to_string(),
                font_sizes,
                line_heights: HashMap::new(),
            },
            spacing: SpacingSpec {
                scale: vec![4, 8, 16],
                unit: "px".to_string(),
            },
        };

        let config = engine.generate_tailwind_config(&spec);
        assert!(config.contains("module.exports"));
        assert!(config.contains("primary"));
        assert!(config.contains("#3b82f6"));
        assert!(config.contains("fontSize"));
        assert!(config.contains("18px"));
    }

    #[test]
    fn test_tailwind_classes() {
        let engine = StyleEngine::new();
        let mut colors = HashMap::new();
        colors.insert("primary".to_string(), "#3b82f6".to_string());

        let spec = StyleSpec {
            theme: "dark".to_string(),
            colors,
            typography: TypographySpec {
                font_family: "Inter".to_string(),
                font_sizes: HashMap::new(),
                line_heights: HashMap::new(),
            },
            spacing: SpacingSpec {
                scale: vec![4, 8, 16],
                unit: "px".to_string(),
            },
        };

        let classes = engine.to_tailwind_classes(&spec);
        assert!(classes.contains(&"dark".to_string()));
        assert!(classes.contains(&"bg-white".to_string()));
    }

    #[test]
    fn test_css_in_js_generation() {
        let engine = StyleEngine::new();
        let mut colors = HashMap::new();
        colors.insert("primary".to_string(), "#3b82f6".to_string());

        let spec = StyleSpec {
            theme: "light".to_string(),
            colors,
            typography: TypographySpec {
                font_family: "Inter".to_string(),
                font_sizes: HashMap::new(),
                line_heights: HashMap::new(),
            },
            spacing: SpacingSpec {
                scale: vec![4, 8, 16],
                unit: "px".to_string(),
            },
        };

        let css_in_js = engine.generate_css_in_js(&spec, "Container");
        assert!(css_in_js.contains("const Container = styled.div"));
        assert!(css_in_js.contains("Inter"));
        assert!(css_in_js.contains("primary"));
    }
}
