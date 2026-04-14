use crate::modes::base::{
    ExecutionMode, ModeExecutor as BaseModeExecutor, ModeSelectionConfig, TaskComplexity,
};
use crate::modes::rlm::RLMModeExecutor;
use crate::modes::session::{SessionManager, SessionState};
use crate::modes::unix::UnixExecutor;
use async_trait::async_trait;
use std::collections::HashMap;

/// Standard mode executor for simple, deterministic execution
#[derive(Debug)]
pub struct StandardModeExecutor;

impl Default for StandardModeExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl StandardModeExecutor {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl BaseModeExecutor for StandardModeExecutor {
    async fn execute(
        &self,
        context: &str,
        task: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        Ok(format!(
            "Standard mode executed task: {} with context length: {}",
            task,
            context.len()
        ))
    }

    fn is_deterministic(&self) -> bool {
        true
    }

    fn mode(&self) -> ExecutionMode {
        ExecutionMode::Standard
    }
}

/// Enhanced hybrid mode executor that intelligently auto-selects the best execution mode
#[derive(Debug)]
pub struct HybridModeExecutor {
    standard_executor: std::sync::Arc<StandardModeExecutor>,
    rlm_executor: Option<std::sync::Arc<RLMModeExecutor>>,
    unix_executor: Option<std::sync::Arc<UnixExecutor>>,
    session_manager: std::sync::Arc<SessionManager>,
    config: ModeSelectionConfig,
}

impl HybridModeExecutor {
    pub fn new(
        standard_executor: std::sync::Arc<StandardModeExecutor>,
        rlm_executor: Option<std::sync::Arc<RLMModeExecutor>>,
        unix_executor: Option<std::sync::Arc<UnixExecutor>>,
        session_manager: std::sync::Arc<SessionManager>,
        config: ModeSelectionConfig,
    ) -> Self {
        Self {
            standard_executor,
            rlm_executor,
            unix_executor,
            session_manager,
            config,
        }
    }

    /// Intelligently select execution mode based on multiple factors
    async fn select_mode(&self, context: &str, task: &str) -> ExecutionMode {
        let context_size = context.len();
        let task_complexity = self.assess_task_complexity(task);
        let has_large_context = context_size > self.config.context_threshold * 4;

        // Calculate confidence scores for each mode
        let mut mode_scores = HashMap::new();

        // Standard mode score: high for small contexts and simple tasks
        let standard_score = if context_size < self.config.context_threshold
            && task_complexity == TaskComplexity::Simple
        {
            10.0
        } else if context_size < self.config.context_threshold * 2 {
            7.0
        } else {
            2.0
        };
        mode_scores.insert(ExecutionMode::Standard, standard_score);

        // RLM mode score: high for complex tasks and large contexts
        let rlm_score = if task_complexity == crate::modes::base::TaskComplexity::Complex
            || task_complexity == crate::modes::base::TaskComplexity::LongHorizon
            || has_large_context
        {
            10.0
        } else if context_size > self.config.context_threshold * 2 {
            8.0
        } else {
            3.0
        };
        mode_scores.insert(ExecutionMode::RLM, rlm_score);

        // Unix mode score: high for large contexts that don't require complex reasoning
        let unix_score = if has_large_context
            && task_complexity != crate::modes::base::TaskComplexity::Complex
        {
            9.0
        } else if context_size > self.config.context_threshold * 2
            && task_complexity == crate::modes::base::TaskComplexity::Simple
        {
            7.0
        } else {
            1.0
        };
        mode_scores.insert(ExecutionMode::Unix, unix_score);

        // Find the mode with the highest score that is available
        let best_mode = mode_scores
            .into_iter()
            .filter(|(mode, _)| self.is_mode_available(mode))
            .max_by(|(_, score_a), (_, score_b)| score_a.partial_cmp(score_b).unwrap())
            .map(|(mode, _)| mode)
            .unwrap_or(ExecutionMode::Standard); // Default to Standard if no mode is available

        // Log the mode selection decision
        let description = format!("Task: {}", task);
        let mode_note = format!(
            "Selected {:?} (score: {:.1})",
            best_mode,
            match best_mode {
                ExecutionMode::Standard => standard_score,
                ExecutionMode::RLM => rlm_score,
                ExecutionMode::Unix => unix_score,
                ExecutionMode::Hybrid => 5.0,
            }
        );
        if let Err(e) = self
            .session_manager
            .commit(
                description.as_str(),
                SessionState {
                    context: context.to_string(),
                    recursion_depth: 0,
                    execution_log: vec![],
                    variables: std::collections::HashMap::new(),
                    answer: None::<String>,
                },
                vec![],
                mode_note.as_str(),
                task,
            )
            .await
        {
            eprintln!("Failed to log mode selection: {}", e);
        }

        best_mode
    }

    /// Check if a mode is available (has the required executor)
    fn is_mode_available(&self, mode: &ExecutionMode) -> bool {
        match mode {
            ExecutionMode::Standard => true,
            ExecutionMode::RLM => self.rlm_executor.is_some(),
            ExecutionMode::Unix => self.unix_executor.is_some(),
            ExecutionMode::Hybrid => true,
        }
    }

    /// Assess task complexity using multiple heuristics
    fn assess_task_complexity(&self, task: &str) -> crate::modes::base::TaskComplexity {
        let task_lower = task.to_lowercase();

        // Count complexity indicators
        let mut complexity_score = 0;

        for pattern in &self.config.complexity_patterns {
            if task_lower.contains(&pattern.replace(".*", " ")) {
                complexity_score += 2;
            }
        }

        if task_lower.contains("across") {
            complexity_score += 1;
        }
        if task_lower.contains("entire") {
            complexity_score += 1;
        }
        if task_lower.contains("all") {
            complexity_score += 1;
        }
        if task_lower.contains("comprehensive") {
            complexity_score += 2;
        }
        if task_lower.contains("multi") {
            complexity_score += 1;
        }
        if task_lower.contains("complex") {
            complexity_score += 2;
        }
        if task_lower.contains("large") {
            complexity_score += 1;
        }
        if task_lower.contains("long") {
            complexity_score += 1;
        }
        if task_lower.contains("analyze") {
            complexity_score += 1;
        }
        if task_lower.contains("compare") {
            complexity_score += 1;
        }
        if task_lower.contains("synthesize") {
            complexity_score += 2;
        }
        if task_lower.contains("reason") {
            complexity_score += 1;
        }
        if task_lower.contains("plan") {
            complexity_score += 1;
        }
        if task_lower.contains("strategy") {
            complexity_score += 2;
        }

        // Classify based on score
        if complexity_score >= 8 {
            crate::modes::base::TaskComplexity::LongHorizon
        } else if complexity_score >= 5 {
            crate::modes::base::TaskComplexity::Complex
        } else if complexity_score >= 3 {
            crate::modes::base::TaskComplexity::LargeScale
        } else {
            crate::modes::base::TaskComplexity::Simple
        }
    }
}

#[async_trait]
impl BaseModeExecutor for HybridModeExecutor {
    async fn execute(
        &self,
        context: &str,
        task: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let mode = self.select_mode(context, task).await;

        let result = match mode {
            ExecutionMode::Standard => self.standard_executor.execute(context, task).await,
            ExecutionMode::RLM => {
                if let Some(ref rlm_exec) = self.rlm_executor {
                    rlm_exec.execute(context, task).await
                } else {
                    Err("RLM executor not available".into())
                }
            }
            ExecutionMode::Unix => {
                if let Some(ref unix_exec) = self.unix_executor {
                    unix_exec.execute(context, task).await
                } else {
                    Err("Unix executor not available".into())
                }
            }
            ExecutionMode::Hybrid => self.standard_executor.execute(context, task).await,
        };

        result
    }

    fn is_deterministic(&self) -> bool {
        // Hybrid mode is not deterministic since it chooses different execution paths
        false
    }

    fn mode(&self) -> ExecutionMode {
        ExecutionMode::Hybrid
    }
}
