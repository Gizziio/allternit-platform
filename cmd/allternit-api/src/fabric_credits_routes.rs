//! Fabric credits routes — buy credits and view balance/history.
//!
//! Merged into the `/api/v1` chain in `main.rs`, so public paths land at
//! `/api/v1/credits/*` and admin paths at `/api/v1/admin/credits/*`.

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{
    auth::AuthUser,
    fabric::credits::{CreditLedgerEntry, CreditsError, CreditsLedger, TransactionType},
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/credits/balance", get(get_balance))
        .route("/credits/transactions", get(list_transactions))
        .route("/credits/purchase", post(purchase_credits))
        .route("/admin/credits/grant", post(admin_grant_credits))
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    body: Json<Value>,
}

impl ApiError {
    fn new(status: StatusCode, code: &str, message: impl Into<String>) -> Self {
        Self {
            status,
            body: Json(json!({"error": code, "message": message.into()})),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, self.body).into_response()
    }
}

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    ApiError::new(status, code, message)
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "fabric credits operation failed");
    ApiError::new(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        err.to_string(),
    )
}

fn credits_error(err: CreditsError) -> ApiError {
    match err {
        CreditsError::InsufficientCredits { .. } => {
            error(StatusCode::PAYMENT_REQUIRED, "insufficient_credits", err.to_string())
        }
        CreditsError::InvalidAmount(_) => {
            error(StatusCode::BAD_REQUEST, "invalid_amount", err.to_string())
        }
        CreditsError::HoldNotFound(_) | CreditsError::HoldAlreadyFinalized(_) => {
            error(StatusCode::CONFLICT, "hold_error", err.to_string())
        }
        CreditsError::Db(e) => internal(e),
    }
}

fn require_org(user: &AuthUser) -> Result<String, ApiError> {
    user.organization_id.clone().ok_or_else(|| {
        error(
            StatusCode::FORBIDDEN,
            "organization_required",
            "An active organization is required.",
        )
    })
}

fn require_org_admin(conn: &rusqlite::Connection, user: &AuthUser) -> Result<String, ApiError> {
    let org = require_org(user)?;
    if !crate::rbac::is_org_admin(conn, &org, &user.user_id).map_err(internal)? {
        return Err(error(
            StatusCode::FORBIDDEN,
            "insufficient_role",
            "Only organization owners/admins can manage credits.",
        ));
    }
    Ok(org)
}

fn entry_json(entry: &CreditLedgerEntry) -> Value {
    json!({
        "id": entry.id,
        "organization_id": entry.organization_id,
        "transaction_type": entry.transaction_type.as_str(),
        "amount_cents": entry.amount_cents,
        "balance_cents_after": entry.balance_cents_after,
        "description": entry.description,
        "reference_type": entry.reference_type,
        "reference_id": entry.reference_id,
        "expires_at": entry.expires_at.map(|d| d.to_rfc3339()),
        "created_at": entry.created_at.to_rfc3339(),
    })
}

async fn get_balance(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<Value>, ApiError> {
    let org = require_org(&user)?;
    let db = state.db.clone();
    let org_for_balance = org.clone();
    let (balance, available, held) = tokio::task::spawn_blocking(move || {
        let ledger = CreditsLedger::new(db);
        let balance = ledger.balance_cents(&org_for_balance)?;
        let available = ledger.available_cents(&org_for_balance)?;
        let held = ledger.held_cents(&org_for_balance)?;
        Ok::<_, CreditsError>((balance, available, held))
    })
    .await
    .map_err(internal)?
    .map_err(credits_error)?;

    Ok(Json(json!({
        "organization_id": org,
        "balance_cents": balance,
        "available_cents": available,
        "held_cents": held,
        "currency": "USD",
    })))
}

#[derive(Debug, Deserialize)]
struct ListTransactionsQuery {
    #[serde(default = "default_limit")]
    limit: usize,
}

fn default_limit() -> usize {
    50
}

async fn list_transactions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListTransactionsQuery>,
) -> Result<Json<Value>, ApiError> {
    let org = require_org(&user)?;
    let limit = query.limit;
    let db = state.db.clone();
    let org_for_list = org.clone();
    let entries = tokio::task::spawn_blocking(move || {
        let ledger = CreditsLedger::new(db);
        ledger.list(&org_for_list, limit)
    })
    .await
    .map_err(internal)?
    .map_err(credits_error)?;

    Ok(Json(json!({
        "organization_id": org,
        "transactions": entries.iter().map(entry_json).collect::<Vec<_>>(),
    })))
}

#[derive(Debug, Deserialize)]
struct PurchaseRequest {
    amount_cents: i64,
    method: String,
    #[serde(default)]
    idempotency_key: Option<String>,
    #[serde(default)]
    reference_id: Option<String>,
}

async fn purchase_credits(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<PurchaseRequest>,
) -> Result<Json<Value>, ApiError> {
    let org = require_org(&user)?;

    let (transaction_type, reference_type) = match req.method.as_str() {
        "stripe" => (TransactionType::Purchase, Some("stripe")),
        "crypto" => (TransactionType::Purchase, Some("crypto")),
        _ => {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "invalid_method",
                "Supported purchase methods are 'stripe' and 'crypto'.",
            ));
        }
    };

    let db = state.db.clone();
    let amount_cents = req.amount_cents;
    let reference_id = req.reference_id;
    let idempotency_key = req.idempotency_key;
    let org_for_ledger = org.clone();
    let entry = tokio::task::spawn_blocking(move || {
        let ledger = CreditsLedger::new(db);
        ledger.credit_with_idempotency(
            &org_for_ledger,
            amount_cents,
            transaction_type,
            Some("credit purchase"),
            reference_type,
            reference_id.as_deref(),
            None,
            idempotency_key.as_deref(),
        )
    })
    .await
    .map_err(internal)?
    .map_err(credits_error)?;

    Ok(Json(json!({
        "organization_id": org,
        "transaction": entry_json(&entry),
        "balance_cents": entry.balance_cents_after,
        "available_cents": entry.balance_cents_after,
    })))
}

#[derive(Debug, Deserialize)]
struct GrantRequest {
    amount_cents: i64,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    idempotency_key: Option<String>,
}

async fn admin_grant_credits(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<GrantRequest>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    let user_for_admin = user.clone();
    let amount_cents = req.amount_cents;
    let description = req.description;
    let idempotency_key = req.idempotency_key;

    let (org, entry) = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal)?;
        let org = require_org_admin(&conn, &user_for_admin)?;
        let ledger = CreditsLedger::new(db);
        let entry = ledger
            .credit_with_idempotency(
                &org,
                amount_cents,
                TransactionType::Grant,
                description.as_deref().or(Some("admin grant")),
                Some("admin_grant"),
                None,
                None,
                idempotency_key.as_deref(),
            )
            .map_err(credits_error)?;
        Ok::<_, ApiError>((org, entry))
    })
    .await
    .map_err(internal)??;

    Ok(Json(json!({
        "organization_id": org,
        "transaction": entry_json(&entry),
        "balance_cents": entry.balance_cents_after,
        "available_cents": entry.balance_cents_after,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use serde_json::Value;
    use tower::ServiceExt;

    fn seed_org_user(conn: &rusqlite::Connection, org_id: &str, user_id: &str, role: &str) {
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name) VALUES (?1, 'Test Org')",
            rusqlite::params![org_id],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email) VALUES (?1, ?2)",
            rusqlite::params![user_id, format!("{}@test.local", user_id)],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organization_members (id, organization_id, user_id, role)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![format!("{}:{}", org_id, user_id), org_id, user_id, role],
        )
        .unwrap();
    }

    fn auth_user(org_id: Option<&str>, user_id: &str) -> AuthUser {
        AuthUser {
            user_id: user_id.to_string(),
            email: Some(format!("{}@test.local", user_id)),
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: org_id.map(|s| s.to_string()),
            organization_role: None,
            organization_slug: None,
        }
    }

    async fn body_json(body: Body) -> Value {
        let bytes = body.collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap_or_else(|_| Value::Null)
    }

    fn build_request(
        method: &str,
        uri: &str,
        user: AuthUser,
        body: Option<Value>,
    ) -> Request<Body> {
        let body = body
            .map(|b| Body::from(serde_json::to_string(&b).unwrap()))
            .unwrap_or_else(Body::empty);
        let mut req = Request::builder()
            .method(method)
            .uri(uri)
            .header("content-type", "application/json")
            .body(body)
            .unwrap();
        req.extensions_mut().insert(user);
        req
    }

    #[tokio::test]
    async fn purchase_increases_balance() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let conn = state.db.connect().unwrap();
        seed_org_user(&conn, "org-1", "owner-1", "owner");
        drop(conn);

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request(
                "POST",
                "/credits/purchase",
                auth_user(Some("org-1"), "owner-1"),
                Some(json!({
                    "amount_cents": 5000,
                    "method": "stripe",
                    "reference_id": "pi_test_123",
                    "idempotency_key": "key-1"
                })),
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        assert_eq!(body["balance_cents"], 5000);
        assert_eq!(body["transaction"]["transaction_type"], "purchase");
        assert_eq!(body["transaction"]["reference_id"], "pi_test_123");
    }

    #[tokio::test]
    async fn duplicate_idempotency_key_returns_same_result() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let conn = state.db.connect().unwrap();
        seed_org_user(&conn, "org-1", "owner-1", "owner");
        drop(conn);

        let app = router().with_state(state.clone());
        let body1 = json!({
            "amount_cents": 5000,
            "method": "stripe",
            "idempotency_key": "dup-key"
        });

        let resp1 = app
            .clone()
            .oneshot(build_request(
                "POST",
                "/credits/purchase",
                auth_user(Some("org-1"), "owner-1"),
                Some(body1.clone()),
            ))
            .await
            .unwrap();
        assert_eq!(resp1.status(), StatusCode::OK);
        let first = body_json(resp1.into_body()).await;

        // Second request with the same key but a different amount must reuse
        // the first result, not credit additional balance.
        let resp2 = app
            .oneshot(build_request(
                "POST",
                "/credits/purchase",
                auth_user(Some("org-1"), "owner-1"),
                Some(json!({
                    "amount_cents": 9999,
                    "method": "stripe",
                    "idempotency_key": "dup-key"
                })),
            ))
            .await
            .unwrap();
        assert_eq!(resp2.status(), StatusCode::OK);
        let second = body_json(resp2.into_body()).await;

        assert_eq!(first["transaction"]["id"], second["transaction"]["id"]);
        assert_eq!(second["balance_cents"], 5000);

        let ledger = CreditsLedger::new(state.db.clone());
        assert_eq!(ledger.balance_cents("org-1").unwrap(), 5000);
    }

    #[tokio::test]
    async fn admin_grant_requires_admin_role() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let conn = state.db.connect().unwrap();
        seed_org_user(&conn, "org-1", "owner-1", "owner");
        seed_org_user(&conn, "org-1", "member-1", "member");
        drop(conn);

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request(
                "POST",
                "/admin/credits/grant",
                auth_user(Some("org-1"), "member-1"),
                Some(json!({"amount_cents": 1000})),
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn admin_grant_increases_balance() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let conn = state.db.connect().unwrap();
        seed_org_user(&conn, "org-1", "owner-1", "owner");
        drop(conn);

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request(
                "POST",
                "/admin/credits/grant",
                auth_user(Some("org-1"), "owner-1"),
                Some(json!({
                    "amount_cents": 2500,
                    "description": "beta credit grant",
                    "idempotency_key": "grant-1"
                })),
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        assert_eq!(body["balance_cents"], 2500);
        assert_eq!(body["transaction"]["transaction_type"], "grant");

        let ledger = CreditsLedger::new(state.db.clone());
        assert_eq!(ledger.balance_cents("org-1").unwrap(), 2500);
    }

    #[tokio::test]
    async fn balance_and_transactions_are_returned() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let conn = state.db.connect().unwrap();
        seed_org_user(&conn, "org-1", "owner-1", "owner");
        drop(conn);

        let ledger = CreditsLedger::new(state.db.clone());
        ledger
            .credit("org-1", 3000, TransactionType::Purchase, None, None, None, None)
            .unwrap();

        let app = router().with_state(state.clone());
        let resp = app
            .clone()
            .oneshot(build_request(
                "GET",
                "/credits/balance",
                auth_user(Some("org-1"), "owner-1"),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        assert_eq!(body["balance_cents"], 3000);
        assert_eq!(body["available_cents"], 3000);
        assert_eq!(body["currency"], "USD");

        let resp = app
            .oneshot(build_request(
                "GET",
                "/credits/transactions?limit=10",
                auth_user(Some("org-1"), "owner-1"),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        let txs = body["transactions"].as_array().unwrap();
        assert_eq!(txs.len(), 1);
        assert_eq!(txs[0]["amount_cents"], 3000);
    }
}
