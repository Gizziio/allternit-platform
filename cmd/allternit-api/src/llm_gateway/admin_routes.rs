//! Admin & observability APIs for the LLM gateway (B7), Clerk-protected.
//!
//! Merged into the `/api/v1` chain in main.rs next to
//! [`crate::llm_gateway::gateway_keys_router`], so paths land at
//! `/api/v1/gateway/*`.
//!
//! Tenant scoping: callers with an active organization must be owner/admin
//! of it (same role check as `usage_routes.rs:59-71`) and see that
//! organization's rows; organization-less callers see only rows they own.
//! Error bodies follow the keys.rs shape: `{"error": code, "message": msg}`.

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::warn;

use crate::auth::AuthUser;
use crate::AppState;

use super::{dlp_patterns, router as policy_router};

pub fn gateway_admin_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/gateway/usage", get(get_usage))
        .route("/gateway/logs", get(get_logs))
        .route("/gateway/routing/decisions", get(get_routing_decisions))
        .route(
            "/gateway/routing/policies",
            get(list_policies).put(put_policy),
        )
        .route("/gateway/dlp/rules", get(list_dlp_rules).put(put_dlp_rule))
        .route("/gateway/budgets", get(list_budgets).put(put_budget))
        .route(
            "/gateway/inference-hooks",
            get(get_inference_hooks).put(put_inference_hooks),
        )
}

// ─── GET/PUT /gateway/inference-hooks ───────────────────────────────────────

async fn get_inference_hooks(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal_error)?;
        let scope = admin_scope(&conn, &user)?;
        let Some(organization_id) = scope.config_tenant(&user) else { return Err(bad_request("Inference hooks require an active organization.")); };
        let hooks: Option<(Option<String>, Option<String>, i64)> = conn.query_row(
            "SELECT pre_inference_url, post_inference_url, abort_on_pre_error FROM llm_inference_hooks WHERE organization_id = ?1",
            [&organization_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).optional().map_err(internal_error)?;
        let (pre, post, abort) = hooks.unwrap_or((None, None, 1));
        Ok::<_, ApiError>(json!({"organization_id": organization_id, "pre_inference_url": pre, "post_inference_url": post, "abort_on_pre_error": abort != 0}))
    }).await;
    respond(result)
}

#[derive(Debug, Deserialize)]
struct PutInferenceHooksRequest {
    pre_inference_url: Option<String>,
    post_inference_url: Option<String>,
    abort_on_pre_error: Option<bool>,
}

fn validate_hook_url(value: Option<String>) -> Result<Option<String>, ApiError> {
    let Some(value) = value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
    else {
        return Ok(None);
    };
    let parsed = reqwest::Url::parse(&value)
        .map_err(|_| bad_request("Inference hook URLs must be valid HTTP(S) URLs."))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(bad_request("Inference hook URLs must use HTTP or HTTPS."));
    }
    Ok(Some(value))
}

async fn put_inference_hooks(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(payload): Json<PutInferenceHooksRequest>,
) -> Response {
    let pre = match validate_hook_url(payload.pre_inference_url) {
        Ok(v) => v,
        Err(e) => return e.into_response(),
    };
    let post = match validate_hook_url(payload.post_inference_url) {
        Ok(v) => v,
        Err(e) => return e.into_response(),
    };
    let abort = payload.abort_on_pre_error.unwrap_or(true);
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal_error)?;
        let scope = admin_scope(&conn, &user)?;
        let Some(organization_id) = scope.config_tenant(&user) else { return Err(bad_request("Inference hooks require an active organization.")); };
        conn.execute(
            "INSERT INTO llm_inference_hooks (organization_id, pre_inference_url, post_inference_url, abort_on_pre_error) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(organization_id) DO UPDATE SET pre_inference_url = excluded.pre_inference_url, post_inference_url = excluded.post_inference_url, abort_on_pre_error = excluded.abort_on_pre_error, updated_at = CURRENT_TIMESTAMP",
            params![organization_id, pre, post, abort as i64],
        ).map_err(internal_error)?;
        Ok::<_, ApiError>(json!({"organization_id": organization_id, "pre_inference_url": pre, "post_inference_url": post, "abort_on_pre_error": abort}))
    }).await;
    respond(result)
}

// ─── Errors & scoping ────────────────────────────────────────────────────────

type ApiError = (StatusCode, Json<Value>);

fn bad_request(message: impl Into<String>) -> ApiError {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({"error": "invalid_request", "message": message.into()})),
    )
}

fn forbidden(code: &str, message: &str) -> ApiError {
    (
        StatusCode::FORBIDDEN,
        Json(json!({"error": code, "message": message})),
    )
}

fn internal_error(err: impl std::fmt::Display) -> ApiError {
    warn!(error = %err, "gateway admin handler failed");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": "internal_error", "message": err.to_string()})),
    )
}

fn not_found(code: &str, message: &str) -> ApiError {
    (
        StatusCode::NOT_FOUND,
        Json(json!({"error": code, "message": message})),
    )
}

/// The rows a caller may see / the tenant a caller may configure.
enum Scope {
    /// Active-organization owner/admin: sees `tenant_id = org` rows and
    /// configures that tenant.
    Tenant(String),
    /// Organization-less caller: sees only their own rows; configuration is
    /// stored under their profile tenant (or NULL when they have none —
    /// note NULL-tenant rules/policies are global by design, matching how
    /// keys.rs assigns tenant_id).
    User(String),
}

impl Scope {
    /// SQL predicate for `llm_usage_events` scoping, binding the scope value
    /// at the given parameter index.
    fn usage_where(&self, param: usize, alias: &str) -> String {
        match self {
            Scope::Tenant(_) => format!("{alias}.tenant_id = ?{param}"),
            Scope::User(_) => format!("{alias}.user_id = ?{param}"),
        }
    }

    fn value(&self) -> &str {
        match self {
            Scope::Tenant(value) | Scope::User(value) => value,
        }
    }

    /// Tenant id under which tenant-scoped configuration (policies, DLP
    /// rules, budgets) is stored for this caller.
    fn config_tenant(&self, user: &AuthUser) -> Option<String> {
        match self {
            Scope::Tenant(org) => Some(org.clone()),
            Scope::User(_) => user.tenant_id.clone(),
        }
    }
}

/// Resolve the caller's admin scope. Uses the same `crate::rbac::is_org_admin`
/// check as `usage_routes.rs` and `cloud_credentials_routes.rs` for org-scoped
/// access.
fn admin_scope(conn: &Connection, user: &AuthUser) -> Result<Scope, ApiError> {
    if let Some(org) = &user.organization_id {
        let is_admin =
            crate::rbac::is_org_admin(conn, org, &user.user_id).map_err(internal_error)?;
        if !is_admin {
            return Err(forbidden(
                "insufficient_role",
                "Only organization owners/admins can manage the LLM gateway.",
            ));
        }
        return Ok(Scope::Tenant(org.clone()));
    }
    Ok(Scope::User(user.user_id.clone()))
}

// ─── GET /gateway/usage ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct UsageQuery {
    /// YYYY-MM-DD, inclusive. Defaults to the first of the current month.
    from: Option<String>,
    /// YYYY-MM-DD, exclusive. Defaults to tomorrow.
    to: Option<String>,
}

async fn get_usage(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<UsageQuery>,
) -> Response {
    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal_error)?;
        let scope = admin_scope(&conn, &user)?;

        let from = query.from.unwrap_or_else(|| {
            chrono::Utc::now().format("%Y-%m-01").to_string()
        });
        let to = query.to.unwrap_or_else(|| {
            (chrono::Utc::now() + chrono::Duration::days(1))
                .format("%Y-%m-%d")
                .to_string()
        });

        // Spend bills off the recomputed cost when present (V27 single
        // source of truth).
        let sql = format!(
            "SELECT date(e.created_at) AS day,
                    COALESCE(e.provider_id, '') AS provider,
                    COALESCE(e.model_id, '') AS model,
                    COALESCE(e.virtual_key_id, '') AS key_id,
                    k.key_prefix,
                    COUNT(*) AS requests,
                    SUM(e.prompt_tokens), SUM(e.completion_tokens),
                    SUM(e.reasoning_tokens), SUM(e.cached_tokens),
                    SUM(COALESCE(e.recomputed_cost_microdollars, e.cost_microdollars)) AS spend,
                    SUM(e.cost_mismatch) AS mismatches
             FROM llm_usage_events e
             LEFT JOIN llm_virtual_keys k ON k.id = e.virtual_key_id
             WHERE {} AND e.created_at >= ?2 AND e.created_at < ?3
             GROUP BY day, provider, model, key_id
             ORDER BY day DESC, spend DESC",
            scope.usage_where(1, "e")
        );
        let mut stmt = conn.prepare(&sql).map_err(internal_error)?;
        let rows = stmt
            .query_map(params![scope.value(), from, to], |row| {
                Ok(json!({
                    "day": row.get::<_, String>(0)?,
                    "provider_id": row.get::<_, String>(1)?,
                    "model_id": row.get::<_, String>(2)?,
                    "virtual_key_id": row.get::<_, String>(3)?,
                    "key_prefix": row.get::<_, Option<String>>(4)?,
                    "requests": row.get::<_, i64>(5)?,
                    "prompt_tokens": row.get::<_, i64>(6)?,
                    "completion_tokens": row.get::<_, i64>(7)?,
                    "reasoning_tokens": row.get::<_, i64>(8)?,
                    "cached_tokens": row.get::<_, i64>(9)?,
                    "spend_microdollars": row.get::<_, i64>(10)?,
                    "cost_mismatches": row.get::<_, i64>(11)?,
                }))
            })
            .map_err(internal_error)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal_error)?;

        let mut totals = json!({
            "requests": 0, "prompt_tokens": 0, "completion_tokens": 0,
            "reasoning_tokens": 0, "cached_tokens": 0, "spend_microdollars": 0,
        });
        for row in &rows {
            for field in [
                "requests",
                "prompt_tokens",
                "completion_tokens",
                "reasoning_tokens",
                "cached_tokens",
                "spend_microdollars",
            ] {
                let sum = totals[field].as_i64().unwrap_or(0) + row[field].as_i64().unwrap_or(0);
                totals[field] = json!(sum);
            }
        }

        Ok::<_, ApiError>(json!({
            "from": from, "to": to,
            "usage": rows,
            "totals": totals,
        }))
    })
    .await;

    respond(result)
}

// ─── GET /gateway/logs ───────────────────────────────────────────────────────

const DEFAULT_PAGE_LIMIT: i64 = 50;
const MAX_PAGE_LIMIT: i64 = 200;

#[derive(Debug, Deserialize)]
struct LogsQuery {
    limit: Option<i64>,
    /// `created_at|id` of the last row of the previous page.
    cursor: Option<String>,
    status: Option<String>,
}

/// Split a `created_at|id` cursor.
fn parse_cursor(cursor: &str) -> Option<(String, String)> {
    let (created_at, id) = cursor.split_once('|')?;
    if created_at.is_empty() || id.is_empty() {
        return None;
    }
    Some((created_at.to_string(), id.to_string()))
}

async fn get_logs(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<LogsQuery>,
) -> Response {
    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal_error)?;
        let scope = admin_scope(&conn, &user)?;

        let limit = query.limit.unwrap_or(DEFAULT_PAGE_LIMIT);
        if !(1..=MAX_PAGE_LIMIT).contains(&limit) {
            return Err(bad_request(format!(
                "`limit` must be between 1 and {MAX_PAGE_LIMIT}."
            )));
        }
        let cursor = match query.cursor.as_deref() {
            Some(raw) => Some(
                parse_cursor(raw)
                    .ok_or_else(|| bad_request("Malformed `cursor`; expected `created_at|id`."))?,
            ),
            None => None,
        };

        let sql = format!(
            "SELECT e.id, e.created_at, e.status, e.error_type, e.policy,
                    e.provider_id, e.model_id, e.fallback_from,
                    e.prompt_tokens, e.completion_tokens, e.reasoning_tokens, e.cached_tokens,
                    e.cost_microdollars, e.recomputed_cost_microdollars, e.cost_mismatch,
                    e.latency_ms, e.ttft_ms, e.gizzi_session_id, k.key_prefix
             FROM llm_usage_events e
             LEFT JOIN llm_virtual_keys k ON k.id = e.virtual_key_id
             WHERE {}
               AND (?2 IS NULL OR e.status = ?2)
               AND (?3 IS NULL OR e.created_at < ?3 OR (e.created_at = ?3 AND e.id < ?4))
             ORDER BY e.created_at DESC, e.id DESC
             LIMIT ?5",
            scope.usage_where(1, "e")
        );
        let (cursor_ts, cursor_id) = match &cursor {
            Some((ts, id)) => (Some(ts.clone()), Some(id.clone())),
            None => (None, None),
        };
        let mut stmt = conn.prepare(&sql).map_err(internal_error)?;
        let mut rows = stmt
            .query_map(
                params![scope.value(), query.status, cursor_ts, cursor_id, limit + 1],
                |row| {
                    Ok(json!({
                        "id": row.get::<_, String>(0)?,
                        "created_at": row.get::<_, String>(1)?,
                        "status": row.get::<_, String>(2)?,
                        "error_type": row.get::<_, Option<String>>(3)?,
                        "policy": row.get::<_, Option<String>>(4)?,
                        "provider_id": row.get::<_, Option<String>>(5)?,
                        "model_id": row.get::<_, Option<String>>(6)?,
                        "fallback_from": row.get::<_, Option<String>>(7)?,
                        "prompt_tokens": row.get::<_, i64>(8)?,
                        "completion_tokens": row.get::<_, i64>(9)?,
                        "reasoning_tokens": row.get::<_, i64>(10)?,
                        "cached_tokens": row.get::<_, i64>(11)?,
                        "cost_microdollars": row.get::<_, i64>(12)?,
                        "recomputed_cost_microdollars": row.get::<_, Option<i64>>(13)?,
                        "cost_mismatch": row.get::<_, i64>(14)? != 0,
                        "latency_ms": row.get::<_, i64>(15)?,
                        "ttft_ms": row.get::<_, Option<i64>>(16)?,
                        "gizzi_session_id": row.get::<_, Option<String>>(17)?,
                        "key_prefix": row.get::<_, Option<String>>(18)?,
                    }))
                },
            )
            .map_err(internal_error)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal_error)?;

        let next_cursor = if rows.len() as i64 > limit {
            rows.truncate(limit as usize);
            rows.last().map(|row| {
                format!(
                    "{}|{}",
                    row["created_at"].as_str().unwrap_or_default(),
                    row["id"].as_str().unwrap_or_default()
                )
            })
        } else {
            None
        };

        Ok::<_, ApiError>(json!({ "logs": rows, "next_cursor": next_cursor }))
    })
    .await;

    respond(result)
}

// ─── GET /gateway/routing/decisions ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct DecisionsQuery {
    limit: Option<i64>,
    cursor: Option<String>,
}

async fn get_routing_decisions(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<DecisionsQuery>,
) -> Response {
    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal_error)?;
        let scope = admin_scope(&conn, &user)?;

        let limit = query.limit.unwrap_or(DEFAULT_PAGE_LIMIT);
        if !(1..=MAX_PAGE_LIMIT).contains(&limit) {
            return Err(bad_request(format!(
                "`limit` must be between 1 and {MAX_PAGE_LIMIT}."
            )));
        }
        let cursor = match query.cursor.as_deref() {
            Some(raw) => Some(
                parse_cursor(raw)
                    .ok_or_else(|| bad_request("Malformed `cursor`; expected `created_at|id`."))?,
            ),
            None => None,
        };

        let sql = format!(
            "SELECT d.id, d.created_at, d.policy, d.winner, d.candidates, d.scores, d.rules_fired,
                    e.model_id, e.provider_id, e.status, e.id AS usage_event_id
             FROM llm_routing_decisions d
             JOIN llm_usage_events e ON e.id = d.usage_event_id
             WHERE {}
               AND (?2 IS NULL OR d.created_at < ?2 OR (d.created_at = ?2 AND d.id < ?3))
             ORDER BY d.created_at DESC, d.id DESC
             LIMIT ?4",
            scope.usage_where(1, "e")
        );
        let (cursor_ts, cursor_id) = match &cursor {
            Some((ts, id)) => (Some(ts.clone()), Some(id.clone())),
            None => (None, None),
        };
        let mut stmt = conn.prepare(&sql).map_err(internal_error)?;
        let mut rows = stmt
            .query_map(
                params![scope.value(), cursor_ts, cursor_id, limit + 1],
                |row| {
                    let candidates: Option<String> = row.get(4)?;
                    let scores: Option<String> = row.get(5)?;
                    let rules_fired: Option<String> = row.get(6)?;
                    Ok(json!({
                        "id": row.get::<_, String>(0)?,
                        "created_at": row.get::<_, String>(1)?,
                        "policy": row.get::<_, Option<String>>(2)?,
                        "winner": row.get::<_, Option<String>>(3)?,
                        "candidates": candidates.and_then(|c| serde_json::from_str::<Value>(&c).ok()),
                        "scores": scores.and_then(|s| serde_json::from_str::<Value>(&s).ok()),
                        "rules_fired": rules_fired.and_then(|r| serde_json::from_str::<Value>(&r).ok()),
                        "served_model_id": row.get::<_, Option<String>>(7)?,
                        "served_provider_id": row.get::<_, Option<String>>(8)?,
                        "status": row.get::<_, Option<String>>(9)?,
                        "usage_event_id": row.get::<_, Option<String>>(10)?,
                    }))
                },
            )
            .map_err(internal_error)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal_error)?;

        let next_cursor = if rows.len() as i64 > limit {
            rows.truncate(limit as usize);
            rows.last().map(|row| {
                format!(
                    "{}|{}",
                    row["created_at"].as_str().unwrap_or_default(),
                    row["id"].as_str().unwrap_or_default()
                )
            })
        } else {
            None
        };

        Ok::<_, ApiError>(json!({ "decisions": rows, "next_cursor": next_cursor }))
    })
    .await;

    respond(result)
}

// ─── GET/PUT /gateway/routing/policies ───────────────────────────────────────

/// Validate a custom weight map: known benchmarks, finite, non-negative,
/// at least one strictly positive. Returns the canonical JSON string.
fn validate_weights(weights: &Value) -> Result<String, ApiError> {
    let object = weights
        .as_object()
        .ok_or_else(|| bad_request("`weights` must be an object of benchmark → weight."))?;
    if object.is_empty() {
        return Err(bad_request("`weights` must not be empty."));
    }
    let mut any_positive = false;
    for (benchmark, weight) in object {
        if !policy_router::BENCHMARKS.contains(&benchmark.as_str()) {
            return Err(bad_request(format!(
                "Unknown benchmark `{benchmark}`; expected one of {:?}.",
                policy_router::BENCHMARKS
            )));
        }
        let Some(weight) = weight.as_f64() else {
            return Err(bad_request(format!(
                "`weights.{benchmark}` must be a number."
            )));
        };
        if !weight.is_finite() || weight < 0.0 {
            return Err(bad_request(format!(
                "`weights.{benchmark}` must be a finite number >= 0."
            )));
        }
        any_positive |= weight > 0.0;
    }
    if !any_positive {
        return Err(bad_request("At least one weight must be > 0."));
    }
    serde_json::to_string(weights).map_err(internal_error)
}

fn policy_row_json(id: &str, name: &str, weights: &str, updated_at: Option<String>) -> Value {
    json!({
        "id": id,
        "name": name,
        "weights": serde_json::from_str::<Value>(weights).unwrap_or(Value::Null),
        "source": "custom",
        "updated_at": updated_at,
    })
}

async fn list_policies(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal_error)?;
        let scope = admin_scope(&conn, &user)?;
        let tenant = scope.config_tenant(&user);

        // Presets first (read-only; a same-named custom row overrides them
        // at routing time — see router::custom_weights).
        let mut policies: Vec<Value> = Vec::new();
        for alias in super::proxy::POLICY_ALIASES {
            if let Some(weights) = policy_router::preset_weights(alias) {
                policies.push(json!({
                    "name": alias,
                    "weights": weights,
                    "source": "preset",
                }));
            }
        }

        let mut stmt = conn
            .prepare(
                "SELECT id, name, weights, updated_at FROM llm_routing_policies
                 WHERE tenant_id IS ?1
                 ORDER BY name",
            )
            .map_err(internal_error)?;
        let custom = stmt
            .query_map(params![tenant], |row| {
                Ok(policy_row_json(
                    &row.get::<_, String>(0)?,
                    &row.get::<_, String>(1)?,
                    &row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                ))
            })
            .map_err(internal_error)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal_error)?;
        policies.extend(custom);

        Ok::<_, ApiError>(json!({ "policies": policies }))
    })
    .await;

    respond(result)
}

#[derive(Debug, Deserialize)]
struct PutPolicyRequest {
    name: String,
    weights: Value,
}

async fn put_policy(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(payload): Json<PutPolicyRequest>,
) -> Response {
    let name = payload.name.trim().to_string();
    if name.is_empty() || name.len() > 64 {
        return bad_request("`name` must be 1-64 characters.").into_response();
    }
    let weights_json = match validate_weights(&payload.weights) {
        Ok(json) => json,
        Err(err) => return err.into_response(),
    };

    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal_error)?;
        let scope = admin_scope(&conn, &user)?;
        let tenant = scope.config_tenant(&user);

        let existing: Option<String> = conn
            .query_row(
                "SELECT id FROM llm_routing_policies
                 WHERE name = ?1 AND tenant_id IS ?2",
                params![name, tenant],
                |row| row.get(0),
            )
            .optional()
            .map_err(internal_error)?;

        let id = match existing {
            Some(id) => {
                conn.execute(
                    "UPDATE llm_routing_policies
                     SET weights = ?2, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?1",
                    params![id, weights_json],
                )
                .map_err(internal_error)?;
                id
            }
            None => {
                let id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO llm_routing_policies (id, tenant_id, name, weights)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![id, tenant, name, weights_json],
                )
                .map_err(internal_error)?;
                id
            }
        };

        Ok::<_, ApiError>(policy_row_json(&id, &name, &weights_json, None))
    })
    .await;

    respond(result)
}

// ─── GET/PUT /gateway/dlp/rules ──────────────────────────────────────────────

async fn list_dlp_rules(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal_error)?;
        let scope = admin_scope(&conn, &user)?;
        let tenant = scope.config_tenant(&user);

        let default_action = std::env::var("ALLTERNIT_DLP_DEFAULT_ACTION")
            .ok()
            .filter(|a| ["block", "redact", "warn"].contains(&a.as_str()))
            .unwrap_or_else(|| "block".to_string());

        // Built-in pattern ids (actions come from the default or a
        // same-named tenant override).
        let mut rules: Vec<Value> = dlp_patterns::builtin_patterns()
            .iter()
            .map(|pattern| {
                json!({
                    "name": pattern.id,
                    "action": default_action,
                    "source": "builtin",
                })
            })
            .collect();

        let mut stmt = conn
            .prepare(
                "SELECT id, name, pattern, action, enabled, created_at
                 FROM llm_dlp_rules
                 WHERE tenant_id IS ?1
                 ORDER BY created_at DESC",
            )
            .map_err(internal_error)?;
        let custom = stmt
            .query_map(params![tenant], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "pattern": row.get::<_, String>(2)?,
                    "action": row.get::<_, String>(3)?,
                    "enabled": row.get::<_, i64>(4)? != 0,
                    "source": "tenant",
                    "created_at": row.get::<_, Option<String>>(5)?,
                }))
            })
            .map_err(internal_error)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal_error)?;
        rules.extend(custom);

        Ok::<_, ApiError>(json!({ "rules": rules, "default_action": default_action }))
    })
    .await;

    respond(result)
}

#[derive(Debug, Deserialize)]
struct PutDlpRuleRequest {
    /// Update an existing tenant rule when present.
    id: Option<String>,
    name: String,
    pattern: String,
    action: String,
    enabled: Option<bool>,
}

async fn put_dlp_rule(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(payload): Json<PutDlpRuleRequest>,
) -> Response {
    let name = payload.name.trim().to_string();
    if name.is_empty() || name.len() > 64 {
        return bad_request("`name` must be 1-64 characters.").into_response();
    }
    if regex::Regex::new(&payload.pattern).is_err() {
        return bad_request("`pattern` must be a valid regular expression.").into_response();
    }
    if !["block", "redact", "warn"].contains(&payload.action.as_str()) {
        return bad_request("`action` must be one of block, redact, warn.").into_response();
    }

    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal_error)?;
        let scope = admin_scope(&conn, &user)?;
        let tenant = scope.config_tenant(&user);
        let enabled = payload.enabled.unwrap_or(true) as i64;

        if let Some(id) = &payload.id {
            // Only the caller's own tenant rules are updatable.
            let owner: Option<Option<String>> = conn
                .query_row(
                    "SELECT tenant_id FROM llm_dlp_rules WHERE id = ?1",
                    params![id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(internal_error)?;
            let Some(owner) = owner else {
                return Err(not_found("rule_not_found", "No such DLP rule."));
            };
            if owner != tenant {
                return Err(not_found("rule_not_found", "No such DLP rule."));
            }
            conn.execute(
                "UPDATE llm_dlp_rules
                 SET name = ?2, pattern = ?3, action = ?4, enabled = ?5
                 WHERE id = ?1",
                params![id, name, payload.pattern, payload.action, enabled],
            )
            .map_err(internal_error)?;
            return Ok::<_, ApiError>(json!({
                "id": id, "name": name, "pattern": payload.pattern,
                "action": payload.action, "enabled": enabled != 0, "source": "tenant",
            }));
        }

        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO llm_dlp_rules (id, tenant_id, name, pattern, action, enabled)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, tenant, name, payload.pattern, payload.action, enabled],
        )
        .map_err(internal_error)?;
        Ok::<_, ApiError>(json!({
            "id": id, "name": name, "pattern": payload.pattern,
            "action": payload.action, "enabled": enabled != 0, "source": "tenant",
        }))
    })
    .await;

    respond(result)
}

// ─── GET/PUT /gateway/budgets ────────────────────────────────────────────────

async fn list_budgets(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal_error)?;
        let scope = admin_scope(&conn, &user)?;
        let tenant = scope.config_tenant(&user);

        let mut budgets: Vec<Value> = Vec::new();
        let mut spend_microdollars = 0i64;
        if let Some(tenant) = &tenant {
            let mut stmt = conn
                .prepare(
                    "SELECT id, period, budget_cents, hard, created_at, updated_at
                     FROM llm_budgets WHERE tenant_id = ?1
                     ORDER BY created_at DESC",
                )
                .map_err(internal_error)?;
            budgets = stmt
                .query_map(params![tenant], |row| {
                    Ok(json!({
                        "id": row.get::<_, String>(0)?,
                        "tenant_id": tenant,
                        "period": row.get::<_, String>(1)?,
                        "budget_cents": row.get::<_, i64>(2)?,
                        "hard": row.get::<_, i64>(3)? != 0,
                        "created_at": row.get::<_, Option<String>>(4)?,
                        "updated_at": row.get::<_, Option<String>>(5)?,
                    }))
                })
                .map_err(internal_error)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(internal_error)?;

            spend_microdollars = conn
                .query_row(
                    "SELECT COALESCE(SUM(COALESCE(recomputed_cost_microdollars, cost_microdollars)), 0)
                     FROM llm_usage_events
                     WHERE tenant_id = ?1
                       AND created_at >= strftime('%Y-%m-01 00:00:00', 'now')",
                    params![tenant],
                    |row| row.get(0),
                )
                .map_err(internal_error)?;
        }

        Ok::<_, ApiError>(json!({
            "budgets": budgets,
            "tenant_id": tenant,
            "current_month_spend_microdollars": spend_microdollars,
        }))
    })
    .await;

    respond(result)
}

#[derive(Debug, Deserialize)]
struct PutBudgetRequest {
    budget_cents: i64,
    /// Hard cap blocks requests at the cap (default); soft caps only report.
    hard: Option<bool>,
}

async fn put_budget(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(payload): Json<PutBudgetRequest>,
) -> Response {
    if payload.budget_cents < 0 {
        return bad_request("`budget_cents` must be >= 0.").into_response();
    }

    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal_error)?;
        let scope = admin_scope(&conn, &user)?;
        let Some(tenant) = scope.config_tenant(&user) else {
            return Err(bad_request(
                "Tenant budgets require an active organization or profile tenant.",
            ));
        };

        // History-preserving: the budget middleware reads the latest row.
        let id = uuid::Uuid::new_v4().to_string();
        let hard = payload.hard.unwrap_or(true) as i64;
        conn.execute(
            "INSERT INTO llm_budgets (id, tenant_id, period, budget_cents, hard)
             VALUES (?1, ?2, 'monthly', ?3, ?4)",
            params![id, tenant, payload.budget_cents, hard],
        )
        .map_err(internal_error)?;

        Ok::<_, ApiError>(json!({
            "id": id,
            "tenant_id": tenant,
            "period": "monthly",
            "budget_cents": payload.budget_cents,
            "hard": hard != 0,
        }))
    })
    .await;

    respond(result)
}

// ─── Shared response plumbing ────────────────────────────────────────────────

fn respond(
    result: Result<Result<Value, ApiError>, tokio::task::JoinError>,
) -> Response {
    match result {
        Ok(Ok(body)) => Json(body).into_response(),
        Ok(Err((status, body))) => (status, body).into_response(),
        Err(err) => internal_error(err).into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cursor_roundtrip() {
        let (ts, id) = parse_cursor("2026-07-18 04:00:00|abc-123").unwrap();
        assert_eq!(ts, "2026-07-18 04:00:00");
        assert_eq!(id, "abc-123");
        assert!(parse_cursor("no-separator").is_none());
        assert!(parse_cursor("|id").is_none());
        assert!(parse_cursor("ts|").is_none());
    }

    #[test]
    fn weights_validation_accepts_known_benchmarks() {
        let json = validate_weights(&json!({"mmlu": 2.0, "gpqa": 1})).unwrap();
        let back: Value = serde_json::from_str(&json).unwrap();
        assert_eq!(back["mmlu"], 2.0);
    }

    #[test]
    fn weights_validation_rejects_bad_input() {
        assert!(validate_weights(&json!({"nope": 1.0})).is_err());
        assert!(validate_weights(&json!({"mmlu": -1.0})).is_err());
        assert!(validate_weights(&json!({"mmlu": 0.0})).is_err());
        assert!(validate_weights(&json!({})).is_err());
        assert!(validate_weights(&json!([1, 2])).is_err());
        assert!(validate_weights(&json!({"mmlu": "high"})).is_err());
    }

    #[test]
    fn scope_sql_variants() {
        let tenant = Scope::Tenant("org_1".to_string());
        assert_eq!(tenant.usage_where(1, "e"), "e.tenant_id = ?1");
        let user = Scope::User("user_1".to_string());
        assert_eq!(user.usage_where(3, "e"), "e.user_id = ?3");
    }
}
