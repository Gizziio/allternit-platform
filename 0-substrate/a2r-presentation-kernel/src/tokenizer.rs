use crate::error::Result;
use crate::types::{IntentPattern, IntentToken};
use std::collections::HashMap;

#[derive(Clone)]
pub struct IntentTokenizer {
    patterns: HashMap<String, IntentPattern>,
}

impl Default for IntentTokenizer {
    fn default() -> Self {
        Self::new()
    }
}

impl IntentTokenizer {
    pub fn new() -> Self {
        Self {
            patterns: HashMap::new(),
        }
    }

    pub fn register_pattern(&mut self, trigger: String, pattern: IntentPattern) {
        self.patterns.insert(trigger, pattern);
    }

    pub async fn tokenize(&self, input: &str) -> Result<Vec<IntentToken>> {
        let mut tokens = Vec::new();

        for (trigger, pattern) in &self.patterns {
            if input.to_lowercase().contains(&trigger.to_lowercase()) {
                tokens.push(IntentToken {
                    r#type: pattern.token_type.clone(),
                    value: input.to_string(),
                    confidence: pattern.confidence.unwrap_or(1.0),
                });
            }
        }

        Ok(tokens)
    }
}
