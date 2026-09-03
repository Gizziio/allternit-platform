//! Allternit Credits ledger.
//!
//! One prepaid balance per organization. Every transaction is immutable and
//! signed with the resulting balance. Holds are used during placement to
//! prevent concurrent requests from overspending.

use crate::db::DbHandle;
use chrono::{DateTime, Utc};
use rusqlite::OptionalExtension;
use thiserror::Error;
use tracing::{info, warn};
use uuid::Uuid;

/// Type of credit ledger transaction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransactionType {
    Purchase,
    Grant,
    Charge,
    Refund,
    Expiration,
}

impl TransactionType {
    pub fn as_str(&self) -> &'static str {
        match self {
            TransactionType::Purchase => "purchase",
            TransactionType::Grant => "grant",
            TransactionType::Charge => "charge",
            TransactionType::Refund => "refund",
            TransactionType::Expiration => "expiration",
        }
    }
}

impl std::str::FromStr for TransactionType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "purchase" => Ok(TransactionType::Purchase),
            "grant" => Ok(TransactionType::Grant),
            "charge" => Ok(TransactionType::Charge),
            "refund" => Ok(TransactionType::Refund),
            "expiration" => Ok(TransactionType::Expiration),
            other => Err(format!("unknown transaction type: {other}")),
        }
    }
}

/// A single credits ledger row.
#[derive(Debug, Clone)]
pub struct CreditLedgerEntry {
    pub id: String,
    pub organization_id: String,
    pub transaction_type: TransactionType,
    pub amount_cents: i64,
    pub balance_cents_after: i64,
    pub description: Option<String>,
    pub reference_type: Option<String>,
    pub reference_id: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// State of a credit hold.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HoldStatus {
    Held,
    Charged,
    Released,
}

impl HoldStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            HoldStatus::Held => "held",
            HoldStatus::Charged => "charged",
            HoldStatus::Released => "released",
        }
    }
}

impl std::str::FromStr for HoldStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "held" => Ok(HoldStatus::Held),
            "charged" => Ok(HoldStatus::Charged),
            "released" => Ok(HoldStatus::Released),
            other => Err(format!("unknown hold status: {other}")),
        }
    }
}

/// A credit hold placed during provisioning.
#[derive(Debug, Clone)]
pub struct CreditHold {
    pub id: String,
    pub organization_id: String,
    pub resource_id: String,
    pub hold_cents: i64,
    pub status: HoldStatus,
    pub created_at: DateTime<Utc>,
    pub released_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Error)]
pub enum CreditsError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("insufficient credits: balance {balance} cents, required {required} cents")]
    InsufficientCredits { balance: i64, required: i64 },
    #[error("hold not found: {0}")]
    HoldNotFound(String),
    #[error("hold already finalized: {0}")]
    HoldAlreadyFinalized(String),
    #[error("invalid amount: {0}")]
    InvalidAmount(i64),
}

/// Database access for the credits ledger and holds.
#[derive(Debug, Clone)]
pub struct CreditsLedger {
    db: DbHandle,
}

impl CreditsLedger {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    fn parse_entry(row: &rusqlite::Row) -> Result<CreditLedgerEntry, rusqlite::Error> {
        let type_str: String = row.get("transaction_type")?;
        let transaction_type = type_str
            .parse::<TransactionType>()
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, e)),
            ))?;
        Ok(CreditLedgerEntry {
            id: row.get("id")?,
            organization_id: row.get("organization_id")?,
            transaction_type,
            amount_cents: row.get("amount_cents")?,
            balance_cents_after: row.get("balance_cents_after")?,
            description: row.get("description")?,
            reference_type: row.get("reference_type")?,
            reference_id: row.get("reference_id")?,
            expires_at: row.get("expires_at")?,
            created_at: row.get("created_at")?,
        })
    }

    /// Current balance in USD cents for an organization.
    pub fn balance_cents(&self, organization_id: &str) -> Result<i64, CreditsError> {
        let conn = self.db.connect()?;
        let balance: Option<i64> = conn
            .query_row(
                "SELECT balance_cents_after FROM fabric_credits_ledger
                 WHERE organization_id = ?1
                 ORDER BY created_at DESC, id DESC
                 LIMIT 1",
                rusqlite::params![organization_id],
                |row| row.get(0),
            )
            .optional()?;
        Ok(balance.unwrap_or(0))
    }

    /// Total held credits for an organization.
    pub fn held_cents(&self, organization_id: &str) -> Result<i64, CreditsError> {
        let conn = self.db.connect()?;
        let held: Option<i64> = conn
            .query_row(
                "SELECT COALESCE(SUM(hold_cents), 0) FROM fabric_credit_holds
                 WHERE organization_id = ?1 AND status = 'held'",
                rusqlite::params![organization_id],
                |row| row.get(0),
            )
            .optional()?;
        Ok(held.unwrap_or(0))
    }

    /// Spendable balance = balance - held.
    pub fn available_cents(&self, organization_id: &str) -> Result<i64, CreditsError> {
        Ok(self.balance_cents(organization_id)? - self.held_cents(organization_id)?)
    }

    /// Add credits to the ledger (purchase or grant) with an optional idempotency key.
    ///
    /// If the key has been seen before, the existing ledger entry is returned and
    /// no new balance is credited. The ledger insert and idempotency record are
    /// committed in the same transaction.
    pub fn credit_with_idempotency(
        &self,
        organization_id: &str,
        amount_cents: i64,
        transaction_type: TransactionType,
        description: Option<&str>,
        reference_type: Option<&str>,
        reference_id: Option<&str>,
        expires_at: Option<DateTime<Utc>>,
        idempotency_key: Option<&str>,
    ) -> Result<CreditLedgerEntry, CreditsError> {
        if amount_cents <= 0 {
            return Err(CreditsError::InvalidAmount(amount_cents));
        }

        let mut conn = self.db.connect()?;
        let tx = conn.transaction()?;

        // Reuse an earlier result for the same idempotency key.
        if let Some(key) = idempotency_key {
            let existing: Option<String> = tx
                .query_row(
                    "SELECT ledger_entry_id FROM credit_purchase_idempotency
                     WHERE idempotency_key = ?1",
                    rusqlite::params![key],
                    |row| row.get(0),
                )
                .optional()?;
            if let Some(ledger_entry_id) = existing {
                let mut stmt = tx.prepare(
                    "SELECT id, organization_id, transaction_type, amount_cents,
                            balance_cents_after, description, reference_type, reference_id,
                            expires_at, created_at
                     FROM fabric_credits_ledger
                     WHERE id = ?1"
                )?;
                let entry = stmt.query_row(rusqlite::params![ledger_entry_id], Self::parse_entry)?;
                return Ok(entry);
            }
        }

        let balance: Option<i64> = tx
            .query_row(
                "SELECT balance_cents_after FROM fabric_credits_ledger
                 WHERE organization_id = ?1
                 ORDER BY created_at DESC, id DESC
                 LIMIT 1",
                rusqlite::params![organization_id],
                |row| row.get(0),
            )
            .optional()?;
        let balance_after = balance.unwrap_or(0) + amount_cents;
        let id = Uuid::new_v4().to_string();

        tx.execute(
            "INSERT INTO fabric_credits_ledger (
                id, organization_id, transaction_type, amount_cents,
                balance_cents_after, description, reference_type, reference_id,
                expires_at, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                id,
                organization_id,
                transaction_type.as_str(),
                amount_cents,
                balance_after,
                description,
                reference_type,
                reference_id,
                expires_at.map(|d| d.to_rfc3339()),
                Utc::now().to_rfc3339(),
            ],
        )?;

        if let Some(key) = idempotency_key {
            tx.execute(
                "INSERT INTO credit_purchase_idempotency
                 (idempotency_key, organization_id, ledger_entry_id, created_at)
                 VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![key, organization_id, &id, Utc::now().to_rfc3339()],
            )?;
        }

        tx.commit()?;

        self.get_entry(&id)?.ok_or_else(|| {
            CreditsError::Db(rusqlite::Error::QueryReturnedNoRows)
        })
    }

    /// Add credits to the ledger (purchase or grant).
    pub fn credit(
        &self,
        organization_id: &str,
        amount_cents: i64,
        transaction_type: TransactionType,
        description: Option<&str>,
        reference_type: Option<&str>,
        reference_id: Option<&str>,
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<CreditLedgerEntry, CreditsError> {
        if amount_cents <= 0 {
            return Err(CreditsError::InvalidAmount(amount_cents));
        }
        let id = Uuid::new_v4().to_string();
        let balance_after = self.balance_cents(organization_id)? + amount_cents;
        let conn = self.db.connect()?;
        conn.execute(
            "INSERT INTO fabric_credits_ledger (
                id, organization_id, transaction_type, amount_cents,
                balance_cents_after, description, reference_type, reference_id,
                expires_at, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                id,
                organization_id,
                transaction_type.as_str(),
                amount_cents,
                balance_after,
                description,
                reference_type,
                reference_id,
                expires_at.map(|d| d.to_rfc3339()),
                Utc::now().to_rfc3339(),
            ],
        )?;
        info!(
            organization_id,
            amount_cents,
            balance_after,
            ?transaction_type,
            "credited organization"
        );
        self.get_entry(&id)?.ok_or_else(|| {
            CreditsError::Db(rusqlite::Error::QueryReturnedNoRows)
        })
    }

    /// Charge credits immediately.
    pub fn charge(
        &self,
        organization_id: &str,
        amount_cents: i64,
        description: &str,
        reference_type: Option<&str>,
        reference_id: Option<&str>,
    ) -> Result<CreditLedgerEntry, CreditsError> {
        if amount_cents <= 0 {
            return Err(CreditsError::InvalidAmount(amount_cents));
        }
        let available = self.available_cents(organization_id)?;
        if available < amount_cents {
            return Err(CreditsError::InsufficientCredits {
                balance: self.balance_cents(organization_id)?,
                required: amount_cents,
            });
        }
        let id = Uuid::new_v4().to_string();
        let balance_after = self.balance_cents(organization_id)? - amount_cents;
        let conn = self.db.connect()?;
        conn.execute(
            "INSERT INTO fabric_credits_ledger (
                id, organization_id, transaction_type, amount_cents,
                balance_cents_after, description, reference_type, reference_id,
                expires_at, created_at
            ) VALUES (?1, ?2, 'charge', ?3, ?4, ?5, ?6, ?7, NULL, ?8)",
            rusqlite::params![
                id,
                organization_id,
                -amount_cents,
                balance_after,
                description,
                reference_type,
                reference_id,
                Utc::now().to_rfc3339(),
            ],
        )?;
        info!(
            organization_id,
            amount_cents,
            balance_after,
            "charged organization"
        );
        self.get_entry(&id)?.ok_or_else(|| {
            CreditsError::Db(rusqlite::Error::QueryReturnedNoRows)
        })
    }

    /// Place a hold so that concurrent provisioning cannot overspend.
    pub fn hold(
        &self,
        organization_id: &str,
        resource_id: &str,
        hold_cents: i64,
    ) -> Result<CreditHold, CreditsError> {
        if hold_cents <= 0 {
            return Err(CreditsError::InvalidAmount(hold_cents));
        }
        let available = self.available_cents(organization_id)?;
        if available < hold_cents {
            return Err(CreditsError::InsufficientCredits {
                balance: self.balance_cents(organization_id)?,
                required: hold_cents,
            });
        }
        let id = Uuid::new_v4().to_string();
        let conn = self.db.connect()?;
        conn.execute(
            "INSERT INTO fabric_credit_holds (
                id, organization_id, resource_id, hold_cents, status, created_at
            ) VALUES (?1, ?2, ?3, ?4, 'held', ?5)",
            rusqlite::params![
                id,
                organization_id,
                resource_id,
                hold_cents,
                Utc::now().to_rfc3339(),
            ],
        )?;
        Ok(CreditHold {
            id,
            organization_id: organization_id.to_string(),
            resource_id: resource_id.to_string(),
            hold_cents,
            status: HoldStatus::Held,
            created_at: Utc::now(),
            released_at: None,
        })
    }

    /// Convert a held amount into a charge and release the remainder.
    ///
    /// The hold already reserves the funds, so the charge is applied directly
    /// against the organization's balance (not the spendable balance). Any
    /// uncharged portion of the hold is effectively released when the hold is
    /// marked charged.
    pub fn charge_hold(
        &self,
        hold_id: &str,
        charge_cents: i64,
        description: &str,
        reference_type: Option<&str>,
        reference_id: Option<&str>,
    ) -> Result<Option<CreditLedgerEntry>, CreditsError> {
        if charge_cents < 0 {
            return Err(CreditsError::InvalidAmount(charge_cents));
        }
        let hold = self.get_hold(hold_id)?;
        let hold = hold.ok_or_else(|| CreditsError::HoldNotFound(hold_id.to_string()))?;
        if hold.status != HoldStatus::Held {
            return Err(CreditsError::HoldAlreadyFinalized(hold_id.to_string()));
        }
        if charge_cents > hold.hold_cents {
            return Err(CreditsError::InsufficientCredits {
                balance: hold.hold_cents,
                required: charge_cents,
            });
        }

        let mut conn = self.db.connect()?;
        let tx = conn.transaction()?;

        tx.execute(
            "UPDATE fabric_credit_holds
             SET status = 'charged', released_at = CURRENT_TIMESTAMP
             WHERE id = ?1",
            rusqlite::params![hold_id],
        )?;

        let entry = if charge_cents > 0 {
            let balance: Option<i64> = tx
                .query_row(
                    "SELECT balance_cents_after FROM fabric_credits_ledger
                     WHERE organization_id = ?1
                     ORDER BY created_at DESC, id DESC
                     LIMIT 1",
                    rusqlite::params![hold.organization_id],
                    |row| row.get(0),
                )
                .optional()?;
            let balance_before = balance.unwrap_or(0);
            if balance_before < charge_cents {
                return Err(CreditsError::InsufficientCredits {
                    balance: balance_before,
                    required: charge_cents,
                });
            }
            let balance_after = balance_before - charge_cents;
            let id = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO fabric_credits_ledger (
                    id, organization_id, transaction_type, amount_cents,
                    balance_cents_after, description, reference_type, reference_id,
                    expires_at, created_at
                ) VALUES (?1, ?2, 'charge', ?3, ?4, ?5, ?6, ?7, NULL, ?8)",
                rusqlite::params![
                    id,
                    hold.organization_id,
                    -charge_cents,
                    balance_after,
                    description,
                    reference_type,
                    reference_id,
                    Utc::now().to_rfc3339(),
                ],
            )?;
            Some(tx.query_row(
                "SELECT id, organization_id, transaction_type, amount_cents,
                        balance_cents_after, description, reference_type, reference_id,
                        expires_at, created_at
                 FROM fabric_credits_ledger
                 WHERE id = ?1",
                rusqlite::params![id],
                Self::parse_entry,
            )?)
        } else {
            None
        };

        tx.commit()?;
        Ok(entry)
    }

    /// Release a hold without charging.
    pub fn release_hold(&self, hold_id: &str) -> Result<(), CreditsError> {
        let hold = self.get_hold(hold_id)?;
        let hold = hold.ok_or_else(|| CreditsError::HoldNotFound(hold_id.to_string()))?;
        if hold.status != HoldStatus::Held {
            return Err(CreditsError::HoldAlreadyFinalized(hold_id.to_string()));
        }
        let conn = self.db.connect()?;
        conn.execute(
            "UPDATE fabric_credit_holds
             SET status = 'released', released_at = CURRENT_TIMESTAMP
             WHERE id = ?1",
            rusqlite::params![hold_id],
        )?;
        Ok(())
    }

    fn get_entry(&self, id: &str) -> Result<Option<CreditLedgerEntry>, CreditsError> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, organization_id, transaction_type, amount_cents,
                    balance_cents_after, description, reference_type, reference_id,
                    expires_at, created_at
             FROM fabric_credits_ledger
             WHERE id = ?1"
        )?;
        stmt.query_row(rusqlite::params![id], Self::parse_entry)
            .optional()
            .map_err(Into::into)
    }

    fn get_hold(&self, id: &str) -> Result<Option<CreditHold>, CreditsError> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, organization_id, resource_id, hold_cents, status,
                    created_at, released_at
             FROM fabric_credit_holds
             WHERE id = ?1"
        )?;
        stmt.query_row(rusqlite::params![id], |row| {
            let status_str: String = row.get("status")?;
            let status = status_str.parse::<HoldStatus>().map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, e)),
                )
            })?;
            Ok(CreditHold {
                id: row.get("id")?,
                organization_id: row.get("organization_id")?,
                resource_id: row.get("resource_id")?,
                hold_cents: row.get("hold_cents")?,
                status,
                created_at: row.get("created_at")?,
                released_at: row.get("released_at")?,
            })
        })
        .optional()
        .map_err(Into::into)
    }

    /// List ledger entries for an organization, newest first.
    pub fn list(
        &self,
        organization_id: &str,
        limit: usize,
    ) -> Result<Vec<CreditLedgerEntry>, CreditsError> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, organization_id, transaction_type, amount_cents,
                    balance_cents_after, description, reference_type, reference_id,
                    expires_at, created_at
             FROM fabric_credits_ledger
             WHERE organization_id = ?1
             ORDER BY created_at DESC, id DESC
             LIMIT ?2"
        )?;
        let rows = stmt.query_map(rusqlite::params![organization_id, limit], Self::parse_entry)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    /// Refund unused paid credits. Creates a negative charge (credit) row.
    pub fn refund(
        &self,
        organization_id: &str,
        amount_cents: i64,
        description: &str,
        reference_id: Option<&str>,
    ) -> Result<CreditLedgerEntry, CreditsError> {
        self.credit(
            organization_id,
            amount_cents,
            TransactionType::Refund,
            Some(description),
            Some("refund"),
            reference_id,
            None,
        )
    }

    /// Expire promotional/grant credits that have passed their expiration.
    pub fn expire_credits(&self, _now: DateTime<Utc>) -> Result<usize, CreditsError> {
        // Phase 0 stub: production implementation would find grant rows with
        // expires_at < now, compute remaining unspent grant balance, and insert
        // expiration rows. This requires tracking per-grant spend.
        warn!("credit expiration not yet implemented");
        Ok(0)
    }
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
        conn.execute(
            "INSERT OR IGNORE INTO fabric_resources (id, organization_id, kind, class, status)
             VALUES (?1, ?2, 'compute', 's', 'pending')",
            rusqlite::params!["resource-1", "org-1"],
        )
        .expect("insert resource");
        db
    }

    fn test_ledger() -> CreditsLedger {
        CreditsLedger::new(test_db())
    }

    #[test]
    fn purchase_and_balance() {
        let ledger = test_ledger();
        let org = "org-1";
        ledger
            .credit(org, 1000, TransactionType::Purchase, Some("top-up"), None, None, None)
            .unwrap();
        assert_eq!(ledger.balance_cents(org).unwrap(), 1000);
        assert_eq!(ledger.available_cents(org).unwrap(), 1000);
    }

    #[test]
    fn charge_reduces_balance() {
        let ledger = test_ledger();
        let org = "org-1";
        ledger
            .credit(org, 1000, TransactionType::Purchase, None, None, None, None)
            .unwrap();
        ledger
            .charge(org, 300, "compute usage", Some("placement"), Some("p-1"))
            .unwrap();
        assert_eq!(ledger.balance_cents(org).unwrap(), 700);
    }

    #[test]
    fn insufficient_credit_fails() {
        let ledger = test_ledger();
        let org = "org-1";
        ledger
            .credit(org, 100, TransactionType::Purchase, None, None, None, None)
            .unwrap();
        let err = ledger.charge(org, 200, "compute usage", None, None).unwrap_err();
        assert!(matches!(err, CreditsError::InsufficientCredits { .. }));
    }

    #[test]
    fn hold_reduces_available_balance() {
        let ledger = test_ledger();
        let org = "org-1";
        ledger
            .credit(org, 1000, TransactionType::Purchase, None, None, None, None)
            .unwrap();
        let hold = ledger.hold(org, "resource-1", 400).unwrap();
        assert_eq!(ledger.available_cents(org).unwrap(), 600);
        assert_eq!(ledger.balance_cents(org).unwrap(), 1000);

        ledger
            .charge_hold(&hold.id, 250, "actual usage", None, None)
            .unwrap();
        assert_eq!(ledger.available_cents(org).unwrap(), 750);
        assert_eq!(ledger.balance_cents(org).unwrap(), 750);
    }

    #[test]
    fn release_hold_restores_availability() {
        let ledger = test_ledger();
        let org = "org-1";
        ledger
            .credit(org, 1000, TransactionType::Purchase, None, None, None, None)
            .unwrap();
        let hold = ledger.hold(org, "resource-1", 400).unwrap();
        ledger.release_hold(&hold.id).unwrap();
        assert_eq!(ledger.available_cents(org).unwrap(), 1000);
    }

    #[test]
    fn charge_hold_works_when_balance_equals_hold() {
        // The hold already reserves the full balance. Charging the hold should
        // succeed even though available_cents is zero at the moment of charge.
        let ledger = test_ledger();
        let org = "org-1";
        ledger
            .credit(org, 400, TransactionType::Purchase, None, None, None, None)
            .unwrap();
        let hold = ledger.hold(org, "resource-1", 400).unwrap();
        assert_eq!(ledger.available_cents(org).unwrap(), 0);
        ledger
            .charge_hold(&hold.id, 400, "actual usage", None, None)
            .unwrap()
            .expect("ledger entry returned");
        assert_eq!(ledger.balance_cents(org).unwrap(), 0);
        assert_eq!(ledger.available_cents(org).unwrap(), 0);
    }
}
