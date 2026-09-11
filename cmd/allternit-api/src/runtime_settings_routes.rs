//! Runtime Settings + Driver API routes
//!
//! Backs `surfaces/ai.allternit.com/src/hooks/useRuntimeSettings.ts`.
//! Settings persist per user in the `runtime_settings` table (V142); missing
//! sections fall back to server defaults. Driver reports are honest probes:
//! availability comes from the drivers actually registered on `AppState` and,
//! for the process driver, a real reachability check against the gizzi
//! runtime. Nothing here fabricates a healthy status.

use axum::{
    extract::{Extension, Json, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use rusqlite::params;
use serde_json::{json, Map, Value};
use std::sync::Arc;
use tracing::warn;

use crate::auth::AuthUser;
use crate::AppState;

const DRIVER_TYPES: &[&str] = &["process", "container", "microvm", "wasm"];
const ISOLATION_LEVELS: &[&str] = &["limited", "standard", "hardened", "maximum"];
const CAPTURE_LEVELS: &[&str] = &["none", "minimal", "full"];
const SETTING_KEYS: &[&str] = &["driver", "resources", "replay", "prewarm", "versioning"];

pub fn runtime_settings_router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/runtime/settings",
            get(get_settings).put(update_settings),
        )
        .route("/runtime/settings/reset", post(reset_settings))
        .route("/runtime/drivers", get(list_drivers))
        .route("/runtime/drivers/:type/status", get(driver_status))
        .route("/runtime/drivers/:type/activate", post(activate_driver))
}

// ─── Settings document ────────────────────────────────────────────────────────

fn default_settings() -> Value {
    json!({
        "driver": {
            "driver_type": "process",
            "isolation_level": "limited",
            "enabled": true,
        },
        "resources": {
            "cpu_millicores": 1000,
            "memory_mib": 2048,
            "budget_credits_per_hour": null,
        },
        "replay": {
            "capture_level": "minimal",
            "deterministic_mode": true,
            "snapshot_interval_seconds": 60,
        },
        "prewarm": {
            "enabled": true,
            "pool_size": 2,
            "warmup_commands": [],
        },
        "versioning": {
            "auto_commit": false,
            "commit_message_template": "[allternit] {description}",
            "branch_prefix": "allternit-session-",
        },
    })
}

/// Deep-merge `patch` onto `base` (objects merge recursively, everything else
/// replaces). Only `SETTING_KEYS` top-level sections survive.
fn merge_settings(base: &Value, patch: &Value) -> Value {
    let mut out = base.clone();
    let Some(out_map) = out.as_object_mut() else {
        return patch.clone();
    };
    if let Some(patch_map) = patch.as_object() {
        for (key, value) in patch_map {
            if !SETTING_KEYS.contains(&key.as_str()) {
                continue;
            }
            let merged = match (out_map.get(key), value) {
                (Some(Value::Object(existing)), Value::Object(incoming)) => {
                    let mut m = existing.clone();
                    for (k, v) in incoming {
                        m.insert(k.clone(), v.clone());
                    }
                    Value::Object(m)
                }
                _ => value.clone(),
            };
            out_map.insert(key.clone(), merged);
        }
    }
    out
}

/// Validate one settings section. Returns Err(message) naming the bad field.
fn validate_section(key: &str, section: &Value) -> Result<(), String> {
    let obj = section
        .as_object()
        .ok_or_else(|| format!("{key} must be an object"))?;
    let str_field = |name: &str| -> Option<String> {
        obj.get(name).and_then(|v| v.as_str()).map(String::from)
    };
    match key {
        "driver" => {
            if let Some(t) = str_field("driver_type") {
                if !DRIVER_TYPES.contains(&t.as_str()) {
                    return Err(format!(
                        "driver.driver_type must be one of: {}",
                        DRIVER_TYPES.join(", ")
                    ));
                }
            }
            if let Some(l) = str_field("isolation_level") {
                if !ISOLATION_LEVELS.contains(&l.as_str()) {
                    return Err(format!(
                        "driver.isolation_level must be one of: {}",
                        ISOLATION_LEVELS.join(", ")
                    ));
                }
            }
        }
        "resources" => {
            for name in ["cpu_millicores", "memory_mib"] {
                if let Some(v) = obj.get(name) {
                    let n = v
                        .as_u64()
                        .ok_or_else(|| format!("resources.{name} must be a positive integer"))?;
                    if n == 0 {
                        return Err(format!("resources.{name} must be at least 1"));
                    }
                }
            }
            if let Some(v) = obj.get("budget_credits_per_hour") {
                if !v.is_null() && v.as_f64().is_none() {
                    return Err("resources.budget_credits_per_hour must be a number or null".to_string());
                }
            }
        }
        "replay" => {
            if let Some(l) = str_field("capture_level") {
                if !CAPTURE_LEVELS.contains(&l.as_str()) {
                    return Err(format!(
                        "replay.capture_level must be one of: {}",
                        CAPTURE_LEVELS.join(", ")
                    ));
                }
            }
            if let Some(v) = obj.get("snapshot_interval_seconds") {
                let n = v
                    .as_u64()
                    .ok_or_else(|| "replay.snapshot_interval_seconds must be a positive integer".to_string())?;
                if n < 10 {
                    return Err("replay.snapshot_interval_seconds must be at least 10".to_string());
                }
            }
        }
        "prewarm" => {
            if let Some(v) = obj.get("pool_size") {
                let n = v
                    .as_u64()
                    .ok_or_else(|| "prewarm.pool_size must be a positive integer".to_string())?;
                if !(1..=64).contains(&n) {
                    return Err("prewarm.pool_size must be between 1 and 64".to_string());
                }
            }
            if let Some(v) = obj.get("warmup_commands") {
                let arr = v
                    .as_array()
                    .ok_or_else(|| "prewarm.warmup_commands must be an array of strings".to_string())?;
                if arr.iter().any(|c| !c.is_string()) {
                    return Err("prewarm.warmup_commands must be an array of strings".to_string());
                }
            }
        }
        "versioning" => {
            for name in ["commit_message_template", "branch_prefix"] {
                if let Some(v) = obj.get(name) {
                    if !v.is_string() {
                        return Err(format!("versioning.{name} must be a string"));
                    }
                }
            }
        }
        _ => {}
    }
    Ok(())
}

fn load_settings(conn: &rusqlite::Connection, user_id: &str) -> rusqlite::Result<Value> {
    let mut stmt = conn.prepare(
        "SELECT key, value FROM runtime_settings WHERE user_id = ?1 AND key IN ('driver', 'resources', 'replay', 'prewarm', 'versioning')",
    )?;
    let rows = stmt.query_map(params![user_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    let mut stored = Map::new();
    for row in rows {
        let (key, value) = row?;
        if let Ok(parsed) = serde_json::from_str::<Value>(&value) {
            stored.insert(key, parsed);
        }
    }
    Ok(merge_settings(&default_settings(), &Value::Object(stored)))
}

fn store_settings(
    conn: &rusqlite::Connection,
    user_id: &str,
    settings: &Value,
) -> rusqlite::Result<()> {
    let Some(map) = settings.as_object() else {
        return Ok(());
    };
    for key in SETTING_KEYS {
        if let Some(section) = map.get(*key) {
            conn.execute(
                "INSERT INTO runtime_settings (user_id, key, value, updated_at)
                 VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
                 ON CONFLICT(user_id, key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = CURRENT_TIMESTAMP",
                params![user_id, key, section.to_string()],
            )?;
        }
    }
    Ok(())
}

// ─── Settings handlers ────────────────────────────────────────────────────────

async fn get_settings(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    match tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        load_settings(&conn, &user_id)
    })
    .await
    {
        Ok(Ok(settings)) => Json(settings).into_response(),
        Ok(Err(e)) => db_error("loading runtime settings", e),
        Err(e) => panic_error(e),
    }
}

async fn update_settings(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(patch): Json<Value>,
) -> impl IntoResponse {
    if let Some(obj) = patch.as_object() {
        for key in obj.keys() {
            if !SETTING_KEYS.contains(&key.as_str()) {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": format!("unknown settings section '{key}'")})),
                )
                    .into_response();
            }
        }
        for key in SETTING_KEYS {
            if let Some(section) = obj.get(*key) {
                if let Err(msg) = validate_section(key, section) {
                    return (StatusCode::BAD_REQUEST, Json(json!({"error": msg})))
                        .into_response();
                }
            }
        }
    }

    let db = state.db.clone();
    let user_id = user.user_id;
    match tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let current = load_settings(&conn, &user_id)?;
        let merged = merge_settings(&current, &patch);
        store_settings(&conn, &user_id, &merged)?;
        Ok(merged)
    })
    .await
    {
        Ok(Ok(settings)) => Json(settings).into_response(),
        Ok(Err(e)) => db_error("updating runtime settings", e),
        Err(e) => panic_error(e),
    }
}

async fn reset_settings(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    match tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM runtime_settings WHERE user_id = ?1",
            params![user_id],
        )?;
        Ok::<_, rusqlite::Error>(default_settings())
    })
    .await
    {
        Ok(Ok(settings)) => Json(settings).into_response(),
        Ok(Err(e)) => db_error("resetting runtime settings", e),
        Err(e) => panic_error(e),
    }
}

// ─── Driver registry ──────────────────────────────────────────────────────────

fn driver_available(state: &AppState, driver_type: &str) -> bool {
    match driver_type {
        // The process driver is always selectable: the gateway itself spawns
        // OS processes, and reachability of the gizzi runtime is reported
        // separately in the status probe.
        "process" => true,
        "container" => state.incus_driver.is_some(),
        "microvm" => state.vm_driver.is_some(),
        _ => false,
    }
}

fn driver_unavailable_reason(_state: &AppState, driver_type: &str) -> String {
    match driver_type {
        "container" => "no container (Incus) driver registered on this gateway".to_string(),
        "microvm" => "no MicroVM driver registered on this gateway".to_string(),
        other => format!("no '{other}' runtime available on this gateway"),
    }
}

fn driver_info(state: &AppState, driver_type: &str) -> Value {
    let (name, description, isolation, recommended) = match driver_type {
        "process" => (
            "Process Driver",
            "OS process execution via the local gizzi runtime",
            "limited",
            false,
        ),
        "container" => (
            "Container Driver",
            "Incus/LXD container execution",
            "standard",
            false,
        ),
        "microvm" => (
            "MicroVM Driver",
            "MicroVM execution (cloud-hypervisor / tart)",
            "maximum",
            true,
        ),
        _ => (
            "Wasm Driver",
            "Wasm sandbox execution (no wasm runtime configured)",
            "maximum",
            false,
        ),
    };
    json!({
        "driver_type": driver_type,
        "name": name,
        "description": description,
        "isolation": isolation,
        "available": driver_available(state, driver_type),
        "recommended": recommended,
        "max_resources": {
            "cpu_millicores": 8000,
            "memory_mib": 32768,
            "budget_credits_per_hour": null,
        },
    })
}

/// Live probe of the gizzi runtime used by the process driver. Any HTTP
/// response counts as reachable — the runtime is up even if its /health path
/// moves; only a transport error means down.
async fn probe_process_runtime(state: &AppState) -> Result<(), String> {
    let url = state.config.terminal_server_url();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;
    client
        .get(format!("{}/health", url.trim_end_matches('/')))
        .send()
        .await
        .map(|_| ())
        .map_err(|e| format!("gizzi runtime not reachable at {url}: {e}"))
}

async fn list_drivers(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!(DRIVER_TYPES
        .iter()
        .map(|t| driver_info(&state, t))
        .collect::<Vec<_>>()))
    .into_response()
}

async fn driver_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(driver_type): Path<String>,
) -> impl IntoResponse {
    if !DRIVER_TYPES.contains(&driver_type.as_str()) {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error": format!("unknown driver type '{driver_type}'")})),
        )
            .into_response();
    }

    let db = state.db.clone();
    let user_id = user.user_id.clone();
    let settings = match tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        load_settings(&conn, &user_id)
    })
    .await
    {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => return db_error("loading runtime settings", e),
        Err(e) => return panic_error(e),
    };

    let active_driver = settings["driver"]["driver_type"]
        .as_str()
        .unwrap_or("process")
        .to_string();
    let is_active = active_driver == driver_type;
    let pool_size = if is_active && settings["prewarm"]["enabled"].as_bool().unwrap_or(false) {
        settings["prewarm"]["pool_size"].as_i64().unwrap_or(0)
    } else {
        0
    };
    let (status, healthy, message) = match driver_type.as_str() {
        "process" => match probe_process_runtime(&state).await {
            Ok(()) => ("healthy".to_string(), true, None),
            Err(msg) => ("unavailable".to_string(), false, Some(msg)),
        },
        t if driver_available(&state, t) => ("healthy".to_string(), true, None),
        t => (
            "unavailable".to_string(),
            false,
            Some(driver_unavailable_reason(&state, t)),
        ),
    };

    // Active sessions on this user's agents are the honest instance count for
    // the process driver; VM/container instance tracking lives outside this
    // gateway's tables.
    let active_instances = if driver_type == "process" {
        let db = state.db.clone();
        let user_id = user.user_id;
        match tokio::task::spawn_blocking(move || {
            let conn = db.connect()?;
            conn.query_row(
                "SELECT COUNT(*) FROM beta_sessions WHERE user_id = ?1 AND status = 'active'",
                params![user_id],
                |row| row.get::<_, i64>(0),
            )
        })
        .await
        {
            Ok(Ok(n)) => n,
            Ok(Err(e)) => {
                warn!("DB error counting active sessions: {e}");
                0
            }
            Err(e) => {
                warn!("DB task panicked: {e}");
                0
            }
        }
    } else {
        0
    };

    Json(json!({
        "driver_type": driver_type,
        "status": status,
        "active_instances": active_instances,
        "pool_size": pool_size,
        "healthy": healthy,
        "message": message,
    }))
    .into_response()
}

async fn activate_driver(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(driver_type): Path<String>,
) -> impl IntoResponse {
    if !DRIVER_TYPES.contains(&driver_type.as_str()) {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error": format!("unknown driver type '{driver_type}'")})),
        )
            .into_response();
    }
    if !driver_available(&state, &driver_type) {
        // No server-side spawn path exists for this driver — say so instead
        // of pretending activation happened.
        return (
            StatusCode::CONFLICT,
            Json(json!({
                "error": format!(
                    "driver '{driver_type}' cannot be activated: {}",
                    driver_unavailable_reason(&state, &driver_type)
                ),
            })),
        )
            .into_response();
    }

    let isolation = driver_info(&state, &driver_type)["isolation"]
        .as_str()
        .unwrap_or("limited")
        .to_string();
    let patch = json!({
        "driver": {
            "driver_type": driver_type,
            "isolation_level": isolation,
            "enabled": true,
        }
    });

    let db = state.db.clone();
    let user_id = user.user_id;
    match tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let current = load_settings(&conn, &user_id)?;
        let merged = merge_settings(&current, &patch);
        store_settings(&conn, &user_id, &merged)?;
        Ok(merged)
    })
    .await
    {
        Ok(Ok(_)) => Json(json!({
            "status": "activated",
            "driver": driver_type,
            "isolation": isolation,
        }))
        .into_response(),
        Ok(Err(e)) => db_error("activating driver", e),
        Err(e) => panic_error(e),
    }
}

// ─── Shared error shapes (match neighboring v1 routes) ───────────────────────

fn db_error(context: &str, e: rusqlite::Error) -> axum::response::Response {
    warn!("DB error {context}: {e}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": e.to_string()})),
    )
        .into_response()
}

fn panic_error(e: tokio::task::JoinError) -> axum::response::Response {
    warn!("DB task panicked: {e}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": "internal error"})),
    )
        .into_response()
}


#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    use crate::beta_session_routes::tests as beta_test;

    fn request(
        path: &str,
        method: &str,
        body: Option<&serde_json::Value>,
        user: &str,
    ) -> Request<Body> {
        let builder = Request::builder()
            .method(method)
            .uri(path)
            .extension(beta_test::test_user(user));
        match body {
            Some(v) => builder
                .header("content-type", "application/json")
                .body(Body::from(v.to_string())),
            None => builder.body(Body::empty()),
        }
        .unwrap()
    }

    async fn call(
        router: &Router,
        path: &str,
        method: &str,
        body: Option<&serde_json::Value>,
        user: &str,
    ) -> (StatusCode, serde_json::Value) {
        let response = router
            .clone()
            .oneshot(request(path, method, body, user))
            .await
            .unwrap();
        let status = response.status();
        let payload: serde_json::Value = serde_json::from_slice(
            &response.into_body().collect().await.unwrap().to_bytes(),
        )
        .unwrap_or_else(|_| json!({}));
        (status, payload)
    }

    #[tokio::test]
    async fn settings_roundtrip_defaults_patch_reset() {
        let temp = beta_test::temp_dir("rt-settings");
        let state = beta_test::test_app_state(&temp).await;
        let router = runtime_settings_router().with_state(state);

        // Defaults with no stored rows.
        let (status, payload) = call(&router, "/runtime/settings", "GET", None, "user-a").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(payload["driver"]["driver_type"], "process");
        assert_eq!(payload["prewarm"]["pool_size"], 2);

        // PATCH a section.
        let patch = json!({
            "resources": { "cpu_millicores": 4000, "memory_mib": 8192 },
            "prewarm": { "pool_size": 4, "warmup_commands": ["echo hi"] },
        });
        let (status, payload) =
            call(&router, "/runtime/settings", "PUT", Some(&patch), "user-a").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(payload["resources"]["cpu_millicores"], 4000);
        assert_eq!(payload["resources"]["budget_credits_per_hour"], serde_json::Value::Null);
        assert_eq!(payload["prewarm"]["pool_size"], 4);
        // Untouched sections stay at defaults.
        assert_eq!(payload["driver"]["driver_type"], "process");

        // Persistence across requests.
        let (status, payload) = call(&router, "/runtime/settings", "GET", None, "user-a").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(payload["resources"]["memory_mib"], 8192);

        // Other users are isolated.
        let (_, payload) = call(&router, "/runtime/settings", "GET", None, "user-b").await;
        assert_eq!(payload["resources"]["cpu_millicores"], 1000);

        // Reset restores defaults.
        let (status, payload) =
            call(&router, "/runtime/settings/reset", "POST", None, "user-a").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(payload["resources"]["cpu_millicores"], 1000);
        assert_eq!(payload["prewarm"]["pool_size"], 2);
    }

    #[tokio::test]
    async fn settings_patch_validates_sections() {
        let temp = beta_test::temp_dir("rt-validate");
        let state = beta_test::test_app_state(&temp).await;
        let router = runtime_settings_router().with_state(state);

        let bad = json!({ "driver": { "driver_type": "quantum" } });
        let (status, payload) =
            call(&router, "/runtime/settings", "PUT", Some(&bad), "user-a").await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert!(payload["error"].as_str().unwrap().contains("driver_type"));

        let bad = json!({ "nonsense": {} });
        let (status, _) = call(&router, "/runtime/settings", "PUT", Some(&bad), "user-a").await;
        assert_eq!(status, StatusCode::BAD_REQUEST);

        let bad = json!({ "prewarm": { "pool_size": 0 } });
        let (status, _) = call(&router, "/runtime/settings", "PUT", Some(&bad), "user-a").await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn drivers_list_is_honest_about_availability() {
        let temp = beta_test::temp_dir("rt-drivers");
        let state = beta_test::test_app_state(&temp).await;
        let router = runtime_settings_router().with_state(state);

        let (status, payload) = call(&router, "/runtime/drivers", "GET", None, "user-a").await;
        assert_eq!(status, StatusCode::OK);
        let drivers = payload.as_array().unwrap();
        assert_eq!(drivers.len(), 4);

        let find = |t: &str| drivers.iter().find(|d| d["driver_type"] == t).unwrap();
        // Test state registers no VM/Incus drivers — say so.
        assert_eq!(find("process")["available"], true);
        assert_eq!(find("container")["available"], false);
        assert_eq!(find("microvm")["available"], false);
        assert_eq!(find("wasm")["available"], false);
        assert_eq!(find("microvm")["isolation"], "maximum");
    }

    #[tokio::test]
    async fn driver_status_probes_honestly() {
        let temp = beta_test::temp_dir("rt-status");
        let state = beta_test::test_app_state(&temp).await;
        let router = runtime_settings_router().with_state(state);

        // Point the process-driver probe at a port that is guaranteed closed
        // (grab an ephemeral port, then drop the listener). The dev machine
        // often has a real gizzi runtime on :4096, which would make this
        // assertion environment-dependent.
        let port = {
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let port = listener.local_addr().unwrap().port();
            drop(listener);
            port
        };
        // SAFETY-equivalent concern: env mutation is process-global. This var
        // is only read by `AppConfig::terminal_server_url`, and no other test
        // depends on its value.
        std::env::set_var("TERMINAL_SERVER_URL", format!("http://127.0.0.1:{port}"));

        // No gizzi runtime is running in tests: the process driver must report
        // unavailable with a real reason, not a fabricated healthy status.
        let (status, payload) =
            call(&router, "/runtime/drivers/process/status", "GET", None, "user-a").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(payload["driver_type"], "process");
        assert_eq!(payload["healthy"], false);
        assert!(payload["message"].as_str().unwrap().contains("not reachable"));

        let (_, payload) =
            call(&router, "/runtime/drivers/microvm/status", "GET", None, "user-a").await;
        assert_eq!(payload["healthy"], false);
        assert!(payload["message"].as_str().unwrap().contains("MicroVM"));

        let (status, _) =
            call(&router, "/runtime/drivers/nope/status", "GET", None, "user-a").await;
        assert_eq!(status, StatusCode::NOT_FOUND);

        std::env::remove_var("TERMINAL_SERVER_URL");
    }

    #[tokio::test]
    async fn activate_selects_available_driver_and_rejects_missing_ones() {
        let temp = beta_test::temp_dir("rt-activate");
        let state = beta_test::test_app_state(&temp).await;
        let router = runtime_settings_router().with_state(state);

        // Activation of an unavailable driver is a clear 409, not a fake 200.
        let (status, payload) =
            call(&router, "/runtime/drivers/microvm/activate", "POST", None, "user-a").await;
        assert_eq!(status, StatusCode::CONFLICT);
        assert!(payload["error"].as_str().unwrap().contains("microvm"));

        // The process driver activation is the real settings transition.
        let (status, payload) =
            call(&router, "/runtime/drivers/process/activate", "POST", None, "user-a").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(payload["status"], "activated");
        assert_eq!(payload["driver"], "process");
        assert_eq!(payload["isolation"], "limited");

        let (_, settings) = call(&router, "/runtime/settings", "GET", None, "user-a").await;
        assert_eq!(settings["driver"]["driver_type"], "process");
        assert_eq!(settings["driver"]["enabled"], true);

        let (status, _) =
            call(&router, "/runtime/drivers/wasm/activate", "POST", None, "user-a").await;
        assert_eq!(status, StatusCode::CONFLICT);
    }
}
