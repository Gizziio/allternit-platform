use crate::modes::base::{ExecutionMode, ModeExecutor};
use allternit_providers::{
    Capability, Modality, Persona, ProviderBudget, ProviderRequest, ProviderRouter,
};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::io::{self, Read};
use std::sync::Arc;
use uuid::Uuid;

/// Configuration for Unix mode execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnixAgentConfig {
    /// Role of the agent
    pub role: String,
    /// Purpose of the execution
    pub purpose: String,
    /// Background context
    pub background: String,
    /// Specific instruction
    pub instruction: String,
    /// Session ID for tracking
    pub session_id: Option<String>,
    /// Model ID to use
    pub model_id: String,
}

impl Default for UnixAgentConfig {
    fn default() -> Self {
        Self {
            role: "general".to_string(),
            purpose: "General task execution".to_string(),
            background: "".to_string(),
            instruction: "".to_string(),
            session_id: None,
            model_id: "claude-3-5-sonnet".to_string(),
        }
    }
}

/// Unix mode executor implementing stateless, pipe-friendly execution
pub struct UnixExecutor {
    config: UnixAgentConfig,
    provider_router: Arc<ProviderRouter>,
}

impl std::fmt::Debug for UnixExecutor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("UnixExecutor").finish()
    }
}

impl UnixExecutor {
    pub fn new(config: UnixAgentConfig, provider_router: Arc<ProviderRouter>) -> Self {
        Self {
            config,
            provider_router,
        }
    }

    /// Execute from stdin, following Unix pipe patterns
    pub async fn execute_from_stdin(
        &self,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let mut input = String::new();
        io::stdin().read_to_string(&mut input)?;

        let context = self.build_context(&input)?;
        let result = self.call_llm(&context).await?;

        let output = UnixOutput {
            result: result.clone(),
            session_id: self
                .config
                .session_id
                .clone()
                .unwrap_or_else(|| Uuid::new_v4().to_string()),
            mode: "unix".to_string(),
            input_size: input.len(),
        };

        Ok(serde_json::to_string(&output)?)
    }

    /// Build context from stdin input and configuration
    fn build_context(
        &self,
        input: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        Ok(format!(
            "# Purpose\n{}\n\n# Background\n{}\n\n# Input\n{}\n\n# Instruction\n{}",
            self.config.purpose, self.config.background, input, self.config.instruction
        ))
    }

    async fn call_llm(
        &self,
        prompt: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let session_id = self
            .config
            .session_id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let context_bundle = allternit_context_router::ContextBundle {
            bundle_id: Uuid::new_v4().to_string(),
            tenant_id: "unix-mode".to_string(),
            session_id: Some(session_id.clone()),
            created_at: now,
            expires_at: None,
            context_entries: vec![],
            provenance: allternit_context_router::ContextProvenance {
                origin_session: Some(session_id.clone()),
                origin_agent: "unix-agent".to_string(),
                derivation_chain: vec![],
                integrity_hash: "placeholder".to_string(),
                signature: None,
            },
            access_control: allternit_context_router::ContextAccessControl {
                allowed_agents: std::collections::HashSet::new(),
                allowed_skills: std::collections::HashSet::new(),
                allowed_phases: std::collections::HashSet::new(),
                time_window: None,
                access_policy: allternit_context_router::ContextAccessPolicy::ExplicitAllowList,
            },
            size_bytes: 0,
            last_accessed: now,
            access_count: 0,
        };

        let request = ProviderRequest {
            request_id: Uuid::new_v4().to_string(),
            session_id: session_id.clone(),
            tenant_id: "unix-mode".to_string(),
            agent_id: "unix-agent".to_string(),
            persona: Persona {
                persona_id: "unix-default".to_string(),
                name: self.config.role.clone(),
                description: self.config.purpose.clone(),
                base_persona: "system".to_string(),
                overlays: vec![],
                version: "1.0.0".to_string(),
                created_at: 0,
                updated_at: 0,
                is_active: true,
            },
            context_bundle,
            intent: prompt.to_string(),
            required_capabilities: vec![Capability {
                model: self.config.model_id.clone(),
                modalities: vec![Modality::Text],
                context_window: 128000,
                max_tokens: 4096,
                response_time_ms: 0,
                cost_per_token: 0.0,
                safety_tier: 0,
            }],
            budget_constraints: ProviderBudget {
                daily_limit: None,
                monthly_limit: None,
                rate_limit: None,
                token_limit: None,
            },
            trace_id: None,
        };

        let response = self.provider_router.route_request(request).await?;
        Ok(response
            .response
            .as_str()
            .map(str::to_string)
            .unwrap_or_else(|| response.response.to_string()))
    }
}

#[async_trait]
impl ModeExecutor for UnixExecutor {
    async fn execute(
        &self,
        context: &str,
        task: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let full_prompt = format!("Context:\n{}\n\nTask:\n{}", context, task);
        let result = self.call_llm(&full_prompt).await?;

        let output = UnixOutput {
            result: result.clone(),
            session_id: self
                .config
                .session_id
                .clone()
                .unwrap_or_else(|| Uuid::new_v4().to_string()),
            mode: "unix".to_string(),
            input_size: context.len(),
        };

        Ok(serde_json::to_string(&output)?)
    }

    fn is_deterministic(&self) -> bool {
        true
    }

    fn mode(&self) -> ExecutionMode {
        ExecutionMode::Unix
    }
}

/// Structured output for Unix mode execution
#[derive(Debug, Serialize, Deserialize)]
pub struct UnixOutput {
    /// The result of the execution
    pub result: String,
    /// Session ID for tracking
    pub session_id: String,
    /// Execution mode used
    pub mode: String,
    /// Size of the input processed
    pub input_size: usize,
}
