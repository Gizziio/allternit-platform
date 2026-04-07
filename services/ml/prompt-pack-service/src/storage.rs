use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::models::{PromptPack, PromptReceipt, RenderResult};

/// StorageManager handles all persistence: SQLite for metadata, filesystem for content
pub struct StorageManager {
    pool: Pool<Sqlite>,
    data_dir: PathBuf,
    packs_dir: PathBuf,
    receipts_dir: PathBuf,
    cache_dir: PathBuf,
}

impl StorageManager {
    pub async fn new(data_dir: &str) -> Result<Self> {
        let data_path = PathBuf::from(data_dir);
        let packs_dir = data_path.join("packs");
        let receipts_dir = data_path.join("receipts");
        let cache_dir = data_path.join("cache");

        // Create directories
        tokio::fs::create_dir_all(&packs_dir).await?;
        tokio::fs::create_dir_all(&receipts_dir).await?;
        tokio::fs::create_dir_all(&cache_dir).await?;

        // Setup SQLite
        let db_path = data_path.join("prompt_pack.db");
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&format!("sqlite:{}", db_path.display()))
            .await?;

        // Run migrations
        Self::run_migrations(&pool).await?;

        Ok(Self {
            pool,
            data_dir: data_path,
            packs_dir,
            receipts_dir,
            cache_dir,
        })
    }

    async fn run_migrations(pool: &Pool<Sqlite>) -> Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS packs (
                id TEXT PRIMARY KEY,
                pack_id TEXT NOT NULL,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                metadata TEXT NOT NULL,  -- JSON
                created_at TEXT NOT NULL,
                UNIQUE(pack_id, version)
            );

            CREATE INDEX IF NOT EXISTS idx_packs_pack_id ON packs(pack_id);
            CREATE INDEX IF NOT EXISTS idx_packs_version ON packs(version);
            CREATE INDEX IF NOT EXISTS idx_packs_content_hash ON packs(content_hash);

            CREATE TABLE IF NOT EXISTS receipts (
                id TEXT PRIMARY KEY,
                receipt_id TEXT NOT NULL UNIQUE,
                pack_id TEXT NOT NULL,
                prompt_id TEXT NOT NULL,
                version TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                rendered_hash TEXT NOT NULL,
                variables_hash TEXT NOT NULL,
                rendered_at TEXT NOT NULL,
                rails_ledger_tx TEXT,
                data TEXT NOT NULL  -- JSON
            );

            CREATE INDEX IF NOT EXISTS idx_receipts_pack ON receipts(pack_id);
            CREATE INDEX IF NOT EXISTS idx_receipts_receipt_id ON receipts(receipt_id);
            "#,
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Store a pack
    pub async fn store_pack(&self, pack: &PromptPack) -> Result<()> {
        let metadata = serde_json::to_string(pack)?;
        let created_at = pack.created_at.to_rfc3339();

        sqlx::query(
            r#"
            INSERT INTO packs (id, pack_id, name, version, content_hash, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(pack_id, version) DO UPDATE SET
                name = excluded.name,
                content_hash = excluded.content_hash,
                metadata = excluded.metadata
            "#,
        )
        .bind(&pack.content_hash)
        .bind(&pack.pack_id)
        .bind(&pack.name)
        .bind(&pack.version)
        .bind(&pack.content_hash)
        .bind(&metadata)
        .bind(&created_at)
        .execute(&self.pool)
        .await?;

        // Store pack files on disk
        let pack_dir = self.packs_dir.join(&pack.pack_id).join(&pack.version);
        tokio::fs::create_dir_all(&pack_dir).await?;
        
        let pack_file = pack_dir.join("pack.json");
        tokio::fs::write(&pack_file, metadata).await?;

        Ok(())
    }

    /// Get a pack by ID and version
    pub async fn get_pack(&self, pack_id: &str, version: &str) -> Result<Option<PromptPack>> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT metadata FROM packs WHERE pack_id = ? AND version = ?"
        )
        .bind(pack_id)
        .bind(version)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some((metadata,)) => {
                let pack: PromptPack = serde_json::from_str(&metadata)?;
                Ok(Some(pack))
            }
            None => Ok(None),
        }
    }

    /// Get latest version of a pack
    pub async fn get_latest_version(&self, pack_id: &str) -> Result<Option<String>> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT version FROM packs WHERE pack_id = ? ORDER BY created_at DESC LIMIT 1"
        )
        .bind(pack_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| r.0))
    }

    /// List all versions of a pack
    pub async fn list_versions(&self, pack_id: &str) -> Result<Vec<String>> {
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT version FROM packs WHERE pack_id = ? ORDER BY created_at"
        )
        .bind(pack_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| r.0).collect())
    }

    /// List all packs
    pub async fn list_packs(&self) -> Result<Vec<(String, String, String)>> {
        // pack_id, name, latest_version
        let rows: Vec<(String, String, String)> = sqlx::query_as(
            r#"
            SELECT p.pack_id, p.name, p.version as latest_version
            FROM packs p
            INNER JOIN (
                SELECT pack_id, MAX(created_at) as max_created
                FROM packs
                GROUP BY pack_id
            ) pm ON p.pack_id = pm.pack_id AND p.created_at = pm.max_created
            ORDER BY p.pack_id
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    /// Store a receipt
    pub async fn store_receipt(&self, receipt: &PromptReceipt) -> Result<()> {
        let data = serde_json::to_string(receipt)?;
        let rendered_at = receipt.rendered_at.to_rfc3339();

        sqlx::query(
            r#"
            INSERT INTO receipts 
            (id, receipt_id, pack_id, prompt_id, version, content_hash, rendered_hash, 
             variables_hash, rendered_at, rails_ledger_tx, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&receipt.receipt_id)
        .bind(&receipt.receipt_id)
        .bind(&receipt.pack_id)
        .bind(&receipt.prompt_id)
        .bind(&receipt.version)
        .bind(&receipt.content_hash)
        .bind(&receipt.rendered_hash)
        .bind(&receipt.variables_hash)
        .bind(&rendered_at)
        .bind(&receipt.rails_ledger_tx)
        .bind(&data)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get a receipt by ID
    pub async fn get_receipt(&self, receipt_id: &str) -> Result<Option<PromptReceipt>> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT data FROM receipts WHERE receipt_id = ?"
        )
        .bind(receipt_id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some((data,)) => {
                let receipt: PromptReceipt = serde_json::from_str(&data)?;
                Ok(Some(receipt))
            }
            None => Ok(None),
        }
    }

    /// Update receipt with Rails ledger transaction
    pub async fn record_ledger_tx(
        &self,
        receipt_id: &str,
        ledger_tx: &str,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE receipts SET rails_ledger_tx = ? WHERE receipt_id = ?"
        )
        .bind(ledger_tx)
        .bind(receipt_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Store rendered output in content-addressed cache
    pub async fn cache_rendered(
        &self,
        content_hash: &str,
        rendered: &str,
    ) -> Result<()> {
        let cache_path = self.cache_dir.join(&content_hash[..2]).join(content_hash);
        tokio::fs::create_dir_all(cache_path.parent().unwrap()).await?;
        tokio::fs::write(&cache_path, rendered).await?;
        Ok(())
    }

    /// Get cached rendered output
    pub async fn get_cached_rendered(&self, content_hash: &str) -> Result<Option<String>> {
        let cache_path = self.cache_dir.join(&content_hash[..2]).join(content_hash);
        
        if cache_path.exists() {
            let content = tokio::fs::read_to_string(&cache_path).await?;
            Ok(Some(content))
        } else {
            Ok(None)
        }
    }

    /// Get pack directory path
    pub fn pack_dir(&self, pack_id: &str, version: &str) -> PathBuf {
        self.packs_dir.join(pack_id).join(version)
    }

    /// Get template content
    pub async fn get_template(&self, pack_id: &str, version: &str, template_path: &str) -> Result<String> {
        let full_path = self.pack_dir(pack_id, version).join(template_path);
        let content = tokio::fs::read_to_string(&full_path).await
            .with_context(|| format!("Failed to read template: {}", full_path.display()))?;
        Ok(content)
    }

    /// Store template content
    pub async fn store_template(
        &self,
        pack_id: &str,
        version: &str,
        template_path: &str,
        content: &str,
    ) -> Result<()> {
        let pack_dir = self.pack_dir(pack_id, version);
        tokio::fs::create_dir_all(&pack_dir).await?;
        
        let full_path = pack_dir.join(template_path);
        if let Some(parent) = full_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        
        tokio::fs::write(&full_path, content).await?;
        Ok(())
    }
}
