use serde::{Deserialize, Serialize};
use sqlx::{SqlitePool, AnyPool, Row};
use uuid::Uuid;
use super::RegistryError;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct AgentDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,

    // Agent classification
    #[serde(default = "default_agent_type")]
    pub agent_type: String, // orchestrator | sub-agent | worker | specialist | reviewer
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,

    // Cognitive configuration
    pub system_prompt: String,
    pub model_config: ModelConfig,

    // Character layer
    #[serde(skip_serializing_if = "Option::is_none")]
    pub character: Option<CharacterLayer>,

    // Avatar
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<AvatarConfig>,

    // Capabilities & Tools
    pub allowed_skills: Vec<String>,
    #[serde(default)]
    pub allowed_tools: Vec<String>,
    pub expertise_domains: Vec<String>,
    #[serde(default)]
    pub capabilities: Vec<String>, // e.g. "file_read", "bash", "browser", "code_edit"

    // Trust & Policy
    #[serde(default = "default_trust_tier")]
    pub trust_tier: String, // sandbox | standard | elevated | admin
    #[serde(skip_serializing_if = "Option::is_none")]
    pub write_scope: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_classification: Option<String>,

    // Harness configuration (per-agent model routing)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub harness_config: Option<HarnessConfig>,

    // Enabled mode surfaces
    #[serde(default = "default_enabled_modes")]
    pub enabled_modes: Vec<String>, // chat | cowork | code | browser | design

    // Metadata
    pub tenant_id: String,
    pub created_at: i64,
    pub updated_at: i64,
}

fn default_agent_type() -> String { "worker".to_string() }
fn default_trust_tier() -> String { "standard".to_string() }
fn default_enabled_modes() -> Vec<String> { vec!["chat".to_string()] }

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct ModelConfig {
    pub provider: String,   // e.g. "anthropic", "openai", "google", "local"
    pub model_name: String, // e.g. "claude-3-opus", "gpt-4o"
    pub temperature: f32,
    pub max_tokens: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct CharacterLayer {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub setup: Option<String>,       // character setup name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperament: Option<String>, // analytical | creative | pragmatic
    #[serde(skip_serializing_if = "Option::is_none")]
    pub personality: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role_card: Option<String>,   // freeform role card text
    #[serde(default)]
    pub hard_bans: Vec<String>,      // categories the agent must never touch
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice_rules: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct AvatarConfig {
    #[serde(default = "default_avatar_type")]
    pub avatar_type: String, // emoji | image | mascot
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uri: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emoji: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mascot_template: Option<String>,
}

fn default_avatar_type() -> String { "emoji".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct HarnessByokProviderConfig {
    pub api_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct HarnessByokConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anthropic: Option<HarnessByokProviderConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub openai: Option<HarnessByokProviderConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub google: Option<HarnessByokProviderConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct HarnessCloudConfig {
    pub base_url: String,
    pub access_token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct HarnessLocalConfig {
    pub base_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, utoipa::ToSchema)]
pub struct HarnessSubprocessConfig {
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct HarnessConfig {
    pub mode: String, // byok | cloud | local | subprocess
    #[serde(skip_serializing_if = "Option::is_none")]
    pub byok: Option<HarnessByokConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cloud: Option<HarnessCloudConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local: Option<HarnessLocalConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subprocess: Option<HarnessSubprocessConfig>,
}


pub struct AgentRegistry {
    pool: AnyPool,
}

impl AgentRegistry {
    pub fn new(pool: AnyPool) -> Self {
        Self { pool }
    }

    pub async fn initialize_schema(&self) -> Result<(), RegistryError> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                description TEXT,
                definition_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(agent_type);
            CREATE INDEX IF NOT EXISTS idx_agents_trust_tier ON agents(trust_tier);
            CREATE INDEX IF NOT EXISTS idx_agents_parent ON agents(parent_agent_id);
            CREATE INDEX IF NOT EXISTS idx_agents_modes ON agents(enabled_modes);
            "#
        )
        .execute(&self.pool)
        .await
        .map_err(RegistryError::Db)?;
        Ok(())
    }

    pub async fn register(&self, agent: AgentDefinition) -> Result<String, RegistryError> {
        let json = serde_json::to_string(&agent)?;
        
        sqlx::query(
            r#"
            INSERT INTO agents (id, tenant_id, name, version, description, definition_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                version = excluded.version,
                description = excluded.description,
                definition_json = excluded.definition_json,
                updated_at = excluded.updated_at
            "#
        )
        .bind(&agent.id)
        .bind(&agent.tenant_id)
        .bind(&agent.name)
        .bind(&agent.version)
        .bind(&agent.description)
        .bind(json)
        .bind(agent.created_at)
        .bind(agent.updated_at)
        .execute(&self.pool)
        .await
        .map_err(RegistryError::Db)?;

        Ok(agent.id)
    }

    pub async fn get(&self, id: &str) -> Result<Option<AgentDefinition>, RegistryError> {
        let row = sqlx::query("SELECT definition_json FROM agents WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(RegistryError::Db)?;

        if let Some(row) = row {
            let json: String = row.get("definition_json");
            let agent = serde_json::from_str(&json)?;
            Ok(Some(agent))
        } else {
            Ok(None)
        }
    }

    pub async fn list(&self, tenant_id: &str) -> Result<Vec<AgentDefinition>, RegistryError> {
        let rows = sqlx::query("SELECT definition_json FROM agents WHERE tenant_id = ?")
            .bind(tenant_id)
            .fetch_all(&self.pool)
            .await
            .map_err(RegistryError::Db)?;

        let mut agents = Vec::new();
        for row in rows {
            let json: String = row.get("definition_json");
            agents.push(serde_json::from_str(&json)?);
        }
        Ok(agents)
    }

    pub async fn list_all(&self) -> Result<Vec<AgentDefinition>, RegistryError> {
        let rows = sqlx::query("SELECT definition_json FROM agents")
            .fetch_all(&self.pool)
            .await
            .map_err(RegistryError::Db)?;

        let mut agents = Vec::new();
        for row in rows {
            let json: String = row.get("definition_json");
            agents.push(serde_json::from_str(&json)?);
        }
        Ok(agents)
    }

    pub async fn delete(&self, id: &str) -> Result<(), RegistryError> {
        sqlx::query("DELETE FROM agents WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(RegistryError::Db)?;

        Ok(())
    }

    pub async fn update(&self, agent: AgentDefinition) -> Result<String, RegistryError> {
        let json = serde_json::to_string(&agent)?;
        let now = chrono::Utc::now().timestamp();

        sqlx::query(
            r#"
            UPDATE agents
            SET name = ?, version = ?, description = ?, definition_json = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(&agent.name)
        .bind(&agent.version)
        .bind(&agent.description)
        .bind(json)
        .bind(now)
        .bind(&agent.id)
        .execute(&self.pool)
        .await
        .map_err(RegistryError::Db)?;

        Ok(agent.id)
    }
}
