//! Layout Engine Module
//!
//! Generates layout from specifications.

use crate::{LayoutConstraints, LayoutRegionSpec, LayoutSpec, TamboError};

/// Responsive breakpoint
#[derive(Debug, Clone)]
pub struct Breakpoint {
    pub name: String,
    pub min_width: u32,
    pub max_width: Option<u32>,
}

/// Grid configuration
#[derive(Debug, Clone)]
pub struct GridConfig {
    pub columns: u32,
    pub gap: u32,
    pub responsive: Vec<ResponsiveColumn>,
}

/// Responsive column configuration
#[derive(Debug, Clone)]
pub struct ResponsiveColumn {
    pub breakpoint: String,
    pub columns: u32,
}

/// Generated layout
#[derive(Debug, Clone)]
pub struct Layout {
    pub container_class: String,
    pub regions: Vec<LayoutRegion>,
}

/// Generated layout region
#[derive(Debug, Clone)]
pub struct LayoutRegion {
    pub region_id: String,
    pub class_name: String,
    pub styles: String,
}

/// Layout engine
#[derive(Clone)]
pub struct LayoutEngine {
    prefix: String,
}

impl LayoutEngine {
    /// Create a new layout engine
    pub fn new() -> Self {
        Self {
            prefix: "layout".to_string(),
        }
    }

    /// Generate layout from spec
    pub fn generate(&self, spec: &LayoutSpec) -> Result<Layout, TamboError> {
        let container_class = format!("{}_container", self.prefix);
        let mut regions = Vec::new();

        for region_spec in &spec.regions {
            let region = self.generate_region(region_spec)?;
            regions.push(region);
        }

        Ok(Layout {
            container_class,
            regions,
        })
    }

    /// Generate a single region
    fn generate_region(&self, spec: &LayoutRegionSpec) -> Result<LayoutRegion, TamboError> {
        let class_name = format!("{}_{}", self.prefix, spec.region_id);
        let styles = self.generate_region_styles(spec);

        Ok(LayoutRegion {
            region_id: spec.region_id.clone(),
            class_name,
            styles,
        })
    }

    /// Generate CSS styles for a region
    fn generate_region_styles(&self, spec: &LayoutRegionSpec) -> String {
        format!(
            ".{} {{ position: absolute; left: {}px; top: {}px; width: {}px; height: {}px; }}",
            format!("{}_{}", self.prefix, spec.region_id),
            spec.position.x,
            spec.position.y,
            spec.size.width,
            spec.size.height,
        )
    }

    /// Generate constraint styles
    pub fn generate_constraint_styles(&self, constraints: &LayoutConstraints) -> String {
        let mut styles = Vec::new();

        if let Some(min_width) = constraints.min_width {
            styles.push(format!("min-width: {}px;", min_width));
        }
        if let Some(max_width) = constraints.max_width {
            styles.push(format!("max-width: {}px;", max_width));
        }
        if let Some(min_height) = constraints.min_height {
            styles.push(format!("min-height: {}px;", min_height));
        }
        if let Some(max_height) = constraints.max_height {
            styles.push(format!("max-height: {}px;", max_height));
        }

        styles.join(" ")
    }

    /// Generate grid layout styles
    pub fn generate_grid_styles(&self, config: &GridConfig) -> String {
        let base_styles = format!(
            "display: grid; grid-template-columns: repeat({}, 1fr); gap: {}px;",
            config.columns, config.gap
        );

        let mut responsive_styles = String::new();
        for resp in &config.responsive {
            let media_query = self.generate_media_query(&resp.breakpoint);
            let column_style = format!("grid-template-columns: repeat({}, 1fr);", resp.columns);
            responsive_styles.push_str(&format!(
                "{} {{ .{}_container {{ {} }} }}",
                media_query, self.prefix, column_style
            ));
        }

        format!(
            "{} {} .{}_container {{ {} }}",
            base_styles, responsive_styles, self.prefix, base_styles
        )
    }

    /// Generate media query for breakpoint
    fn generate_media_query(&self, breakpoint: &str) -> String {
        match breakpoint {
            "sm" => "@media (min-width: 640px)".to_string(),
            "md" => "@media (min-width: 768px)".to_string(),
            "lg" => "@media (min-width: 1024px)".to_string(),
            "xl" => "@media (min-width: 1280px)".to_string(),
            "2xl" => "@media (min-width: 1536px)".to_string(),
            _ => "@media (min-width: 768px)".to_string(),
        }
    }

    /// Generate flexbox layout styles
    pub fn generate_flex_styles(
        &self,
        direction: &str,
        justify: &str,
        align: &str,
        gap: u32,
    ) -> String {
        format!(
            "display: flex; flex-direction: {}; justify-content: {}; align-items: {}; gap: {}px;",
            direction, justify, align, gap
        )
    }

    /// Get standard breakpoints
    pub fn standard_breakpoints() -> Vec<Breakpoint> {
        vec![
            Breakpoint {
                name: "sm".to_string(),
                min_width: 640,
                max_width: Some(767),
            },
            Breakpoint {
                name: "md".to_string(),
                min_width: 768,
                max_width: Some(1023),
            },
            Breakpoint {
                name: "lg".to_string(),
                min_width: 1024,
                max_width: Some(1279),
            },
            Breakpoint {
                name: "xl".to_string(),
                min_width: 1280,
                max_width: Some(1535),
            },
            Breakpoint {
                name: "2xl".to_string(),
                min_width: 1536,
                max_width: None,
            },
        ]
    }
}

impl Default for LayoutEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{RegionPosition, RegionSize};

    #[test]
    fn test_layout_engine_creation() {
        let engine = LayoutEngine::new();
        assert_eq!(engine.prefix, "layout");
    }

    #[test]
    fn test_layout_generation() {
        let engine = LayoutEngine::new();
        let spec = LayoutSpec {
            layout_type: "flex".to_string(),
            constraints: LayoutConstraints::default(),
            regions: vec![LayoutRegionSpec {
                region_id: "header".to_string(),
                region_type: "header".to_string(),
                position: RegionPosition { x: 0.0, y: 0.0 },
                size: RegionSize {
                    width: 100.0,
                    height: 10.0,
                },
            }],
        };

        let layout = engine.generate(&spec).unwrap();
        assert_eq!(layout.container_class, "layout_container");
        assert_eq!(layout.regions.len(), 1);
        assert_eq!(layout.regions[0].region_id, "header");
    }

    #[test]
    fn test_region_generation() {
        let engine = LayoutEngine::new();
        let spec = LayoutRegionSpec {
            region_id: "sidebar".to_string(),
            region_type: "sidebar".to_string(),
            position: RegionPosition { x: 0.0, y: 10.0 },
            size: RegionSize {
                width: 20.0,
                height: 80.0,
            },
        };

        let region = engine.generate_region(&spec).unwrap();
        assert_eq!(region.region_id, "sidebar");
        assert!(region.class_name.contains("sidebar"));
    }

    #[test]
    fn test_constraint_styles() {
        let engine = LayoutEngine::new();
        let constraints = LayoutConstraints {
            min_width: Some(320),
            max_width: Some(1920),
            min_height: Some(200),
            max_height: Some(1080),
        };

        let styles = engine.generate_constraint_styles(&constraints);
        assert!(styles.contains("min-width: 320px"));
        assert!(styles.contains("max-width: 1920px"));
        assert!(styles.contains("min-height: 200px"));
        assert!(styles.contains("max-height: 1080px"));
    }

    #[test]
    fn test_empty_constraints() {
        let engine = LayoutEngine::new();
        let constraints = LayoutConstraints::default();

        let styles = engine.generate_constraint_styles(&constraints);
        assert!(styles.is_empty());
    }

    #[test]
    fn test_layout_region_styles() {
        let engine = LayoutEngine::new();
        let spec = LayoutRegionSpec {
            region_id: "footer".to_string(),
            region_type: "footer".to_string(),
            position: RegionPosition { x: 0.0, y: 90.0 },
            size: RegionSize {
                width: 100.0,
                height: 10.0,
            },
        };

        let styles = engine.generate_region_styles(&spec);
        assert!(styles.contains(".layout_footer"));
        assert!(styles.contains("left: 0px"));
        assert!(styles.contains("top: 90px"));
    }

    #[test]
    fn test_grid_styles_generation() {
        let engine = LayoutEngine::new();
        let config = GridConfig {
            columns: 3,
            gap: 16,
            responsive: vec![
                ResponsiveColumn {
                    breakpoint: "md".to_string(),
                    columns: 2,
                },
                ResponsiveColumn {
                    breakpoint: "lg".to_string(),
                    columns: 4,
                },
            ],
        };

        let styles = engine.generate_grid_styles(&config);
        assert!(styles.contains("display: grid"));
        assert!(styles.contains("grid-template-columns: repeat(3, 1fr)"));
        assert!(styles.contains("gap: 16px"));
        assert!(styles.contains("@media (min-width: 768px)"));
        assert!(styles.contains("@media (min-width: 1024px)"));
    }

    #[test]
    fn test_flex_styles_generation() {
        let engine = LayoutEngine::new();
        let styles = engine.generate_flex_styles("row", "center", "stretch", 8);

        assert!(styles.contains("display: flex"));
        assert!(styles.contains("flex-direction: row"));
        assert!(styles.contains("justify-content: center"));
        assert!(styles.contains("align-items: stretch"));
        assert!(styles.contains("gap: 8px"));
    }

    #[test]
    fn test_standard_breakpoints() {
        let breakpoints = LayoutEngine::standard_breakpoints();

        assert_eq!(breakpoints.len(), 5);
        assert_eq!(breakpoints[0].name, "sm");
        assert_eq!(breakpoints[0].min_width, 640);
        assert_eq!(breakpoints[2].name, "lg");
        assert_eq!(breakpoints[2].min_width, 1024);
    }
}
