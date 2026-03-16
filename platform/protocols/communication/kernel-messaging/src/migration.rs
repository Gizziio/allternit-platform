use sqlx::{Row, SqlitePool};
use std::path::Path;

#[derive(Debug)]
pub struct MigrationRunner {
    pool: SqlitePool,
}

#[derive(Debug, thiserror::Error)]
pub enum MigrationError {
    #[error("SQLX error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Migration error: {0}")]
    Other(String),
}

impl MigrationRunner {
    pub async fn new(pool: SqlitePool) -> Result<Self, sqlx::Error> {
        // Create the migrations table if it doesn't exist
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS _migrations (
                id INTEGER PRIMARY KEY,
                version TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL,
                applied_at INTEGER NOT NULL
            )",
        )
        .execute(&pool)
        .await?;

        Ok(MigrationRunner { pool })
    }

    pub async fn run_migrations(&self, migrations_path: &Path) -> Result<(), MigrationError> {
        use std::ffi::OsStr;
        use std::fs;

        // Read all migration files from the directory
        let migration_entries = fs::read_dir(migrations_path).map_err(MigrationError::Io)?;

        let mut migration_files: Vec<_> = migration_entries
            .filter_map(|entry| {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.extension() == Some(OsStr::new("sql")) {
                        return Some(path);
                    }
                }
                None
            })
            .collect();

        // Sort migration files by name to ensure proper order
        migration_files.sort();

        for migration_path in migration_files {
            let migration_name = migration_path
                .file_name()
                .unwrap()
                .to_string_lossy()
                .to_string();

            // Extract version from filename (format: 001_*.sql)
            let version = migration_name.split('_').next().unwrap_or("").to_string();

            // Check if this migration has already been applied
            let existing_migration: Option<(String,)> =
                sqlx::query_as("SELECT version FROM _migrations WHERE version = ?")
                    .bind(&version)
                    .fetch_optional(&self.pool)
                    .await?;

            if existing_migration.is_some() {
                println!("Migration {} already applied, skipping", version);
                continue;
            }

            // Read and execute the migration
            let migration_sql = fs::read_to_string(&migration_path).map_err(MigrationError::Io)?;
            println!(
                "Applying migration {}: {}",
                version,
                migration_path.display()
            );

            // Execute the migration in a transaction
            let mut tx = self.pool.begin().await?;

            // Split the migration into statements and execute them
            // Note: This is a simplified approach - in production, you'd want more robust SQL parsing
            for statement in migration_sql.split(';') {
                let trimmed = statement.trim();
                if !trimmed.is_empty() {
                    sqlx::query(trimmed).execute(&mut *tx).await?;
                }
            }

            // Record that this migration was applied
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();

            sqlx::query(
                "INSERT INTO _migrations (version, description, applied_at) VALUES (?, ?, ?)",
            )
            .bind(&version)
            .bind(&migration_name)
            .bind(now as i64)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;
            println!("Migration {} applied successfully", version);
        }

        Ok(())
    }

    pub async fn get_applied_migrations(&self) -> Result<Vec<String>, sqlx::Error> {
        let rows: Vec<(String,)> =
            sqlx::query_as("SELECT version FROM _migrations ORDER BY version")
                .fetch_all(&self.pool)
                .await?;

        Ok(rows.into_iter().map(|(version,)| version).collect())
    }
}
