//! Allternit-owned connector standard — catalog + connection engine.
//!
//! Reuses the existing in-process design catalog (`assets/open-design/connectors.json`)
//! and layers owned auth metadata (`assets/connectors.meta.json`) on top. The
//! curated 3 (github/notion/slack — the explicit meta entries) connect/execute
//! entirely in-process: local_cli (e.g. `gh`), api_key, oauth2 PKCE/loopback,
//! device_flow, with tokens sealed by `token_crypto.rs` in `connector_connections`
//! (V16, backend='rust_native'). Every other catalog id is served by the
//! vendored open-connector sidecar (`services/open-connector`) through
//! `crate::open_connector_proxy`: the sidecar holds the real credential in its
//! own encrypted SQLite and Rust keeps only an index row (backend='open_connector',
//! V17, tokens NULL). Connection state for both backends lives in
//! `connector_connections`, scoped by (connector_id, user_id).

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{Html, IntoResponse},
    routing::{delete, get, post},
    Json, Router,
};
use rusqlite::params;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::auth::get_user;
use crate::AppState;

const CATALOG_JSON: &str = include_str!("../assets/open-design/connectors.json");
const META_JSON: &str = include_str!("../assets/connectors.meta.json");

fn catalog() -> &'static Value {
    static C: std::sync::OnceLock<Value> = std::sync::OnceLock::new();
    C.get_or_init(|| serde_json::from_str(CATALOG_JSON).unwrap_or_else(|_| json!({"connectors": []})))
}

fn meta() -> &'static Value {
    static M: std::sync::OnceLock<Value> = std::sync::OnceLock::new();
    M.get_or_init(|| serde_json::from_str(META_JSON).unwrap_or_else(|_| json!({})))
}

/// Owned auth mapping for a connector: explicit `assets/connectors.meta.json`
/// entry if present, otherwise a synthesized Allternit-owned OAuth2 mapping.
/// Synthesis NEVER invents a provider base_url or OAuth endpoints — those only
/// exist when an explicit meta entry (or a future curated mapping) supplies them.
/// What synthesis guarantees for all 181: a concrete owned auth method + the exact
/// one-click-config knob (`ALLTERNIT_<ID>_CLIENT_ID`), so Connect never answers
/// "not supported"; it answers "register the Allternit OAuth app once (this env)".
fn synthesize_meta(id: &str) -> Value {
    let env = format!("ALLTERNIT_{}_CLIENT_ID", id.to_uppercase().replace('-', "_"));
    json!({
        "auth_type": "oauth2",
        "tier": 2,
        "mcp_backed": false,
        "connectable": true,
        "synthesized": true,
        "oauth2": { "pkce": false },
        "setup_env": env
    })
}

fn meta_for(id: &str) -> Value {
    meta()
        .get(id)
        .cloned()
        .unwrap_or_else(|| synthesize_meta(id))
}

fn catalog_connectors() -> Vec<Value> {
    catalog()
        .get("connectors")
        .and_then(|c| c.as_array())
        .cloned()
        .unwrap_or_default()
}

fn find_catalog(id: &str) -> Option<Value> {
    catalog_connectors()
        .into_iter()
        .find(|c| c.get("id").and_then(|i| i.as_str()) == Some(id))
}

pub fn connector_router() -> Router<Arc<AppState>> {
    // NOTE: `/connectors/oauth/callback` is intentionally NOT mounted here.
    // An OAuth provider's browser redirect cannot carry a Clerk JWT, so the
    // callback lives in the public router (`connector_public_router`, mounted
    // unauthenticated in main.rs) alongside the sidecar's `/oauth/callback`.
    Router::new()
        .route("/connectors", get(list_connectors))
        .route("/connectors/:id", get(get_connector))
        .route("/connectors/:id/connect", post(connect_connector))
        .route("/connectors/:id/refresh", post(refresh_connector))
        .route("/connectors/:id/poll", post(poll_device))
        .route("/connectors/:id/execute", post(execute_connector))
        .route("/connectors/:id/disconnect", delete(disconnect_connector))
}

/// Public connector routes — mounted OUTSIDE the Clerk-protected router in
/// main.rs. Both are OAuth provider redirect targets: the browser arrives
/// straight from the provider's consent screen with no Allternit session.
/// `/api/v1/connectors/oauth/callback` is the rust-native (curated 3)
/// loopback; `/oauth/callback` proxies to the open-connector sidecar, whose
/// OAuth client configs use `{ALLTERNIT origin}/oauth/callback` as redirect
/// URI (OOMOL_CONNECT_ORIGIN is set to this API's origin by dev-stack-watch).
pub fn connector_public_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/v1/connectors/oauth/callback", get(oauth_callback))
        .route("/oauth/callback", get(sidecar_oauth_callback))
}

/// Sidecar OAuth completion: the provider redirected to this API's origin;
/// forward the query string to the sidecar's own `/oauth/callback` (which
/// knows the pending state) and pipe its HTML completion page back verbatim.
/// On success the sidecar holds the credential; the next `list_connectors`
/// lazily upgrades this user's index row to 'connected' via the live
/// connection view, so no DB write is needed (or possible — this request is
/// unauthenticated) here.
async fn sidecar_oauth_callback(
    axum::extract::RawQuery(query): axum::extract::RawQuery,
) -> impl IntoResponse {
    match crate::open_connector_proxy::proxy_oauth_callback(&query.unwrap_or_default()).await {
        Ok((status, html)) => (
            StatusCode::from_u16(status).unwrap_or(StatusCode::OK),
            Html(html),
        )
            .into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Html(format!(
                "<html><body><h2>Connector sidecar unavailable</h2><p>{}</p></body></html>",
                e.message
            )),
        )
            .into_response(),
    }
}

fn caller(headers: &axum::http::HeaderMap) -> String {
    get_user(headers)
        .map(|u| u.user_id)
        .unwrap_or_else(|| "local-dev".to_string())
}

/// True for the curated 3 (github/notion/slack) — ids with an explicit entry
/// in `assets/connectors.meta.json`. Those keep the rust-native path; every
/// other catalog id is served by the open-connector sidecar.
fn is_curated(id: &str) -> bool {
    meta().get(id).is_some()
}

/// Snapshot of sidecar state for one catalog render: the slim provider map
/// (`None` = sidecar unreachable — degrade gracefully) and THIS user's live
/// connections (service -> account label), alias-filtered inside the proxy.
struct SidecarView {
    providers:
        Option<std::sync::Arc<std::collections::HashMap<String, crate::open_connector_proxy::ProviderSummary>>>,
    connections: std::collections::HashMap<String, String>,
}

async fn sidecar_view(user_id: &str) -> SidecarView {
    use crate::open_connector_proxy as sidecar;
    match sidecar::provider_summaries().await {
        Ok(map) => {
            let conns = sidecar::list_user_connections(user_id).await.unwrap_or_default();
            SidecarView { providers: Some(map), connections: conns.into_iter().collect() }
        }
        Err(_) => SidecarView { providers: None, connections: std::collections::HashMap::new() },
    }
}

/// Detect whether a `local_cli` connector's backing CLI is installed and
/// authenticated on THIS machine. Generic: driven entirely by
/// `meta.local_cli.{cmd,token_args,account_args}`, so gh/gcloud/git/... all
/// light up the same way. Never returns the token itself — only presence.
fn detect_local_cli(m: &Value) -> Value {
    let lc = m.get("local_cli").cloned().unwrap_or_else(|| json!({}));
    let cmd = lc.get("cmd").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let token_args: Vec<String> = lc
        .get("token_args")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    let account_args: Vec<String> = lc
        .get("account_args")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    if cmd.is_empty() {
        return json!({ "installed": false, "authed": false, "account": "", "cmd": "" });
    }
    match std::process::Command::new(&cmd).args(&token_args).output() {
        Err(_) => json!({ "installed": false, "authed": false, "account": "", "cmd": cmd }),
        Ok(o) if !o.status.success() => json!({
            "installed": true, "authed": false, "account": "", "cmd": cmd,
            "hint": format!("`{}` is installed but not authenticated; run its login once", cmd),
        }),
        Ok(o) => {
            let authed = !String::from_utf8_lossy(&o.stdout).trim().is_empty();
            let mut account = String::new();
            if authed && !account_args.is_empty() {
                if let Ok(a) = std::process::Command::new(&cmd).args(&account_args).output() {
                    if a.status.success() {
                        account = String::from_utf8_lossy(&a.stdout).trim().to_string();
                    }
                }
            }
            json!({ "installed": true, "authed": authed, "account": account, "cmd": cmd })
        }
    }
}

/// Merge catalog entry + owned meta + live connection status into one view.
/// Curated 3 (github/notion/slack): the rust-native meta path below, untouched.
/// Everything else: sidecar-sourced truth via `merge_sidecar` — never the old
/// synthesized always-`connectable:true` stub.
fn merge(c: &Value, user_id: &str, db: &crate::db::DbHandle, sv: &SidecarView) -> Value {
    let id = c.get("id").and_then(|i| i.as_str()).unwrap_or("");
    if !is_curated(id) {
        return merge_sidecar(c, user_id, db, sv);
    }
    let m = meta_for(id);
    let auth_type = m.get("auth_type").and_then(|v| v.as_str()).unwrap_or("unknown");
    let tier = m.get("tier").and_then(|v| v.as_i64()).unwrap_or(2);
    let mcp_backed = m.get("mcp_backed").and_then(|v| v.as_bool()).unwrap_or(false);
    let connectable = m.get("connectable").and_then(|v| v.as_bool()).unwrap_or(false);
    let base_url = m.get("base_url").and_then(|v| v.as_str());
    let synthesized = m.get("synthesized").and_then(|v| v.as_bool()).unwrap_or(false);
    let setup_env = m.get("setup_env").and_then(|v| v.as_str()).map(|s| s.to_string());
    let tools_mapped = m
        .get("tools")
        .and_then(|v| v.as_array())
        .map(|a| !a.is_empty())
        .unwrap_or(false);
    let executable = base_url.is_some() && tools_mapped;

    let (conn_status, account) = db
        .connect()
        .ok()
        .and_then(|conn| {
            conn.query_row(
                "SELECT status, COALESCE(account,'') FROM connector_connections WHERE connector_id=?1 AND user_id=?2",
                params![id, user_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .ok()
        })
        .unwrap_or_else(|| ("disconnected".to_string(), String::new()));

    let mut out = c.clone();
    if let Some(obj) = out.as_object_mut() {
        obj.insert("provider".to_string(), json!("allternit"));
        obj.insert("auth".to_string(), json!({ "type": auth_type, "owned": true, "synthesized": synthesized }));
        obj.insert("auth_type".to_string(), json!(auth_type));
        obj.insert("tier".to_string(), json!(tier));
        obj.insert("mcp_backed".to_string(), json!(mcp_backed));
        obj.insert("connectable".to_string(), json!(connectable));
        obj.insert("executable".to_string(), json!(executable));
        if let Some(b) = base_url {
            obj.insert("base_url".to_string(), json!(b));
        }
        if synthesized {
            if let Some(env) = setup_env {
                obj.insert(
                    "setup".to_string(),
                    json!({
                        "kind": "owned_oauth_app",
                        "set_env": env,
                        "one_click": true,
                        "message": "One-time Allternit OAuth app for this provider; set the env above (or use the Connect button) — no third-party key.",
                    }),
                );
            }
        }
        if auth_type == "local_cli" {
            obj.insert("availability".to_string(), detect_local_cli(&m));
        }
        obj.insert("connection".to_string(), json!({ "status": conn_status, "account": account }));
    }
    out
}

/// Sidecar-backed merge: real `connectable`/`executable`/`auth_type` from the
/// sidecar's own catalog, and live connection status from the sidecar's
/// connection list (falling back to the index row). Degrades to an honest
/// `connectable:false` with a clear message when the sidecar is down or lacks
/// the provider — no fake stub, and curated connectors are unaffected.
fn merge_sidecar(c: &Value, user_id: &str, db: &crate::db::DbHandle, sv: &SidecarView) -> Value {
    let id = c.get("id").and_then(|i| i.as_str()).unwrap_or("");

    let (db_status, db_account) = db
        .connect()
        .ok()
        .and_then(|conn| {
            conn.query_row(
                "SELECT status, COALESCE(account,'') FROM connector_connections WHERE connector_id=?1 AND user_id=?2",
                params![id, user_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .ok()
        })
        .unwrap_or_else(|| ("disconnected".to_string(), String::new()));

    let mut out = c.clone();
    let mut provider_auth_type = String::from("unknown");
    if let Some(obj) = out.as_object_mut() {
        obj.insert("provider".to_string(), json!("allternit"));
        obj.insert("tier".to_string(), json!(3));
        obj.insert("mcp_backed".to_string(), json!(false));
        obj.insert("backend".to_string(), json!("open_connector"));
        match sv.providers.as_ref().and_then(|m| m.get(id)) {
            Some(p) => {
                provider_auth_type = p.auth_types.first().cloned().unwrap_or_else(|| "unknown".to_string());
                obj.insert("auth".to_string(), json!({ "type": provider_auth_type, "owned": true, "synthesized": false }));
                obj.insert("auth_type".to_string(), json!(provider_auth_type));
                obj.insert("connectable".to_string(), json!(true));
                obj.insert("executable".to_string(), json!(p.executable_actions > 0));
            }
            None if sv.providers.is_none() => {
                obj.insert("auth".to_string(), json!({ "type": "unknown", "owned": true, "synthesized": false }));
                obj.insert("auth_type".to_string(), json!("unknown"));
                obj.insert("connectable".to_string(), json!(false));
                obj.insert("executable".to_string(), json!(false));
                obj.insert("setup".to_string(), json!({
                    "kind": "sidecar_unavailable",
                    "one_click": false,
                    "message": "Connector sidecar unavailable — the open-connector process is down or still starting. github/notion/slack are unaffected.",
                }));
            }
            None => {
                obj.insert("auth".to_string(), json!({ "type": "unknown", "owned": true, "synthesized": false }));
                obj.insert("auth_type".to_string(), json!("unknown"));
                obj.insert("connectable".to_string(), json!(false));
                obj.insert("executable".to_string(), json!(false));
                obj.insert("setup".to_string(), json!({
                    "kind": "not_in_sidecar_catalog",
                    "one_click": false,
                    "message": "This catalog entry has no matching provider in the vendored open-connector catalog yet.",
                }));
            }
        }
        // Live sidecar status wins over the index row; lazily sync the row so
        // `refresh`/`disconnect`/`execute` see it too.
        if let Some(account) = sv.connections.get(id) {
            if db_status != "connected" {
                mark_sidecar_connected(db, id, user_id, &provider_auth_type, account);
            }
            obj.insert("connection".to_string(), json!({ "status": "connected", "account": account }));
        } else {
            obj.insert("connection".to_string(), json!({ "status": db_status, "account": db_account }));
        }
    }
    out
}

/// Lazily sync the index row when the sidecar reports a live connection the DB
/// doesn't know about yet (e.g. OAuth completed in the popup while this row
/// was still 'pending'). Index-only: tokens stay NULL, backend='open_connector'.
fn mark_sidecar_connected(db: &crate::db::DbHandle, id: &str, user_id: &str, auth_type: &str, account: &str) {
    if let Ok(conn) = db.connect() {
        let _ = conn.execute(
            "INSERT INTO connector_connections (id, connector_id, user_id, auth_type, status, account, backend)
             VALUES (?1, ?2, ?3, ?4, 'connected', ?5, 'open_connector')
             ON CONFLICT(connector_id, user_id) DO UPDATE SET
               status='connected', account=excluded.account, backend='open_connector',
               access_token=NULL, refresh_token=NULL, updated_at=CURRENT_TIMESTAMP",
            params![uuid::Uuid::new_v4().to_string(), id, user_id, auth_type, account],
        );
    }
}

async fn list_connectors(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
) -> impl IntoResponse {
    let user_id = caller(&headers);
    let db = state.db.clone();
    let sv = sidecar_view(&user_id).await;
    let sidecar_ok = sv.providers.is_some();
    let list: Vec<Value> = catalog_connectors().iter().map(|c| merge(c, &user_id, &db, &sv)).collect();
    let total = list.len();
    Json(json!({
        "connectors": list,
        "total": total,
        "source": "allternit-owned",
        "standard": "mcp+owned-oauth+openapi",
        "sidecar": if sidecar_ok { "ok" } else { "unavailable" },
    }))
}

async fn get_connector(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match find_catalog(&id) {
        Some(c) => {
            let user_id = caller(&headers);
            let sv = sidecar_view(&user_id).await;
            (StatusCode::OK, Json(merge(&c, &user_id, &state.db, &sv)))
        }
        None => (StatusCode::NOT_FOUND, Json(json!({ "error": "connector_not_found", "id": id }))),
    }
}

#[derive(Deserialize)]
struct ConnectBody {
    via: Option<String>,
    api_key: Option<String>,
}

async fn connect_connector(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(id): Path<String>,
    body: Option<Json<ConnectBody>>,
) -> impl IntoResponse {
    let c = match find_catalog(&id) {
        Some(c) => c,
        None => return (StatusCode::NOT_FOUND, Json(json!({ "error": "connector_not_found", "id": id }))),
    };
    let m = meta_for(&id);
    let user_id = caller(&headers);
    let body = body.map(|Json(b)| b).unwrap_or(ConnectBody { via: None, api_key: None });
    if !is_curated(&id) {
        return connect_sidecar(&state, &user_id, &id, &c, body).await;
    }
    let via = body.via.unwrap_or_else(|| m.get("auth_type").and_then(|v| v.as_str()).unwrap_or("").to_string());

    match via.as_str() {
        "local_cli" => connect_local_cli(&state, &user_id, &id, &c, &m).await,
        "api_key" => connect_api_key(&state, &user_id, &id, &c, body.api_key.as_deref()).await,
        "oauth2" => connect_oauth2(&state, &user_id, &id, &c, &m).await,
        "device_flow" => connect_device(&state, &user_id, &id, &c, &m).await,
        other => (StatusCode::BAD_REQUEST, Json(json!({ "error": "unsupported_auth_type", "via": other }))),
    }
}

/// Connect a non-curated connector via the open-connector sidecar. The secret
/// lands only in the sidecar's encrypted store; Rust keeps an index row
/// (backend='open_connector', tokens NULL). Response shapes match exactly what
/// `owned-connector.ts` already expects, so the frontend needs no changes.
async fn connect_sidecar(
    state: &Arc<AppState>,
    user_id: &str,
    id: &str,
    c: &Value,
    body: ConnectBody,
) -> (StatusCode, Json<Value>) {
    use crate::open_connector_proxy as sidecar;
    let provider = match sidecar::get_provider(id).await {
        Ok(p) => p,
        Err(e) if e.unreachable => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": "sidecar_unavailable", "id": id, "message": "Connector sidecar unavailable — the open-connector process is down or still starting." })),
            );
        }
        Err(e) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "connector_not_found", "id": id, "message": e.message })),
            );
        }
    };
    let auth_types: Vec<String> = provider
        .get("authTypes")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    let via = body.via.clone().unwrap_or_else(|| auth_types.first().cloned().unwrap_or_default());

    match via.as_str() {
        "oauth2" => {
            let auth = match sidecar::start_oauth(id, user_id).await {
                Ok(a) => a,
                Err(e) if e.unreachable => {
                    return (
                        StatusCode::BAD_GATEWAY,
                        Json(json!({ "error": "sidecar_unavailable", "id": id, "message": "Connector sidecar unavailable — the open-connector process is down or still starting." })),
                    );
                }
                Err(e) => {
                    return (
                        StatusCode::from_u16(e.status).unwrap_or(StatusCode::BAD_GATEWAY),
                        Json(json!({ "error": "sidecar_oauth_failed", "id": id, "message": e.message })),
                    );
                }
            };
            let authorize_url = auth.get("authorizationUrl").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if authorize_url.is_empty() {
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({ "error": "sidecar_bad_response", "id": id, "message": "Sidecar returned no authorizationUrl — is an OAuth client configured for this provider?" })),
                );
            }
            if let Err(e) = persist_sidecar_row(&state.db, user_id, id, "oauth2", "pending", "").await {
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e })));
            }
            (
                StatusCode::OK,
                Json(json!({
                    "status": "authorization_required",
                    "auth_type": "oauth2",
                    "owned": true,
                    "connector": c.get("id"),
                    "authorize_url": authorize_url,
                    "backend": "open_connector",
                    "instructions": "Open authorize_url, approve Allternit; the provider redirects back to the Allternit callback, which forwards to the connector sidecar to finish.",
                })),
            )
        }
        "api_key" => {
            let key = body.api_key.map(|s| s.trim().to_string()).unwrap_or_default();
            if key.is_empty() {
                return (StatusCode::BAD_REQUEST, Json(json!({ "error": "api_key_required", "id": id })));
            }
            let resp = sidecar::upsert_credential(
                id,
                user_id,
                json!({ "authType": "api_key", "values": { "apiKey": key } }),
            )
            .await;
            finish_sidecar_connect(state, user_id, id, c, "api_key", resp).await
        }
        "no_auth" => {
            let resp = sidecar::upsert_credential(id, user_id, json!({ "authType": "no_auth" })).await;
            finish_sidecar_connect(state, user_id, id, c, "no_auth", resp).await
        }
        "custom_credential" => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "custom_credential_requires_values", "id": id, "message": "This provider needs structured credentials the connect dialog cannot collect yet." })),
        ),
        other => (StatusCode::BAD_REQUEST, Json(json!({ "error": "unsupported_auth_type", "via": other }))),
    }
}

/// Shared tail for the non-OAuth sidecar connect paths: on success, upsert the
/// index row (status='connected', tokens NULL, backend='open_connector') and
/// return the exact `{status:"connected", ...}` shape the frontend expects.
async fn finish_sidecar_connect(
    state: &Arc<AppState>,
    user_id: &str,
    id: &str,
    c: &Value,
    auth_type: &str,
    resp: Result<Value, crate::open_connector_proxy::ProxyError>,
) -> (StatusCode, Json<Value>) {
    let r = match resp {
        Ok(r) => r,
        Err(e) if e.unreachable => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": "sidecar_unavailable", "id": id, "message": "Connector sidecar unavailable — the open-connector process is down or still starting." })),
            );
        }
        Err(e) => {
            return (
                StatusCode::from_u16(e.status).unwrap_or(StatusCode::BAD_GATEWAY),
                Json(json!({ "error": "sidecar_connect_failed", "id": id, "message": e.message })),
            );
        }
    };
    let account = r
        .get("profile")
        .and_then(|p| p.get("displayName"))
        .and_then(|v| v.as_str())
        .or_else(|| r.get("alias").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();
    match persist_sidecar_row(&state.db, user_id, id, auth_type, "connected", &account).await {
        Ok(()) => (
            StatusCode::OK,
            Json(json!({
                "status": "connected",
                "connector": c.get("id"),
                "auth_type": auth_type,
                "owned": true,
                "account": account,
                "backend": "open_connector",
            })),
        ),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e }))),
    }
}

/// Upsert the sidecar-backed index row. Index-only: access_token/refresh_token
/// are always NULL — the sidecar's own encrypted SQLite is the token vault.
async fn persist_sidecar_row(
    db: &crate::db::DbHandle,
    user_id: &str,
    id: &str,
    auth_type: &str,
    status: &str,
    account: &str,
) -> Result<(), String> {
    let db = db.clone();
    let uid = user_id.to_string();
    let id_s = id.to_string();
    let at = auth_type.to_string();
    let st = status.to_string();
    let acc = account.to_string();
    tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO connector_connections (id, connector_id, user_id, auth_type, status, account, backend)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'open_connector')
             ON CONFLICT(connector_id, user_id) DO UPDATE SET
               auth_type=excluded.auth_type, status=excluded.status, account=excluded.account,
               backend='open_connector', access_token=NULL, refresh_token=NULL, metadata=NULL,
               updated_at=CURRENT_TIMESTAMP",
            params![uuid::Uuid::new_v4().to_string(), id_s, uid, at, st, acc],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("db task: {}", e))?
}

/// Refresh/reconnect an existing connection using how it was originally authed:
/// local_cli re-derives + re-seals the token (e.g. re-run `gh auth token`);
/// oauth2 / device_flow re-open the owned authorization; api_key must re-POST
/// /connect with the key. Never stores plaintext.
async fn refresh_connector(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let c = match find_catalog(&id) {
        Some(c) => c,
        None => return (StatusCode::NOT_FOUND, Json(json!({ "error": "connector_not_found", "id": id }))),
    };
    let m = meta_for(&id);
    let user_id = caller(&headers);

    let db = state.db.clone();
    let id_s = id.to_string();
    let uid = user_id.clone();
    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.query_row(
            "SELECT auth_type, status FROM connector_connections WHERE connector_id=?1 AND user_id=?2",
            params![id_s, uid],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
        )
    })
    .await;
    let (stored_auth, _stored_status) = match row {
        Ok(Ok(v)) => v,
        _ => return (StatusCode::CONFLICT, Json(json!({ "error": "not_connected", "id": id, "message": "Nothing to refresh — connect this connector first." }))),
    };

    if !is_curated(&id) {
        // Sidecar-backed: oauth2 re-opens the sidecar authorization; api_key
        // rotation is a fresh /connect, same as the rust-native rule.
        return match stored_auth.as_str() {
            "api_key" => (StatusCode::BAD_REQUEST, Json(json!({ "error": "api_key_refresh_via_connect", "id": id, "message": "Re-POST /connect with {\"api_key\":\"...\"} to rotate an api_key connector." }))),
            other => connect_sidecar(&state, &user_id, &id, &c, ConnectBody { via: Some(other.to_string()), api_key: None }).await,
        };
    }

    match stored_auth.as_str() {
        "local_cli" => connect_local_cli(&state, &user_id, &id, &c, &m).await,
        "oauth2" => connect_oauth2(&state, &user_id, &id, &c, &m).await,
        "device_flow" => connect_device(&state, &user_id, &id, &c, &m).await,
        "api_key" => (StatusCode::BAD_REQUEST, Json(json!({ "error": "api_key_refresh_via_connect", "id": id, "message": "Re-POST /connect with {\"api_key\":\"...\"} to rotate an api_key connector." }))),
        other => (StatusCode::BAD_REQUEST, Json(json!({ "error": "unsupported_auth_type", "via": other }))),
    }
}

async fn connect_local_cli(
    state: &Arc<AppState>,
    user_id: &str,
    id: &str,
    c: &Value,
    m: &Value,
) -> (StatusCode, Json<Value>) {
    let lc = m.get("local_cli").cloned().unwrap_or_else(|| json!({}));
    let cmd = lc.get("cmd").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let token_args: Vec<String> = lc
        .get("token_args")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    let account_args: Vec<String> = lc
        .get("account_args")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    if cmd.is_empty() || token_args.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "local_cli_not_configured", "id": id })));
    }

    // Run `<cmd> <token_args>` (e.g. `gh auth token`).
    let token_out = tokio::process::Command::new(&cmd).args(&token_args).output().await;
    let token = match token_out {
        Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout).trim().to_string(),
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr).trim().to_string();
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "local_cli_not_authenticated",
                    "id": id,
                    "message": format!("`{}` is not authenticated. Run the login flow once (e.g. `gh auth login`).", cmd),
                    "stderr": stderr,
                })),
            );
        }
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "local_cli_missing",
                    "id": id,
                    "message": format!("`{}` not found on this machine: {}. Install it and authenticate once.", cmd, e),
                })),
            );
        }
    };

    if token.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "local_cli_empty_token", "id": id })));
    }

    // Best-effort account label (e.g. `gh api user --jq .login`).
    let mut account = String::new();
    if !account_args.is_empty() {
        if let Ok(o) = tokio::process::Command::new(&cmd).args(&account_args).output().await {
            if o.status.success() {
                account = String::from_utf8_lossy(&o.stdout).trim().to_string();
            }
        }
    }

    let db = state.db.clone();
    let cid = uuid::Uuid::new_v4().to_string();
    let id_s = id.to_string();
    let uid = user_id.to_string();
    let tok = crate::token_crypto::seal(&token);
    let acc = account.clone();
    let scopes = m.get("scopes").cloned().unwrap_or_else(|| json!([])).to_string();
    let res = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO connector_connections (id, connector_id, user_id, auth_type, status, access_token, account, scopes)
             VALUES (?1, ?2, ?3, 'local_cli', 'connected', ?4, ?5, ?6)
             ON CONFLICT(connector_id, user_id) DO UPDATE SET
               auth_type='local_cli', status='connected', access_token=excluded.access_token,
               account=excluded.account, scopes=excluded.scopes, updated_at=CURRENT_TIMESTAMP",
            params![cid, id_s, uid, tok, acc, scopes],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match res {
        Ok(Ok(())) => (StatusCode::OK, Json(json!({
            "status": "connected",
            "connector": c.get("id"),
            "auth_type": "local_cli",
            "owned": true,
            "account": account,
        }))),
        Ok(Err(e)) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("db task: {}", e) }))),
    }
}

async fn connect_api_key(
    state: &Arc<AppState>,
    user_id: &str,
    id: &str,
    c: &Value,
    api_key: Option<&str>,
) -> (StatusCode, Json<Value>) {
    let key = api_key.map(|s| s.trim().to_string()).unwrap_or_default();
    if key.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "api_key_required", "id": id })));
    }
    let db = state.db.clone();
    let cid = uuid::Uuid::new_v4().to_string();
    let id_s = id.to_string();
    let uid = user_id.to_string();
    let key = crate::token_crypto::seal(&key);
    let res = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO connector_connections (id, connector_id, user_id, auth_type, status, access_token)
             VALUES (?1, ?2, ?3, 'api_key', 'connected', ?4)
             ON CONFLICT(connector_id, user_id) DO UPDATE SET
               auth_type='api_key', status='connected', access_token=excluded.access_token, updated_at=CURRENT_TIMESTAMP",
            params![cid, id_s, uid, key],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;
    match res {
        Ok(Ok(())) => (StatusCode::OK, Json(json!({ "status": "connected", "connector": c.get("id"), "auth_type": "api_key", "owned": true }))),
        Ok(Err(e)) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("db task: {}", e) }))),
    }
}

#[derive(Deserialize)]
struct ExecuteBody {
    tool: Option<String>,
    input: Option<Value>,
    path: Option<String>,
    method: Option<String>,
}

/// Synthesized connector-MCP: execute any tool declared in `meta.tools[]` against
/// `meta.base_url` — no per-connector Rust code. Supports `{path}` templating from
/// input, GET/DELETE query pass-through, and JSON body for POST/PUT/PATCH. Optional
/// `query` / `body` arrays in a tool entry restrict which input keys are forwarded;
/// otherwise GET forwards all leftover scalar inputs as query and writes send all
/// leftover input as the JSON body.
fn generic_dispatch(meta: &Value, tool: &str, input: &Value, base_url: &str) -> Option<(String, String, Option<Value>)> {
    if tool.is_empty() {
        return None;
    }
    let tools = meta.get("tools").and_then(|v| v.as_array())?;
    let t = tools.iter().find(|t| t.get("name").and_then(|n| n.as_str()) == Some(tool))?;
    let method = t.get("method").and_then(|v| v.as_str()).unwrap_or("GET").to_uppercase();
    let mut path = t.get("path").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if path.is_empty() {
        return None;
    }

    // Collect {path} template tokens.
    let mut tokens: Vec<String> = Vec::new();
    let mut rest = path.as_str();
    while let Some(start) = rest.find('{') {
        if let Some(end) = rest[start..].find('}') {
            tokens.push(rest[start + 1..start + end].to_string());
            rest = &rest[start + end + 1..];
        } else {
            break;
        }
    }

    let obj = input.as_object();
    let mut used: Vec<String> = Vec::new();
    for name in &tokens {
        if let Some(val) = obj.and_then(|o| o.get(name)).and_then(|v| v.as_str()) {
            path = path.replace(&format!("{{{}}}", name), &urlencoding(val));
            used.push(name.clone());
        }
    }

    let query_keys: Option<Vec<String>> = t
        .get("query")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect());
    let body_keys: Option<Vec<String>> = t
        .get("body")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect());

    let mut url = format!("{}{}", base_url, path);
    let mut req_body: Option<Value> = None;

    if method == "GET" || method == "DELETE" {
        let mut pairs: Vec<(String, String)> = Vec::new();
        if let Some(o) = obj {
            for (k, v) in o.iter() {
                if used.contains(k) {
                    continue;
                }
                if let Some(ref qk) = query_keys {
                    if !qk.contains(k) {
                        continue;
                    }
                }
                if let Some(s) = v.as_str() {
                    pairs.push((k.clone(), s.to_string()));
                } else if let Some(n) = v.as_i64() {
                    pairs.push((k.clone(), n.to_string()));
                } else if let Some(b) = v.as_bool() {
                    pairs.push((k.clone(), b.to_string()));
                }
            }
        }
        if !pairs.is_empty() {
            let qs: String = pairs
                .iter()
                .map(|(k, v)| format!("{}={}", urlencoding(k), urlencoding(v)))
                .collect::<Vec<_>>()
                .join("&");
            url = format!("{}?{}", url, qs);
        }
    } else {
        let mut bmap = serde_json::Map::new();
        if let Some(o) = obj {
            for (k, v) in o.iter() {
                if used.contains(k) {
                    continue;
                }
                if let Some(ref bk) = body_keys {
                    if !bk.contains(k) {
                        continue;
                    }
                }
                bmap.insert(k.clone(), v.clone());
            }
        }
        req_body = Some(Value::Object(bmap));
    }
    Some((method, url, req_body))
}

async fn execute_connector(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<ExecuteBody>,
) -> impl IntoResponse {
    let c = match find_catalog(&id) {
        Some(c) => c,
        None => return (StatusCode::NOT_FOUND, Json(json!({ "error": "connector_not_found", "id": id }))),
    };
    let m = meta_for(&id);
    let base_url = m.get("base_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let user_id = caller(&headers);

    if !is_curated(&id) {
        return execute_sidecar(&user_id, &id, &c, body).await;
    }

    // Load active connection + token.
    let db = state.db.clone();
    let id_s = id.to_string();
    let uid = user_id.clone();
    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.query_row(
            "SELECT status, COALESCE(access_token,'') FROM connector_connections WHERE connector_id=?1 AND user_id=?2",
            params![id_s, uid],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
        )
    })
    .await;

    let (status, token) = match row {
        Ok(Ok(v)) => v,
        _ => return (StatusCode::CONFLICT, Json(json!({ "error": "not_connected", "id": id, "message": "Connect this connector first, then execute." }))),
    };
    let token = crate::token_crypto::open(&token);
    if status != "connected" || token.is_empty() {
        return (StatusCode::CONFLICT, Json(json!({ "error": "not_connected", "id": id })));
    }

    let client = reqwest::Client::new();
    let tool = body.tool.clone().unwrap_or_default();
    let input = body.input.clone().unwrap_or_else(|| json!({}));

    // Dispatch order: hand-written (github) -> meta tools[] (generic, long-tail) -> raw path passthrough.
    // Triple = (method, url, optional_json_body).
    let built: Option<(String, String, Option<Value>)> = if id == "github" {
        match tool.as_str() {
            "github_search_repositories" => {
                let q = input.get("query").and_then(|v| v.as_str()).unwrap_or("");
                Some(("GET".to_string(), format!("{}/search/repositories?q={}&per_page=5", base_url, urlencoding(q)), None))
            }
            "github_get_issue" => {
                let owner = input.get("owner").and_then(|v| v.as_str()).unwrap_or("");
                let repo = input.get("repo").and_then(|v| v.as_str()).unwrap_or("");
                let number = input.get("issue_number").and_then(|v| v.as_i64()).map(|n| n.to_string()).or_else(|| input.get("issue_number").and_then(|v| v.as_str()).map(|s| s.to_string())).unwrap_or_default();
                Some(("GET".to_string(), format!("{}/repos/{}/{}/issues/{}", base_url, owner, repo, number), None))
            }
            _ => generic_dispatch(&m, &tool, &input, &base_url),
        }
    } else {
        generic_dispatch(&m, &tool, &input, &base_url)
    };
    let built = built.or_else(|| {
        body.path
            .clone()
            .map(|p| (body.method.clone().unwrap_or_else(|| "GET".to_string()), format!("{}{}", base_url, p), None))
    });

    let (method, url, req_body) = match built {
        Some(u) => u,
        None => return (StatusCode::BAD_REQUEST, Json(json!({ "error": "execute_needs_tool_or_path", "id": id, "message": "Provide a known 'tool' (hand-written or meta tools[]) or a generic 'path'." }))),
    };

    let mut req = match method.to_uppercase().as_str() {
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "PATCH" => client.patch(&url),
        "DELETE" => client.delete(&url),
        _ => client.get(&url),
    };
    req = req
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Allternit-Connectors/1.0")
        .header("Accept", "application/vnd.github+json, application/json");
    if let Some(b) = req_body {
        req = req.json(&b);
    }

    let resp = req.send().await;
    match resp {
        Ok(r) => {
            let code = StatusCode::from_u16(r.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
            let body_json: Value = r.json().await.unwrap_or_else(|_| json!({}));
            (code, Json(json!({ "status": "ok", "connector": c.get("id"), "tool": tool, "provider_status": code.as_u16(), "result": body_json })))
        }
        Err(e) => (StatusCode::BAD_GATEWAY, Json(json!({ "error": "provider_request_failed", "id": id, "message": e.to_string() }))),
    }
}

/// Execute a non-curated connector through the sidecar: resolve the tool name
/// to a sidecar action id (`{service}.{name}`), then proxy `POST
/// /v1/actions/:actionId` with the per-user alias. Response is normalized to
/// the same `{status:"ok", result:...}` shape the curated path returns.
async fn execute_sidecar(user_id: &str, id: &str, c: &Value, body: ExecuteBody) -> (StatusCode, Json<Value>) {
    use crate::open_connector_proxy as sidecar;
    let tool = body.tool.clone().unwrap_or_default();
    if tool.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "execute_needs_tool", "id": id, "message": "Sidecar-backed connectors execute by action id — pass a 'tool' from this connector's action list (GET /api/v1/connectors/:id)." })),
        );
    }
    let provider = match sidecar::get_provider(id).await {
        Ok(p) => p,
        Err(e) if e.unreachable => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": "sidecar_unavailable", "id": id, "message": "Connector sidecar unavailable — the open-connector process is down or still starting." })),
            );
        }
        Err(e) => {
            return (
                StatusCode::from_u16(e.status).unwrap_or(StatusCode::BAD_GATEWAY),
                Json(json!({ "error": "sidecar_provider_unavailable", "id": id, "message": e.message })),
            );
        }
    };
    let action_id = match resolve_action_id(id, &tool, &provider) {
        Ok(a) => a,
        Err(resp) => return resp,
    };
    let input = body.input.clone().unwrap_or_else(|| json!({}));
    match sidecar::execute(&action_id, user_id, input).await {
        Ok(env) => {
            let data = env.get("data").cloned().unwrap_or_else(|| json!({}));
            let result = data.get("result").cloned().unwrap_or(data);
            (
                StatusCode::OK,
                Json(json!({ "status": "ok", "connector": c.get("id"), "tool": tool, "provider_status": 200, "result": result, "backend": "open_connector" })),
            )
        }
        Err(e) if e.unreachable => (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": "sidecar_unavailable", "id": id, "message": "Connector sidecar unavailable — the open-connector process is down or still starting." })),
        ),
        Err(e) => (
            StatusCode::from_u16(e.status).unwrap_or(StatusCode::BAD_GATEWAY),
            Json(json!({ "error": "sidecar_action_failed", "id": id, "tool": tool, "message": e.message })),
        ),
    }
}

/// Map a caller-supplied tool name to a sidecar action id: exact action-id
/// match first, then action display name, then trust any already-qualified
/// `{service}.{name}` string.
fn resolve_action_id(id: &str, tool: &str, provider: &Value) -> Result<String, (StatusCode, Json<Value>)> {
    let actions = provider.get("actions").and_then(|v| v.as_array());
    if let Some(actions) = actions {
        if actions.iter().any(|a| a.get("id").and_then(|v| v.as_str()) == Some(tool)) {
            return Ok(tool.to_string());
        }
        if let Some(a) = actions.iter().find(|a| a.get("name").and_then(|v| v.as_str()) == Some(tool)) {
            if let Some(aid) = a.get("id").and_then(|v| v.as_str()) {
                return Ok(aid.to_string());
            }
        }
    }
    if tool.starts_with(&format!("{}.", id)) {
        return Ok(tool.to_string());
    }
    let available: Vec<&str> = actions
        .map(|a| a.iter().filter_map(|x| x.get("id").and_then(|v| v.as_str())).take(10).collect())
        .unwrap_or_default();
    Err((
        StatusCode::BAD_REQUEST,
        Json(json!({ "error": "unknown_action", "id": id, "tool": tool, "message": "Unknown tool for this provider. Pass one of available_actions (or its short name).", "available_actions": available })),
    ))
}

async fn disconnect_connector(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let user_id = caller(&headers);
    if !is_curated(&id) {
        // Proxy the real disconnect to the sidecar first. If it is down, bail
        // so the user can retry — otherwise the sidecar would keep the secret
        // while our index row says disconnected. Other errors (e.g. the
        // connection is already gone) fall through to index cleanup.
        if let Err(e) = crate::open_connector_proxy::disconnect(&id, &user_id).await {
            if e.unreachable {
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({ "error": "sidecar_unavailable", "id": id, "message": "Connector sidecar unavailable — credential NOT removed. Retry when it is back." })),
                );
            }
        }
    }
    let db = state.db.clone();
    let id_s = id.clone();
    let res = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let n = conn.execute(
            "UPDATE connector_connections SET status='disconnected', access_token=NULL, refresh_token=NULL, updated_at=CURRENT_TIMESTAMP WHERE connector_id=?1 AND user_id=?2",
            params![id_s, user_id],
        )?;
        Ok::<_, rusqlite::Error>(n)
    })
    .await;
    match res {
        Ok(Ok(_)) => (StatusCode::OK, Json(json!({ "status": "disconnected", "connector": id }))),
        Ok(Err(e)) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("db task: {}", e) }))),
    }
}

// ─── S2: owned OAuth2 (loopback) + device-flow engine ─────────────────────────

const CALLBACK_PATH: &str = "/api/v1/connectors/oauth/callback";

fn public_base() -> String {
    std::env::var("ALLTERNIT_PUBLIC_BASE_URL").unwrap_or_else(|_| "http://127.0.0.1:8013".to_string())
}
fn redirect_uri() -> String {
    format!("{}{}", public_base(), CALLBACK_PATH)
}
fn env_name(id: &str, suffix: &str) -> String {
    format!("ALLTERNIT_{}_{}", id.to_uppercase().replace('-', "_"), suffix)
}
fn read_client(id: &str, m: &Value) -> (Option<String>, Option<String>) {
    let cid = std::env::var(env_name(id, "CLIENT_ID"))
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| m.get("oauth2").and_then(|o| o.get("client_id")).and_then(|v| v.as_str()).map(|s| s.to_string()))
        .or_else(|| m.get("device").and_then(|o| o.get("client_id")).and_then(|v| v.as_str()).map(|s| s.to_string()));
    let sec = std::env::var(env_name(id, "CLIENT_SECRET"))
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| m.get("oauth2").and_then(|o| o.get("client_secret")).and_then(|v| v.as_str()).map(|s| s.to_string()));
    (cid, sec)
}
fn oauth_registration_required(id: &str) -> (StatusCode, Json<Value>) {
    let env = env_name(id, "CLIENT_ID");
    let sec_env = env_name(id, "CLIENT_SECRET");
    (
        StatusCode::OK,
        Json(json!({
            "status": "oauth_app_registration_required",
            "connector": id,
            "owned": true,
            "set_env": env,
            "message": format!("Owned OAuth needs a one-time Allternit OAuth app client id for '{}'. Set {} (and optionally {}). No third-party key. GitHub works today via local_cli (`gh`).", id, env, sec_env),
        })),
    )
}

fn scopes_of(m: &Value) -> Vec<String> {
    m.get("scopes")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default()
}

async fn persist_pending(
    db: &crate::db::DbHandle,
    user_id: &str,
    id: &str,
    auth_type: &str,
    metadata: String,
) -> Result<(), String> {
    let db = db.clone();
    let uid = user_id.to_string();
    let id_s = id.to_string();
    let at = auth_type.to_string();
    tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO connector_connections (id, connector_id, user_id, auth_type, status, metadata)
             VALUES (?1, ?2, ?3, ?4, 'pending', ?5)
             ON CONFLICT(connector_id, user_id) DO UPDATE SET
               status='pending', auth_type=excluded.auth_type, metadata=excluded.metadata,
               access_token=NULL, refresh_token=NULL, updated_at=CURRENT_TIMESTAMP",
            params![uuid::Uuid::new_v4().to_string(), id_s, uid, at, metadata],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("db task: {}", e))?
}

async fn connect_oauth2(
    state: &Arc<AppState>,
    user_id: &str,
    id: &str,
    c: &Value,
    m: &Value,
) -> (StatusCode, Json<Value>) {
    let (client_id, client_secret) = read_client(id, m);
    let client_id = match client_id {
        Some(v) => v,
        None => return oauth_registration_required(id),
    };
    let oa = m.get("oauth2").cloned().unwrap_or_else(|| json!({}));
    let authorize = oa.get("authorize_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let token_url = oa.get("token_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if authorize.is_empty() || token_url.is_empty() {
        // Client id is present, but Allternit has not mapped this provider's OAuth
        // endpoints yet. Honest status — never fabricate an authorize URL.
        return (
            StatusCode::OK,
            Json(json!({
                "status": "owned_oauth_endpoint_mapping_needed",
                "connector": id,
                "owned": true,
                "message": format!("Allternit client id is set for '{}', but its OAuth authorize/token endpoints are not mapped in connectors.meta.json yet. Add oauth2.authorize_url + token_url to finish; execution stays gated until then.", id),
            })),
        );
    }
    let redirect = redirect_uri();
    let oauth_state = uuid::Uuid::new_v4().to_string();
    let meta_json = json!({ "state": oauth_state, "token_url": token_url, "redirect_uri": redirect, "client_id": client_id, "client_secret": client_secret }).to_string();
    if let Err(e) = persist_pending(&state.db, user_id, id, "oauth2", meta_json).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e })));
    }
    let scopes = scopes_of(m);
    let mut url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&state={}",
        authorize,
        urlencoding(&client_id),
        urlencoding(&redirect),
        urlencoding(&oauth_state)
    );
    if !scopes.is_empty() {
        url.push_str(&format!("&scope={}", urlencoding(&scopes.join(" "))));
    }
    (
        StatusCode::OK,
        Json(json!({
            "status": "authorization_required",
            "auth_type": "oauth2",
            "owned": true,
            "connector": c.get("id"),
            "authorize_url": url,
            "redirect_uri": redirect,
            "state": oauth_state,
            "instructions": "Open authorize_url, approve Allternit; the provider redirects back to the Allternit loopback callback to finish. No third-party key.",
        })),
    )
}

#[derive(Deserialize)]
struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

async fn oauth_callback(State(state): State<Arc<AppState>>, Query(q): Query<CallbackQuery>) -> Html<String> {
    if let Some(err) = q.error.clone() {
        let desc = q.error_description.clone().unwrap_or(err);
        return Html(format!("<html><body><h2>Connector authorization failed</h2><p>{}</p></body></html>", desc));
    }
    let code = match q.code.clone() {
        Some(c) => c,
        None => return Html("<html><body>Missing code.</body></html>".to_string()),
    };
    let st = match q.state.clone() {
        Some(s) => s,
        None => return Html("<html><body>Missing state.</body></html>".to_string()),
    };

    let db = state.db.clone();
    let st2 = st.clone();
    let found = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT connector_id, user_id, COALESCE(metadata,'{}') FROM connector_connections WHERE status='pending' AND json_extract(metadata,'$.state')=?1",
        )?;
        let row = stmt
            .query_row(params![st2], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?, r.get::<_, String>(2)?))
            })
            .ok();
        Ok::<_, rusqlite::Error>(row)
    })
    .await;

    let (connector_id, _user_id, metadata_s) = match found {
        Ok(Ok(Some(r))) => r,
        _ => return Html("<html><body>Pending authorization not found or expired.</body></html>".to_string()),
    };
    let md: Value = serde_json::from_str(&metadata_s).unwrap_or_else(|_| json!({}));
    let token_url = md.get("token_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let redirect = md.get("redirect_uri").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let client_id = md.get("client_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let client_secret = md.get("client_secret").and_then(|v| v.as_str()).map(|s| s.to_string());

    let client = reqwest::Client::new();
    let mut form: Vec<(&str, String)> = vec![
        ("grant_type", "authorization_code".to_string()),
        ("code", code),
        ("redirect_uri", redirect),
        ("client_id", client_id.clone()),
    ];
    if let Some(ref sec) = client_secret {
        form.push(("client_secret", sec.clone()));
    }
    let resp = client.post(&token_url).form(&form).header("Accept", "application/json").send().await;
    match resp {
        Ok(r) if r.status().is_success() => {
            let tok: Value = r.json().await.unwrap_or_else(|_| json!({}));
            let access = tok.get("access_token").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let refresh = tok.get("refresh_token").and_then(|v| v.as_str()).map(|s| s.to_string());
            let expires_at = tok
                .get("expires_in")
                .and_then(|v| v.as_i64())
                .map(|s| (chrono::Utc::now() + chrono::Duration::seconds(s)).to_rfc3339());
            if access.is_empty() {
                return Html(format!("<html><body>Token response missing access_token: {}</body></html>", tok));
            }
            let db2 = state.db.clone();
            let cid = connector_id.clone();
            let sealed_access = crate::token_crypto::seal(&access);
            let refr = refresh.as_deref().map(crate::token_crypto::seal);
            let exp = expires_at.clone();
            let _ = tokio::task::spawn_blocking(move || {
                let conn = db2.connect()?;
                conn.execute(
                    "UPDATE connector_connections SET status='connected', access_token=?1, refresh_token=?2, expires_at=?3, metadata=NULL, updated_at=CURRENT_TIMESTAMP WHERE connector_id=?4 AND status='pending'",
                    params![sealed_access, refr, exp, cid],
                )?;
                Ok::<_, rusqlite::Error>(())
            })
            .await;
            Html("<html><body><h2>Connector connected</h2><p>You can close this window and return to Allternit.</p><script>window.close();</script></body></html>".to_string())
        }
        Ok(r) => {
            let body = r.text().await.unwrap_or_default();
            Html(format!("<html><body>Token exchange failed: {}</body></html>", body))
        }
        Err(e) => Html(format!("<html><body>Token request error: {}</body></html>", e)),
    }
}

async fn connect_device(
    state: &Arc<AppState>,
    user_id: &str,
    id: &str,
    c: &Value,
    m: &Value,
) -> (StatusCode, Json<Value>) {
    let (client_id, _) = read_client(id, m);
    let client_id = match client_id {
        Some(v) => v,
        None => return oauth_registration_required(id),
    };
    let device_url = m
        .get("device")
        .and_then(|d| d.get("device_url"))
        .and_then(|v| v.as_str())
        .or_else(|| if id == "github" { Some("https://github.com/login/device/code") } else { None })
        .unwrap_or("")
        .to_string();
    let token_url = m
        .get("device")
        .and_then(|d| d.get("token_url"))
        .and_then(|v| v.as_str())
        .or_else(|| if id == "github" { Some("https://github.com/login/oauth/access_token") } else { None })
        .unwrap_or("")
        .to_string();
    let scopes = scopes_of(m);
    let client = reqwest::Client::new();
    let mut form: Vec<(&str, String)> = vec![("client_id", client_id.clone())];
    if !scopes.is_empty() {
        form.push(("scope", scopes.join(" ")));
    }
    let resp = client
        .post(&device_url)
        .form(&form)
        .header("Accept", "application/json")
        .header("User-Agent", "Allternit-Connectors/1.0")
        .send()
        .await;
    match resp {
        Ok(r) if r.status().is_success() => {
            let d: Value = r.json().await.unwrap_or_else(|_| json!({}));
            let device_code = d.get("device_code").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let user_code = d.get("user_code").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let verification_uri = d.get("verification_uri").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let expires_in = d.get("expires_in").and_then(|v| v.as_i64()).unwrap_or(900);
            let interval = d.get("interval").and_then(|v| v.as_i64()).unwrap_or(5);
            if device_code.is_empty() {
                return (StatusCode::BAD_GATEWAY, Json(json!({ "error": "device_flow_no_code", "provider": d })));
            }
            let meta_json = json!({ "device_code": device_code, "token_url": token_url, "client_id": client_id, "interval": interval }).to_string();
            if let Err(e) = persist_pending(&state.db, user_id, id, "device_flow", meta_json).await {
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e })));
            }
            (
                StatusCode::OK,
                Json(json!({
                    "status": "device_authorization_required",
                    "auth_type": "device_flow",
                    "owned": true,
                    "connector": c.get("id"),
                    "user_code": user_code,
                    "verification_uri": verification_uri,
                    "expires_in": expires_in,
                    "interval": interval,
                    "instructions": "Enter user_code at verification_uri to approve Allternit, then call POST /api/v1/connectors/:id/poll to complete. No third-party key.",
                })),
            )
        }
        Ok(r) => {
            let status = r.status().as_u16();
            let body: Value = r.json().await.unwrap_or_else(|_| json!({}));
            (
                StatusCode::OK,
                Json(json!({
                    "status": "device_provider_reached",
                    "auth_type": "device_flow",
                    "owned": true,
                    "connector": c.get("id"),
                    "provider_status": status,
                    "provider": body,
                    "message": "Owned device flow reached the provider endpoint; it rejected the (unregistered/test) client id, which proves the wiring is live. Register the Allternit OAuth app and set its client id to complete.",
                })),
            )
        }
        Err(e) => (StatusCode::BAD_GATEWAY, Json(json!({ "error": "device_request_failed", "message": e.to_string() }))),
    }
}

async fn poll_device(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let user_id = caller(&headers);
    let db = state.db.clone();
    let id_s = id.clone();
    let uid = user_id.clone();
    let found = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let v = conn
            .query_row(
                "SELECT COALESCE(metadata,'{}') FROM connector_connections WHERE connector_id=?1 AND user_id=?2 AND status='pending'",
                params![id_s, uid],
                |r| r.get::<_, String>(0),
            )
            .ok();
        Ok::<_, rusqlite::Error>(v)
    })
    .await;

    let metadata_s = match found {
        Ok(Ok(Some(s))) => s,
        _ => return (StatusCode::CONFLICT, Json(json!({ "error": "no_pending_device_flow", "id": id }))),
    };
    let md: Value = serde_json::from_str(&metadata_s).unwrap_or_else(|_| json!({}));
    let device_code = md.get("device_code").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let token_url = md.get("token_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let client_id = md.get("client_id").and_then(|v| v.as_str()).unwrap_or("").to_string();

    let client = reqwest::Client::new();
    let form: Vec<(&str, String)> = vec![
        ("client_id", client_id),
        ("device_code", device_code),
        ("grant_type", "urn:ietf:params:oauth:grant-type:device_code".to_string()),
    ];
    let resp = client
        .post(&token_url)
        .form(&form)
        .header("Accept", "application/json")
        .header("User-Agent", "Allternit-Connectors/1.0")
        .send()
        .await;
    match resp {
        Ok(r) => {
            let d: Value = r.json().await.unwrap_or_else(|_| json!({}));
            if let Some(err) = d.get("error").and_then(|v| v.as_str()) {
                let status = if err == "authorization_pending" || err == "slow_down" { "pending" } else { "error" };
                return (StatusCode::OK, Json(json!({ "status": status, "provider_error": err, "id": id })));
            }
            let access = d.get("access_token").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if access.is_empty() {
                return (StatusCode::BAD_GATEWAY, Json(json!({ "error": "no_access_token", "provider": d })));
            }
            let db2 = state.db.clone();
            let cid = id.clone();
            let acc = crate::token_crypto::seal(&access);
            let _ = tokio::task::spawn_blocking(move || {
                let conn = db2.connect()?;
                conn.execute(
                    "UPDATE connector_connections SET status='connected', access_token=?1, metadata=NULL, updated_at=CURRENT_TIMESTAMP WHERE connector_id=?2 AND status='pending'",
                    params![acc, cid],
                )?;
                Ok::<_, rusqlite::Error>(())
            })
            .await;
            (StatusCode::OK, Json(json!({ "status": "connected", "connector": id, "auth_type": "device_flow", "owned": true })))
        }
        Err(e) => (StatusCode::BAD_GATEWAY, Json(json!({ "error": "device_poll_failed", "message": e.to_string() }))),
    }
}

fn urlencoding(s: &str) -> String {
    // Minimal percent-encoding for query parameters (no extra crate).
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}
