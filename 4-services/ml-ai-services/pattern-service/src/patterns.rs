use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::error::{PKError, Result};

pub type PatternId = String;

#[derive(Debug, Clone, Serialize, Deserialize, Hash, Eq, PartialEq)]
pub enum PatternStatus {
    Draft = "draft",
    Tested = "tested",
    Active = "active",
    Deprecated = "deprecated",
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternSpec {
    pub pattern_id: PatternId,
    pub intent_class: String,
    pub trigger_signals: Vec<String>,
    pub inputs_schema: serde_json::Value,
    pub tool_plan_template: serde_json::Value,
    pub control_flow: serde_json::Value,
    pub guardrails: serde_json::Value,
    pub eval_suite: Vec<String>,
    pub status: PatternStatus,
    pub reliability: f32,
    pub sample_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub pattern_id: PatternId,
    pub reliability: f32,
    pub tests_passed: bool,
    pub sample_count: u32,
}

pub struct Embedding {
    vector: Vec<f32>,
}

pub struct EmbeddingEngine {
    patterns: HashMap<String, Embedding>,
}

impl EmbeddingEngine {
    pub fn new() -> Self {
        Self {
            patterns: HashMap::new(),
        }
    }

    pub fn register_pattern(&mut self, pattern_id: String, embedding: Embedding) {
        self.patterns.insert(pattern_id, embedding);
    }

    pub fn compute_similarity(&self, input: &str, pattern_id: &str) -> Result<f32> {
        let pattern_opt = self.patterns.get(pattern_id);

        if let Some(embedding) = pattern_opt {
            let similarity = embedding.vector.iter()
                .zip(input.chars())
                .map(|(input_char, pattern_char)| {
                    if input_char == pattern_char { 1.0 } else { 0.0 }
                })
                .map(|sim| sim * sim)
                .sum::<f32>()
                / (embedding.vector.len() as f32).powi(2);

            Ok(similarity)
        } else {
            Err(PKError::PatternNotFound(pattern_id.to_string()))
        }
    }
}
