use rusqlite::{Connection, OptionalExtension, Result as SqlResult};
use std::path::PathBuf;
use tracing::info;

mod embedded {
    use refinery::embed_migrations;
    embed_migrations!("migrations");
}

#[derive(Clone)]
pub struct DbHandle {
    path: PathBuf,
}

impl DbHandle {
    pub fn new(path: PathBuf) -> SqlResult<Self> {
        let mut conn = Connection::open(&path)?;
        // Run refinery migrations (idempotent — CREATE TABLE IF NOT EXISTS)
        embedded::migrations::runner().run(&mut conn).map_err(|e| {
            rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(1),
                Some(format!("Migration failed: {}", e)),
            )
        })?;
        info!("SQLite DB ready at {}", path.display());
        Ok(Self { path })
    }

    pub fn connect(&self) -> SqlResult<Connection> {
        Connection::open(&self.path)
    }

    /// Store the original frontend surface for a Gizzi session.
    pub fn set_session_origin_surface(
        &self,
        session_id: &str,
        origin_surface: &str,
    ) -> SqlResult<()> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO session_origin_surface (session_id, origin_surface)
             VALUES (?1, ?2)
             ON CONFLICT(session_id) DO UPDATE SET
                 origin_surface = excluded.origin_surface,
                 updated_at = CURRENT_TIMESTAMP",
            rusqlite::params![session_id, origin_surface],
        )?;
        Ok(())
    }

    /// Retrieve the original frontend surface for a Gizzi session, if any.
    pub fn get_session_origin_surface(&self, session_id: &str) -> SqlResult<Option<String>> {
        let conn = self.connect()?;
        let mut stmt = conn
            .prepare("SELECT origin_surface FROM session_origin_surface WHERE session_id = ?1")?;
        let result = stmt.query_row(rusqlite::params![session_id], |row| row.get::<_, String>(0));
        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Mark a Gizzi session as ephemeral (incognito chat).
    pub fn set_session_ephemeral(&self, session_id: &str) -> SqlResult<()> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO ephemeral_sessions (session_id) VALUES (?1)
             ON CONFLICT(session_id) DO NOTHING",
            rusqlite::params![session_id],
        )?;
        Ok(())
    }

    /// Whether a Gizzi session was created as ephemeral (incognito chat).
    pub fn is_session_ephemeral(&self, session_id: &str) -> SqlResult<bool> {
        let conn = self.connect()?;
        let mut stmt =
            conn.prepare("SELECT 1 FROM ephemeral_sessions WHERE session_id = ?1")?;
        let result = stmt.exists(rusqlite::params![session_id]);
        result
    }

    /// Forget the ephemeral flag for a Gizzi session (after the backing
    /// record was purged).
    pub fn clear_session_ephemeral(&self, session_id: &str) -> SqlResult<()> {
        let conn = self.connect()?;
        conn.execute(
            "DELETE FROM ephemeral_sessions WHERE session_id = ?1",
            rusqlite::params![session_id],
        )?;
        Ok(())
    }

    // ─── API Capture persistence ─────────────────────────────────────────────

    pub fn create_capture_session(
        &self,
        id: &str,
        user_id: &str,
        domain: &str,
        source: &str,
        status: &str,
        started_at: &str,
    ) -> SqlResult<()> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO api_capture_sessions (id, user_id, domain, source, status, started_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![id, user_id, domain, source, status, started_at],
        )?;
        Ok(())
    }

    pub fn update_capture_session_har(
        &self,
        id: &str,
        user_id: &str,
        status: &str,
        ended_at: &str,
        har_json: &str,
    ) -> SqlResult<bool> {
        let conn = self.connect()?;
        let rows = conn.execute(
            "UPDATE api_capture_sessions
             SET status = ?3, ended_at = ?4, har_json = ?5
             WHERE id = ?1 AND user_id = ?2",
            rusqlite::params![id, user_id, status, ended_at, har_json],
        )?;
        Ok(rows > 0)
    }

    pub fn list_capture_sessions(&self, user_id: &str) -> SqlResult<Vec<serde_json::Value>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, domain, source, status, started_at, ended_at
             FROM api_capture_sessions
             WHERE user_id = ?1
             ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(rusqlite::params![user_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "domain": row.get::<_, String>(1)?,
                "source": row.get::<_, String>(2)?,
                "status": row.get::<_, String>(3)?,
                "started_at": row.get::<_, String>(4)?,
                "ended_at": row.get::<_, Option<String>>(5)?,
            }))
        })?;
        rows.collect()
    }

    pub fn create_contract(
        &self,
        id: &str,
        user_id: &str,
        domain: &str,
        source: &str,
        derived_at: &str,
    ) -> SqlResult<()> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO api_capture_contracts (id, user_id, domain, source, derived_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![id, user_id, domain, source, derived_at],
        )?;
        Ok(())
    }

    pub fn create_endpoint(
        &self,
        id: &str,
        contract_id: &str,
        method: &str,
        url: &str,
        host: &str,
        path: &str,
        path_template: &str,
        summary: Option<&str>,
        query_params_json: &str,
        path_params_json: &str,
        headers_json: &str,
        body_template: Option<&str>,
        body_mime_type: Option<&str>,
        body_params_json: &str,
        status_code: u16,
        response_sample: Option<&str>,
        hit_count: u32,
    ) -> SqlResult<()> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO api_capture_endpoints
             (id, contract_id, method, url, host, path, path_template, summary,
              query_params_json, path_params_json, headers_json, body_template,
              body_mime_type, body_params_json, status_code, response_sample, hit_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            rusqlite::params![
                id, contract_id, method, url, host, path, path_template, summary,
                query_params_json, path_params_json, headers_json, body_template,
                body_mime_type, body_params_json, status_code, response_sample, hit_count,
            ],
        )?;
        Ok(())
    }

    pub fn list_capture_contracts(&self, user_id: &str) -> SqlResult<Vec<serde_json::Value>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, domain, source, derived_at
             FROM api_capture_contracts
             WHERE user_id = ?1
             ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(rusqlite::params![user_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "domain": row.get::<_, String>(1)?,
                "source": row.get::<_, String>(2)?,
                "derived_at": row.get::<_, String>(3)?,
            }))
        })?;
        rows.collect()
    }

    pub fn get_contract_with_endpoints(
        &self,
        contract_id: &str,
        user_id: &str,
    ) -> SqlResult<Option<serde_json::Value>> {
        let conn = self.connect()?;
        let contract: Option<serde_json::Value> = conn
            .query_row(
                "SELECT id, domain, source, derived_at
                 FROM api_capture_contracts
                 WHERE id = ?1 AND user_id = ?2",
                rusqlite::params![contract_id, user_id],
                |row| {
                    Ok(serde_json::json!({
                        "id": row.get::<_, String>(0)?,
                        "domain": row.get::<_, String>(1)?,
                        "source": row.get::<_, String>(2)?,
                        "derived_at": row.get::<_, String>(3)?,
                    }))
                },
            )
            .optional()?;

        let Some(mut contract) = contract else { return Ok(None); };

        let mut stmt = conn.prepare(
            "SELECT id, method, url, host, path, path_template, summary,
                    query_params_json, path_params_json, headers_json, body_template,
                    body_mime_type, body_params_json, status_code, response_sample, hit_count
             FROM api_capture_endpoints
             WHERE contract_id = ?1
             ORDER BY method, path",
        )?;
        let endpoints = stmt.query_map(rusqlite::params![contract_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "method": row.get::<_, String>(1)?,
                "url": row.get::<_, String>(2)?,
                "host": row.get::<_, String>(3)?,
                "path": row.get::<_, String>(4)?,
                "path_template": row.get::<_, String>(5)?,
                "summary": row.get::<_, Option<String>>(6)?,
                "query_params": serde_json::from_str::<serde_json::Value>(&row.get::<_, String>(7)?).unwrap_or(serde_json::json!([])),
                "path_params": serde_json::from_str::<serde_json::Value>(&row.get::<_, String>(8)?).unwrap_or(serde_json::json!([])),
                "headers": serde_json::from_str::<serde_json::Value>(&row.get::<_, String>(9)?).unwrap_or(serde_json::json!([])),
                "body_template": row.get::<_, Option<String>>(10)?,
                "body_mime_type": row.get::<_, Option<String>>(11)?,
                "body_params": serde_json::from_str::<serde_json::Value>(&row.get::<_, String>(12)?).unwrap_or(serde_json::json!([])),
                "status_code": row.get::<_, u16>(13)?,
                "response_sample": row.get::<_, Option<String>>(14)?,
                "hit_count": row.get::<_, u32>(15)?,
            }))
        })?;
        let endpoints: Vec<serde_json::Value> = endpoints.collect::<Result<Vec<_>, _>>()?;
        contract["endpoints"] = serde_json::Value::Array(endpoints);
        Ok(Some(contract))
    }

    pub fn delete_capture_contract(&self, contract_id: &str, user_id: &str) -> SqlResult<bool> {
        let conn = self.connect()?;
        let rows = conn.execute(
            "DELETE FROM api_capture_contracts WHERE id = ?1 AND user_id = ?2",
            rusqlite::params![contract_id, user_id],
        )?;
        Ok(rows > 0)
    }

    pub fn get_endpoint_by_id(
        &self,
        endpoint_id: &str,
        user_id: &str,
    ) -> SqlResult<Option<serde_json::Value>> {
        let conn = self.connect()?;
        let result = conn.query_row(
            "SELECT e.id, e.contract_id, e.method, e.url, e.host, e.path, e.path_template,
                    e.summary, e.query_params_json, e.path_params_json, e.headers_json,
                    e.body_template, e.body_mime_type, e.body_params_json, e.status_code,
                    e.response_sample, e.hit_count
             FROM api_capture_endpoints e
             JOIN api_capture_contracts c ON c.id = e.contract_id
             WHERE e.id = ?1 AND c.user_id = ?2",
            rusqlite::params![endpoint_id, user_id],
            |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "contract_id": row.get::<_, String>(1)?,
                    "method": row.get::<_, String>(2)?,
                    "url": row.get::<_, String>(3)?,
                    "host": row.get::<_, String>(4)?,
                    "path": row.get::<_, String>(5)?,
                    "path_template": row.get::<_, String>(6)?,
                    "summary": row.get::<_, Option<String>>(7)?,
                    "query_params": serde_json::from_str::<serde_json::Value>(&row.get::<_, String>(8)?).unwrap_or(serde_json::json!([])),
                    "path_params": serde_json::from_str::<serde_json::Value>(&row.get::<_, String>(9)?).unwrap_or(serde_json::json!([])),
                    "headers": serde_json::from_str::<serde_json::Value>(&row.get::<_, String>(10)?).unwrap_or(serde_json::json!([])),
                    "body_template": row.get::<_, Option<String>>(11)?,
                    "body_mime_type": row.get::<_, Option<String>>(12)?,
                    "body_params": serde_json::from_str::<serde_json::Value>(&row.get::<_, String>(13)?).unwrap_or(serde_json::json!([])),
                    "status_code": row.get::<_, u16>(14)?,
                    "response_sample": row.get::<_, Option<String>>(15)?,
                    "hit_count": row.get::<_, u32>(16)?,
                }))
            },
        ).optional()?;
        Ok(result)
    }
}
