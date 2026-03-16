use crate::error::Result;
use crate::types::{
    ColorSemantics, IntentPattern, InteractionSpec, MotionSpec, RiskLevel, SpatialRules,
};
use std::collections::HashMap;

#[derive(Clone)]
pub struct InteractionGenerator {
    patterns: HashMap<String, IntentPattern>,
}

impl Default for InteractionGenerator {
    fn default() -> Self {
        Self::new()
    }
}

impl InteractionGenerator {
    pub fn new() -> Self {
        Self {
            patterns: HashMap::new(),
        }
    }

    pub fn register_pattern(&mut self, trigger: &str, pattern: IntentPattern) -> Result<()> {
        self.patterns.insert(trigger.to_string(), pattern);
        Ok(())
    }

    pub fn get_all_patterns(&self) -> Result<Vec<IntentPattern>> {
        Ok(self.patterns.values().cloned().collect())
    }

    pub fn generate_interaction_spec(&self, canvas_type: &str) -> Result<InteractionSpec> {
        Ok(InteractionSpec {
            motion: MotionSpec {
                weight: 1.0,
                resistance: 0.3,
                continuity: 0.8,
            },
            color_semantics: ColorSemantics {
                risk: RiskLevel::Read,
                confidence: 1.0,
            },
            spatial_rules: SpatialRules {
                layout_preference: String::from("stacked"),
                interaction_model: String::from("point"),
            },
        })
    }
}
