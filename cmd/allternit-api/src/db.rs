use rusqlite::{Connection, Result as SqlResult};
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
}
