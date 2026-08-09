//! Built-in evaluation metrics library.
//!
//! Stateless scorers used by the eval framework and admin API. All metrics
//! return a score in the range [0.0, 1.0] where higher is better.
//!
//! Available metrics:
//! - `exact_match`: normalized string equality.
//! - `contains`: case-insensitive substring match.
//! - `token_overlap`: token-set F1 score.
//! - `cosine_similarity`: cosine similarity over term-frequency vectors.
//! - `rouge_l`: ROUGE-L F1 based on longest common subsequence of tokens.
//! - `llm_as_judge`: placeholder that returns a structured rubric score
//!   (no external LLM call in this implementation).

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

/// Tokenize text into lowercase alphanumeric tokens, dropping short words.
pub fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty() && s.len() > 2)
        .collect()
}

fn normalize(text: &str) -> String {
    text.trim().to_lowercase()
}

/// Exact normalized string match.
pub fn exact_match(prediction: &str, reference: &str) -> f64 {
    if normalize(prediction) == normalize(reference) {
        1.0
    } else {
        0.0
    }
}

/// Case-insensitive substring match of the reference inside the prediction.
pub fn contains(prediction: &str, reference: &str) -> f64 {
    if normalize(prediction).contains(&normalize(reference)) {
        1.0
    } else {
        0.0
    }
}

/// Token-set F1 score.
pub fn token_overlap(prediction: &str, reference: &str) -> f64 {
    let pred_tokens: std::collections::HashSet<String> = tokenize(prediction).into_iter().collect();
    let ref_tokens: std::collections::HashSet<String> = tokenize(reference).into_iter().collect();
    if pred_tokens.is_empty() && ref_tokens.is_empty() {
        return 1.0;
    }
    if pred_tokens.is_empty() || ref_tokens.is_empty() {
        return 0.0;
    }
    let intersection: std::collections::HashSet<_> =
        pred_tokens.intersection(&ref_tokens).cloned().collect();
    let precision = intersection.len() as f64 / pred_tokens.len() as f64;
    let recall = intersection.len() as f64 / ref_tokens.len() as f64;
    if precision + recall == 0.0 {
        0.0
    } else {
        (2.0 * precision * recall) / (precision + recall)
    }
}

fn term_frequency(tokens: &[String]) -> HashMap<String, f64> {
    let mut freq = HashMap::new();
    for token in tokens {
        *freq.entry(token.clone()).or_insert(0.0) += 1.0;
    }
    freq
}

/// Cosine similarity over term-frequency vectors built from tokenized text.
pub fn cosine_similarity(prediction: &str, reference: &str) -> f64 {
    let pred_tokens = tokenize(prediction);
    let ref_tokens = tokenize(reference);
    if pred_tokens.is_empty() && ref_tokens.is_empty() {
        return 1.0;
    }
    if pred_tokens.is_empty() || ref_tokens.is_empty() {
        return 0.0;
    }
    let pred_tf = term_frequency(&pred_tokens);
    let ref_tf = term_frequency(&ref_tokens);

    let mut dot = 0.0;
    let mut pred_norm_sq = 0.0;
    for (term, count) in &pred_tf {
        pred_norm_sq += count * count;
        if let Some(ref_count) = ref_tf.get(term) {
            dot += count * ref_count;
        }
    }
    let mut ref_norm_sq = 0.0;
    for count in ref_tf.values() {
        ref_norm_sq += count * count;
    }
    let denom = (pred_norm_sq.sqrt() * ref_norm_sq.sqrt()).max(0.0);
    if denom == 0.0 {
        0.0
    } else {
        (dot / denom).clamp(0.0, 1.0)
    }
}

fn lcs_length(a: &[String], b: &[String]) -> usize {
    if a.is_empty() || b.is_empty() {
        return 0;
    }
    let mut prev = vec![0usize; b.len() + 1];
    let mut curr = vec![0usize; b.len() + 1];
    for i in 1..=a.len() {
        for j in 1..=b.len() {
            if a[i - 1] == b[j - 1] {
                curr[j] = prev[j - 1] + 1;
            } else {
                curr[j] = curr[j - 1].max(prev[j]);
            }
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[b.len()]
}

/// Simplified ROUGE-L F1 score over token sequences.
pub fn rouge_l(prediction: &str, reference: &str) -> f64 {
    let pred_tokens = tokenize(prediction);
    let ref_tokens = tokenize(reference);
    if pred_tokens.is_empty() && ref_tokens.is_empty() {
        return 1.0;
    }
    if pred_tokens.is_empty() || ref_tokens.is_empty() {
        return 0.0;
    }
    let lcs = lcs_length(&pred_tokens, &ref_tokens);
    let precision = lcs as f64 / pred_tokens.len() as f64;
    let recall = lcs as f64 / ref_tokens.len() as f64;
    if precision + recall == 0.0 {
        0.0
    } else {
        (2.0 * precision * recall) / (precision + recall)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BuiltinMetric {
    ExactMatch,
    Contains,
    TokenOverlap,
    CosineSimilarity,
    RougeL,
    LlmAsJudge,
}

impl BuiltinMetric {
    pub fn as_str(&self) -> &'static str {
        match self {
            BuiltinMetric::ExactMatch => "exact_match",
            BuiltinMetric::Contains => "contains",
            BuiltinMetric::TokenOverlap => "token_overlap",
            BuiltinMetric::CosineSimilarity => "cosine_similarity",
            BuiltinMetric::RougeL => "rouge_l",
            BuiltinMetric::LlmAsJudge => "llm_as_judge",
        }
    }

    pub fn score(&self, prediction: &str, reference: &str) -> Value {
        match self {
            BuiltinMetric::ExactMatch => json!({"score": exact_match(prediction, reference)}),
            BuiltinMetric::Contains => json!({"score": contains(prediction, reference)}),
            BuiltinMetric::TokenOverlap => json!({"score": token_overlap(prediction, reference)}),
            BuiltinMetric::CosineSimilarity => {
                json!({"score": cosine_similarity(prediction, reference)})
            }
            BuiltinMetric::RougeL => json!({"score": rouge_l(prediction, reference)}),
            BuiltinMetric::LlmAsJudge => json!({
                "score": 0.0,
                "note": "LLM-as-judge requires an external evaluator; placeholder returned."
            }),
        }
    }
}

pub fn list_metrics() -> Value {
    json!({
        "items": [
            {
                "id": "exact_match",
                "name": "Exact match",
                "description": "Normalized string equality.",
                "range": [0.0, 1.0]
            },
            {
                "id": "contains",
                "name": "Contains",
                "description": "Case-insensitive substring match.",
                "range": [0.0, 1.0]
            },
            {
                "id": "token_overlap",
                "name": "Token overlap F1",
                "description": "Token-set F1 between prediction and reference.",
                "range": [0.0, 1.0]
            },
            {
                "id": "cosine_similarity",
                "name": "Cosine similarity",
                "description": "Cosine similarity over term-frequency vectors.",
                "range": [0.0, 1.0]
            },
            {
                "id": "rouge_l",
                "name": "ROUGE-L",
                "description": "Longest common subsequence F1 over tokens.",
                "range": [0.0, 1.0]
            },
            {
                "id": "llm_as_judge",
                "name": "LLM-as-judge",
                "description": "Rubric-based judge score from an external LLM (placeholder).",
                "range": [0.0, 1.0]
            }
        ]
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_match_normalizes_case_and_whitespace() {
        assert_eq!(exact_match("  Hello World  ", "hello world"), 1.0);
        assert_eq!(exact_match("hello", "world"), 0.0);
    }

    #[test]
    fn contains_is_case_insensitive() {
        assert_eq!(contains("The quick brown fox", "QUICK"), 1.0);
        assert_eq!(contains("The quick brown fox", "lazy"), 0.0);
    }

    #[test]
    fn token_overlap_f1() {
        // prediction and reference share "quick" and "fox" out of 3/3 tokens.
        let score = token_overlap("The quick brown fox", "A quick fox jumps");
        assert!(score > 0.5 && score < 0.8, "unexpected overlap {score}");
    }

    #[test]
    fn cosine_identical_texts() {
        let score = cosine_similarity("hello world", "hello world");
        assert!((score - 1.0).abs() < 1e-9, "expected ~1.0, got {score}");
    }

    #[test]
    fn rouge_l_partial_match() {
        let score = rouge_l("the cat sat on the mat", "the cat sat");
        assert!(score > 0.6 && score < 1.0, "unexpected rouge_l {score}");
    }

    #[test]
    fn lcs_length_works() {
        let a: Vec<String> = vec!["a".into(), "b".into(), "c".into()];
        let b: Vec<String> = vec!["a".into(), "b".into(), "d".into()];
        assert_eq!(lcs_length(&a, &b), 2);
    }

    #[test]
    fn empty_inputs_are_handled() {
        assert_eq!(token_overlap("", ""), 1.0);
        assert_eq!(token_overlap("hello", ""), 0.0);
        assert_eq!(cosine_similarity("", ""), 1.0);
        assert_eq!(rouge_l("hello", ""), 0.0);
    }
}
