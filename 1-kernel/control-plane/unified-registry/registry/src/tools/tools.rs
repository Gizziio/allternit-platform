use a2rchitech_tools_gateway::ToolDefinition;
use serde::{Deserialize, Serialize};
use sqlx::{SqlitePool, AnyPool, Row};
use super::RegistryError;

pub struct ToolRegistry {
    pool: AnyPool,
}

impl ToolRegistry {
    pub fn new(pool: AnyPool) -> Self {
        Self { pool }
    }

    pub async fn initialize_schema(&self) -> Result<(), RegistryError> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS tools (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                definition_json TEXT NOT NULL,
                safety_tier TEXT NOT NULL
            );
            "#
        )
        .execute(&self.pool)
        .await
        .map_err(RegistryError::Db)?;
        Ok(())
    }

    pub async fn register(&self, tool: ToolDefinition) -> Result<String, RegistryError> {
        let json = serde_json::to_string(&tool)?;
        
        sqlx::query(
            r#"
            INSERT INTO tools (id, name, description, definition_json, safety_tier)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                definition_json = excluded.definition_json,
                safety_tier = excluded.safety_tier
            "#
        )
        .bind(&tool.id)
        .bind(&tool.name)
        .bind(&tool.description)
        .bind(json)
        .bind(format!("{:?}", tool.safety_tier))
        .execute(&self.pool)
        .await
        .map_err(RegistryError::Db)?;

        Ok(tool.id)
    }

    pub async fn get(&self, id: &str) -> Result<Option<ToolDefinition>, RegistryError> {
        let row = sqlx::query("SELECT definition_json FROM tools WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(RegistryError::Db)?;

        if let Some(row) = row {
            let json: String = row.get("definition_json");
            let tool = serde_json::from_str(&json)?;
            Ok(Some(tool))
        } else {
            Ok(None)
        }
    }

    pub async fn list(&self) -> Result<Vec<ToolDefinition>, RegistryError> {
        let rows = sqlx::query("SELECT definition_json FROM tools")
            .fetch_all(&self.pool)
            .await
            .map_err(RegistryError::Db)?;

        let mut tools = Vec::new();
        for row in rows {
            let json: String = row.get("definition_json");
            tools.push(serde_json::from_str(&json)?);
        }
        Ok(tools)
    }

    pub async fn delete(&self, id: &str) -> Result<(), RegistryError> {
        sqlx::query("DELETE FROM tools WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(RegistryError::Db)?;

        Ok(())
    }

    pub async fn update(&self, tool: ToolDefinition) -> Result<String, RegistryError> {
        let json = serde_json::to_string(&tool)?;

        sqlx::query(
            r#"
            UPDATE tools
            SET name = ?, description = ?, definition_json = ?, safety_tier = ?
            WHERE id = ?
            "#
        )
        .bind(&tool.name)
        .bind(&tool.description)
        .bind(json)
        .bind(format!("{:?}", tool.safety_tier))
        .bind(&tool.id)
        .execute(&self.pool)
        .await
        .map_err(RegistryError::Db)?;

        Ok(tool.id)
    }
}
