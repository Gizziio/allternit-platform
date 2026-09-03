//! Fabric Model Gateway — token-cost calculation and ledger charging.
//!
//! The HTTP surface lives in `fabric_model_routes.rs`. This module owns the
//! pure business logic: turn a provider/model + token counts into a cost,
//! charge the credits ledger, and record the usage event.

use super::credits::{CreditsError, CreditsLedger};
use super::model_catalog::{FabricModelRecord, ModelCatalog, ModelCatalogError};
use crate::db::DbHandle;
use chrono::Utc;
use uuid::Uuid;

/// Gateway error.
#[derive(Debug, thiserror::Error)]
pub enum ModelGatewayError {
    #[error("model not found: {0}")]
    ModelNotFound(String),
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("catalog error: {0}")]
    Catalog(#[from] ModelCatalogError),
    #[error("credits error: {0}")]
    Credits(#[from] CreditsError),
}

/// Result of a billed inference request.
#[derive(Debug, Clone)]
pub struct ModelUsageResult {
    pub provider_kind: String,
    pub model_id: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub cost_cents: i64,
    pub ledger_entry_id: String,
}

/// Business logic for pricing and charging model usage.
#[derive(Debug, Clone)]
pub struct ModelGateway {
    db: DbHandle,
    catalog: ModelCatalog,
    ledger: CreditsLedger,
}

impl ModelGateway {
    pub fn new(db: DbHandle) -> Self {
        Self {
            db: db.clone(),
            catalog: ModelCatalog::new(db.clone()),
            ledger: CreditsLedger::new(db),
        }
    }

    /// Look up a model and compute the token cost in USD cents.
    pub fn estimate_cost(
        &self,
        full_model_id: &str,
        input_tokens: u32,
        output_tokens: u32,
    ) -> Result<(FabricModelRecord, i64), ModelGatewayError> {
        let model = self
            .catalog
            .get_by_full_id(full_model_id)
            .map_err(ModelGatewayError::Catalog)?
            .ok_or_else(|| ModelGatewayError::ModelNotFound(full_model_id.to_string()))?;

        let input_cents = token_cost(input_tokens, model.input_cents_per_1m);
        let output_cents = token_cost(output_tokens, model.output_cents_per_1m);
        let total_cents = input_cents + output_cents;

        Ok((model, total_cents.max(1)))
    }

    /// Charge the organization's credits ledger and persist a usage event.
    ///
    /// `reference_id` should be the gateway request id so the usage event can
    /// be tied back to the ledger charge.
    pub fn charge_usage(
        &self,
        organization_id: &str,
        full_model_id: &str,
        input_tokens: u32,
        output_tokens: u32,
        reference_id: &str,
    ) -> Result<ModelUsageResult, ModelGatewayError> {
        let (model, cost_cents) =
            self.estimate_cost(full_model_id, input_tokens, output_tokens)?;

        let entry = self.ledger.charge(
            organization_id,
            cost_cents,
            &format!("{} inference: {}/{}", model.provider_kind, model.provider_kind, model.model_id),
            Some("model_usage"),
            Some(reference_id),
        )?;

        let conn = self.db.connect()?;
        conn.execute(
            "INSERT INTO fabric_model_usage_events (
                id, organization_id, provider_kind, model_id,
                input_tokens, output_tokens, cost_cents, ledger_entry_id, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                Uuid::new_v4().to_string(),
                organization_id,
                &model.provider_kind,
                &model.model_id,
                input_tokens,
                output_tokens,
                cost_cents,
                &entry.id,
                Utc::now().to_rfc3339(),
            ],
        )?;

        Ok(ModelUsageResult {
            provider_kind: model.provider_kind,
            model_id: model.model_id,
            input_tokens,
            output_tokens,
            cost_cents,
            ledger_entry_id: entry.id,
        })
    }
}

/// Cost in USD cents for `tokens` at `cents_per_1m` token rate.
/// Rounds up so tiny requests always cost at least one cent when any rate is
/// non-zero; returns 0 only when the rate is 0.
fn token_cost(tokens: u32, cents_per_1m: i64) -> i64 {
    if cents_per_1m <= 0 || tokens == 0 {
        return 0;
    }
    ((tokens as i64) * cents_per_1m + 999_999) / 1_000_000
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> DbHandle {
        let db = DbHandle::new_memory().expect("memory db");
        let conn = db.connect().expect("connect");
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name) VALUES (?1, ?2)",
            rusqlite::params!["org-1", "Test Org"],
        )
        .expect("insert org");
        db
    }

    #[test]
    fn estimate_cost_rounds_up() {
        let db = test_db();
        let gateway = ModelGateway::new(db);
        gateway.catalog.seed_builtin().unwrap();

        let (_, cost) = gateway.estimate_cost("openai/gpt-4o-mini", 1_000_000, 500_000).unwrap();
        // input 15 + output 30 = 45 cents
        assert_eq!(cost, 45);
    }

    #[test]
    fn charge_usage_records_event() {
        let db = test_db();
        let gateway = ModelGateway::new(db);
        gateway.catalog.seed_builtin().unwrap();

        gateway
            .ledger
            .credit(
                "org-1",
                100,
                crate::fabric::credits::TransactionType::Purchase,
                None,
                None,
                None,
                None,
            )
            .unwrap();

        let result = gateway
            .charge_usage("org-1", "openai/gpt-4o-mini", 1_000_000, 500_000, "req-1")
            .unwrap();
        assert_eq!(result.cost_cents, 45);

        let balance = gateway.ledger.balance_cents("org-1").unwrap();
        assert_eq!(balance, 55);

        let conn = gateway.db.connect().unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM fabric_model_usage_events WHERE ledger_entry_id = ?1",
                rusqlite::params![result.ledger_entry_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn insufficient_credits_fails() {
        let db = test_db();
        let gateway = ModelGateway::new(db);
        gateway.catalog.seed_builtin().unwrap();

        let err = gateway
            .charge_usage("org-1", "openai/gpt-4o", 10_000_000, 10_000_000, "req-2")
            .unwrap_err();
        assert!(matches!(err, ModelGatewayError::Credits(CreditsError::InsufficientCredits { .. })));
    }
}
