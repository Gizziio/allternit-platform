//! Fabric usage ingestion.
//!
//! Converts raw usage events (seconds, hours) into cost events and customer
//! ledger charges. A background worker periodically calls `run_batch` to
//! process unprocessed events.

use crate::db::DbHandle;
use crate::fabric::credits::{CreditsError, CreditsLedger};
use chrono::{DateTime, Utc};
use rusqlite::OptionalExtension;
use thiserror::Error;
use tracing::{info, warn};
use uuid::Uuid;

/// A row from `fabric_usage_events`.
#[derive(Debug, Clone)]
pub struct UsageEvent {
    pub id: String,
    pub resource_id: String,
    pub placement_id: Option<String>,
    pub event_type: String,
    pub quantity: f64,
    pub unit: String,
    pub measured_at: DateTime<Utc>,
    pub cost_event_id: Option<String>,
    pub processed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Error)]
pub enum UsageError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("resource not found: {0}")]
    ResourceNotFound(String),
    #[error("no pricing available for resource: {0}")]
    NoPricing(String),
    #[error("invalid unit: {0}")]
    InvalidUnit(String),
    #[error("credits error: {0}")]
    Credits(#[from] CreditsError),
}

/// Database access for usage events and their conversion to cost events.
#[derive(Debug, Clone)]
pub struct UsageIngestor {
    db: DbHandle,
}

impl UsageIngestor {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    fn parse_event(row: &rusqlite::Row) -> Result<UsageEvent, rusqlite::Error> {
        Ok(UsageEvent {
            id: row.get("id")?,
            resource_id: row.get("resource_id")?,
            placement_id: row.get("placement_id")?,
            event_type: row.get("event_type")?,
            quantity: row.get("quantity")?,
            unit: row.get("unit")?,
            measured_at: row.get("measured_at")?,
            cost_event_id: row.get("cost_event_id")?,
            processed_at: row.get("processed_at")?,
        })
    }

    /// Record a raw usage event. Returns the new event id.
    pub fn record_usage_event(
        &self,
        resource_id: &str,
        event_type: &str,
        quantity: f64,
        unit: &str,
        measured_at: Option<DateTime<Utc>>,
        placement_id: Option<&str>,
    ) -> Result<String, UsageError> {
        if quantity <= 0.0 {
            return Err(UsageError::InvalidUnit(format!(
                "quantity must be positive: {quantity}"
            )));
        }
        let id = Uuid::new_v4().to_string();
        let conn = self.db.connect()?;
        let measured_at_str = measured_at.map(|d| d.to_rfc3339());
        conn.execute(
            "INSERT INTO fabric_usage_events (
                id, resource_id, placement_id, event_type, quantity, unit, measured_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, COALESCE(?7, CURRENT_TIMESTAMP))",
            rusqlite::params![
                id,
                resource_id,
                placement_id,
                event_type,
                quantity,
                unit,
                measured_at_str,
            ],
        )?;
        Ok(id)
    }

    /// List unprocessed usage events, oldest first, up to `limit`.
    pub fn list_unprocessed(&self, limit: usize) -> Result<Vec<UsageEvent>, UsageError> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, resource_id, placement_id, event_type, quantity, unit,
                    measured_at, cost_event_id, processed_at
             FROM fabric_usage_events
             WHERE processed_at IS NULL
             ORDER BY measured_at ASC, id ASC
             LIMIT ?1",
        )?;
        let rows = stmt.query_map(rusqlite::params![limit], Self::parse_event)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    /// Process a single usage event: create a cost event and charge the ledger.
    pub fn process_event(&self, event_id: &str, ledger: &CreditsLedger) -> Result<(), UsageError> {
        let mut conn = self.db.connect()?;
        let tx = conn.transaction()?;

        let event: Option<UsageEvent> = tx
            .query_row(
                "SELECT id, resource_id, placement_id, event_type, quantity, unit,
                        measured_at, cost_event_id, processed_at
                 FROM fabric_usage_events
                 WHERE id = ?1",
                rusqlite::params![event_id],
                Self::parse_event,
            )
            .optional()?;
        let event = event.ok_or_else(|| UsageError::ResourceNotFound(event_id.to_string()))?;

        if event.processed_at.is_some() {
            // Already processed; treat as no-op.
            tx.commit()?;
            return Ok(());
        }

        let (organization_id, class): (String, String) = tx
            .query_row(
                "SELECT organization_id, class FROM fabric_resources WHERE id = ?1",
                rusqlite::params![&event.resource_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .optional()?
            .ok_or_else(|| UsageError::ResourceNotFound(event.resource_id.clone()))?;

        // Resolve pricing. Prefer the requested/placement id, then the latest
        // open placement, then the resource class catalog.
        let (
            placement_id,
            retail_price_per_hour_cents,
            provider_cost_per_hour_cents,
            retail_price_per_request_cents,
            provider_cost_per_request_cents,
            retail_price_per_token_cents,
            provider_cost_per_token_cents,
        ) = if let Some(pid) = &event.placement_id {
            tx.query_row(
                "SELECT id,
                        retail_price_per_hour_cents, provider_cost_per_hour_cents,
                        retail_price_per_request_cents, provider_cost_per_request_cents,
                        retail_price_per_token_cents, provider_cost_per_token_cents
                 FROM fabric_placements
                 WHERE id = ?1",
                rusqlite::params![pid],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, i64>(4)?,
                        row.get::<_, i64>(5)?,
                        row.get::<_, i64>(6)?,
                    ))
                },
            )
            .optional()?
            .ok_or_else(|| UsageError::ResourceNotFound(pid.clone()))?
        } else {
            match Self::latest_placement_pricing_tx(&tx, &event.resource_id)? {
                Some(pricing) => pricing,
                None => {
                    let retail = Self::resource_class_pricing_tx(&tx, &event.resource_id, &class)?;
                    (String::new(), retail, retail, 0, 0, 0, 0)
                }
            }
        };

        let (retail_cents, provider_cost_cents) = compute_costs(
            retail_price_per_hour_cents,
            provider_cost_per_hour_cents,
            retail_price_per_request_cents,
            provider_cost_per_request_cents,
            retail_price_per_token_cents,
            provider_cost_per_token_cents,
            event.quantity,
            &event.unit,
        )?;

        let cost_event_id = Uuid::new_v4().to_string();
        let provider_kind: String = if placement_id.is_empty() {
            "unknown".to_string()
        } else {
            tx.query_row(
                "SELECT provider_kind FROM fabric_placements WHERE id = ?1",
                rusqlite::params![&placement_id],
                |row| row.get(0),
            )
            .optional()?
            .unwrap_or_else(|| "unknown".to_string())
        };

        tx.execute(
            "INSERT INTO fabric_cost_events (
                id, resource_id, placement_id, provider_kind, cost_cents, currency, description, recorded_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, 'USD', ?6, ?7)",
            rusqlite::params![
                &cost_event_id,
                &event.resource_id,
                placement_id.as_str().non_empty(),
                &provider_kind,
                provider_cost_cents,
                format!("{} {} {}(s)", event.event_type, event.quantity, event.unit),
                Utc::now().to_rfc3339(),
            ],
        )?;

        tx.execute(
            "UPDATE fabric_usage_events
             SET cost_event_id = ?1, processed_at = ?2
             WHERE id = ?3",
            rusqlite::params![&cost_event_id, Utc::now().to_rfc3339(), &event.id],
        )?;

        tx.commit()?;

        // Charge the customer outside the usage transaction so the two
        // operations do not deadlock on the same file-backed database.
        // If the charge fails due to insufficient credits, the cost event is
        // still recorded and the usage event remains marked processed; a
        // separate reconciliation flow can handle the unpaid charge.
        let charge_result = ledger.charge(
            &organization_id,
            retail_cents,
            &format!("fabric usage: {} {} {}", event.event_type, event.quantity, event.unit),
            Some("usage"),
            Some(&event.id),
        );
        match charge_result {
            Ok(_) => {
                info!(
                    event_id = %event.id,
                    organization_id = %organization_id,
                    retail_cents = retail_cents,
                    "charged usage to ledger"
                );
            }
            Err(CreditsError::InsufficientCredits { balance, required }) => {
                warn!(
                    event_id = %event.id,
                    organization_id = %organization_id,
                    balance = balance,
                    required = required,
                    "usage ledger charge failed due to insufficient credits"
                );
            }
            Err(e) => return Err(UsageError::Credits(e)),
        }

        Ok(())
    }

    /// Process up to `batch_size` unprocessed events. Returns the number processed.
    pub fn run_batch(&self, ledger: &CreditsLedger, batch_size: usize) -> Result<usize, UsageError> {
        let events = self.list_unprocessed(batch_size)?;
        let mut processed = 0;
        for event in events {
            match self.process_event(&event.id, ledger) {
                Ok(()) => processed += 1,
                Err(e) => {
                    warn!(event_id = %event.id, error = %e, "failed to process usage event");
                }
            }
        }
        Ok(processed)
    }

    fn latest_placement_pricing_tx(
        tx: &rusqlite::Transaction,
        resource_id: &str,
    ) -> Result<
        Option<
            (
                String,
                i64,
                i64,
                i64,
                i64,
                i64,
                i64,
            ),
        >,
        UsageError,
    > {
        let row = tx
            .query_row(
                "SELECT id,
                        retail_price_per_hour_cents, provider_cost_per_hour_cents,
                        retail_price_per_request_cents, provider_cost_per_request_cents,
                        retail_price_per_token_cents, provider_cost_per_token_cents
                 FROM fabric_placements
                 WHERE resource_id = ?1 AND ended_at IS NULL
                 ORDER BY started_at DESC, id DESC
                 LIMIT 1",
                rusqlite::params![resource_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, i64>(4)?,
                        row.get::<_, i64>(5)?,
                        row.get::<_, i64>(6)?,
                    ))
                },
            )
            .optional()?;
        Ok(row)
    }

    fn resource_class_pricing_tx(
        tx: &rusqlite::Transaction,
        resource_id: &str,
        class: &str,
    ) -> Result<i64, UsageError> {
        let retail: Option<i64> = tx
            .query_row(
                "SELECT c.retail_price_per_hour_cents
                 FROM fabric_resources r
                 JOIN fabric_resource_classes c
                   ON r.kind = c.kind AND r.class = c.class
                 WHERE r.id = ?1 AND c.class = ?2",
                rusqlite::params![resource_id, class],
                |row| row.get(0),
            )
            .optional()?;
        retail.ok_or_else(|| UsageError::NoPricing(resource_id.to_string()))
    }
}

/// Compute retail and provider costs in USD cents for a usage event.
fn compute_costs(
    retail_price_per_hour_cents: i64,
    provider_cost_per_hour_cents: i64,
    retail_price_per_request_cents: i64,
    provider_cost_per_request_cents: i64,
    retail_price_per_token_cents: i64,
    provider_cost_per_token_cents: i64,
    quantity: f64,
    unit: &str,
) -> Result<(i64, i64), UsageError> {
    let (retail, provider) = match unit {
        "seconds" => (
            (retail_price_per_hour_cents as f64 * quantity / 3600.0).ceil() as i64,
            (provider_cost_per_hour_cents as f64 * quantity / 3600.0).ceil() as i64,
        ),
        "hours" => (
            (retail_price_per_hour_cents as f64 * quantity).ceil() as i64,
            (provider_cost_per_hour_cents as f64 * quantity).ceil() as i64,
        ),
        "request" => (
            (retail_price_per_request_cents as f64 * quantity).ceil() as i64,
            (provider_cost_per_request_cents as f64 * quantity).ceil() as i64,
        ),
        "token" => (
            (retail_price_per_token_cents as f64 * quantity).ceil() as i64,
            (provider_cost_per_token_cents as f64 * quantity).ceil() as i64,
        ),
        other => return Err(UsageError::InvalidUnit(other.to_string())),
    };
    Ok((retail.max(0), provider.max(0)))
}

trait OptionalStr {
    fn non_empty(&self) -> Option<&str>;
}

impl OptionalStr for &str {
    fn non_empty(&self) -> Option<&str> {
        if self.is_empty() {
            None
        } else {
            Some(self)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fabric::credits::{CreditsLedger, TransactionType};
    use crate::db::DbHandle;
    use rusqlite::params;

    fn test_db(org_id: &str) -> DbHandle {
        let db = DbHandle::new_memory().expect("memory db");
        let conn = db.connect().expect("connect");
        conn.execute(
            "INSERT INTO organizations (id, name, status) VALUES (?1, ?2, 'active')",
            params![org_id, format!("Test Org {org_id}")],
        )
        .unwrap();
        db
    }

    fn seed_resource(db: &DbHandle, resource_id: &str, org_id: &str, class: &str) {
        let conn = db.connect().unwrap();
        conn.execute(
            "INSERT INTO fabric_resources (id, organization_id, kind, class, status)
             VALUES (?1, ?2, 'compute', ?3, 'active')",
            params![resource_id, org_id, class],
        )
        .unwrap();
    }

    fn seed_resource_class(db: &DbHandle, class: &str, retail_price_per_hour_cents: i64) {
        let conn = db.connect().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO fabric_resource_classes
             (id, kind, class, vcpu_min, memory_mib_min, gpu_vram_mib_min,
              reliability_tier, retail_price_per_hour_cents,
              retail_price_per_request_cents, retail_price_per_token_cents)
             VALUES (?1, 'compute', ?2, 1, 1024, 0, 'standard', ?3, 0, 0)",
            params![format!("compute.{class}"), class, retail_price_per_hour_cents],
        )
        .unwrap();
    }

    fn seed_placement(
        db: &DbHandle,
        placement_id: &str,
        resource_id: &str,
        retail_price_per_hour_cents: i64,
        provider_cost_per_hour_cents: i64,
    ) {
        let conn = db.connect().unwrap();
        conn.execute(
            "INSERT INTO fabric_placements
             (id, resource_id, provider_kind, provider_resource_id, offer_id, instance_type, region,
              retail_price_per_hour_cents, provider_cost_per_hour_cents,
              retail_price_per_request_cents, provider_cost_per_request_cents,
              retail_price_per_token_cents, provider_cost_per_token_cents, started_at)
             VALUES (?1, ?2, 'fake', 'fake-1', 'off_fake_test', 'fake-cpu-small', 'us-east', ?3, ?4, 0, 0, 0, 0, ?5)",
            params![
                placement_id,
                resource_id,
                retail_price_per_hour_cents,
                provider_cost_per_hour_cents,
                Utc::now().to_rfc3339(),
            ],
        )
        .unwrap();
    }

    fn seed_credits(db: &DbHandle, org_id: &str, cents: i64) {
        let ledger = CreditsLedger::new(db.clone());
        ledger
            .credit(org_id, cents, TransactionType::Purchase, Some("top-up"), None, None, None)
            .unwrap();
    }

    #[test]
    fn record_and_list_unprocessed() {
        let db = test_db("org-1");
        seed_resource(&db, "resource-1", "org-1", "s");
        let ingestor = UsageIngestor::new(db);
        let id = ingestor
            .record_usage_event("resource-1", "compute_seconds", 60.0, "seconds", None, None)
            .unwrap();
        let unprocessed = ingestor.list_unprocessed(10).unwrap();
        assert_eq!(unprocessed.len(), 1);
        assert_eq!(unprocessed[0].id, id);
    }

    #[test]
    fn process_event_creates_cost_event_and_charge() {
        let db = test_db("org-1");
        seed_resource_class(&db, "s", 3600);
        seed_resource(&db, "resource-1", "org-1", "s");
        seed_placement(&db, "placement-1", "resource-1", 3600, 1800);
        seed_credits(&db, "org-1", 10_000);

        let ingestor = UsageIngestor::new(db.clone());
        let ledger = CreditsLedger::new(db.clone());
        let event_id = ingestor
            .record_usage_event("resource-1", "compute_seconds", 3600.0, "seconds", None, None)
            .unwrap();

        ingestor.process_event(&event_id, &ledger).unwrap();

        let conn = db.connect().unwrap();
        let (cost_cents, cost_event_id): (i64, Option<String>) = conn
            .query_row(
                "SELECT c.cost_cents, u.cost_event_id
                 FROM fabric_usage_events u
                 LEFT JOIN fabric_cost_events c ON c.id = u.cost_event_id
                 WHERE u.id = ?1",
                params![&event_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert!(cost_event_id.is_some());
        assert_eq!(cost_cents, 1800);
        assert_eq!(ledger.balance_cents("org-1").unwrap(), 6400);
    }

    #[test]
    fn process_event_uses_resource_class_fallback() {
        let db = test_db("org-1");
        seed_resource_class(&db, "s", 3600);
        seed_resource(&db, "resource-1", "org-1", "s");
        seed_credits(&db, "org-1", 10_000);

        let ingestor = UsageIngestor::new(db.clone());
        let ledger = CreditsLedger::new(db.clone());
        let event_id = ingestor
            .record_usage_event("resource-1", "compute_hours", 2.0, "hours", None, None)
            .unwrap();

        ingestor.process_event(&event_id, &ledger).unwrap();

        assert_eq!(ledger.balance_cents("org-1").unwrap(), 2800);
    }

    #[test]
    fn process_event_invalid_unit_fails() {
        let db = test_db("org-1");
        seed_resource_class(&db, "s", 3600);
        seed_resource(&db, "resource-1", "org-1", "s");
        seed_credits(&db, "org-1", 10_000);

        let ingestor = UsageIngestor::new(db.clone());
        let ledger = CreditsLedger::new(db.clone());
        let event_id = ingestor
            .record_usage_event("resource-1", "tokens", 1000.0, "tokens", None, None)
            .unwrap();

        let err = ingestor.process_event(&event_id, &ledger).unwrap_err();
        assert!(matches!(err, UsageError::InvalidUnit(_)));

        let unprocessed = ingestor.list_unprocessed(10).unwrap();
        assert_eq!(unprocessed.len(), 1);
    }

    #[test]
    fn process_harness_request_event_reconciles_credits() {
        let db = test_db("org-1");
        // Seed harness.gizzi class with a per-request retail price.
        let conn = db.connect().unwrap();
        conn.execute(
            "INSERT INTO fabric_resource_classes
             (id, kind, class, display_name, vcpu_min, memory_mib_min, gpu_vram_mib_min,
              reliability_tier, retail_price_per_hour_cents,
              retail_price_per_request_cents, retail_price_per_token_cents)
             VALUES ('harness.gizzi', 'harness', 'gizzi', 'Gizzi Harness Runtime', 1, 2048, 0,
                     'standard', 8, 5, 0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO fabric_resources (id, organization_id, kind, class, status)
             VALUES ('res-harness-1', 'org-1', 'harness', 'gizzi', 'active')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO fabric_placements
             (id, resource_id, provider_kind, provider_resource_id, offer_id, instance_type, region,
              retail_price_per_hour_cents, provider_cost_per_hour_cents,
              retail_price_per_request_cents, provider_cost_per_request_cents,
              retail_price_per_token_cents, provider_cost_per_token_cents, started_at)
             VALUES ('plc-harness-1', 'res-harness-1', 'fake', 'fake-1', 'off_fake_test',
                     'fake-cpu-small', 'us-east', 8, 4, 5, 5, 0, 0, ?1)",
            params![Utc::now().to_rfc3339()],
        )
        .unwrap();
        drop(conn);

        seed_credits(&db, "org-1", 10_000);

        let ingestor = UsageIngestor::new(db.clone());
        let ledger = CreditsLedger::new(db.clone());
        let event_id = ingestor
            .record_usage_event(
                "res-harness-1",
                "harness.gizzi.session",
                3.0,
                "request",
                Some(Utc::now()),
                Some("plc-harness-1"),
            )
            .unwrap();

        ingestor.process_event(&event_id, &ledger).unwrap();

        // 3 requests @ 5 cents retail = 15 cents; provider cost = 15 cents.
        assert_eq!(ledger.balance_cents("org-1").unwrap(), 9985);

        let conn = db.connect().unwrap();
        let cost_cents: i64 = conn
            .query_row(
                "SELECT cost_cents FROM fabric_cost_events WHERE resource_id = ?1",
                params!["res-harness-1"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(cost_cents, 15);
    }

    #[test]
    fn run_batch_processes_multiple_events() {
        let db = test_db("org-1");
        seed_resource_class(&db, "s", 3600);
        seed_resource(&db, "resource-1", "org-1", "s");
        seed_placement(&db, "placement-1", "resource-1", 3600, 1800);
        seed_credits(&db, "org-1", 10_000);

        let ingestor = UsageIngestor::new(db.clone());
        let ledger = CreditsLedger::new(db.clone());
        ingestor
            .record_usage_event("resource-1", "compute_seconds", 60.0, "seconds", None, None)
            .unwrap();
        ingestor
            .record_usage_event("resource-1", "compute_seconds", 120.0, "seconds", None, None)
            .unwrap();

        let processed = ingestor.run_batch(&ledger, 10).unwrap();
        assert_eq!(processed, 2);
        assert!(ingestor.list_unprocessed(10).unwrap().is_empty());
    }

    #[test]
    fn process_event_insufficient_credits_records_cost_but_marks_processed() {
        let db = test_db("org-1");
        seed_resource_class(&db, "s", 3600);
        seed_resource(&db, "resource-1", "org-1", "s");
        seed_placement(&db, "placement-1", "resource-1", 3600, 1800);
        seed_credits(&db, "org-1", 10); // not enough

        let ingestor = UsageIngestor::new(db.clone());
        let ledger = CreditsLedger::new(db.clone());
        let event_id = ingestor
            .record_usage_event("resource-1", "compute_hours", 1.0, "hours", None, None)
            .unwrap();

        ingestor.process_event(&event_id, &ledger).unwrap();

        let conn = db.connect().unwrap();
        let cost_event_id: Option<String> = conn
            .query_row(
                "SELECT cost_event_id FROM fabric_usage_events WHERE id = ?1",
                params![&event_id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(cost_event_id.is_some());

        let cost_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM fabric_cost_events WHERE resource_id = ?1",
                params!["resource-1"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(cost_count, 1);

        assert!(ingestor.list_unprocessed(10).unwrap().is_empty());
    }
}
