//! Marketplace payments & checkout API (Phase 1).
//!
//! Provides capability browsing, checkout/order creation, license validation,
//! and user license listing.  The checkout is a no-op for Phase 1 — it creates
//! a pending order and returns a placeholder checkout URL, matching the
//! `NoopCharger` pattern in `billing.rs`.
//!
//! Routes are merged into the `/api/v1` chain in main.rs, so paths land at
//! `/api/v1/marketplace/*`.

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

// ── DB schema (created lazily in `ensure_tables`) ────────────────────────────
//
// CREATE TABLE IF NOT EXISTS marketplace_capabilities (
//   id TEXT PRIMARY KEY,
//   name TEXT NOT NULL,
//   display_name TEXT NOT NULL,
//   description TEXT NOT NULL DEFAULT '',
//   version TEXT NOT NULL DEFAULT '1.0.0',
//   kind TEXT NOT NULL DEFAULT 'plugin',
//   author_name TEXT NOT NULL DEFAULT '',
//   pricing_type TEXT NOT NULL DEFAULT 'free',
//   pricing_amount_cents INTEGER NOT NULL DEFAULT 0,
//   pricing_currency TEXT NOT NULL DEFAULT 'USD',
//   install_count INTEGER NOT NULL DEFAULT 0,
//   rating REAL NOT NULL DEFAULT 0.0,
//   manifest_json TEXT NOT NULL DEFAULT '{}',
//   created_at TEXT NOT NULL DEFAULT (datetime('now')),
//   updated_at TEXT NOT NULL DEFAULT (datetime('now'))
// );
//
// CREATE TABLE IF NOT EXISTS marketplace_orders (
//   id TEXT PRIMARY KEY,
//   user_id TEXT NOT NULL,
//   capability_id TEXT NOT NULL,
//   pricing_type TEXT NOT NULL,
//   amount_cents INTEGER NOT NULL DEFAULT 0,
//   currency TEXT NOT NULL DEFAULT 'USD',
//   status TEXT NOT NULL DEFAULT 'pending',
//   license_key TEXT,
//   created_at TEXT NOT NULL DEFAULT (datetime('now')),
//   updated_at TEXT NOT NULL DEFAULT (datetime('now'))
// );
//
// CREATE TABLE IF NOT EXISTS marketplace_licenses (
//   license_key TEXT PRIMARY KEY,
//   user_id TEXT NOT NULL,
//   capability_id TEXT NOT NULL,
//   order_id TEXT NOT NULL,
//   status TEXT NOT NULL DEFAULT 'active',
//   expires_at TEXT,
//   created_at TEXT NOT NULL DEFAULT (datetime('now'))
// );

// ── Router ───────────────────────────────────────────────────────────────────

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/marketplace/capabilities",
            get(get_list_capabilities),
        )
        .route(
            "/marketplace/capabilities/:id",
            get(get_capability),
        )
        .route("/marketplace/checkout", post(create_checkout))
        .route("/marketplace/orders/:id", get(get_order))
        .route(
            "/marketplace/licenses/validate",
            post(validate_license),
        )
        .route("/marketplace/licenses/me", get(list_licenses))
}

// ── Error helpers ────────────────────────────────────────────────────────────

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "marketplace operation failed");
    error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        err.to_string(),
    )
}

// ── Table bootstrap ──────────────────────────────────────────────────────────

fn ensure_tables(conn: &rusqlite::Connection) -> Result<(), ApiError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS marketplace_capabilities (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            display_name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            version TEXT NOT NULL DEFAULT '1.0.0',
            kind TEXT NOT NULL DEFAULT 'plugin',
            author_name TEXT NOT NULL DEFAULT '',
            pricing_type TEXT NOT NULL DEFAULT 'free',
            pricing_amount_cents INTEGER NOT NULL DEFAULT 0,
            pricing_currency TEXT NOT NULL DEFAULT 'USD',
            install_count INTEGER NOT NULL DEFAULT 0,
            rating REAL NOT NULL DEFAULT 0.0,
            manifest_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS marketplace_orders (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            capability_id TEXT NOT NULL,
            pricing_type TEXT NOT NULL,
            amount_cents INTEGER NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'USD',
            status TEXT NOT NULL DEFAULT 'pending',
            license_key TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS marketplace_licenses (
            license_key TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            capability_id TEXT NOT NULL,
            order_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            expires_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )
    .map_err(internal)?;
    Ok(())
}

// ── Capability row → JSON ────────────────────────────────────────────────────

fn capability_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "id": row.get::<_, String>(0)?,
        "name": row.get::<_, String>(1)?,
        "display_name": row.get::<_, String>(2)?,
        "description": row.get::<_, String>(3)?,
        "version": row.get::<_, String>(4)?,
        "kind": row.get::<_, String>(5)?,
        "author_name": row.get::<_, String>(6)?,
        "pricing_type": row.get::<_, String>(7)?,
        "pricing_amount_cents": row.get::<_, i64>(8)?,
        "pricing_currency": row.get::<_, String>(9)?,
        "install_count": row.get::<_, i64>(10)?,
        "rating": row.get::<_, f64>(11)?,
        "manifest_json": row.get::<_, String>(12)?,
        "created_at": row.get::<_, String>(13)?,
        "updated_at": row.get::<_, String>(14)?,
    }))
}

// ── Query params ─────────────────────────────────────────────────────────────

#[derive(Deserialize, Default)]
struct CapabilityQuery {
    q: Option<String>,
    kind: Option<String>,
    pricing: Option<String>,
    tags: Option<String>,
    cursor: Option<String>,
    limit: Option<i64>,
}

// ── GET /marketplace/capabilities ────────────────────────────────────────────

async fn get_list_capabilities(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Query(params): Query<CapabilityQuery>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        ensure_tables(&conn)?;

        let limit = params.limit.unwrap_or(20).min(100).max(1);
        let offset: i64 = params
            .cursor
            .as_deref()
            .and_then(|c| c.parse().ok())
            .unwrap_or(0);

        // Build dynamic WHERE clause.
        let mut conditions: Vec<String> = Vec::new();
        let mut bind_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref q) = params.q {
            if !q.trim().is_empty() {
                conditions.push(format!(
                    "(name LIKE ?{} OR display_name LIKE ?{0} OR description LIKE ?{0})",
                    bind_values.len() + 1
                ));
                let like = format!("%{}%", q.trim());
                bind_values.push(Box::new(like));
            }
        }
        if let Some(ref kind) = params.kind {
            if !kind.trim().is_empty() {
                conditions.push(format!("kind = ?{}", bind_values.len() + 1));
                bind_values.push(Box::new(kind.trim().to_string()));
            }
        }
        if let Some(ref pricing) = params.pricing {
            match pricing.as_str() {
                "free" => {
                    conditions.push("pricing_type = 'free'".to_string());
                }
                "paid" => {
                    conditions.push("pricing_type != 'free'".to_string());
                }
                _ => {} // "all" or unknown → no filter
            }
        }
        // `tags` is accepted but not filtered in Phase 1 (no tags column).

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        // Total count.
        let count_sql = format!(
            "SELECT COUNT(*) FROM marketplace_capabilities {}",
            where_clause
        );
        let total: i64 = {
            let mut stmt = conn.prepare(&count_sql).map_err(internal)?;
            let refs: Vec<&dyn rusqlite::types::ToSql> =
                bind_values.iter().map(|b| b.as_ref()).collect();
            stmt.query_row(refs.as_slice(), |r| r.get(0))
                .map_err(internal)?
        };

        // Fetch page.
        let data_sql = format!(
            "SELECT id, name, display_name, description, version, kind,
                    author_name, pricing_type, pricing_amount_cents, pricing_currency,
                    install_count, rating, manifest_json, created_at, updated_at
             FROM marketplace_capabilities {}
             ORDER BY created_at DESC
             LIMIT ?{} OFFSET ?{}",
            where_clause,
            bind_values.len() + 1,
            bind_values.len() + 2,
        );
        let mut stmt = conn.prepare(&data_sql).map_err(internal)?;
        let mut all_refs: Vec<&dyn rusqlite::types::ToSql> =
            bind_values.iter().map(|b| b.as_ref()).collect();
        all_refs.push(&limit);
        all_refs.push(&offset);

        let items: Vec<Value> = stmt
            .query_map(all_refs.as_slice(), capability_json)
            .map_err(internal)?
            .filter_map(|r| r.ok())
            .collect();

        let next_cursor = if (offset + limit) < total {
            Some((offset + limit).to_string())
        } else {
            None
        };

        Ok::<_, ApiError>(json!({
            "items": items,
            "total": total,
            "cursor": next_cursor,
        }))
    })
    .await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

// ── GET /marketplace/capabilities/:id ────────────────────────────────────────

async fn get_capability(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        ensure_tables(&conn)?;

        let row: Option<Value> = conn
            .query_row(
                "SELECT id, name, display_name, description, version, kind,
                        author_name, pricing_type, pricing_amount_cents, pricing_currency,
                        install_count, rating, manifest_json, created_at, updated_at
                 FROM marketplace_capabilities
                 WHERE id = ?1",
                [&id],
                capability_json,
            )
            .optional()
            .map_err(internal)?;

        match row {
            Some(v) => Ok(v),
            None => Err(error(
                StatusCode::NOT_FOUND,
                "capability_not_found",
                format!("Capability '{}' not found.", id),
            )),
        }
    })
    .await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

// ── POST /marketplace/checkout ───────────────────────────────────────────────

#[derive(Deserialize)]
struct CheckoutRequest {
    capability_id: String,
    pricing_type: Option<String>,
    workspace_id: Option<String>,
}

async fn create_checkout(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CheckoutRequest>,
) -> Response {
    if body.capability_id.trim().is_empty() {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_capability_id",
            "capability_id is required.",
        )
        .into_response();
    }

    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        ensure_tables(&conn)?;

        // Look up the capability to get pricing info.
        let cap: Option<(String, i64)> = conn
            .query_row(
                "SELECT pricing_type, pricing_amount_cents
                 FROM marketplace_capabilities WHERE id = ?1",
                [&body.capability_id],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)),
            )
            .optional()
            .map_err(internal)?;

        let (cap_pricing_type, amount_cents) = match cap {
            Some(c) => c,
            None => {
                return Err(error(
                    StatusCode::NOT_FOUND,
                    "capability_not_found",
                    format!("Capability '{}' not found.", body.capability_id),
                ));
            }
        };

        let pricing_type = body
            .pricing_type
            .as_deref()
            .unwrap_or(&cap_pricing_type)
            .to_string();

        let order_id = format!("ord_{}", uuid::Uuid::new_v4());
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO marketplace_orders (id, user_id, capability_id, pricing_type, amount_cents, currency, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'USD', 'pending', ?6, ?6)",
            params![order_id, user.user_id, body.capability_id, pricing_type, amount_cents, now],
        )
        .map_err(internal)?;

        // Phase 1: NoopCharger-style deferred checkout.  For free capabilities
        // we auto-complete the order and issue a license immediately.
        let (status, license_key, checkout_url) = if pricing_type == "free" || amount_cents == 0 {
            let key = format!("lic_{}", uuid::Uuid::new_v4());
            conn.execute(
                "UPDATE marketplace_orders SET status = 'completed', license_key = ?1, updated_at = ?2 WHERE id = ?3",
                params![key, now, order_id],
            )
            .map_err(internal)?;
            conn.execute(
                "INSERT INTO marketplace_licenses (license_key, user_id, capability_id, order_id, status, created_at)
                 VALUES (?1, ?2, ?3, ?4, 'active', ?5)",
                params![key, user.user_id, body.capability_id, order_id, now],
            )
            .map_err(internal)?;
            // Bump install count.
            conn.execute(
                "UPDATE marketplace_capabilities SET install_count = install_count + 1, updated_at = ?1 WHERE id = ?2",
                params![now, body.capability_id],
            )
            .map_err(internal)?;
            ("completed".to_string(), Some(key), None)
        } else {
            // Paid: return a placeholder checkout URL (Phase 1 no-op).
            let url = format!(
                "/marketplace/checkout/{}?workspace={}",
                order_id,
                body.workspace_id.as_deref().unwrap_or("")
            );
            ("pending".to_string(), None, Some(url))
        };

        Ok::<_, ApiError>(json!({
            "order_id": order_id,
            "status": status,
            "license_key": license_key,
            "checkout_url": checkout_url,
        }))
    })
    .await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

// ── GET /marketplace/orders/:id ─────────────────────────────────────────────

async fn get_order(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        ensure_tables(&conn)?;

        let row: Option<Value> = conn
            .query_row(
                "SELECT id, user_id, capability_id, pricing_type, amount_cents,
                        currency, status, license_key, created_at, updated_at
                 FROM marketplace_orders WHERE id = ?1",
                [&id],
                |r| {
                    let order_user_id: String = r.get(1)?;
                    Ok(json!({
                        "id": r.get::<_, String>(0)?,
                        "user_id": order_user_id,
                        "capability_id": r.get::<_, String>(2)?,
                        "pricing_type": r.get::<_, String>(3)?,
                        "amount_cents": r.get::<_, i64>(4)?,
                        "currency": r.get::<_, String>(5)?,
                        "status": r.get::<_, String>(6)?,
                        "license_key": r.get::<_, Option<String>>(7)?,
                        "created_at": r.get::<_, String>(8)?,
                        "updated_at": r.get::<_, String>(9)?,
                    }))
                },
            )
            .optional()
            .map_err(internal)?;

        match row {
            Some(mut v) => {
                // Only the owning user may see the order.
                if v["user_id"].as_str() != Some(&user.user_id) {
                    return Err(error(
                        StatusCode::FORBIDDEN,
                        "forbidden",
                        "You do not have access to this order.",
                    ));
                }
                // Attach capability summary as a line item.
                let cap_id = v["capability_id"]
                    .as_str()
                    .unwrap_or_default();
                let cap: Option<Value> = conn
                    .query_row(
                        "SELECT display_name, pricing_amount_cents, pricing_currency
                         FROM marketplace_capabilities WHERE id = ?1",
                        [cap_id],
                        |r| {
                            Ok(json!({
                                "description": r.get::<_, String>(0)?,
                                "amount_cents": r.get::<_, i64>(1)?,
                                "currency": r.get::<_, String>(2)?,
                            }))
                        },
                    )
                    .optional()
                    .map_err(internal)?;
                v.as_object_mut()
                    .unwrap()
                    .insert("line_items".to_string(), json!([cap]));
                Ok(v)
            }
            None => Err(error(
                StatusCode::NOT_FOUND,
                "order_not_found",
                format!("Order '{}' not found.", id),
            )),
        }
    })
    .await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

// ── POST /marketplace/licenses/validate ──────────────────────────────────────

#[derive(Deserialize)]
struct ValidateLicenseRequest {
    license_key: String,
    capability_id: Option<String>,
}

async fn validate_license(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Json(body): Json<ValidateLicenseRequest>,
) -> Response {
    if body.license_key.trim().is_empty() {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_license_key",
            "license_key is required.",
        )
        .into_response();
    }

    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        ensure_tables(&conn)?;

        let row: Option<Value> = conn
            .query_row(
                "SELECT license_key, user_id, capability_id, order_id, status, expires_at, created_at
                 FROM marketplace_licenses WHERE license_key = ?1",
                [&body.license_key],
                |r| {
                    Ok(json!({
                        "license_key": r.get::<_, String>(0)?,
                        "user_id": r.get::<_, String>(1)?,
                        "capability_id": r.get::<_, String>(2)?,
                        "order_id": r.get::<_, String>(3)?,
                        "status": r.get::<_, String>(4)?,
                        "expires_at": r.get::<_, Option<String>>(5)?,
                        "created_at": r.get::<_, String>(6)?,
                    }))
                },
            )
            .optional()
            .map_err(internal)?;

        match row {
            Some(v) => {
                let license_cap_id = v["capability_id"].as_str().unwrap_or_default();
                let status = v["status"].as_str().unwrap_or_default();

                // If caller specified a capability_id, it must match.
                if let Some(ref requested_cap) = body.capability_id {
                    if requested_cap != license_cap_id {
                        return Ok::<_, ApiError>(json!({
                            "valid": false,
                            "reason": "capability_mismatch",
                            "license_key": body.license_key,
                            "capability_id": license_cap_id,
                            "expires_at": v["expires_at"],
                        }));
                    }
                }

                let valid = status == "active";
                Ok::<_, ApiError>(json!({
                    "valid": valid,
                    "license_key": v["license_key"],
                    "capability_id": license_cap_id,
                    "expires_at": v["expires_at"],
                    "status": status,
                }))
            }
            None => Ok::<_, ApiError>(json!({
                "valid": false,
                "reason": "not_found",
                "license_key": body.license_key,
            })),
        }
    })
    .await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

// ── GET /marketplace/licenses/me ─────────────────────────────────────────────

async fn list_licenses(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        ensure_tables(&conn)?;

        let mut stmt = conn
            .prepare(
                "SELECT l.license_key, l.capability_id, l.order_id, l.status,
                        l.expires_at, l.created_at,
                        c.display_name, c.pricing_type
                 FROM marketplace_licenses l
                 LEFT JOIN marketplace_capabilities c ON c.id = l.capability_id
                 WHERE l.user_id = ?1 AND l.status = 'active'
                 ORDER BY l.created_at DESC",
            )
            .map_err(internal)?;

        let items: Vec<Value> = stmt
            .query_map([&user.user_id], |r| {
                Ok(json!({
                    "license_key": r.get::<_, String>(0)?,
                    "capability_id": r.get::<_, String>(1)?,
                    "order_id": r.get::<_, String>(2)?,
                    "status": r.get::<_, String>(3)?,
                    "expires_at": r.get::<_, Option<String>>(4)?,
                    "created_at": r.get::<_, String>(5)?,
                    "capability_name": r.get::<_, Option<String>>(6)?,
                    "pricing_type": r.get::<_, Option<String>>(7)?,
                }))
            })
            .map_err(internal)?
            .filter_map(|r| r.ok())
            .collect();

        Ok::<_, ApiError>(json!({
            "items": items,
            "total": items.len(),
        }))
    })
    .await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}
