//! Pre-paid credits ledger for organizations.
//!
//! All metered compute usage deducts from an org's credit balance. Subscriptions,
//! top-ups, and manual grants add to it. The ledger is intentionally simple:
//! one balance row per org plus an immutable transaction log.

use rusqlite::OptionalExtension;
use std::sync::Arc;
use tracing::{info, warn};

use crate::db::DbHandle;

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

impl CreditTransactionKind {
    fn as_str(&self) -> &'static str {
        match self {
            CreditTransactionKind::Purchase => "purchase",
            CreditTransactionKind::SubscriptionGrant => "subscription_grant",
            CreditTransactionKind::ManualGrant => "manual_grant",
            CreditTransactionKind::Usage => "usage",
            CreditTransactionKind::Refund => "refund",
        }
    }
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

/// Read the current balance for an organization. Returns zero if no row exists.
pub fn get_balance(db: &DbHandle, org_id: &str) -> Result<CreditBalance, CreditsError> {
    let conn = db.connect()?;
    let row: Option<(i64, i64, i64)> = conn
        .query_row(
            "SELECT balance_cents, lifetime_purchased_cents, lifetime_consumed_cents \
             FROM organization_credits WHERE org_id = ?1",
            [org_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;

    let (balance, purchased, consumed) = row.unwrap_or((0, 0, 0));
    Ok(CreditBalance {
        org_id: org_id.to_string(),
        balance_cents: balance,
        lifetime_purchased_cents: purchased,
        lifetime_consumed_cents: consumed,
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
    let mut conn = db.connect()?;
    let tx = conn.transaction()?;

    tx.execute(
        "INSERT INTO organization_credits (org_id, balance_cents, lifetime_purchased_cents) \
         VALUES (?1, ?2, ?2) \
         ON CONFLICT(org_id) DO UPDATE SET \
             balance_cents = balance_cents + excluded.balance_cents, \
             lifetime_purchased_cents = lifetime_purchased_cents + excluded.lifetime_purchased_cents",
        rusqlite::params![org_id, amount_cents],
    )?;

    let tx_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO credit_transactions (id, org_id, amount_cents, kind, description, reference_id) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            tx_id.as_str(),
            org_id,
            amount_cents,
            kind.as_str(),
            description.unwrap_or(""),
            reference_id.unwrap_or(""),
        ],
    )?;

    tx.commit()?;
    info!(org_id, amount_cents, kind = ?kind, "credited organization");
    get_balance(db, org_id)
}

/// Deduct credits for usage. Returns the new balance.
///
/// This is atomic: if the balance is too low, no row is changed and
/// `InsufficientBalance` is returned.
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
    let mut conn = db.connect()?;
    let tx = conn.transaction()?;

    // Ensure the org row exists with a zero balance so the UPDATE below is safe.
    tx.execute(
        "INSERT OR IGNORE INTO organization_credits (org_id, balance_cents) VALUES (?1, 0)",
        rusqlite::params![org_id],
    )?;

    let updated = tx.execute(
        "UPDATE organization_credits \
         SET balance_cents = balance_cents - ?1, \
             lifetime_consumed_cents = lifetime_consumed_cents + ?1 \
         WHERE org_id = ?2 AND balance_cents >= ?1",
        rusqlite::params![amount_cents, org_id],
    )?;

    if updated == 0 {
        return Err(CreditsError::InsufficientBalance);
    }

    let tx_id = uuid::Uuid::new_v4().to_string();
    tx.execute(
        "INSERT INTO credit_transactions (id, org_id, amount_cents, kind, description, reference_id) \
         VALUES (?1, ?2, ?3, 'usage', ?4, ?5)",
        rusqlite::params![
            tx_id.as_str(),
            org_id,
            -amount_cents,
            description,
            reference_id.unwrap_or(""),
        ],
    )?;

    tx.commit()?;
    info!(org_id, amount_cents, "consumed credits for usage");
    get_balance(db, org_id)
}

/// Reserve credits for an estimated future cost (e.g. before provisioning).
///
/// This is a simple pessimistic check: it verifies the balance is at least
/// `min_required_cents`. It does not hold/reserve the amount. A true reservation
/// system can be added later if concurrent provisioning becomes a problem.
pub fn has_minimum_balance(
    db: &DbHandle,
    org_id: &str,
    min_required_cents: i64,
) -> Result<bool, CreditsError> {
    if min_required_cents <= 0 {
        return Ok(true);
    }
    let balance = get_balance(db, org_id)?;
    Ok(balance.balance_cents >= min_required_cents)
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
    consume(db, org_id, amount_cents, description, reference_id)
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

        let conn = db.connect().unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM credit_transactions WHERE org_id = 'org-1' AND amount_cents = 5000",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
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
    fn consume_fails_when_insufficient() {
        let db = in_memory_db();
        create_schema(&db);
        credit(&db, "org-1", 100, CreditTransactionKind::ManualGrant, None, None).unwrap();
        let err = consume(&db, "org-1", 200, "linux desktop", None).unwrap_err();
        assert!(matches!(err, CreditsError::InsufficientBalance));
        let bal = get_balance(&db, "org-1").unwrap();
        assert_eq!(bal.balance_cents, 100); // unchanged
    }

    #[test]
    fn has_minimum_balance_checks_threshold() {
        let db = in_memory_db();
        create_schema(&db);
        assert!(!has_minimum_balance(&db, "org-1", 1).unwrap());
        credit(&db, "org-1", 1000, CreditTransactionKind::ManualGrant, None, None).unwrap();
        assert!(has_minimum_balance(&db, "org-1", 1000).unwrap());
        assert!(!has_minimum_balance(&db, "org-1", 1001).unwrap());
    }
}
