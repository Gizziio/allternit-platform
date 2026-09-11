//! Pre-paid credits ledger for organizations.
//!
//! All metered compute usage deducts from an org's credit balance. Subscriptions,
//! top-ups, and manual grants add to it.
//!
//! This module is a compatibility shim over the canonical fabric credits
//! ledger (`crate::fabric::credits`): the older `organization_credits` /
//! `credit_transactions` tables (V102) are retired and no longer written.
//! Balance, holds, and history all live in `fabric_credits_ledger` /
//! `fabric_credit_holds` now, so the desktop/computer product line and the
//! fabric/agents product line share one balance per organization.

use rusqlite::OptionalExtension;
use tracing::info;

use crate::db::DbHandle;
use crate::fabric::credits::{CreditsLedger, TransactionType};

/// Credit balance snapshot for an organization.
#[derive(Debug, Clone)]
pub struct CreditBalance {
    pub org_id: String,
    pub balance_cents: i64,
    pub lifetime_purchased_cents: i64,
    pub lifetime_consumed_cents: i64,
}

/// Kinds of credit transactions.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CreditTransactionKind {
    Purchase,
    SubscriptionGrant,
    ManualGrant,
    Usage,
    Refund,
}

/// Errors from the credits ledger.
#[derive(Debug, thiserror::Error)]
pub enum CreditsError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("insufficient credits")]
    InsufficientBalance,
    #[error("amount must be positive")]
    NonPositiveAmount,
}

impl From<crate::fabric::credits::CreditsError> for CreditsError {
    fn from(err: crate::fabric::credits::CreditsError) -> Self {
        match err {
            crate::fabric::credits::CreditsError::Db(e) => CreditsError::Db(e),
            crate::fabric::credits::CreditsError::InvalidAmount(_) => {
                CreditsError::NonPositiveAmount
            }
            crate::fabric::credits::CreditsError::InsufficientCredits { .. } => {
                CreditsError::InsufficientBalance
            }
            other => CreditsError::Db(rusqlite::Error::ToSqlConversionFailure(Box::new(
                std::io::Error::new(std::io::ErrorKind::InvalidData, other.to_string()),
            ))),
        }
    }
}

fn kind_to_transaction_type(kind: CreditTransactionKind) -> TransactionType {
    match kind {
        CreditTransactionKind::Purchase => TransactionType::Purchase,
        CreditTransactionKind::SubscriptionGrant | CreditTransactionKind::ManualGrant => {
            TransactionType::Grant
        }
        CreditTransactionKind::Usage => TransactionType::Charge,
        CreditTransactionKind::Refund => TransactionType::Refund,
    }
}

/// The fabric ledger foreign-keys ledger rows to `organizations`; legacy
/// callers passed arbitrary org ids, so make sure the row exists.
fn ensure_org(db: &DbHandle, org_id: &str) -> Result<(), CreditsError> {
    let conn = db.connect()?;
    conn.execute(
        "INSERT OR IGNORE INTO organizations (id, name) VALUES (?1, ?1)",
        rusqlite::params![org_id],
    )?;
    Ok(())
}

/// Read the current balance for an organization. Returns zero if no row exists.
pub fn get_balance(db: &DbHandle, org_id: &str) -> Result<CreditBalance, CreditsError> {
    let ledger = CreditsLedger::new(db.clone());
    let balance_cents = ledger.balance_cents(org_id)?;
    let conn = db.connect()?;
    let lifetime_purchased: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount_cents), 0) FROM fabric_credits_ledger
             WHERE organization_id = ?1 AND amount_cents > 0",
            [org_id],
            |r| r.get(0),
        )
        .optional()?
        .unwrap_or(0);
    let lifetime_consumed: i64 = conn
        .query_row(
            "SELECT COALESCE(-SUM(amount_cents), 0) FROM fabric_credits_ledger
             WHERE organization_id = ?1 AND amount_cents < 0",
            [org_id],
            |r| r.get(0),
        )
        .optional()?
        .unwrap_or(0);
    Ok(CreditBalance {
        org_id: org_id.to_string(),
        balance_cents,
        lifetime_purchased_cents: lifetime_purchased,
        lifetime_consumed_cents: lifetime_consumed,
    })
}

/// Add credits to an organization's balance. Returns the new balance.
pub fn credit(
    db: &DbHandle,
    org_id: &str,
    amount_cents: i64,
    kind: CreditTransactionKind,
    description: Option<&str>,
    reference_id: Option<&str>,
) -> Result<CreditBalance, CreditsError> {
    if amount_cents <= 0 {
        return Err(CreditsError::NonPositiveAmount);
    }
    ensure_org(db, org_id)?;
    let ledger = CreditsLedger::new(db.clone());
    ledger.credit(
        org_id,
        amount_cents,
        kind_to_transaction_type(kind),
        description,
        Some("legacy_credits"),
        reference_id,
        None,
    )?;
    info!(org_id, amount_cents, ?kind, "credited organization");
    get_balance(db, org_id)
}

/// Deduct credits for usage. Returns the new balance.
///
/// Usage has already been consumed, so the charge is recorded even when the
/// balance cannot cover it (the balance goes negative = debt) rather than
/// being dropped.
pub fn consume(
    db: &DbHandle,
    org_id: &str,
    amount_cents: i64,
    description: &str,
    reference_id: Option<&str>,
) -> Result<CreditBalance, CreditsError> {
    if amount_cents <= 0 {
        return Err(CreditsError::NonPositiveAmount);
    }
    ensure_org(db, org_id)?;
    let ledger = CreditsLedger::new(db.clone());
    ledger.charge_overdraft(org_id, amount_cents, description, Some("usage"), reference_id)?;
    info!(org_id, amount_cents, "consumed credits for usage");
    get_balance(db, org_id)
}

/// One-time backfill of legacy `organization_credits` balances (V102) into the
/// fabric credits ledger.
///
/// Runs at every startup; idempotent via `credit_purchase_idempotency` keys
/// (`v102-migration-{org_id}`), so reruns are no-ops. Positive balances become
/// grant rows, negative balances become overdraft debt. After this runs, the
/// legacy table is frozen (no writers remain) and can be dropped in a later
/// release.
pub fn migrate_v102_balances(db: &DbHandle) {
    let orgs: Vec<(String, i64)> = match (|| -> Result<Vec<(String, i64)>, rusqlite::Error> {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT org_id, balance_cents FROM organization_credits WHERE balance_cents != 0",
        )?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
        rows.collect()
    })() {
        Ok(orgs) => orgs,
        Err(e) => {
            tracing::warn!(error = %e, "v102 credits migration: could not read legacy balances");
            return;
        }
    };

    let ledger = CreditsLedger::new(db.clone());
    let mut migrated = 0usize;
    for (org_id, balance_cents) in orgs {
        let key = format!("v102-migration-{org_id}");
        if idempotency_seen(db, &key).unwrap_or(false) {
            continue;
        }
        if let Err(e) = ensure_org(db, &org_id) {
            tracing::warn!(org_id = %org_id, error = %e, "v102 credits migration failed for org");
            continue;
        }
        let result = if balance_cents > 0 {
            ledger
                .credit_with_idempotency(
                    &org_id,
                    balance_cents,
                    TransactionType::Grant,
                    Some("migration from organization_credits (V102)"),
                    Some("v102_migration"),
                    Some("v102-migration"),
                    None,
                    Some(&key),
                )
                .map(|_| ())
        } else {
            match ledger.charge_overdraft(
                &org_id,
                -balance_cents,
                "migration from organization_credits (V102 debt)",
                Some("v102_migration"),
                Some("v102-migration"),
            ) {
                Ok(entry) => record_idempotency(db, &key, &org_id, &entry.id),
                Err(e) => Err(e.into()),
            }
        };
        match result {
            Ok(()) => migrated += 1,
            Err(e) => tracing::warn!(org_id = %org_id, error = %e, "v102 credits migration failed for org"),
        }
    }
    if migrated > 0 {
        info!(migrated, "migrated legacy organization_credits balances to fabric ledger");
    }
}

fn idempotency_seen(db: &DbHandle, key: &str) -> Result<bool, rusqlite::Error> {
    let conn = db.connect()?;
    let seen: Option<String> = conn
        .query_row(
            "SELECT ledger_entry_id FROM credit_purchase_idempotency WHERE idempotency_key = ?1",
            [key],
            |row| row.get(0),
        )
        .optional()?;
    Ok(seen.is_some())
}

fn record_idempotency(
    db: &DbHandle,
    key: &str,
    org_id: &str,
    ledger_entry_id: &str,
) -> Result<(), crate::fabric::credits::CreditsError> {
    let conn = db.connect()?;
    conn.execute(
        "INSERT OR IGNORE INTO credit_purchase_idempotency
         (idempotency_key, organization_id, ledger_entry_id, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![key, org_id, ledger_entry_id, chrono::Utc::now().to_rfc3339()],
    )?;
    Ok(())
}

/// Reserve credits for an estimated future cost (e.g. before provisioning).
///
/// Checks the spendable balance (balance minus open holds) so concurrent
/// provisioning cannot overspend.
pub fn has_minimum_balance(
    db: &DbHandle,
    org_id: &str,
    min_required_cents: i64,
) -> Result<bool, CreditsError> {
    if min_required_cents <= 0 {
        return Ok(true);
    }
    let ledger = CreditsLedger::new(db.clone());
    Ok(ledger.available_cents(org_id)? >= min_required_cents)
}

/// Atomically consume credits if the balance is sufficient; otherwise return
/// `InsufficientBalance` without modifying anything.
pub fn consume_if_sufficient(
    db: &DbHandle,
    org_id: &str,
    amount_cents: i64,
    description: &str,
    reference_id: Option<&str>,
) -> Result<CreditBalance, CreditsError> {
    if amount_cents <= 0 {
        return get_balance(db, org_id);
    }
    ensure_org(db, org_id)?;
    let ledger = CreditsLedger::new(db.clone());
    ledger.charge(org_id, amount_cents, description, Some("usage"), reference_id)?;
    get_balance(db, org_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;

    fn in_memory_db() -> DbHandle {
        DbHandle::new_memory().expect("in-memory db")
    }

    fn create_schema(db: &DbHandle) {
        let conn = db.connect().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name) VALUES ('org-1', 'Test Org')",
            [],
        )
        .unwrap();
    }

    #[test]
    fn balance_starts_at_zero() {
        let db = in_memory_db();
        create_schema(&db);
        let bal = get_balance(&db, "org-1").unwrap();
        assert_eq!(bal.balance_cents, 0);
    }

    #[test]
    fn credit_increases_balance_and_logs_transaction() {
        let db = in_memory_db();
        create_schema(&db);
        let bal = credit(&db, "org-1", 5000, CreditTransactionKind::Purchase, Some("top-up"), None).unwrap();
        assert_eq!(bal.balance_cents, 5000);
        assert_eq!(bal.lifetime_purchased_cents, 5000);

        let ledger = CreditsLedger::new(db.clone());
        let entries = ledger.list("org-1", 10).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].transaction_type, TransactionType::Purchase);
    }

    #[test]
    fn consume_deducts_balance() {
        let db = in_memory_db();
        create_schema(&db);
        credit(&db, "org-1", 1000, CreditTransactionKind::ManualGrant, None, None).unwrap();
        let bal = consume(&db, "org-1", 300, "linux desktop", Some("evt-1")).unwrap();
        assert_eq!(bal.balance_cents, 700);
        assert_eq!(bal.lifetime_consumed_cents, 300);
    }

    #[test]
    fn consume_records_debt_when_insufficient() {
        let db = in_memory_db();
        create_schema(&db);
        credit(&db, "org-1", 100, CreditTransactionKind::ManualGrant, None, None).unwrap();
        let bal = consume(&db, "org-1", 200, "linux desktop", None).unwrap();
        assert_eq!(bal.balance_cents, -100);
        assert_eq!(bal.lifetime_consumed_cents, 200);
    }

    #[test]
    fn consume_if_sufficient_fails_without_debt() {
        let db = in_memory_db();
        create_schema(&db);
        credit(&db, "org-1", 100, CreditTransactionKind::ManualGrant, None, None).unwrap();
        let err = consume_if_sufficient(&db, "org-1", 200, "linux desktop", None).unwrap_err();
        assert!(matches!(err, CreditsError::InsufficientBalance));
        let bal = get_balance(&db, "org-1").unwrap();
        assert_eq!(bal.balance_cents, 100); // unchanged
    }

    #[test]
    fn has_minimum_balance_checks_spendable_balance() {
        let db = in_memory_db();
        create_schema(&db);
        assert!(!has_minimum_balance(&db, "org-1", 1).unwrap());
        credit(&db, "org-1", 1000, CreditTransactionKind::ManualGrant, None, None).unwrap();
        assert!(has_minimum_balance(&db, "org-1", 1000).unwrap());
        assert!(!has_minimum_balance(&db, "org-1", 1001).unwrap());
    }

    #[test]
    fn has_minimum_balance_counts_open_holds() {
        let db = in_memory_db();
        create_schema(&db);
        let conn = db.connect().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO fabric_resources (id, organization_id, kind, class, status)
             VALUES ('resource-1', 'org-1', 'compute', 's', 'active')",
            [],
        )
        .unwrap();
        credit(&db, "org-1", 1000, CreditTransactionKind::ManualGrant, None, None).unwrap();
        let ledger = CreditsLedger::new(db.clone());
        ledger.hold("org-1", "resource-1", 400).unwrap();
        assert!(!has_minimum_balance(&db, "org-1", 700).unwrap());
        assert!(has_minimum_balance(&db, "org-1", 600).unwrap());
    }

    #[test]
    fn migrate_v102_backfills_and_is_idempotent() {
        let db = in_memory_db();
        create_schema(&db);
        let conn = db.connect().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name) VALUES ('org-2', 'Test Org 2')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO organization_credits (org_id, balance_cents) VALUES ('org-1', 750)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO organization_credits (org_id, balance_cents) VALUES ('org-2', -200)",
            [],
        )
        .unwrap();
        drop(conn);

        migrate_v102_balances(&db);
        let ledger = CreditsLedger::new(db.clone());
        assert_eq!(ledger.balance_cents("org-1").unwrap(), 750);
        assert_eq!(ledger.balance_cents("org-2").unwrap(), -200);

        // A rerun must not double-apply balances.
        migrate_v102_balances(&db);
        assert_eq!(ledger.balance_cents("org-1").unwrap(), 750);
        assert_eq!(ledger.balance_cents("org-2").unwrap(), -200);
    }
}
