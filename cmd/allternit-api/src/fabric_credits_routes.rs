//! Fabric credits routes — balance/history, org credits grants, and the
//! purchase endpoint (redirects to platform billing when cloud billing is
//! configured; admin-only manual settlements when self-hosted).
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
        .route("/credits/transfer_from_wallet", post(transfer_from_wallet))
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

enum PurchaseMode {
    /// Cloud billing is configured: purchases go through the Stripe-backed
    /// platform wallet, and this route must never mint unbacked balance.
    Hosted { platform_url: String },
    /// Self-hosted: no payment provider is wired; purchases are admin-only
    /// manual settlements (off-platform payments confirmed by the operator).
    SelfHosted,
}

fn purchase_mode(config: &crate::config::AppConfig) -> PurchaseMode {
    if config.cloud_api_url().is_some() {
        let platform_url = std::env::var("ALLTERNIT_PLATFORM_URL")
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "https://platform.allternit.com".to_string());
        PurchaseMode::Hosted { platform_url }
    } else {
        PurchaseMode::SelfHosted
    }
}

async fn purchase_credits(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<PurchaseRequest>,
) -> Result<Json<Value>, ApiError> {
    if let PurchaseMode::Hosted { platform_url } = purchase_mode(&state.config) {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "billing_redirect",
            format!(
                "Credit purchases go through platform billing. Complete checkout at {platform_url}/billing, then transfer credits to this organization."
            ),
        ));
    }

    let db = state.db.clone();
    let user_for_admin = user.clone();
    let org = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal)?;
        require_org_admin(&conn, &user_for_admin)
    })
    .await
    .map_err(internal)??;

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
            Some("manual settlement (self-hosted, operator-confirmed)"),
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

#[derive(Debug, Deserialize)]
struct TransferFromWalletRequest {
    amount_cents: i64,
    #[serde(default)]
    idempotency_key: Option<String>,
}

/// Move credits from the caller's Stripe-backed user wallet (cloud-api) into
/// this organization's fabric credits ledger.
///
/// Orchestration: debit the wallet, credit the local ledger with the same
/// idempotency key; if the local credit fails after a successful debit,
/// refund the wallet (same key) so money is neither lost nor duplicated.
async fn transfer_from_wallet(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<TransferFromWalletRequest>,
) -> Result<Json<Value>, ApiError> {
    let org = require_org(&user)?;
    let client = crate::wallet::ReqwestWalletClient::from_env(&state.config).ok_or_else(|| {
        error(
            StatusCode::CONFLICT,
            "wallet_transfers_unavailable",
            "Wallet transfers require hosted billing (no cloud API configured). Use an admin grant instead.",
        )
    })?;

    let idempotency_key = req
        .idempotency_key
        .clone()
        .filter(|key| !key.is_empty())
        .unwrap_or_else(|| format!("wallet-transfer-{}", uuid::Uuid::new_v4()));

    let result = transfer_from_wallet_inner(
        state.db.clone(),
        client,
        user.user_id.clone(),
        org,
        req.amount_cents,
        idempotency_key,
    )
    .await?;

    Ok(Json(result))
}

async fn transfer_from_wallet_inner(
    db: crate::db::DbHandle,
    client: impl crate::wallet::WalletClient,
    user_id: String,
    org: String,
    amount_cents: i64,
    idempotency_key: String,
) -> Result<Value, ApiError> {
    use crate::wallet::{TransferDirection, WalletError};

    if amount_cents <= 0 {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_amount",
            "amount_cents must be positive.",
        ));
    }

    let wallet_balance = match client
        .transfer(
            &user_id,
            amount_cents,
            &idempotency_key,
            TransferDirection::Debit,
        )
        .await
    {
        Ok(result) => result.balance_usd,
        Err(WalletError::Insufficient(message)) => {
            return Err(error(
                StatusCode::PAYMENT_REQUIRED,
                "insufficient_wallet_balance",
                message,
            ));
        }
        Err(WalletError::Unauthorized(message)) => {
            return Err(error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "wallet_credentials_rejected",
                message,
            ));
        }
        Err(e) => {
            return Err(error(
                StatusCode::BAD_GATEWAY,
                "wallet_transfer_failed",
                e.to_string(),
            ));
        }
    };

    let key_for_credit = idempotency_key.clone();
    let org_for_credit = org.clone();
    let user_id_for_credit = user_id.clone();
    let credit = tokio::task::spawn_blocking(move || {
        let ledger = CreditsLedger::new(db);
        ledger.credit_with_idempotency(
            &org_for_credit,
            amount_cents,
            TransactionType::Grant,
            Some("transfer from user wallet"),
            Some("wallet_transfer"),
            Some(&user_id_for_credit),
            None,
            Some(&key_for_credit),
        )
    })
    .await
    .map_err(internal)?;

    match credit {
        Ok(entry) => Ok(json!({
            "organization_id": org,
            "transaction": entry_json(&entry),
            "balance_cents": entry.balance_cents_after,
            "available_cents": entry.balance_cents_after,
            "wallet_balance_usd": wallet_balance,
        })),
        Err(e) => {
            // The wallet was already debited — refund it with the same key so
            // the transfer is all-or-nothing across the two ledgers.
            let refund = client
                .transfer(
                    &user_id,
                    amount_cents,
                    &idempotency_key,
                    TransferDirection::Credit,
                )
                .await;
            match refund {
                Ok(_) => Err(error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "ledger_credit_failed_refunded",
                    format!("Wallet debit was refunded: {e}"),
                )),
                Err(refund_err) => Err(error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "ledger_credit_failed_refund_failed",
                    format!("Local credit failed ({e}) AND wallet refund failed ({refund_err}) — reconcile manually."),
                )),
            }
        }
    }
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
    async fn purchase_requires_admin_role_self_hosted() {
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
                "/credits/purchase",
                auth_user(Some("org-1"), "member-1"),
                Some(json!({"amount_cents": 5000, "method": "stripe"})),
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
        let ledger = CreditsLedger::new(state.db.clone());
        assert_eq!(ledger.balance_cents("org-1").unwrap(), 0);
    }

    #[test]
    fn purchase_mode_self_hosted_by_default() {
        let config = crate::config::AppConfig {
            company: crate::config::CompanyConfig::default(),
            user: crate::config::UserConfig::default(),
        };
        assert!(matches!(purchase_mode(&config), PurchaseMode::SelfHosted));
    }

    #[test]
    fn purchase_mode_hosted_when_cloud_billing_configured() {
        let config = crate::config::AppConfig {
            company: crate::config::CompanyConfig {
                cloud_api_url: Some("https://api.allternit.com".to_string()),
                ..Default::default()
            },
            user: crate::config::UserConfig::default(),
        };
        match purchase_mode(&config) {
            PurchaseMode::Hosted { platform_url } => {
                assert!(platform_url.ends_with("allternit.com"));
            }
            PurchaseMode::SelfHosted => panic!("expected hosted mode"),
        }
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

    mod transfer_from_wallet_tests {
        use super::*;
        use crate::db::DbHandle;
        use crate::wallet::{TransferDirection, WalletClient, WalletError, WalletTransferResult};
        use std::sync::{Arc, Mutex};

        #[derive(Default)]
        struct FakeWallet {
            balance_usd: Arc<Mutex<f64>>,
            insufficient: bool,
            calls: Arc<Mutex<Vec<(TransferDirection, i64, String)>>>,
        }

        impl WalletClient for FakeWallet {
            async fn transfer(
                &self,
                user_id: &str,
                amount_cents: i64,
                idempotency_key: &str,
                direction: TransferDirection,
            ) -> Result<WalletTransferResult, WalletError> {
                self.calls
                    .lock()
                    .unwrap()
                    .push((direction, amount_cents, idempotency_key.to_string()));
                if direction == TransferDirection::Debit && self.insufficient {
                    return Err(WalletError::Insufficient(
                        "$0.00 available".to_string(),
                    ));
                }
                let mut balance = self.balance_usd.lock().unwrap();
                let amount = amount_cents as f64 / 100.0;
                *balance += if direction == TransferDirection::Debit {
                    -amount
                } else {
                    amount
                };
                Ok(WalletTransferResult {
                    balance_usd: *balance,
                    idempotent_replay: false,
                })
            }
        }

        fn test_db() -> DbHandle {
            let db = DbHandle::new_memory().expect("memory db");
            let conn = db.connect().unwrap();
            conn.execute(
                "INSERT OR IGNORE INTO organizations (id, name) VALUES ('org-1', 'Test Org')",
                [],
            )
            .unwrap();
            db
        }

        #[tokio::test]
        async fn transfer_debits_wallet_and_credits_org_ledger() {
            let db = test_db();
            let wallet = FakeWallet {
                balance_usd: Arc::new(Mutex::new(20.0)),
                ..Default::default()
            };
            let calls = wallet.calls.clone();

            let result = super::transfer_from_wallet_inner(
                db.clone(),
                wallet,
                "user-1".to_string(),
                "org-1".to_string(),
                1500,
                "key-1".to_string(),
            )
            .await
            .unwrap();

            assert_eq!(result["balance_cents"], 1500);
            assert_eq!(result["wallet_balance_usd"], 5.0);
            let ledger = CreditsLedger::new(db);
            assert_eq!(ledger.balance_cents("org-1").unwrap(), 1500);
            let calls = calls.lock().unwrap();
            assert_eq!(calls.len(), 1);
            assert_eq!(calls[0].0, TransferDirection::Debit);
            assert_eq!(calls[0].1, 1500);
        }

        #[tokio::test]
        async fn transfer_insufficient_wallet_credits_nothing() {
            let db = test_db();
            let wallet = FakeWallet {
                balance_usd: Arc::new(Mutex::new(5.0)),
                insufficient: true,
                ..Default::default()
            };
            let calls = wallet.calls.clone();

            let err = super::transfer_from_wallet_inner(
                db.clone(),
                wallet,
                "user-1".to_string(),
                "org-1".to_string(),
                1500,
                "key-1".to_string(),
            )
            .await
            .unwrap_err();

            assert_eq!(err.status, StatusCode::PAYMENT_REQUIRED);
            let ledger = CreditsLedger::new(db);
            assert_eq!(ledger.balance_cents("org-1").unwrap(), 0);
            assert_eq!(calls.lock().unwrap().len(), 1, "no refund without a debit");
        }

        #[tokio::test]
        async fn transfer_ledger_failure_refunds_wallet() {
            let db = test_db();
            let wallet = FakeWallet {
                balance_usd: Arc::new(Mutex::new(20.0)),
                ..Default::default()
            };
            let calls = wallet.calls.clone();

            // The org row does not exist, so the ledger credit fails on its
            // foreign key AFTER the wallet debit succeeds — the compensation
            // path must refund the wallet.
            let err = super::transfer_from_wallet_inner(
                db,
                wallet,
                "user-1".to_string(),
                "org-missing".to_string(),
                1500,
                "key-1".to_string(),
            )
            .await
            .unwrap_err();

            assert_eq!(err.status, StatusCode::INTERNAL_SERVER_ERROR);
            let calls = calls.lock().unwrap();
            assert_eq!(calls.len(), 2, "debit then refund");
            assert_eq!(calls[0].0, TransferDirection::Debit);
            assert_eq!(calls[1].0, TransferDirection::Credit);
            assert_eq!(calls[1].2, "key-1", "refund reuses the idempotency key");
        }
    }
}
