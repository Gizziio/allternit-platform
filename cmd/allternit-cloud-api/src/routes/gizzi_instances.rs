//! Self-registered gizzi instances (`gizzi serve --tunnel`).
//!
//! A user runs gizzi on their own machine behind an ephemeral public URL
//! (e.g. https://*.trycloudflare.com) and registers it here with their Clerk
//! session — or a paired runtime registers itself with its device credential —
//! so first-party apps can discover it. Unlike `runtime_devices`,
//! these records carry no credentials or relay lifecycle — they are a
//! lightweight, self-service presence registry keyed by (user_id, name).

use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{delete, get, put},
    Json, Router,
};
use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;
use sqlx::{FromRow, SqlitePool};
use std::sync::Arc;
use uuid::Uuid;

use crate::{auth::clerk, routes::runtime_pairing, ApiError, ApiState};

/// An instance is reported as "online" while it has refreshed its
/// registration within this window; older records are "stale".
const ONLINE_WINDOW_MINUTES: i64 = 10;

/// Stale registrations are garbage-collected once their `updated_at` is
/// older than this; the registry is presence-only, so nothing references
/// the deleted rows.
const STALE_RETENTION_DAYS: i64 = 30;

/// How often the background GC sweep runs.
const GC_INTERVAL: std::time::Duration = std::time::Duration::from_secs(60 * 60);

const DEFAULT_INSTANCE_NAME: &str = "default";

#[derive(Debug, Deserialize)]
pub struct UpsertInstanceRequest {
    url: String,
    name: Option<String>,
}

#[derive(Debug, FromRow)]
struct GizziInstanceView {
    id: String,
    name: String,
    url: String,
    updated_at: DateTime<Utc>,
}

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/api/v1/gizzi-instances", get(list_instances))
        .route("/api/v1/gizzi-instances/self", put(upsert_self_instance))
        .route("/api/v1/gizzi-instances/:id", delete(delete_instance))
}

fn derive_status(updated_at: DateTime<Utc>, now: DateTime<Utc>) -> &'static str {
    if updated_at >= now - Duration::minutes(ONLINE_WINDOW_MINUTES) {
        "online"
    } else {
        "stale"
    }
}

fn instance_json(instance: &GizziInstanceView) -> serde_json::Value {
    serde_json::json!({
        "id": instance.id,
        "name": instance.name,
        "url": instance.url,
        "status": derive_status(instance.updated_at, Utc::now()),
        "updated_at": instance.updated_at,
    })
}

fn validate_instance_url(url: &str) -> Result<String, ApiError> {
    let trimmed = url.trim();
    let valid = (trimmed.starts_with("https://") || trimmed.starts_with("http://"))
        && trimmed.len() > "https://".len()
        && !trimmed.chars().any(char::is_whitespace);
    if !valid {
        return Err(ApiError::BadRequest(
            "url must be an http(s) URL".to_string(),
        ));
    }
    Ok(trimmed.to_string())
}

async fn upsert_instance(
    db: &SqlitePool,
    user_id: &str,
    name: &str,
    url: &str,
) -> Result<GizziInstanceView, ApiError> {
    let id = format!("gi_{}", Uuid::new_v4().simple());
    sqlx::query(
        r#"
        INSERT INTO gizzi_instances (id, user_id, name, url)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, name)
        DO UPDATE SET url = excluded.url, updated_at = CURRENT_TIMESTAMP
        "#,
    )
    .bind(&id)
    .bind(user_id)
    .bind(name)
    .bind(url)
    .execute(db)
    .await?;
    // The explicit updated_at keeps conflict refreshes observable; the table
    // trigger covers any other UPDATE path. Re-read so the response carries
    // the stored id and timestamps either way.
    let instance = sqlx::query_as::<_, GizziInstanceView>(
        "SELECT id, name, url, updated_at FROM gizzi_instances WHERE user_id = ? AND name = ?",
    )
    .bind(user_id)
    .bind(name)
    .fetch_one(db)
    .await?;
    Ok(instance)
}

/// Resolves who is registering: a paired runtime device token registers
/// under the device's owner and defaults the instance name to the device
/// name; anything else falls back to the Clerk session path.
async fn actor_from_headers(
    db: &SqlitePool,
    headers: &HeaderMap,
) -> Result<(String, String), ApiError> {
    if let Some(token) = runtime_pairing::device_token_from_headers(headers) {
        let device = runtime_pairing::runtime_device_for_token(db, token, None).await?;
        // The registry PUT doubles as a lightweight heartbeat.
        sqlx::query(
            "UPDATE runtime_devices SET status = 'online', last_seen_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(&device.id)
        .execute(db)
        .await?;
        return Ok((device.user_id, device.name));
    }
    let user = clerk::user_from_headers(headers).await?;
    Ok((user.id, DEFAULT_INSTANCE_NAME.to_string()))
}

async fn upsert_self_instance(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Json(body): Json<UpsertInstanceRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let url = validate_instance_url(&body.url)?;
    let (user_id, default_name) = actor_from_headers(&state.db, &headers).await?;
    let name = body
        .name
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .unwrap_or(&default_name);
    let instance = upsert_instance(&state.db, &user_id, name, &url).await?;
    Ok(Json(instance_json(&instance)))
}

async fn list_instances(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;
    let instances = sqlx::query_as::<_, GizziInstanceView>(
        r#"
        SELECT id, name, url, updated_at
        FROM gizzi_instances
        WHERE user_id = ?
        ORDER BY updated_at DESC
        "#,
    )
    .bind(&user.id)
    .fetch_all(&state.db)
    .await?;
    let instances = instances.iter().map(instance_json).collect::<Vec<_>>();
    Ok(Json(serde_json::json!({ "instances": instances })))
}

/// Deletes instance rows whose `updated_at` is older than
/// [`STALE_RETENTION_DAYS`]. Returns the number of rows removed.
pub async fn collect_stale_instances(db: &SqlitePool) -> Result<u64, ApiError> {
    let deleted = sqlx::query(
        "DELETE FROM gizzi_instances WHERE updated_at < datetime('now', ?)",
    )
    .bind(format!("-{STALE_RETENTION_DAYS} days"))
    .execute(db)
    .await?
    .rows_affected();
    Ok(deleted)
}

/// Background GC for stale gizzi instances. Runs a sweep immediately at
/// startup (the first interval tick fires without delay), then hourly.
pub fn start_gizzi_instance_gc_task(db: SqlitePool) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(GC_INTERVAL);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        tracing::info!(
            retention_days = STALE_RETENTION_DAYS,
            "Gizzi instance GC task started"
        );
        loop {
            interval.tick().await;
            match collect_stale_instances(&db).await {
                Ok(deleted) => tracing::info!(deleted, "Gizzi instance GC sweep complete"),
                Err(error) => tracing::error!("Gizzi instance GC sweep failed: {}", error),
            }
        }
    });
}

async fn delete_instance(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;
    let affected = sqlx::query("DELETE FROM gizzi_instances WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&user.id)
        .execute(&state.db)
        .await?
        .rows_affected();
    if affected == 0 {
        return Err(ApiError::NotFound("Gizzi instance not found".to_string()));
    }
    Ok(Json(serde_json::json!({ "id": id, "status": "deleted" })))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Table DDL only — the trigger is left out so tests can backdate
    /// updated_at to exercise stale derivation.
    async fn test_pool() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        sqlx::query(
            r#"
            CREATE TABLE gizzi_instances (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, name)
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        // Minimal runtime_devices shape for the device-token auth path.
        sqlx::query(
            r#"
            CREATE TABLE runtime_devices (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                credential_hash TEXT NOT NULL UNIQUE,
                credential_expires_at TIMESTAMP NOT NULL,
                status TEXT NOT NULL DEFAULT 'offline',
                last_seen_at TIMESTAMP,
                revoked_at TIMESTAMP
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    fn bearer_headers(token: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::AUTHORIZATION,
            format!("Bearer {token}").parse().unwrap(),
        );
        headers
    }

    async fn insert_device(pool: &SqlitePool, token: &str, status: &str, revoked: bool) {
        sqlx::query(
            r#"
            INSERT INTO runtime_devices (
                id, user_id, name, credential_hash, credential_expires_at, status, revoked_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind("rd_1")
        .bind("user_9")
        .bind("joes-macbook")
        .bind(runtime_pairing::sha256_hex(token.as_bytes()))
        .bind(Utc::now() + Duration::days(1))
        .bind(status)
        .bind(if revoked { Some(Utc::now()) } else { None })
        .execute(pool)
        .await
        .unwrap();
    }

    #[test]
    fn validate_instance_url_accepts_http_and_https() {
        assert!(validate_instance_url("https://xyz.trycloudflare.com").is_ok());
        assert!(validate_instance_url("http://localhost:8080").is_ok());
    }

    #[test]
    fn validate_instance_url_rejects_non_http() {
        for url in ["", "ftp://host", "xyz.trycloudflare.com", "https://", "https://a b"] {
            assert!(validate_instance_url(url).is_err(), "should reject {url:?}");
        }
    }

    #[test]
    fn derive_status_marks_recent_online_and_old_stale() {
        let now = Utc::now();
        assert_eq!(derive_status(now, now), "online");
        assert_eq!(
            derive_status(now - Duration::minutes(ONLINE_WINDOW_MINUTES - 1), now),
            "online"
        );
        assert_eq!(
            derive_status(now - Duration::minutes(ONLINE_WINDOW_MINUTES + 1), now),
            "stale"
        );
    }

    #[tokio::test]
    async fn upsert_inserts_then_refreshes_url_and_timestamp() {
        let pool = test_pool().await;

        let first = upsert_instance(&pool, "user_1", "my-macbook", "https://a.trycloudflare.com")
            .await
            .unwrap();
        assert_eq!(first.name, "my-macbook");
        assert_eq!(first.url, "https://a.trycloudflare.com");

        // Backdate so a refresh must move updated_at forward.
        sqlx::query("UPDATE gizzi_instances SET updated_at = datetime('now', '-1 hour')")
            .execute(&pool)
            .await
            .unwrap();

        let second = upsert_instance(&pool, "user_1", "my-macbook", "https://b.trycloudflare.com")
            .await
            .unwrap();
        assert_eq!(second.id, first.id, "upsert keeps the same row");
        assert_eq!(second.url, "https://b.trycloudflare.com");
        assert!(
            second.updated_at > Utc::now() - Duration::minutes(1),
            "upsert refreshes updated_at"
        );

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM gizzi_instances")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 1, "repeated PUTs must not duplicate the row");
    }

    #[tokio::test]
    async fn list_is_per_user_with_derived_status() {
        let pool = test_pool().await;
        upsert_instance(&pool, "user_1", "default", "https://a.trycloudflare.com")
            .await
            .unwrap();
        upsert_instance(&pool, "user_1", "stale-one", "https://b.trycloudflare.com")
            .await
            .unwrap();
        upsert_instance(&pool, "user_2", "default", "https://c.trycloudflare.com")
            .await
            .unwrap();
        sqlx::query(
            "UPDATE gizzi_instances SET updated_at = datetime('now', '-1 hour') WHERE name = 'stale-one'",
        )
        .execute(&pool)
        .await
        .unwrap();

        let rows = sqlx::query_as::<_, GizziInstanceView>(
            "SELECT id, name, url, updated_at FROM gizzi_instances WHERE user_id = ? ORDER BY updated_at DESC",
        )
        .bind("user_1")
        .fetch_all(&pool)
        .await
        .unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].name, "default", "newest first");
        let statuses: Vec<&str> = rows
            .iter()
            .map(|row| derive_status(row.updated_at, Utc::now()))
            .collect();
        assert_eq!(statuses, vec!["online", "stale"]);
    }

    #[tokio::test]
    async fn device_token_upsert_resolves_owner_and_device_name() {
        let pool = test_pool().await;
        let token = format!("{}testsecret", runtime_pairing::DEVICE_TOKEN_PREFIX);
        insert_device(&pool, &token, "offline", false).await;

        let (user_id, default_name) = actor_from_headers(&pool, &bearer_headers(&token))
            .await
            .unwrap();
        assert_eq!(user_id, "user_9", "registration lands on the device owner");
        assert_eq!(default_name, "joes-macbook", "name defaults to the device name");

        let instance = upsert_instance(&pool, &user_id, &default_name, "https://a.trycloudflare.com")
            .await
            .unwrap();
        assert_eq!(instance.name, "joes-macbook");

        // The registry PUT doubles as a heartbeat: last_seen_at moves forward.
        let (status, last_seen_at): (String, Option<DateTime<Utc>>) = sqlx::query_as(
            "SELECT status, last_seen_at FROM runtime_devices WHERE id = 'rd_1'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(status, "online");
        assert!(
            last_seen_at.unwrap() > Utc::now() - Duration::minutes(1),
            "device registration bumps last_seen_at"
        );
    }

    #[tokio::test]
    async fn gc_deletes_only_instances_older_than_retention() {
        let pool = test_pool().await;

        // Insert the old row directly with a backdated updated_at; any UPDATE
        // would refresh the timestamp (the production table has a trigger for
        // exactly that), so seed with INSERT only.
        sqlx::query(
            r#"
            INSERT INTO gizzi_instances (id, user_id, name, url, updated_at)
            VALUES ('gi_old', 'user_1', 'old-one', 'https://old.trycloudflare.com',
                    datetime('now', '-40 days'))
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        upsert_instance(&pool, "user_1", "fresh-one", "https://fresh.trycloudflare.com")
            .await
            .unwrap();

        let deleted = collect_stale_instances(&pool).await.unwrap();
        assert_eq!(deleted, 1, "only the 40-day-old row should be collected");

        let names: Vec<String> =
            sqlx::query_scalar("SELECT name FROM gizzi_instances ORDER BY name")
                .fetch_all(&pool)
                .await
                .unwrap();
        assert_eq!(names, vec!["fresh-one".to_string()]);

        // A second sweep on a clean registry deletes nothing.
        let deleted = collect_stale_instances(&pool).await.unwrap();
        assert_eq!(deleted, 0);
    }

    #[tokio::test]
    async fn revoked_device_token_is_rejected() {
        let pool = test_pool().await;
        let token = format!("{}testsecret", runtime_pairing::DEVICE_TOKEN_PREFIX);
        insert_device(&pool, &token, "revoked", true).await;

        let error = actor_from_headers(&pool, &bearer_headers(&token))
            .await
            .unwrap_err();
        assert!(
            matches!(error, ApiError::Unauthorized(_)),
            "revoked device credential must be a 401, got {error:?}"
        );

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM gizzi_instances")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 0, "rejected tokens must not register anything");
    }
}
