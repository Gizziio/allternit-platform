use std::collections::HashMap;
use crate::types::{PatternSpec, IntentPattern};
use crate::error::{PKError, Result};

pub struct EmbeddingEngine {
    patterns: HashMap<String, Vec<f32>>,
}

impl EmbeddingEngine {
    pub fn new() -> Self {
        Self {
            patterns: HashMap::new(),
        }
    }

    pub fn register_pattern(&mut self, pattern: &PatternSpec, embedding: Vec<f32>) {
        self.patterns.insert(pattern.trigger.to_lowercase(), embedding);
    }

    pub async fn compute_similarity(&self, input: &str, threshold: f32) -> Result<Option<(String, f32)>> {
        let mut best_match: Option<(String, f32)> = None;
        let mut best_score: threshold;

        for (trigger, patterns) in &self.patterns.iter() {
            if input.to_lowercase().contains(trigger) {
                for embedding in patterns {
                    let score = embedding.iter().map(|&e| (e - embedding).powi(2)).sum::<f32>().sqrt();

                    if score > best_score && score < threshold {
                        best_score = score;
                        best_match = Some((trigger.clone(), score));
                    }
                }
            }
        }

        Ok(best_match)
    }
}
