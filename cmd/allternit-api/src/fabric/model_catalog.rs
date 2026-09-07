//! Fabric model catalog — canonical cost-per-token ledger for inference.
//!
//! The Model Gateway reads from this catalog to price requests, record usage,
//! and charge the Allternit Credits ledger. The catalog is seeded from the
//! same planning prices used by the OpenAI/Together/Fireworks provider
//! adapters in `cmd/allternit-computer-cloud`.

use crate::db::DbHandle;
use chrono::{DateTime, Utc};
use rusqlite::OptionalExtension;
use uuid::Uuid;

/// A single model entry in the Fabric catalog.
#[derive(Debug, Clone)]
pub struct FabricModelRecord {
    pub id: String,
    pub provider_kind: String,
    pub model_id: String,
    pub display_name: String,
    pub input_cents_per_1m: i64,
    pub output_cents_per_1m: i64,
    pub context_tokens: u32,
    pub quality_tier: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Error type for catalog operations.
#[derive(Debug, thiserror::Error)]
pub enum ModelCatalogError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("model not found: {0}")]
    NotFound(String),
}

/// Database access for the Fabric model catalog.
#[derive(Debug, Clone)]
pub struct ModelCatalog {
    db: DbHandle,
}

impl ModelCatalog {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    /// Seed the built-in model catalog. Idempotent — safe to call at startup.
    pub fn seed_builtin(&self) -> Result<(), ModelCatalogError> {
        let mut conn = self.db.connect()?;
        let tx = conn.transaction()?;
        for entry in builtin_catalog() {
            tx.execute(
                "INSERT INTO fabric_model_catalog (
                    id, provider_kind, model_id, display_name,
                    input_cents_per_1m, output_cents_per_1m, context_tokens,
                    quality_tier, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                ON CONFLICT(provider_kind, model_id) DO UPDATE SET
                    display_name = excluded.display_name,
                    input_cents_per_1m = excluded.input_cents_per_1m,
                    output_cents_per_1m = excluded.output_cents_per_1m,
                    context_tokens = excluded.context_tokens,
                    quality_tier = excluded.quality_tier,
                    updated_at = excluded.updated_at",
                rusqlite::params![
                    entry.id,
                    entry.provider_kind,
                    entry.model_id,
                    entry.display_name,
                    entry.input_cents_per_1m,
                    entry.output_cents_per_1m,
                    entry.context_tokens,
                    entry.quality_tier,
                    entry.created_at.to_rfc3339(),
                    entry.updated_at.to_rfc3339(),
                ],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    /// List every model in the catalog, ordered by provider then model id.
    pub fn list(&self) -> Result<Vec<FabricModelRecord>, ModelCatalogError> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, provider_kind, model_id, display_name,
                    input_cents_per_1m, output_cents_per_1m, context_tokens,
                    quality_tier, created_at, updated_at
             FROM fabric_model_catalog
             ORDER BY provider_kind, model_id",
        )?;
        let rows = stmt.query_map([], Self::parse_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    /// Fetch a model by provider kind and model id.
    pub fn get(
        &self,
        provider_kind: &str,
        model_id: &str,
    ) -> Result<Option<FabricModelRecord>, ModelCatalogError> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, provider_kind, model_id, display_name,
                    input_cents_per_1m, output_cents_per_1m, context_tokens,
                    quality_tier, created_at, updated_at
             FROM fabric_model_catalog
             WHERE provider_kind = ?1 AND model_id = ?2",
        )?;
        stmt.query_row(
            rusqlite::params![provider_kind, model_id],
            Self::parse_row,
        )
        .optional()
        .map_err(Into::into)
    }

    /// Fetch a model by its full gateway id (`provider/model_id`).
    pub fn get_by_full_id(
        &self,
        full_id: &str,
    ) -> Result<Option<FabricModelRecord>, ModelCatalogError> {
        let (provider_kind, model_id) = parse_full_id(full_id)?;
        self.get(provider_kind, model_id)
    }

    fn parse_row(row: &rusqlite::Row) -> Result<FabricModelRecord, rusqlite::Error> {
        Ok(FabricModelRecord {
            id: row.get("id")?,
            provider_kind: row.get("provider_kind")?,
            model_id: row.get("model_id")?,
            display_name: row.get("display_name")?,
            input_cents_per_1m: row.get("input_cents_per_1m")?,
            output_cents_per_1m: row.get("output_cents_per_1m")?,
            context_tokens: row.get::<_, i64>("context_tokens")? as u32,
            quality_tier: row.get("quality_tier")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

/// Parse a full gateway model id like `openai/gpt-4o` or
/// `together/meta-llama/Llama-3.3-70B-Instruct-Turbo`.
/// The provider kind is the first segment; everything after the first `/` is
/// the provider-specific model id.
pub fn parse_full_id(full_id: &str) -> Result<(&str, &str), ModelCatalogError> {
    let (provider_kind, model_id) = full_id
        .split_once('/')
        .ok_or_else(|| ModelCatalogError::NotFound(full_id.to_string()))?;
    if provider_kind.is_empty() || model_id.is_empty() {
        return Err(ModelCatalogError::NotFound(full_id.to_string()));
    }
    Ok((provider_kind, model_id))
}

fn builtin_catalog() -> Vec<FabricModelRecord> {
    let now = Utc::now();
    let mut entries = Vec::new();

    for (provider_kind, model_id, display_name, input_cents, output_cents, context_tokens, quality_tier) in [
        // OpenAI
        ("openai", "gpt-4o-mini", "GPT-4o mini", 15, 60, 128_000, "fast"),
        ("openai", "gpt-4o", "GPT-4o", 250, 1000, 128_000, "high"),
        ("openai", "gpt-4.1-mini", "GPT-4.1 mini", 40, 160, 1_000_000, "fast"),
        ("openai", "gpt-4.1", "GPT-4.1", 200, 800, 1_000_000, "high"),
        ("openai", "o3-mini", "o3-mini", 110, 440, 200_000, "reasoning"),
        // Together
        ("together", "meta-llama/Llama-3.3-70B-Instruct-Turbo", "Llama 3.3 70B Instruct Turbo", 88, 88, 131_072, "high"),
        ("together", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", "Llama 3.1 8B Instruct Turbo", 18, 18, 131_072, "fast"),
        ("together", "deepseek-ai/DeepSeek-R1-Distill-Llama-70B", "DeepSeek R1 Distill Llama 70B", 90, 99, 131_072, "reasoning"),
        ("together", "Qwen/Qwen2.5-72B-Instruct-Turbo", "Qwen2.5 72B Instruct Turbo", 120, 120, 131_072, "high"),
        // Fireworks
        ("fireworks", "accounts/fireworks/models/llama-v3p1-8b-instruct", "Llama 3.1 8B Instruct", 20, 20, 131_072, "fast"),
        ("fireworks", "accounts/fireworks/models/llama-v3p1-70b-instruct", "Llama 3.1 70B Instruct", 90, 90, 131_072, "high"),
        ("fireworks", "accounts/fireworks/models/deepseek-r1", "DeepSeek R1", 80, 240, 131_072, "reasoning"),
        ("fireworks", "accounts/fireworks/models/qwen2p5-72b-instruct", "Qwen2.5 72B Instruct", 90, 90, 131_072, "high"),
    ] {
        entries.push(FabricModelRecord {
            id: Uuid::new_v4().to_string(),
            provider_kind: provider_kind.to_string(),
            model_id: model_id.to_string(),
            display_name: display_name.to_string(),
            input_cents_per_1m: input_cents,
            output_cents_per_1m: output_cents,
            context_tokens,
            quality_tier: quality_tier.to_string(),
            created_at: now,
            updated_at: now,
        });
    }

    entries
}
