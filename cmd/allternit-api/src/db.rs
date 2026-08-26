use rusqlite::{Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
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

    /// Open a shared in-memory database. Useful for unit tests that need the
    /// full migration stack but do not require persistence.
    pub fn new_memory() -> SqlResult<Self> {
        let path = PathBuf::from("file::memory:?cache=shared");
        Self::new(path)
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

    /// Store the frontend metadata bag for a session.
    pub fn set_session_metadata(
        &self,
        session_id: &str,
        metadata: &serde_json::Value,
    ) -> SqlResult<()> {
        let conn = self.connect()?;
        let json = metadata.to_string();
        conn.execute(
            "INSERT INTO session_metadata (session_id, metadata)
             VALUES (?1, ?2)
             ON CONFLICT(session_id) DO UPDATE SET
                 metadata = excluded.metadata,
                 updated_at = CURRENT_TIMESTAMP",
            rusqlite::params![session_id, json],
        )?;
        Ok(())
    }

    /// Retrieve the frontend metadata bag for a session, if any.
    pub fn get_session_metadata(
        &self,
        session_id: &str,
    ) -> SqlResult<Option<serde_json::Value>> {
        let conn = self.connect()?;
        let mut stmt =
            conn.prepare("SELECT metadata FROM session_metadata WHERE session_id = ?1")?;
        let result = stmt.query_row(rusqlite::params![session_id], |row| {
            let json: String = row.get(0)?;
            Ok(serde_json::from_str::<serde_json::Value>(&json)
                .unwrap_or(serde_json::Value::Null))
        });
        match result {
            Ok(value) if !value.is_null() => Ok(Some(value)),
            Ok(_) => Ok(None),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    // ─── HAR-derived API capture persistence ────────────────────────────────────

    pub fn create_capture_session(
        &self,
        id: &str,
        user_id: &str,
        domain: Option<&str>,
        source: Option<&str>,
        status: &str,
        started_at: &str,
    ) -> SqlResult<()> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO har_capture_sessions (id, user_id, domain, source, status, started_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                 user_id = excluded.user_id,
                 domain = excluded.domain,
                 source = excluded.source,
                 status = excluded.status,
                 started_at = excluded.started_at,
                 updated_at = CURRENT_TIMESTAMP",
            rusqlite::params![id, user_id, domain, source, status, started_at],
        )?;
        Ok(())
    }

    pub fn get_capture_session(&self, id: &str) -> SqlResult<Option<CaptureSession>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, domain, source, status, started_at, ended_at
             FROM har_capture_sessions WHERE id = ?1",
        )?;
        let mut rows = stmt.query(rusqlite::params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(CaptureSession {
                id: row.get(0)?,
                user_id: row.get(1)?,
                domain: row.get(2)?,
                source: row.get(3)?,
                status: row.get(4)?,
                started_at: row.get(5)?,
                ended_at: row.get(6)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn update_capture_session_status(
        &self,
        id: &str,
        status: &str,
        ended_at: Option<&str>,
    ) -> SqlResult<()> {
        let conn = self.connect()?;
        conn.execute(
            "UPDATE har_capture_sessions
             SET status = ?1, ended_at = COALESCE(?2, ended_at), updated_at = CURRENT_TIMESTAMP
             WHERE id = ?3",
            rusqlite::params![status, ended_at, id],
        )?;
        Ok(())
    }

    pub fn list_capture_sessions_for_user(&self, user_id: &str) -> SqlResult<Vec<CaptureSession>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, domain, source, status, started_at, ended_at
             FROM har_capture_sessions
             WHERE user_id = ?1
             ORDER BY started_at DESC",
        )?;
        let rows = stmt.query_map(rusqlite::params![user_id], |row| {
            Ok(CaptureSession {
                id: row.get(0)?,
                user_id: row.get(1)?,
                domain: row.get(2)?,
                source: row.get(3)?,
                status: row.get(4)?,
                started_at: row.get(5)?,
                ended_at: row.get(6)?,
            })
        })?;
        rows.collect()
    }

    pub fn delete_capture_session(&self, id: &str) -> SqlResult<bool> {
        let conn = self.connect()?;
        let changed = conn.execute(
            "DELETE FROM har_capture_sessions WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(changed > 0)
    }

    pub fn create_api_contract(
        &self,
        id: &str,
        user_id: &str,
        domain: &str,
        source: Option<&str>,
        derived_at: &str,
    ) -> SqlResult<()> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO har_api_contracts (id, user_id, domain, source, derived_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
                 user_id = excluded.user_id,
                 domain = excluded.domain,
                 source = excluded.source,
                 derived_at = excluded.derived_at,
                 updated_at = CURRENT_TIMESTAMP",
            rusqlite::params![id, user_id, domain, source, derived_at],
        )?;
        Ok(())
    }

    pub fn get_contract_with_endpoints(
        &self,
        id: &str,
    ) -> SqlResult<Option<(ApiContract, Vec<ApiEndpoint>)>> {
        let conn = self.connect()?;
        let contract: Option<ApiContract> = {
            let mut stmt = conn.prepare(
                "SELECT id, user_id, domain, source, derived_at
                 FROM har_api_contracts WHERE id = ?1",
            )?;
            let mut rows = stmt.query(rusqlite::params![id])?;
            rows.next()?
                .map(|row| -> SqlResult<ApiContract> {
                    Ok(ApiContract {
                        id: row.get(0)?,
                        user_id: row.get(1)?,
                        domain: row.get(2)?,
                        source: row.get(3)?,
                        derived_at: row.get(4)?,
                    })
                })
                .transpose()?
        };
        let Some(contract) = contract else {
            return Ok(None);
        };
        let mut stmt = conn.prepare(
            "SELECT id, contract_id, method, url, host, path, path_template, summary,
                    query_params, path_params, headers, body_template, body_mime_type,
                    body_params, status_code, response_sample, hit_count
             FROM har_api_endpoints
             WHERE contract_id = ?1
             ORDER BY method, path",
        )?;
        let endpoints = stmt
            .query_map(rusqlite::params![id], |row| Ok(endpoint_from_row(row)?))?
            .collect::<SqlResult<Vec<_>>>()?;
        Ok(Some((contract, endpoints)))
    }

    pub fn list_contracts_for_user(&self, user_id: &str) -> SqlResult<Vec<ApiContract>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, domain, source, derived_at
             FROM har_api_contracts
             WHERE user_id = ?1
             ORDER BY derived_at DESC",
        )?;
        let rows = stmt.query_map(rusqlite::params![user_id], |row| {
            Ok(ApiContract {
                id: row.get(0)?,
                user_id: row.get(1)?,
                domain: row.get(2)?,
                source: row.get(3)?,
                derived_at: row.get(4)?,
            })
        })?;
        rows.collect()
    }

    pub fn delete_contract(&self, id: &str) -> SqlResult<bool> {
        let conn = self.connect()?;
        let changed = conn.execute(
            "DELETE FROM har_api_contracts WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(changed > 0)
    }

    pub fn create_api_endpoints(&self, endpoints: &[ApiEndpoint]) -> SqlResult<()> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "INSERT INTO har_api_endpoints (
                id, contract_id, method, url, host, path, path_template, summary,
                query_params, path_params, headers, body_template, body_mime_type,
                body_params, status_code, response_sample, hit_count
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
            ON CONFLICT(id) DO UPDATE SET
                contract_id = excluded.contract_id,
                method = excluded.method,
                url = excluded.url,
                host = excluded.host,
                path = excluded.path,
                path_template = excluded.path_template,
                summary = excluded.summary,
                query_params = excluded.query_params,
                path_params = excluded.path_params,
                headers = excluded.headers,
                body_template = excluded.body_template,
                body_mime_type = excluded.body_mime_type,
                body_params = excluded.body_params,
                status_code = excluded.status_code,
                response_sample = excluded.response_sample,
                hit_count = excluded.hit_count,
                updated_at = CURRENT_TIMESTAMP",
        )?;
        for ep in endpoints {
            stmt.execute(rusqlite::params![
                &ep.id,
                &ep.contract_id,
                &ep.method,
                &ep.url,
                ep.host.as_ref(),
                ep.path.as_ref(),
                ep.path_template.as_ref(),
                ep.summary.as_ref(),
                serde_json::to_string(&ep.query_params).unwrap_or_else(|_| "[]".to_string()),
                serde_json::to_string(&ep.path_params).unwrap_or_else(|_| "[]".to_string()),
                serde_json::to_string(&ep.headers).unwrap_or_else(|_| "[]".to_string()),
                ep.body_template.as_ref(),
                ep.body_mime_type.as_ref(),
                serde_json::to_string(&ep.body_params).unwrap_or_else(|_| "[]".to_string()),
                ep.status_code,
                ep.response_sample.as_ref(),
                ep.hit_count,
            ])?;
        }
        Ok(())
    }

    pub fn get_endpoint_by_id(&self, id: &str) -> SqlResult<Option<ApiEndpoint>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, contract_id, method, url, host, path, path_template, summary,
                    query_params, path_params, headers, body_template, body_mime_type,
                    body_params, status_code, response_sample, hit_count
             FROM har_api_endpoints WHERE id = ?1",
        )?;
        let mut rows = stmt.query(rusqlite::params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(endpoint_from_row(row)?))
        } else {
            Ok(None)
        }
    }

    pub fn get_endpoints_by_ids(&self, ids: &[String]) -> SqlResult<Vec<ApiEndpoint>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders: Vec<String> = (1..=ids.len()).map(|i| format!("?{}", i)).collect();
        let sql = format!(
            "SELECT id, contract_id, method, url, host, path, path_template, summary,
                    query_params, path_params, headers, body_template, body_mime_type,
                    body_params, status_code, response_sample, hit_count
             FROM har_api_endpoints WHERE id IN ({})",
            placeholders.join(", ")
        );
        let conn = self.connect()?;
        let mut stmt = conn.prepare(&sql)?;
        let params: Vec<&dyn rusqlite::ToSql> = ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
        let rows = stmt.query_map(params.as_slice(), |row| Ok(endpoint_from_row(row)?))?;
        rows.collect()
    }
}

pub(crate) fn endpoint_from_row(row: &rusqlite::Row) -> SqlResult<ApiEndpoint> {
    let query_params_json: String = row.get(8)?;
    let path_params_json: String = row.get(9)?;
    let headers_json: String = row.get(10)?;
    let body_params_json: String = row.get(13)?;
    Ok(ApiEndpoint {
        id: row.get(0)?,
        contract_id: row.get(1)?,
        method: row.get(2)?,
        url: row.get(3)?,
        host: row.get(4)?,
        path: row.get(5)?,
        path_template: row.get(6)?,
        summary: row.get(7)?,
        query_params: serde_json::from_str(&query_params_json).unwrap_or_default(),
        path_params: serde_json::from_str(&path_params_json).unwrap_or_default(),
        headers: serde_json::from_str(&headers_json).unwrap_or_default(),
        body_template: row.get(11)?,
        body_mime_type: row.get(12)?,
        body_params: serde_json::from_str(&body_params_json).unwrap_or_default(),
        status_code: row.get(14)?,
        response_sample: row.get(15)?,
        hit_count: row.get(16)?,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureSession {
    pub id: String,
    pub user_id: String,
    pub domain: Option<String>,
    pub source: Option<String>,
    pub status: String,
    pub started_at: String,
    pub ended_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiContract {
    pub id: String,
    pub user_id: String,
    pub domain: String,
    pub source: Option<String>,
    pub derived_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiEndpoint {
    pub id: String,
    pub contract_id: String,
    pub method: String,
    pub url: String,
    pub host: Option<String>,
    pub path: Option<String>,
    pub path_template: Option<String>,
    pub summary: Option<String>,
    pub query_params: Vec<TemplatedParam>,
    pub path_params: Vec<TemplatedParam>,
    pub headers: Vec<TemplatedParam>,
    pub body_template: Option<String>,
    pub body_mime_type: Option<String>,
    pub body_params: Vec<TemplatedParam>,
    pub status_code: Option<i64>,
    pub response_sample: Option<String>,
    pub hit_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplatedParam {
    pub name: String,
    pub value: String,
    pub templated: bool,
    pub suggested_default: Option<String>,
}
