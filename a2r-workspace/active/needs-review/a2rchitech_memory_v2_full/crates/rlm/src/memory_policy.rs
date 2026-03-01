use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryPolicyInput {
    pub tenant_id: String,
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub user_query: String,
    pub candidate_write_count: usize,
    pub candidate_retrieval_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryPolicyOutput {
    pub write_strength: f64,
    pub recency_bias: f64,
    pub confidence_bias: f64,
    pub memory_budget: usize,
    pub decay_aggressiveness: f64,
}

pub trait MemoryPolicy: Send + Sync {
    fn decide(&self, input: MemoryPolicyInput) -> MemoryPolicyOutput;
}

pub struct DefaultMemoryPolicy;

impl MemoryPolicy for DefaultMemoryPolicy {
    fn decide(&self, input: MemoryPolicyInput) -> MemoryPolicyOutput {
        let q = input.user_query.to_lowercase();
        let recall = q.contains("remember") || q.contains("what did i tell you");
        MemoryPolicyOutput {
            write_strength: if recall { 0.4 } else { 0.75 },
            recency_bias: if recall { 0.85 } else { 0.65 },
            confidence_bias: 0.8,
            memory_budget: if recall { 5000 } else { 2500 },
            decay_aggressiveness: 0.6,
        }
    }
}
