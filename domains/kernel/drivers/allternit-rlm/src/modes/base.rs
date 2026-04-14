use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;

/// Execution mode enum for different RLM approaches
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ExecutionMode {
    /// Deterministic, full context mode
    Standard,
    /// Recursive, sub-LLM delegation mode
    RLM,
    /// Stateless, stdin/stdout mode (Unix-like)
    Unix,
    /// Auto-select based on heuristics
    Hybrid,
}

impl ExecutionMode {
    /// Check if the mode is deterministic
    pub fn is_deterministic(&self) -> bool {
        match self {
            ExecutionMode::Standard => true,
            ExecutionMode::RLM => false,
            ExecutionMode::Unix => true,
            ExecutionMode::Hybrid => true,
        }
    }
}

/// Abstract base trait for mode executors
#[async_trait]
pub trait ModeExecutor: Send + Sync + Debug {
    /// Execute a task with the given context
    async fn execute(
        &self,
        context: &str,
        task: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>>;

    /// Check if this execution mode is deterministic
    fn is_deterministic(&self) -> bool;

    /// Get the execution mode
    fn mode(&self) -> ExecutionMode;
}

/// Configuration for mode selection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModeSelectionConfig {
    /// Threshold for context size to trigger RLM mode (default: 32K tokens)
    pub context_threshold: usize,
    /// Complexity patterns that trigger RLM mode
    pub complexity_patterns: Vec<String>,
}

/// Task complexity classification for hybrid mode selection
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TaskComplexity {
    Simple,
    Complex,
    LargeScale,
    LongHorizon,
}

impl Default for ModeSelectionConfig {
    fn default() -> Self {
        Self {
            context_threshold: 32_000,
            complexity_patterns: vec![
                "across.*files".to_string(),
                "entire.*codebase".to_string(),
                "all.*instances".to_string(),
                "comprehensive.*analysis".to_string(),
                "multi-document".to_string(),
                "large.*scale".to_string(),
                "complex.*reasoning".to_string(),
                "long.*horizon".to_string(),
            ],
        }
    }
}
