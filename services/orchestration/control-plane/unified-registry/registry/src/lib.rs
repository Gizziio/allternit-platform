pub mod agents;
pub mod fabric;
pub mod tools;

use allternit_skills::SkillRegistry;
use serde::Serialize;
use std::sync::Arc;

#[derive(Debug, thiserror::Error)]
pub enum RegistryError {
    #[error("Database error: {0}")]
    Db(#[from] sqlx::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Validation failed: {0}")]
    Validation(String),
    #[error("Skill registry error: {0}")]
    Skill(#[from] allternit_skills::SkillsError),
}

/// The Unified Registry aggregates Agents, Skills, and Tools through the Data Fabric.
pub struct UnifiedRegistry {
    pub skills: Arc<SkillRegistry>,
    pub agents: Arc<agents::AgentRegistry>,
    pub tools: Arc<tools::ToolRegistry>,
    pub fabric: Arc<crate::fabric::DataFabric>,
}

impl UnifiedRegistry {
    pub fn new(
        skills: Arc<SkillRegistry>,
        agents: Arc<agents::AgentRegistry>,
        tools: Arc<tools::ToolRegistry>,
        fabric: Arc<crate::fabric::DataFabric>,
    ) -> Self {
        Self {
            skills,
            agents,
            tools,
            fabric,
        }
    }

    /// Initialize all registry schemas
    pub async fn initialize_schema(&self) -> Result<(), RegistryError> {
        self.agents.initialize_schema().await?;
        self.tools.initialize_schema().await?;
        self.fabric
            .initialize_schema()
            .await
            .map_err(|e| RegistryError::Validation(e.to_string()))?;
        // Skill registry handles its own schema initialization
        Ok(())
    }

    /// Get all capabilities for a specific tenant
    pub async fn get_tenant_capabilities(
        &self,
        tenant_id: &str,
    ) -> Result<TenantCapabilities, RegistryError> {
        // Use the data fabric to get all tenant capabilities
        let capabilities = self
            .fabric
            .get_tenant_capabilities(tenant_id)
            .await
            .map_err(|e| RegistryError::Validation(e.to_string()))?;

        Ok(TenantCapabilities {
            agents: capabilities.agents,
            skills: capabilities.skills,
            tools: capabilities.tools,
        })
    }

    /// Get all enabled capabilities for a specific tenant
    pub async fn get_enabled_tenant_capabilities(
        &self,
        tenant_id: &str,
    ) -> Result<TenantCapabilities, RegistryError> {
        // Use the data fabric to get enabled tenant capabilities
        let capabilities = self
            .fabric
            .get_enabled_tenant_capabilities(tenant_id)
            .await
            .map_err(|e| RegistryError::Validation(e.to_string()))?;

        Ok(TenantCapabilities {
            agents: capabilities.agents,
            skills: capabilities.skills,
            tools: capabilities.tools,
        })
    }

    /// Get capability summary for a tenant (lightweight version)
    pub async fn get_tenant_capability_summary(
        &self,
        tenant_id: &str,
    ) -> Result<CapabilitySummary, RegistryError> {
        // Use the data fabric to get capability summary
        let summary = self
            .fabric
            .get_tenant_capability_summary(tenant_id)
            .await
            .map_err(|e| RegistryError::Validation(e.to_string()))?;

        Ok(CapabilitySummary {
            tenant_id: tenant_id.to_string(),
            agent_count: summary.agent_count,
            skill_count: summary.skill_count,
            tool_count: summary.tool_count,
            last_updated: summary.last_updated,
        })
    }

    /// Search capabilities by name or description
    pub async fn search_capabilities(
        &self,
        query: &str,
        tenant_id: &str,
    ) -> Result<SearchResults, RegistryError> {
        // Use the data fabric to search capabilities
        let results = self
            .fabric
            .search_capabilities(query, tenant_id)
            .await
            .map_err(|e| RegistryError::Validation(e.to_string()))?;

        Ok(SearchResults {
            agents: results.agents,
            skills: results.skills,
            tools: results.tools,
        })
    }

    /// Validate that a capability exists and is accessible to the tenant
    pub async fn validate_capability_access(
        &self,
        capability_id: &str,
        tenant_id: &str,
    ) -> Result<bool, RegistryError> {
        // Use the data fabric to validate capability access
        self.fabric
            .validate_capability_access(capability_id, tenant_id)
            .await
            .map_err(|e| RegistryError::Validation(e.to_string()))
    }

    /// Register an agent with the registry
    pub async fn register_agent(
        &self,
        agent: agents::AgentDefinition,
    ) -> Result<String, RegistryError> {
        // Use the data fabric to register the agent
        self.fabric
            .register_agent(agent)
            .await
            .map_err(|e| RegistryError::Validation(e.to_string()))
    }

    /// Register a skill with the registry
    pub async fn register_skill(
        &self,
        skill: allternit_skills::Skill,
    ) -> Result<String, RegistryError> {
        // Use the data fabric to register the skill
        self.fabric
            .register_skill(skill)
            .await
            .map_err(|e| RegistryError::Validation(e.to_string()))
    }

    /// Register a tool with the registry
    pub async fn register_tool(
        &self,
        tool: allternit_tools_gateway::ToolDefinition,
    ) -> Result<String, RegistryError> {
        // Use the data fabric to register the tool
        self.fabric
            .register_tool(tool)
            .await
            .map_err(|e| RegistryError::Validation(e.to_string()))
    }

    /// Get an agent by ID
    pub async fn get_agent(
        &self,
        id: &str,
    ) -> Result<Option<agents::AgentDefinition>, RegistryError> {
        // Use the data fabric to get the agent
        self.fabric
            .get_agent(id)
            .await
            .map_err(|e| RegistryError::Validation(e.to_string()))
    }

    /// Get a skill by ID
    pub async fn get_skill(
        &self,
        id: String,
    ) -> Result<Option<allternit_skills::Skill>, RegistryError> {
        // Use the data fabric to get the skill
        self.fabric
            .get_skill(id)
            .await
            .map_err(|e| RegistryError::Validation(e.to_string()))
    }

    /// Get a tool by ID
    pub async fn get_tool(
        &self,
        id: &str,
    ) -> Result<Option<allternit_tools_gateway::ToolDefinition>, RegistryError> {
        // Use the data fabric to get the tool
        self.fabric
            .get_tool(id)
            .await
            .map_err(|e| RegistryError::Validation(e.to_string()))
    }
}

/// Represents all capabilities available to a tenant
#[derive(Debug, Clone, Serialize)]
pub struct TenantCapabilities {
    pub agents: Vec<agents::AgentDefinition>,
    pub skills: Vec<allternit_skills::Skill>,
    pub tools: Vec<allternit_tools_gateway::ToolDefinition>,
}

/// Summary of capabilities for a tenant
#[derive(Debug, Clone, Serialize)]
pub struct CapabilitySummary {
    pub tenant_id: String,
    pub agent_count: usize,
    pub skill_count: usize,
    pub tool_count: usize,
    pub last_updated: i64,
}

/// Search results for capabilities
#[derive(Debug, Clone, Serialize)]
pub struct SearchResults {
    pub agents: Vec<agents::AgentDefinition>,
    pub skills: Vec<allternit_skills::Skill>,
    pub tools: Vec<allternit_tools_gateway::ToolDefinition>,
}
