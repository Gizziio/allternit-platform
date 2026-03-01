use crate::error::Result;
use crate::types::{CanvasSelection, CanvasSpec};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub struct CanvasSelector {
    patterns: HashMap<String, CanvasSelectionPattern>,
}

impl Default for CanvasSelector {
    fn default() -> Self {
        Self::new()
    }
}

impl CanvasSelector {
    pub fn new() -> Self {
        Self {
            patterns: HashMap::new(),
        }
    }

    pub fn register_pattern(&mut self, intent_pattern: &str, canvas_spec: CanvasSelectionPattern) {
        self.patterns
            .insert(intent_pattern.to_lowercase(), canvas_spec);
    }

    pub async fn select_canvas(
        &self,
        intent: &str,
        renderer_type: &str,
    ) -> Result<Option<CanvasSelection>> {
        let lower_intent = intent.to_lowercase();
        if let Some(pattern) = self.patterns.get(&lower_intent) {
            Ok(Some(CanvasSelection {
                canvas_spec: pattern.canvas_spec.clone(),
                primary: true,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn get_primary_canvas(&self, intent: &str) -> Result<Option<CanvasSelection>> {
        let lower_intent = intent.to_lowercase();
        if let Some(pattern) = self.patterns.get(&lower_intent) {
            Ok(Some(CanvasSelection {
                canvas_spec: pattern.canvas_spec.clone(),
                primary: true,
            }))
        } else {
            Ok(None)
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasSelectionPattern {
    pub trigger: String,
    pub canvas_spec: CanvasSpec,
}
