//! Best-effort audit log writes.
//!
//! The `audit_log` table (migrations_pg/001_initial.sql) previously had zero
//! writers — security-relevant events (API key lifecycle, Clerk account
//! deletions, billing grants, device pairing) were invisible to compliance
//! review. Writes here are synchronous-with-request and best-effort: a failed
//! audit insert is logged with `tracing::warn!`, never surfaced as an error
//! to the caller (a webhook must still 2xx, a key creation must still return
//! its one-time token).

use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

/// A single audit log entry. Fields mirror the `audit_log` table columns.
pub struct AuditEvent {
    /// Dotted action name, e.g. `api_key.create`, `user.deleted`,
    /// `billing.subscription.granted`, `device_pairing.token_issued`.
    pub action: String,
    /// Table-ish resource kind, e.g. `api_key`, `user`, `billing_entitlement`.
    pub resource_type: String,
    pub resource_id: Option<String>,
    pub user_id: Option<String>,
    pub user_email: Option<String>,
    /// Structured details; serialized to the `details` text column as JSON.
    pub details: Option<Value>,
    pub success: bool,
}

/// Insert an entry into `audit_log`. Never fails the caller.
pub async fn write_audit_log(pool: &PgPool, event: AuditEvent) {
    // The `details` column is `text` (not jsonb), so serialize manually.
    let details = event.details.map(|value| value.to_string());
    let result = sqlx::query(
        r#"
        INSERT INTO audit_log (id, action, resource_type, resource_id, user_id, user_email, details, success)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
    )
    .bind(format!("al_{}", Uuid::new_v4()))
    .bind(&event.action)
    .bind(&event.resource_type)
    .bind(event.resource_id.as_deref())
    .bind(event.user_id.as_deref())
    .bind(event.user_email.as_deref())
    .bind(details)
    .bind(event.success)
    .execute(pool)
    .await;

    if let Err(error) = result {
        tracing::warn!(action = %event.action, %error, "failed to write audit_log entry");
    }
}
