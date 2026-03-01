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

    // Cognitive configuration
    pub system_prompt: String,
    pub model_config: ModelConfig,

    // Capabilities
    pub allowed_skills: Vec<String>, // Skill IDs
    pub expertise_domains: Vec<String>,

    // Metadata
    pub tenant_id: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct ModelConfig {
    pub provider: String, // e.g. "anthropic", "openai"
    pub model_name: String, // e.g. "claude-3-opus"
    pub temperature: f32,
    pub max_tokens: Option<i32>,
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
