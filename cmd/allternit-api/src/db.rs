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
        embedded::migrations::runner()
            .run(&mut conn)
            .map_err(|e| rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(1),
                Some(format!("Migration failed: {}", e)),
            ))?;
        info!("SQLite DB ready at {}", path.display());
        Ok(Self { path })
    }

    pub fn connect(&self) -> SqlResult<Connection> {
        Connection::open(&self.path)
    }
}

