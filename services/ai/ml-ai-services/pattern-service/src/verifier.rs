use std::collections::HashMap;
use crate::types::{PatternSpec, IntentPattern};
use crate::error::{PKError, Result};

pub struct VerificationEngine {
    patterns: HashMap<String, PatternSpec>,
}

impl VerificationEngine {
    pub fn new() -> Self {
        Self {
            patterns: HashMap::new(),
        }
    }

    pub fn register_pattern(&mut self, spec: PatternSpec) {
        self.patterns.insert(spec.trigger.to_lowercase(), spec);
    }

    pub async fn verify_pattern(&self, trigger: &str, sample_outputs: Vec<&str>) -> Result<VerificationResult> {
        match self.patterns.get(trigger.to_lowercase()) {
            Some(spec) => {
                let tests_passed = spec.eval_suite.iter().any(|test| sample_outputs.contains(test));

                let reliability = if !sample_outputs.is_empty() {
                    let successes = sample_outputs.iter().filter(|output| spec.eval_suite.contains(output)).count() as f32;
                    successes / sample_outputs.len() as f32
                } else {
                    0.0_f32
                };

                let result = VerificationResult {
                    pattern_id: spec.pattern_id,
                    reliability,
                    tests_passed,
                    sample_count: sample_outputs.len() as u32,
                };

                Ok(result)
            }
            None => Err(PKError::PatternNotFound(trigger.to_string())),
        }
    }

    pub async fn promote_pattern(&mut self, trigger: &str) -> Result<bool> {
        let spec_opt = self.patterns.get_mut(trigger.to_lowercase());

        if let Some(spec) = spec_opt {
            if spec.status == crate::types::PatternStatus::Tested && spec.reliability > 0.9 {
                spec.status = crate::types::PatternStatus::Active;
                Ok(true)
            } else {
                Err(PKError::ResolutionError(format!(
                    "Pattern cannot be promoted: current reliability {:.2}, required: 0.9",
                    spec.reliability
                )))
            }
        } else {
            Err(PKError::PatternNotFound(trigger.to_string()))
        }
    }

    pub fn get_all_patterns(&self) -> Vec<&PatternSpec> {
        self.patterns.values().collect()
    }
}
