//! Allternitchitech Registry Server Library
//!
//! Core functionality for the registry server including data models, business logic,
//! and service implementations for publishing, searching, indexing, and managing
//! skills, tools, and agents in the Allternitchitech ecosystem.

use anyhow::Result;
use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::Row;
use std::collections::HashMap;
use tokio::sync::RwLock;
use tracing::error;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RegistryType {
    Skill,
    Tool,
    Agent,
    Workflow,
    Model,
    Dataset,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryItem {
    pub id: RegistryId,
    #[serde(rename = "type")]
    pub item_type: RegistryType,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub content_hash: String, // SHA256 hash of the content
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub publisher_id: String,  // Node ID of the publisher
    pub channels: Vec<String>, // Channels this item belongs to (e.g., "stable", "beta", "experimental")
    pub downloads: u64,        // Download count
    pub rating: Option<f64>,   // Average rating
}

pub type RegistryId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishRequest {
    pub item_type: RegistryType,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub content: String, // Base64 encoded content
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishResponse {
    pub id: RegistryId,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub text: String,
    pub filters: HashMap<String, String>,
    pub limit: usize,
    pub offset: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub items: Vec<RegistryItem>,
    pub total_count: usize,
    pub limit: usize,
    pub offset: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexRequest {
    pub item_id: RegistryId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequest {
    pub id: RegistryId,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullResponse {
    pub item: RegistryItem,
    pub content: String, // Base64 encoded content
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallRequest {
    pub item_id: RegistryId,
    pub target_environment: String,
    pub config_overrides: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollbackRequest {
    pub item_id: RegistryId,
    pub rollback_target_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelPromotionRequest {
    pub item_id: RegistryId,
    pub channel: String,
    pub notes: Option<String>,
}

pub struct Registry {
    items: HashMap<RegistryId, RegistryItem>,
    db_pool: sqlx::SqlitePool,
}

impl Registry {
    pub async fn new(db_url: &str) -> Result<Self> {
        let pool = sqlx::SqlitePool::connect(db_url).await?;

        // Run migrations
        sqlx::migrate!("./migrations").run(&pool).await?;

        Ok(Self {
            items: HashMap::new(),
            db_pool: pool,
        })
    }

    pub async fn publish(&mut self, item: RegistryItem) -> Result<RegistryId> {
        // Insert into database
        let query = sqlx::query(
            r#"
            INSERT INTO registry_items 
            (id, item_type, name, version, description, tags, content_hash, metadata, publisher_id, channels, downloads, rating)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&item.id)
        .bind(format!("{:?}", item.item_type))
        .bind(&item.name)
        .bind(&item.version)
        .bind(&item.description)
        .bind(serde_json::to_string(&item.tags)?)
        .bind(&item.content_hash)
        .bind(serde_json::to_string(&item.metadata)?)
        .bind(&item.publisher_id)
        .bind(serde_json::to_string(&item.channels)?)
        .bind(item.downloads as i64)
        .bind(item.rating);

        if let Err(err) = query.execute(&self.db_pool).await {
            error!(item_id = %item.id, "failed to publish registry item: {err:?}");
            return Err(err.into());
        }

        // Add to in-memory cache
        let id = item.id.clone();
        self.items.insert(id.clone(), item);

        Ok(id)
    }

    pub async fn get_item(&self, id: &RegistryId) -> Result<Option<RegistryItem>> {
        // First check in-memory cache
        if let Some(item) = self.items.get(id) {
            return Ok(Some(item.clone()));
        }

        // Then check database
        let row = sqlx::query(
            r#"
            SELECT id, item_type, name, version, description, tags, content_hash, 
                   metadata, publisher_id, channels, downloads, rating, created_at, updated_at
            FROM registry_items WHERE id = ?
            "#,
        )
        .bind(id)
        .fetch_optional(&self.db_pool)
        .await?;

        if let Some(row) = row {
            let item = Self::row_to_item(&row)?;

            Ok(Some(item))
        } else {
            Ok(None)
        }
    }

    pub async fn search(&self, query: SearchQuery) -> Result<(Vec<RegistryItem>, usize)> {
        let mut sql = String::from("SELECT * FROM registry_items WHERE 1=1");
        let mut params: Vec<String> = Vec::new();

        // Add text search
        if !query.text.is_empty() {
            sql.push_str(" AND (name LIKE ? OR description LIKE ?)");
            params.push(format!("%{}%", query.text));
            params.push(format!("%{}%", query.text));
        }

        // Add filters
        for (key, value) in &query.filters {
            if key == "type" {
                sql.push_str(" AND item_type = ?");
                params.push(value.clone());
            } else if key == "tag" {
                sql.push_str(" AND tags LIKE ?");
                params.push(format!("%{}%", value));
            } else if key == "publisher" {
                sql.push_str(" AND publisher_id = ?");
                params.push(value.clone());
            }
        }

        sql.push_str(" ORDER BY created_at DESC");
        let base_sql = sql.clone();
        sql.push_str(&format!(" LIMIT {} OFFSET {}", query.limit, query.offset));

        let mut query_builder = sqlx::query(&sql);
        for param in &params {
            query_builder = query_builder.bind(param);
        }
        let rows = query_builder.fetch_all(&self.db_pool).await?;

        let mut items = Vec::new();
        for row in rows {
            items.push(Self::row_to_item(&row)?);
        }

        // Get total count for pagination
        let count_sql = format!("SELECT COUNT(*) FROM ({})", base_sql);
        let mut count_query = sqlx::query(&count_sql);
        for param in &params {
            count_query = count_query.bind(param);
        }
        let count_row = count_query.fetch_one(&self.db_pool).await?;

        let total_count: i64 = count_row.try_get(0)?;

        Ok((items, total_count as usize))
    }

    pub async fn index_item(&mut self, item_id: &RegistryId) -> Result<()> {
        // In a real implementation, this would update search indexes
        // For now, we'll just verify the item exists
        if self.get_item(item_id).await?.is_none() {
            return Err(anyhow::anyhow!("Item not found: {}", item_id));
        }

        // Update the updated_at timestamp
        let now = Utc::now();
        sqlx::query("UPDATE registry_items SET updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(item_id)
            .execute(&self.db_pool)
            .await?;

        // Update in-memory cache
        if let Some(item) = self.items.get_mut(item_id) {
            item.updated_at = now;
        }

        Ok(())
    }

    pub async fn promote_to_channel(&mut self, item_id: &RegistryId, channel: &str) -> Result<()> {
        // Get the current item
        let mut item = match self.get_item(item_id).await? {
            Some(item) => item,
            None => return Err(anyhow::anyhow!("Item not found: {}", item_id)),
        };

        // Add the channel if it's not already present
        if !item.channels.contains(&channel.to_string()) {
            item.channels.push(channel.to_string());
        }

        // Update in database
        sqlx::query("UPDATE registry_items SET channels = ?, updated_at = ? WHERE id = ?")
            .bind(serde_json::to_string(&item.channels)?)
            .bind(Utc::now())
            .bind(item_id)
            .execute(&self.db_pool)
            .await?;

        // Update in-memory cache
        self.items.insert(item_id.clone(), item);

        Ok(())
    }

    pub async fn list_items(
        &self,
        item_type: Option<&str>,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<RegistryItem>> {
        let mut sql = String::from("SELECT * FROM registry_items");
        let mut params = Vec::new();

        if let Some(t) = item_type {
            sql.push_str(" WHERE item_type = ?");
            params.push(t.to_string());
        } else {
            sql.push_str(" WHERE 1=1"); // So we can always append AND clauses
        }

        sql.push_str(&format!(
            " ORDER BY created_at DESC LIMIT {} OFFSET {}",
            limit, offset
        ));

        let mut query_builder = sqlx::query(&sql);
        for param in &params {
            query_builder = query_builder.bind(param);
        }
        let rows = query_builder.fetch_all(&self.db_pool).await?;

        let mut items = Vec::new();
        for row in rows {
            items.push(Self::row_to_item(&row)?);
        }

        Ok(items)
    }

    pub async fn update_item(
        &mut self,
        item_id: &RegistryId,
        updates: serde_json::Value,
    ) -> Result<RegistryItem> {
        let mut item = match self.get_item(item_id).await? {
            Some(item) => item,
            None => return Err(anyhow::anyhow!("Item not found: {}", item_id)),
        };

        // Apply updates based on provided fields
        if let Some(name) = updates.get("name").and_then(|v| v.as_str()) {
            item.name = name.to_string();
        }

        if let Some(description) = updates.get("description").and_then(|v| v.as_str()) {
            item.description = Some(description.to_string());
        }

        if let Some(tags) = updates.get("tags") {
            if let Ok(new_tags) = serde_json::from_value::<Vec<String>>(tags.clone()) {
                item.tags = new_tags;
            }
        }

        if let Some(metadata) = updates.get("metadata") {
            item.metadata = metadata.clone();
        }

        item.updated_at = Utc::now();

        // Update in database
        sqlx::query(
            r#"
            UPDATE registry_items 
            SET name = ?, description = ?, tags = ?, metadata = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&item.name)
        .bind(&item.description)
        .bind(serde_json::to_string(&item.tags)?)
        .bind(serde_json::to_string(&item.metadata)?)
        .bind(item.updated_at)
        .bind(item_id)
        .execute(&self.db_pool)
        .await?;

        // Update in-memory cache
        self.items.insert(item_id.clone(), item.clone());

        Ok(item)
    }

    pub async fn delete_item(&mut self, item_id: &RegistryId) -> Result<()> {
        // Remove from database
        sqlx::query("DELETE FROM registry_items WHERE id = ?")
            .bind(item_id)
            .execute(&self.db_pool)
            .await?;

        // Remove from in-memory cache
        self.items.remove(item_id);

        Ok(())
    }

    fn row_to_item(row: &sqlx::sqlite::SqliteRow) -> Result<RegistryItem> {
        let item_type_str: String = row.get("item_type");
        let item_type = match item_type_str.as_str() {
            "Skill" => RegistryType::Skill,
            "Tool" => RegistryType::Tool,
            "Agent" => RegistryType::Agent,
            "Workflow" => RegistryType::Workflow,
            "Model" => RegistryType::Model,
            "Dataset" => RegistryType::Dataset,
            other => return Err(anyhow::anyhow!("Unknown registry type: {}", other)),
        };

            let created_at_str: String = row.get("created_at");
            let updated_at_str: String = row.get("updated_at");
            let created_at = Self::parse_datetime(&created_at_str)?;
            let updated_at = Self::parse_datetime(&updated_at_str)?;

            Ok(RegistryItem {
                id: row.get("id"),
                item_type,
                name: row.get("name"),
                version: row.get("version"),
                description: row.get("description"),
                tags: Self::parse_json_vec(row.get("tags")),
                content_hash: row.get("content_hash"),
                metadata: Self::parse_json_value(row.get("metadata")),
                created_at,
                updated_at,
                publisher_id: row.get("publisher_id"),
                channels: Self::parse_json_vec(row.get("channels")),
                downloads: row.get::<i64, _>("downloads") as u64,
                rating: row.get("rating"),
            })
    }

    fn parse_json_vec(json: String) -> Vec<String> {
        serde_json::from_str(&json).unwrap_or_default()
    }

    fn parse_json_value(json: String) -> serde_json::Value {
        serde_json::from_str(&json).unwrap_or_else(|_| serde_json::json!({}))
    }

    fn parse_datetime(value: &str) -> Result<DateTime<Utc>> {
        if let Ok(dt) = DateTime::parse_from_rfc3339(value) {
            Ok(dt.with_timezone(&Utc))
        } else {
            let naive = NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S")?;
            Ok(DateTime::<Utc>::from_utc(naive, Utc))
        }
    }
}

// Helper function to calculate content hash
pub fn calculate_content_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_registry_publish_get() {
        let mut registry = Registry::new("sqlite::memory:").await.unwrap();

        let item = RegistryItem {
            id: Uuid::new_v4().to_string(),
            item_type: RegistryType::Skill,
            name: "test-skill".to_string(),
            version: "1.0.0".to_string(),
            description: Some("A test skill".to_string()),
            tags: vec!["test".to_string(), "example".to_string()],
            content_hash: calculate_content_hash("test content"),
            metadata: serde_json::json!({}),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            publisher_id: "node1".to_string(),
            channels: vec!["experimental".to_string()],
            downloads: 0,
            rating: None,
        };

        let id = registry.publish(item.clone()).await.unwrap();
        let retrieved = registry.get_item(&id).await.unwrap().unwrap();

        assert_eq!(retrieved.name, "test-skill");
        assert_eq!(retrieved.version, "1.0.0");
    }

    #[tokio::test]
    async fn test_registry_search() {
        let mut registry = Registry::new("sqlite::memory:").await.unwrap();

        // Add a test item
        let item = RegistryItem {
            id: Uuid::new_v4().to_string(),
            item_type: RegistryType::Tool,
            name: "search-test-tool".to_string(),
            version: "1.0.0".to_string(),
            description: Some("A tool for testing search".to_string()),
            tags: vec!["search".to_string(), "test".to_string()],
            content_hash: calculate_content_hash("test content"),
            metadata: serde_json::json!({}),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            publisher_id: "node1".to_string(),
            channels: vec!["stable".to_string()],
            downloads: 0,
            rating: None,
        };

        registry.publish(item).await.unwrap();

        // Search for the item
        let query = SearchQuery {
            text: "search".to_string(),
            filters: HashMap::new(),
            limit: 10,
            offset: 0,
        };

        let (results, total) = registry.search(query).await.unwrap();
        assert_eq!(total, 1);
        assert_eq!(results[0].name, "search-test-tool");
    }
}
