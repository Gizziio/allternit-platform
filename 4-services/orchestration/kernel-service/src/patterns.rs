use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternSpec {
    pub pattern_id: String,
    pub intent_class: String,
    pub confidence_threshold: f64,
}

#[derive(Debug)]
pub struct PatternRegistry {
    patterns: HashMap<String, PatternSpec>,
}

impl PatternRegistry {
    pub fn new() -> Self {
        let mut patterns = HashMap::new();
        patterns.insert(
            "pattern_discovery".to_string(),
            PatternSpec {
                pattern_id: "pattern_discovery".to_string(),
                intent_class: "exploration".to_string(),
                confidence_threshold: 0.7,
            },
        );
        patterns.insert(
            "pattern_task".to_string(),
            PatternSpec {
                pattern_id: "pattern_task".to_string(),
                intent_class: "execution".to_string(),
                confidence_threshold: 0.8,
            },
        );
        Self { patterns }
    }

    pub fn match_pattern(&self, intent: &str) -> (String, f64) {
        let lower = intent.to_lowercase();
        if lower.contains("search") || lower.contains("find") || lower.contains("what is") {
            ("pattern_discovery".to_string(), 0.9)
        } else if lower.contains("note") || lower.contains("write") || lower.contains("create") {
            ("pattern_task".to_string(), 0.85)
        } else {
            ("pattern_unknown".to_string(), 0.5)
        }
    }

    pub fn abstract_pattern(&self, intent: &str, result: &str) -> serde_json::Value {
        // Architecture/UNIFIED/AGENTS/AdaptivePatterns.md: Transform evidence into pattern spec
        serde_json::json!({
            "pattern_id": format!("pattern_{}", uuid::Uuid::new_v4().to_string()[..8].to_string()),
            "intent_class": if intent.contains("search") { "discovery" } else { "execution" },
            "trigger_signals": [intent],
            "inputs_schema": { "type": "object" },
            "outputs_schema": { "type": "object" },
            "evidence": result
        })
    }
}
