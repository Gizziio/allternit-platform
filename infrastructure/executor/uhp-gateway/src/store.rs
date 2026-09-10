//! SQLite-backed persistence for harnesses, sessions, responses and idempotency keys.

use std::path::Path;

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Row, SqlitePool};

use crate::protocol::{
    self, ErrorBody, Harness, OutputItem, Response, ResponseMetadata, ResponseStatus, Session,
    TurnItem, Usage,
};

#[derive(Debug, Clone)]
pub struct Store {
    pool: SqlitePool,
}

const SEED_HARNESSES: &[(&str, &str, &str, &str)] = &[
    ("chrn_kimi", "Kimi", "kimi", "kimi-k2.7-code"),
    ("chrn_claude", "Claude Code", "claude-code", "claude-sonnet-4-6"),
    ("chrn_codex", "Codex", "codex", "gpt-5-codex"),
];

pub struct SessionRow {
    pub id: String,
    pub harness_id: String,
    pub title: String,
    pub status: String,
    pub cwd: String,
    pub engine_label: String,
    pub engine_workspace_id: Option<String>,
    pub engine_tab_id: Option<String>,
    pub driver_session_ref: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

impl Store {
    pub async fn open(path: &Path) -> Result<Self, sqlx::Error> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let options = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS harnesses (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                base TEXT NOT NULL,
                default_model TEXT,
                builtin INTEGER NOT NULL DEFAULT 0,
                extra_json TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL
            )",
        )
        .execute(&pool)
        .await?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                harness_id TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active',
                cwd TEXT NOT NULL DEFAULT '',
                engine_label TEXT NOT NULL DEFAULT '',
                engine_workspace_id TEXT,
                engine_tab_id TEXT,
                driver_session_ref TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
        )
        .execute(&pool)
        .await?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS responses (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                status TEXT NOT NULL,
                model TEXT NOT NULL DEFAULT '',
                requested_model TEXT,
                output_text TEXT NOT NULL DEFAULT '',
                output_json TEXT NOT NULL DEFAULT '[]',
                usage_json TEXT,
                error_json TEXT,
                metadata_json TEXT NOT NULL DEFAULT '{}',
                previous_response_id TEXT,
                created_at INTEGER NOT NULL,
                completed_at INTEGER
            )",
        )
        .execute(&pool)
        .await?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS idempotency_keys (
                key TEXT PRIMARY KEY,
                response_id TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )",
        )
        .execute(&pool)
        .await?;
        let store = Self { pool };
        store.seed_harnesses().await?;
        Ok(store)
    }

    async fn seed_harnesses(&self) -> Result<(), sqlx::Error> {
        for (id, name, base, default_model) in SEED_HARNESSES {
            sqlx::query(
                "INSERT OR IGNORE INTO harnesses (id, name, base, default_model, builtin, created_at)
                 VALUES (?, ?, ?, ?, 1, ?)",
            )
            .bind(id)
            .bind(name)
            .bind(base)
            .bind(default_model)
            .bind(protocol::now_unix() as i64)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    // ── harnesses ────────────────────────────────────────────────────────────

    fn row_to_harness(row: &sqlx::sqlite::SqliteRow) -> Harness {
        let extra_json: String = row.get("extra_json");
        Harness {
            id: row.get("id"),
            object: Some("harness".into()),
            name: row.get("name"),
            base: row.get("base"),
            base_label: None,
            default_model: row.get("default_model"),
            created_at: Some(row.get::<i64, _>("created_at") as u64),
            extra: serde_json::from_str(&extra_json).unwrap_or_default(),
        }
    }

    pub async fn list_harnesses(&self) -> Result<Vec<Harness>, sqlx::Error> {
        let rows = sqlx::query("SELECT * FROM harnesses ORDER BY created_at, id")
            .fetch_all(&self.pool)
            .await?;
        Ok(rows.iter().map(Self::row_to_harness).collect())
    }

    pub async fn get_harness(&self, id: &str) -> Result<Option<Harness>, sqlx::Error> {
        let row = sqlx::query("SELECT * FROM harnesses WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.as_ref().map(Self::row_to_harness))
    }

    pub async fn create_harness(&self, harness: &Harness) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO harnesses (id, name, base, default_model, builtin, extra_json, created_at)
             VALUES (?, ?, ?, ?, 0, ?, ?)",
        )
        .bind(&harness.id)
        .bind(&harness.name)
        .bind(&harness.base)
        .bind(&harness.default_model)
        .bind(serde_json::to_string(&harness.extra).unwrap_or_else(|_| "{}".into()))
        .bind(protocol::now_unix() as i64)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_harness(&self, harness: &Harness) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE harnesses SET name = ?, base = ?, default_model = ?, extra_json = ? WHERE id = ?",
        )
        .bind(&harness.name)
        .bind(&harness.base)
        .bind(&harness.default_model)
        .bind(serde_json::to_string(&harness.extra).unwrap_or_else(|_| "{}".into()))
        .bind(&harness.id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn delete_harness(&self, id: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM harnesses WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    // ── sessions ─────────────────────────────────────────────────────────────

    pub async fn create_session(
        &self,
        id: &str,
        harness_id: &str,
        cwd: &str,
        engine_label: &str,
    ) -> Result<(), sqlx::Error> {
        let now = protocol::now_unix() as i64;
        sqlx::query(
            "INSERT INTO sessions (id, harness_id, title, status, cwd, engine_label, created_at, updated_at)
             VALUES (?, ?, ?, 'active', ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(harness_id)
        .bind(format!("UHP session {id}"))
        .bind(cwd)
        .bind(engine_label)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    fn row_to_session(row: &sqlx::sqlite::SqliteRow) -> SessionRow {
        SessionRow {
            id: row.get("id"),
            harness_id: row.get("harness_id"),
            title: row.get("title"),
            status: row.get("status"),
            cwd: row.get("cwd"),
            engine_label: row.get("engine_label"),
            engine_workspace_id: row.get("engine_workspace_id"),
            engine_tab_id: row.get("engine_tab_id"),
            driver_session_ref: row.get("driver_session_ref"),
            created_at: row.get::<i64, _>("created_at") as u64,
            updated_at: row.get::<i64, _>("updated_at") as u64,
        }
    }

    pub async fn get_session(&self, id: &str) -> Result<Option<SessionRow>, sqlx::Error> {
        let row = sqlx::query("SELECT * FROM sessions WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.as_ref().map(Self::row_to_session))
    }

    /// List sessions newest-first. `cursor` is a numeric offset; returns the
    /// next cursor (or None on the last page).
    pub async fn list_sessions(
        &self,
        limit: i64,
        cursor: Option<i64>,
    ) -> Result<(Vec<Session>, Option<String>), sqlx::Error> {
        let offset = cursor.unwrap_or(0);
        let rows = sqlx::query(
            "SELECT * FROM sessions ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
        )
        .bind(limit + 1)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;
        let mut next_cursor = None;
        let mut rows = rows;
        if rows.len() as i64 > limit {
            rows.truncate(limit as usize);
            next_cursor = Some((offset + limit).to_string());
        }
        let sessions = rows
            .iter()
            .map(|row| {
                let s = Self::row_to_session(row);
                Session {
                    id: s.id,
                    object: "session".into(),
                    harness_id: s.harness_id,
                    title: s.title,
                    status: s.status,
                    created_at: s.created_at,
                    updated_at: s.updated_at,
                }
            })
            .collect();
        Ok((sessions, next_cursor))
    }

    pub async fn attach_session_engine(
        &self,
        id: &str,
        workspace_id: &str,
        tab_id: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE sessions SET engine_workspace_id = ?, engine_tab_id = ?, updated_at = ? WHERE id = ?",
        )
        .bind(workspace_id)
        .bind(tab_id)
        .bind(protocol::now_unix() as i64)
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn set_driver_session_ref(
        &self,
        id: &str,
        driver_session_ref: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE sessions SET driver_session_ref = ?, updated_at = ? WHERE id = ?")
            .bind(driver_session_ref)
            .bind(protocol::now_unix() as i64)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn list_turns(&self, session_id: &str) -> Result<Vec<TurnItem>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, status FROM responses WHERE session_id = ? ORDER BY created_at, id",
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows
            .iter()
            .map(|row| TurnItem {
                id: row.get("id"),
                status: row.get("status"),
            })
            .collect())
    }

    // ── responses ────────────────────────────────────────────────────────────

    pub async fn insert_response(&self, response: &Response) -> Result<(), sqlx::Error> {
        let output_text = response
            .output
            .first()
            .and_then(|item| item.content.as_ref())
            .and_then(|parts| parts.first())
            .map(|part| part.text.clone())
            .unwrap_or_default();
        sqlx::query(
            "INSERT INTO responses (id, session_id, status, model, requested_model, output_text,
                output_json, usage_json, error_json, metadata_json, previous_response_id, created_at, completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&response.id)
        .bind(response.metadata.session_id.clone().unwrap_or_default())
        .bind(status_str(response.status))
        .bind(&response.model)
        .bind(response.metadata.requested_model.clone())
        .bind(output_text)
        .bind(serde_json::to_string(&response.output).unwrap_or_else(|_| "[]".into()))
        .bind(
            response
                .usage
                .as_ref()
                .and_then(|u| serde_json::to_string(u).ok()),
        )
        .bind(
            response
                .error
                .as_ref()
                .and_then(|e| serde_json::to_string(e).ok()),
        )
        .bind(serde_json::to_string(&response.metadata).unwrap_or_else(|_| "{}".into()))
        .bind(response.previous_response_id.clone())
        .bind(response.created_at as i64)
        .bind(response.status.is_terminal().then(|| protocol::now_unix() as i64))
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_response(&self, response: &Response) -> Result<(), sqlx::Error> {
        let output_text = response
            .output
            .first()
            .and_then(|item| item.content.as_ref())
            .and_then(|parts| parts.first())
            .map(|part| part.text.clone())
            .unwrap_or_default();
        sqlx::query(
            "UPDATE responses SET status = ?, model = ?, requested_model = ?, output_text = ?,
                output_json = ?, usage_json = ?, error_json = ?, metadata_json = ?,
                previous_response_id = ?, completed_at = ? WHERE id = ?",
        )
        .bind(status_str(response.status))
        .bind(&response.model)
        .bind(response.metadata.requested_model.clone())
        .bind(output_text)
        .bind(serde_json::to_string(&response.output).unwrap_or_else(|_| "[]".into()))
        .bind(
            response
                .usage
                .as_ref()
                .and_then(|u| serde_json::to_string(u).ok()),
        )
        .bind(
            response
                .error
                .as_ref()
                .and_then(|e| serde_json::to_string(e).ok()),
        )
        .bind(serde_json::to_string(&response.metadata).unwrap_or_else(|_| "{}".into()))
        .bind(response.previous_response_id.clone())
        .bind(response.status.is_terminal().then(|| protocol::now_unix() as i64))
        .bind(&response.id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_response(&self, id: &str) -> Result<Option<Response>, sqlx::Error> {
        let row = sqlx::query("SELECT * FROM responses WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        row.as_ref().map(Self::row_to_response).transpose()
    }

    fn row_to_response(row: &sqlx::sqlite::SqliteRow) -> Result<Response, sqlx::Error> {
        let status: String = row.get("status");
        let output_json: String = row.get("output_json");
        let usage_json: Option<String> = row.get("usage_json");
        let error_json: Option<String> = row.get("error_json");
        let metadata_json: String = row.get("metadata_json");
        let status = match status.as_str() {
            "completed" => ResponseStatus::Completed,
            "failed" => ResponseStatus::Failed,
            "incomplete" => ResponseStatus::Incomplete,
            "cancelled" => ResponseStatus::Cancelled,
            _ => ResponseStatus::InProgress,
        };
        let output: Vec<OutputItem> = serde_json::from_str(&output_json).unwrap_or_default();
        let usage: Option<Usage> = usage_json
            .as_deref()
            .and_then(|raw| serde_json::from_str(raw).ok());
        let error: Option<ErrorBody> = error_json
            .as_deref()
            .and_then(|raw| serde_json::from_str(raw).ok());
        let metadata: ResponseMetadata =
            serde_json::from_str(&metadata_json).unwrap_or_default();
        Ok(Response {
            id: row.get("id"),
            object: "response".into(),
            created_at: row.get::<i64, _>("created_at") as u64,
            status,
            error,
            previous_response_id: row.get("previous_response_id"),
            model: row.get("model"),
            output,
            store: true,
            usage,
            metadata,
        })
    }

    // ── idempotency ──────────────────────────────────────────────────────────

    pub async fn idempotent_lookup(&self, key: &str) -> Result<Option<String>, sqlx::Error> {
        let row = sqlx::query("SELECT response_id FROM idempotency_keys WHERE key = ?")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|row| row.get("response_id")))
    }

    pub async fn store_idempotency(&self, key: &str, response_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT OR IGNORE INTO idempotency_keys (key, response_id, created_at) VALUES (?, ?, ?)",
        )
        .bind(key)
        .bind(response_id)
        .bind(protocol::now_unix() as i64)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}

fn status_str(status: ResponseStatus) -> &'static str {
    match status {
        ResponseStatus::InProgress => "in_progress",
        ResponseStatus::Completed => "completed",
        ResponseStatus::Failed => "failed",
        ResponseStatus::Incomplete => "incomplete",
        ResponseStatus::Cancelled => "cancelled",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{ContentPart, OutputItem, ResponseStatus, Usage};

    async fn temp_store() -> (Store, tempfile::TempDir) {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(&dir.path().join("uhp.db")).await.unwrap();
        (store, dir)
    }

    fn sample_response(id: &str, session_id: &str, status: ResponseStatus) -> Response {
        Response {
            id: id.into(),
            object: "response".into(),
            created_at: protocol::now_unix(),
            status,
            error: None,
            previous_response_id: None,
            model: "kimi-k2.7-code".into(),
            output: vec![OutputItem {
                id: None,
                item_type: "message".into(),
                status: Some("completed".into()),
                role: Some("assistant".into()),
                content: Some(vec![ContentPart {
                    part_type: "output_text".into(),
                    text: "hello".into(),
                }]),
            }],
            store: true,
            usage: Some(Usage {
                input_tokens: 10,
                output_tokens: 5,
                total_tokens: 15,
                cache_read_tokens: 2,
                cache_write_tokens: 1,
            }),
            metadata: ResponseMetadata {
                session_id: Some(session_id.into()),
                harness_id: Some("chrn_kimi".into()),
                requested_model: None,
                model_fallback: None,
                ignored_fields: None,
                extra: Default::default(),
            },
        }
    }

    #[tokio::test]
    async fn seeds_builtin_harnesses() {
        let (store, _dir) = temp_store().await;
        let harnesses = store.list_harnesses().await.unwrap();
        let ids: Vec<&str> = harnesses.iter().map(|h| h.id.as_str()).collect();
        assert!(ids.contains(&"chrn_kimi"));
        assert!(ids.contains(&"chrn_claude"));
        assert!(ids.contains(&"chrn_codex"));
        // Reopening (same call path) does not duplicate.
        let harnesses2 = store.list_harnesses().await.unwrap();
        assert_eq!(harnesses.len(), harnesses2.len());
    }

    #[tokio::test]
    async fn harness_crud_roundtrip() {
        let (store, _dir) = temp_store().await;
        let h = Harness {
            id: protocol::harness_id(),
            object: Some("harness".into()),
            name: "Test".into(),
            base: "kimi".into(),
            base_label: None,
            default_model: Some("kimi-k3".into()),
            created_at: Some(1),
            extra: serde_json::json!({"customFlag": true}).as_object().unwrap().clone(),
        };
        store.create_harness(&h).await.unwrap();
        let got = store.get_harness(&h.id).await.unwrap().unwrap();
        assert_eq!(got.name, "Test");
        assert_eq!(got.default_model.as_deref(), Some("kimi-k3"));
        assert_eq!(got.extra["customFlag"], true);

        let mut renamed = got.clone();
        renamed.name = "Renamed".into();
        store.update_harness(&renamed).await.unwrap();
        assert_eq!(store.get_harness(&h.id).await.unwrap().unwrap().name, "Renamed");

        assert!(store.delete_harness(&h.id).await.unwrap());
        assert!(store.get_harness(&h.id).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn session_lifecycle_and_turns() {
        let (store, _dir) = temp_store().await;
        let sid = protocol::session_id();
        store
            .create_session(&sid, "chrn_kimi", "/tmp/ws", &format!("uhp-{sid}"))
            .await
            .unwrap();
        store.attach_session_engine(&sid, "ws_1", "tab_1").await.unwrap();
        let session = store.get_session(&sid).await.unwrap().unwrap();
        assert_eq!(session.engine_workspace_id.as_deref(), Some("ws_1"));
        assert_eq!(session.engine_tab_id.as_deref(), Some("tab_1"));

        let r1 = sample_response(&protocol::response_id(), &sid, ResponseStatus::Completed);
        let r2 = sample_response(&protocol::response_id(), &sid, ResponseStatus::InProgress);
        store.insert_response(&r1).await.unwrap();
        store.insert_response(&r2).await.unwrap();

        let turns = store.list_turns(&sid).await.unwrap();
        assert_eq!(turns.len(), 2);
        assert!(turns.iter().all(|t| t.id.starts_with("resp_")));

        let (sessions, next) = store.list_sessions(10, None).await.unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, sid);
        assert_eq!(next, None);
    }

    #[tokio::test]
    async fn response_roundtrip_and_status_update() {
        let (store, _dir) = temp_store().await;
        let sid = protocol::session_id();
        store.create_session(&sid, "chrn_kimi", "/tmp/ws", "lbl").await.unwrap();
        let mut resp = sample_response("resp_test1", &sid, ResponseStatus::InProgress);
        store.insert_response(&resp).await.unwrap();

        let got = store.get_response("resp_test1").await.unwrap().unwrap();
        assert_eq!(got.status, ResponseStatus::InProgress);
        assert_eq!(got.output[0].content.as_ref().unwrap()[0].text, "hello");
        assert_eq!(got.usage.as_ref().unwrap().total_tokens, 15);

        resp.status = ResponseStatus::Completed;
        store.update_response(&resp).await.unwrap();
        let got = store.get_response("resp_test1").await.unwrap().unwrap();
        assert_eq!(got.status, ResponseStatus::Completed);
    }

    #[tokio::test]
    async fn idempotency_key_replay() {
        let (store, _dir) = temp_store().await;
        assert!(store.idempotent_lookup("k1").await.unwrap().is_none());
        store.store_idempotency("k1", "resp_abc").await.unwrap();
        assert_eq!(store.idempotent_lookup("k1").await.unwrap().as_deref(), Some("resp_abc"));
        // Second store with same key is a no-op.
        store.store_idempotency("k1", "resp_other").await.unwrap();
        assert_eq!(store.idempotent_lookup("k1").await.unwrap().as_deref(), Some("resp_abc"));
    }

    #[tokio::test]
    async fn persistence_across_reopen() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("uhp.db");
        let sid = protocol::session_id();
        {
            let store = Store::open(&path).await.unwrap();
            store.create_session(&sid, "chrn_claude", "/tmp/ws", "lbl").await.unwrap();
            store.set_driver_session_ref(&sid, Some("drv-ref-1")).await.unwrap();
            let resp = sample_response("resp_persist", &sid, ResponseStatus::Completed);
            store.insert_response(&resp).await.unwrap();
        }
        // Reopen: checkpoint/rehydrate.
        let store = Store::open(&path).await.unwrap();
        let session = store.get_session(&sid).await.unwrap().unwrap();
        assert_eq!(session.driver_session_ref.as_deref(), Some("drv-ref-1"));
        assert_eq!(session.harness_id, "chrn_claude");
        let resp = store.get_response("resp_persist").await.unwrap().unwrap();
        assert_eq!(resp.status, ResponseStatus::Completed);
    }
}
