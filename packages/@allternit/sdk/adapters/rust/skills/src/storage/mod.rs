use crate::{PublisherKey, Skill, SkillManifest, SkillsError};
use async_trait::async_trait;
use sqlx::{Row, SqlitePool};

// Storage trait for skill registry
#[async_trait]
pub trait SkillStorage: Send + Sync {
    async fn store_skill(&self, skill: &Skill) -> Result<(), SkillsError>;
    async fn get_skill(
        &self,
        skill_id: &str,
        version: Option<&str>,
    ) -> Result<Option<Skill>, SkillsError>;
    async fn list_skills(&self) -> Result<Vec<Skill>, SkillsError>;
    async fn list_skill_versions(&self, skill_id: &str) -> Result<Vec<String>, SkillsError>;
    async fn enable_skill(&self, skill_id: &str, version: &str) -> Result<(), SkillsError>;
    async fn disable_skill(&self, skill_id: &str, version: &str) -> Result<(), SkillsError>;
    async fn revoke_skill(&self, skill_id: &str, version: Option<&str>) -> Result<(), SkillsError>;
    async fn get_enabled_skills(&self) -> Result<Vec<Skill>, SkillsError>;
    async fn get_channel_version(
        &self,
        skill_id: &str,
        channel: &str,
    ) -> Result<Option<String>, SkillsError>;
    async fn set_channel_version(
        &self,
        skill_id: &str,
        channel: &str,
        version: &str,
    ) -> Result<(), SkillsError>;
    async fn store_publisher_key(&self, key: &PublisherKey) -> Result<(), SkillsError>;
    async fn get_publisher_key(
        &self,
        publisher_id: &str,
        public_key_id: &str,
    ) -> Result<Option<PublisherKey>, SkillsError>;
    async fn list_publisher_keys(
        &self,
        publisher_id: Option<&str>,
    ) -> Result<Vec<PublisherKey>, SkillsError>;
    async fn revoke_publisher_key(
        &self,
        publisher_id: &str,
        public_key_id: &str,
    ) -> Result<(), SkillsError>;
}

// SQLite-based storage implementation
pub struct SqliteSkillStorage {
    pool: SqlitePool,
}

impl SqliteSkillStorage {
    pub async fn new(pool: SqlitePool) -> Result<Self, SkillsError> {
        // Create the skills table if it doesn't exist
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS skills (
                skill_id TEXT PRIMARY KEY,
                version TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                manifest_json TEXT NOT NULL,
                workflow_json TEXT NOT NULL,
                tools_json TEXT NOT NULL,
                human_routing TEXT NOT NULL,
                publisher_id TEXT NOT NULL,
                signature TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT 1,
                UNIQUE(skill_id, version)
            )",
        )
        .execute(&pool)
        .await
        .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        // Create the skill_channels table for tracking channel versions
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS skill_channels (
                skill_id TEXT NOT NULL,
                channel TEXT NOT NULL,
                version TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (skill_id, channel)
            )",
        )
        .execute(&pool)
        .await
        .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        // Create indexes for better performance
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_skills_enabled ON skills(enabled)")
            .execute(&pool)
            .await
            .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_skills_publisher ON skills(publisher_id)")
            .execute(&pool)
            .await
            .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS publisher_keys (
                publisher_id TEXT NOT NULL,
                public_key_id TEXT NOT NULL,
                public_key TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                revoked BOOLEAN NOT NULL DEFAULT 0,
                revoked_at INTEGER,
                PRIMARY KEY (publisher_id, public_key_id)
            )",
        )
        .execute(&pool)
        .await
        .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_publisher_keys_publisher ON publisher_keys(publisher_id)")
            .execute(&pool)
            .await
            .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        Ok(SqliteSkillStorage { pool })
    }
}

#[async_trait]
impl SkillStorage for SqliteSkillStorage {
    async fn store_skill(&self, skill: &Skill) -> Result<(), SkillsError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let manifest_json = serde_json::to_string(&skill.manifest).map_err(SkillsError::Json)?;
        let workflow_json = serde_json::to_string(&skill.workflow).map_err(SkillsError::Json)?;
        let tools_json = serde_json::to_string(&skill.tools).map_err(SkillsError::Json)?;

        sqlx::query(
            "INSERT OR REPLACE INTO skills (
                skill_id, version, name, description, manifest_json, workflow_json, 
                tools_json, human_routing, publisher_id, signature, created_at, updated_at, enabled
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&skill.manifest.id)
        .bind(&skill.manifest.version)
        .bind(&skill.manifest.name)
        .bind(&skill.manifest.description)
        .bind(&manifest_json)
        .bind(&workflow_json)
        .bind(&tools_json)
        .bind(&skill.human_routing)
        .bind(&skill.manifest.publisher.publisher_id)
        .bind(&skill.manifest.signature.manifest_sig)
        .bind(now as i64)
        .bind(now as i64)
        .bind(true) // Enable by default
        .execute(&self.pool)
        .await
        .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        Ok(())
    }

    async fn get_skill(
        &self,
        skill_id: &str,
        version: Option<&str>,
    ) -> Result<Option<Skill>, SkillsError> {
        let query = if let Some(ver) = version {
            "SELECT * FROM skills WHERE skill_id = ? AND version = ?"
        } else {
            "SELECT * FROM skills WHERE skill_id = ? ORDER BY version DESC LIMIT 1"
        };

        let row = if let Some(ver) = version {
            sqlx::query(query)
                .bind(skill_id)
                .bind(ver)
                .fetch_optional(&self.pool)
                .await
        } else {
            sqlx::query(query)
                .bind(skill_id)
                .fetch_optional(&self.pool)
                .await
        }
        .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        if let Some(row) = row {
            let manifest: SkillManifest = serde_json::from_str(row.get::<&str, _>("manifest_json"))
                .map_err(SkillsError::Json)?;

            let workflow: crate::SkillWorkflow =
                serde_json::from_str(row.get::<&str, _>("workflow_json"))
                    .map_err(SkillsError::Json)?;

            let tools: Vec<crate::ToolDefinition> =
                serde_json::from_str(row.get::<&str, _>("tools_json"))
                    .map_err(SkillsError::Json)?;

            let skill = Skill {
                manifest,
                workflow,
                tools,
                human_routing: row.get("human_routing"),
            };

            Ok(Some(skill))
        } else {
            Ok(None)
        }
    }

    async fn list_skills(&self) -> Result<Vec<Skill>, SkillsError> {
        let rows = sqlx::query("SELECT * FROM skills ORDER BY skill_id, version DESC")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        let mut skills = Vec::new();
        let mut seen_skills = std::collections::HashSet::new(); // To avoid duplicates by taking latest version

        for row in rows {
            let skill_id: String = row.get("skill_id");

            // Only add the first (latest) version of each skill
            if seen_skills.contains(&skill_id) {
                continue;
            }
            seen_skills.insert(skill_id.clone());

            let manifest: SkillManifest = serde_json::from_str(row.get::<&str, _>("manifest_json"))
                .map_err(SkillsError::Json)?;

            let workflow: crate::SkillWorkflow =
                serde_json::from_str(row.get::<&str, _>("workflow_json"))
                    .map_err(SkillsError::Json)?;

            let tools: Vec<crate::ToolDefinition> =
                serde_json::from_str(row.get::<&str, _>("tools_json"))
                    .map_err(SkillsError::Json)?;

            let skill = Skill {
                manifest,
                workflow,
                tools,
                human_routing: row.get("human_routing"),
            };

            skills.push(skill);
        }

        Ok(skills)
    }

    async fn list_skill_versions(&self, skill_id: &str) -> Result<Vec<String>, SkillsError> {
        let rows =
            sqlx::query("SELECT version FROM skills WHERE skill_id = ? ORDER BY version DESC")
                .bind(skill_id)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        Ok(rows.into_iter().map(|row| row.get("version")).collect())
    }

    async fn enable_skill(&self, skill_id: &str, version: &str) -> Result<(), SkillsError> {
        sqlx::query(
            "UPDATE skills SET enabled = 1, updated_at = ? WHERE skill_id = ? AND version = ?",
        )
        .bind(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64,
        )
        .bind(skill_id)
        .bind(version)
        .execute(&self.pool)
        .await
        .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        Ok(())
    }

    async fn disable_skill(&self, skill_id: &str, version: &str) -> Result<(), SkillsError> {
        sqlx::query(
            "UPDATE skills SET enabled = 0, updated_at = ? WHERE skill_id = ? AND version = ?",
        )
        .bind(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64,
        )
        .bind(skill_id)
        .bind(version)
        .execute(&self.pool)
        .await
        .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        Ok(())
    }

    async fn revoke_skill(&self, skill_id: &str, version: Option<&str>) -> Result<(), SkillsError> {
        if let Some(ver) = version {
            // Revoke specific version
            sqlx::query("DELETE FROM skills WHERE skill_id = ? AND version = ?")
                .bind(skill_id)
                .bind(ver)
                .execute(&self.pool)
                .await
                .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;
        } else {
            // Revoke all versions
            sqlx::query("DELETE FROM skills WHERE skill_id = ?")
                .bind(skill_id)
                .execute(&self.pool)
                .await
                .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;
        }

        Ok(())
    }

    async fn get_enabled_skills(&self) -> Result<Vec<Skill>, SkillsError> {
        let rows =
            sqlx::query("SELECT * FROM skills WHERE enabled = 1 ORDER BY skill_id, version DESC")
                .fetch_all(&self.pool)
                .await
                .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        let mut skills = Vec::new();
        let mut seen_skills = std::collections::HashSet::new(); // To avoid duplicates by taking latest version

        for row in rows {
            let skill_id: String = row.get("skill_id");

            // Only add the first (latest) version of each skill
            if seen_skills.contains(&skill_id) {
                continue;
            }
            seen_skills.insert(skill_id.clone());

            let manifest: SkillManifest = serde_json::from_str(row.get::<&str, _>("manifest_json"))
                .map_err(SkillsError::Json)?;

            let workflow: crate::SkillWorkflow =
                serde_json::from_str(row.get::<&str, _>("workflow_json"))
                    .map_err(SkillsError::Json)?;

            let tools: Vec<crate::ToolDefinition> =
                serde_json::from_str(row.get::<&str, _>("tools_json"))
                    .map_err(SkillsError::Json)?;

            let skill = Skill {
                manifest,
                workflow,
                tools,
                human_routing: row.get("human_routing"),
            };

            skills.push(skill);
        }

        Ok(skills)
    }

    async fn get_channel_version(
        &self,
        skill_id: &str,
        channel: &str,
    ) -> Result<Option<String>, SkillsError> {
        let row =
            sqlx::query("SELECT version FROM skill_channels WHERE skill_id = ? AND channel = ?")
                .bind(skill_id)
                .bind(channel)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        if let Some(row) = row {
            Ok(Some(row.get("version")))
        } else {
            Ok(None)
        }
    }

    async fn set_channel_version(
        &self,
        skill_id: &str,
        channel: &str,
        version: &str,
    ) -> Result<(), SkillsError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        sqlx::query(
            "INSERT OR REPLACE INTO skill_channels (skill_id, channel, version, updated_at) VALUES (?, ?, ?, ?)"
        )
        .bind(skill_id)
        .bind(channel)
        .bind(version)
        .bind(now as i64)
        .execute(&self.pool)
        .await
        .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        Ok(())
    }

    async fn store_publisher_key(&self, key: &PublisherKey) -> Result<(), SkillsError> {
        sqlx::query(
            "INSERT INTO publisher_keys (
                publisher_id, public_key_id, public_key, created_at, revoked, revoked_at
            ) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&key.publisher_id)
        .bind(&key.public_key_id)
        .bind(&key.public_key)
        .bind(key.created_at as i64)
        .bind(key.revoked)
        .bind(key.revoked_at.map(|value| value as i64))
        .execute(&self.pool)
        .await
        .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        Ok(())
    }

    async fn get_publisher_key(
        &self,
        publisher_id: &str,
        public_key_id: &str,
    ) -> Result<Option<PublisherKey>, SkillsError> {
        let row = sqlx::query(
            "SELECT * FROM publisher_keys WHERE publisher_id = ? AND public_key_id = ?",
        )
        .bind(publisher_id)
        .bind(public_key_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        if let Some(row) = row {
            Ok(Some(PublisherKey {
                publisher_id: row.get("publisher_id"),
                public_key_id: row.get("public_key_id"),
                public_key: row.get("public_key"),
                created_at: row.get::<i64, _>("created_at") as u64,
                revoked: row.get("revoked"),
                revoked_at: row
                    .get::<Option<i64>, _>("revoked_at")
                    .map(|value| value as u64),
            }))
        } else {
            Ok(None)
        }
    }

    async fn list_publisher_keys(
        &self,
        publisher_id: Option<&str>,
    ) -> Result<Vec<PublisherKey>, SkillsError> {
        let rows = if let Some(publisher_id) = publisher_id {
            sqlx::query(
                "SELECT * FROM publisher_keys WHERE publisher_id = ? ORDER BY created_at DESC",
            )
            .bind(publisher_id)
            .fetch_all(&self.pool)
            .await
        } else {
            sqlx::query("SELECT * FROM publisher_keys ORDER BY created_at DESC")
                .fetch_all(&self.pool)
                .await
        }
        .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        let mut keys = Vec::new();
        for row in rows {
            keys.push(PublisherKey {
                publisher_id: row.get("publisher_id"),
                public_key_id: row.get("public_key_id"),
                public_key: row.get("public_key"),
                created_at: row.get::<i64, _>("created_at") as u64,
                revoked: row.get("revoked"),
                revoked_at: row
                    .get::<Option<i64>, _>("revoked_at")
                    .map(|value| value as u64),
            });
        }
        Ok(keys)
    }

    async fn revoke_publisher_key(
        &self,
        publisher_id: &str,
        public_key_id: &str,
    ) -> Result<(), SkillsError> {
        let revoked_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        sqlx::query(
            "UPDATE publisher_keys SET revoked = 1, revoked_at = ? WHERE publisher_id = ? AND public_key_id = ?",
        )
        .bind(revoked_at as i64)
        .bind(publisher_id)
        .bind(public_key_id)
        .execute(&self.pool)
        .await
        .map_err(|e| SkillsError::Io(std::io::Error::other(e)))?;

        Ok(())
    }
}
