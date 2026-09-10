//! Curated `system/...` template catalog (spec rq-20260909-004, matrix row #17).
//!
//! A small built-in catalog of `ComputerTemplate` docs shipped in-repo under
//! `templates/system/*.yaml` and embedded at compile time. At API startup the
//! catalog is synced into the `desktop_templates` table as public, system-owned
//! rows keyed by their curated `system/...` ref (matching the migration-seeded
//! `system/preset-*` rows). Sync is idempotent: unchanged entries are a no-op,
//! changed entries update the resolved view and reset build state (the doc is
//! the source of truth; a changed doc invalidates the previous golden).
//!
//! Callers instantiate a private copy of a catalog entry via
//! `POST /api/v1/desktop-templates` with `catalog_ref`, or reference the
//! system-owned row directly by `template_ref` at computer create.

use rusqlite::OptionalExtension;
use tracing::{info, warn};

use crate::bot_desktop_templates::{upsert_template_from_spec, ComputerTemplateSpec};
use crate::db::DbHandle;

/// Every catalog entry shipped in-repo: (curated ref, YAML source). Keep this
/// list in sync with `templates/system/*.yaml`.
const CATALOG_YAML: &[(&str, &str)] = &[
    ("system/base-desktop", include_str!("../../../templates/system/base-desktop.yaml")),
    ("system/node-dev", include_str!("../../../templates/system/node-dev.yaml")),
];

/// Owner/user id for curated rows. Matches the migration-seeded presets.
pub const SYSTEM_OWNER: &str = "system";

/// A parsed, validated catalog entry.
#[derive(Debug, Clone, PartialEq)]
pub struct CatalogEntry {
    pub reference: String,
    pub spec: ComputerTemplateSpec,
}

/// Parse and validate every shipped catalog entry. Invalid entries are
/// skipped with a loud warning (one bad YAML file must not strand the rest of
/// the catalog or block API boot).
pub fn catalog_entries() -> Vec<CatalogEntry> {
    let mut entries = Vec::new();
    for (reference, yaml) in CATALOG_YAML {
        match serde_yaml::from_str::<ComputerTemplateSpec>(yaml) {
            Ok(spec) => {
                if let Some(expected) = reference.strip_prefix("system/") {
                    if spec.metadata.name != expected {
                        warn!(
                            reference,
                            name = %spec.metadata.name,
                            "catalog entry name does not match its ref; skipped"
                        );
                        continue;
                    }
                }
                match spec.validate() {
                    Ok(()) => entries.push(CatalogEntry {
                        reference: reference.to_string(),
                        spec,
                    }),
                    Err(e) => warn!(reference, error = %e, "invalid catalog entry; skipped"),
                }
            }
            Err(e) => warn!(reference, error = %e, "catalog entry does not parse; skipped"),
        }
    }
    entries
}

/// Look up one catalog entry by its curated ref (e.g. `system/node-dev`).
pub fn get_catalog_entry(reference: &str) -> Option<CatalogEntry> {
    catalog_entries()
        .into_iter()
        .find(|e| e.reference == reference)
}

/// Sync the in-repo catalog into `desktop_templates`. Idempotent: re-running
/// with an unchanged catalog performs no writes. Returns (inserted, updated).
pub async fn sync_catalog_to_db(db: &DbHandle) -> Result<(usize, usize), String> {
    let entries = catalog_entries();
    let db = db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(|e| e.to_string())?;
        let mut inserted = 0usize;
        let mut updated = 0usize;
        for entry in &entries {
            let canonical = entry
                .spec
                .to_yaml()
                .map_err(|e| format!("serialize {}: {e}", entry.reference))?;
            let existing: Option<(String, Option<String>)> = conn
                .query_row(
                    "SELECT id, spec_yaml FROM desktop_templates WHERE ref = ?1",
                    rusqlite::params![entry.reference],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .optional()
                .map_err(|e| e.to_string())?;
            match existing {
                None => {
                    let id = upsert_template_from_spec(
                        &conn,
                        None,
                        SYSTEM_OWNER,
                        &entry.spec,
                        &canonical,
                    )
                    .map_err(|e| e.to_string())?;
                    // upsert created a caller-private row; flip it to the
                    // curated shape (public, system-owned, ref set).
                    conn.execute(
                        "UPDATE desktop_templates SET public = 1, ref = ?2, \
                         updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
                        rusqlite::params![id.id, entry.reference],
                    )
                    .map_err(|e| e.to_string())?;
                    inserted += 1;
                }
                Some((id, Some(stored))) if stored == canonical => {}
                Some((id, _)) => {
                    // Doc changed: replace the resolved view + spec doc and
                    // reset build state (a new golden must be built).
                    upsert_template_from_spec(
                        &conn,
                        None,
                        SYSTEM_OWNER,
                        &entry.spec,
                        &canonical,
                    )
                    .map_err(|e| e.to_string())?;
                    conn.execute(
                        "UPDATE desktop_templates SET public = 1, ref = ?2, \
                         updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
                        rusqlite::params![id, entry.reference],
                    )
                    .map_err(|e| e.to_string())?;
                    updated += 1;
                }
            }
        }
        Ok((inserted, updated))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> DbHandle {
        let path = std::env::temp_dir().join(format!(
            "allternit-template-catalog-test-{}.db",
            uuid::Uuid::new_v4()
        ));
        DbHandle::new(path).expect("test db")
    }

    #[test]
    fn shipped_catalog_entries_parse_and_validate() {
        let entries = catalog_entries();
        assert_eq!(entries.len(), CATALOG_YAML.len(), "no entry may be skipped");
        for entry in &entries {
            assert!(entry.reference.starts_with("system/"));
            assert_eq!(
                entry.spec.metadata.name,
                entry.reference.strip_prefix("system/").unwrap(),
                "entry name must match its ref"
            );
        }
        assert!(get_catalog_entry("system/base-desktop").is_some());
        assert!(get_catalog_entry("system/node-dev").is_some());
        assert!(get_catalog_entry("system/nope").is_none());
    }

    #[tokio::test]
    async fn sync_inserts_then_is_a_no_op() {
        let db = test_db();
        let (inserted, updated) = sync_catalog_to_db(&db).await.unwrap();
        assert_eq!(inserted, CATALOG_YAML.len());
        assert_eq!(updated, 0);

        // Re-sync with an unchanged catalog: no writes.
        let (inserted, updated) = sync_catalog_to_db(&db).await.unwrap();
        assert_eq!(inserted, 0);
        assert_eq!(updated, 0);

        // Rows are public, system-owned, and resolve by ref. (The count
        // excludes the migration-seeded `system/preset-*` rows.)
        let count: i64 = {
            let conn = db.connect().unwrap();
            conn.query_row(
                "SELECT COUNT(*) FROM desktop_templates WHERE ref IN ('system/base-desktop', 'system/node-dev') \
                 AND user_id = 'system' AND public = 1",
                [],
                |row| row.get(0),
            )
            .unwrap()
        };
        assert_eq!(count as usize, CATALOG_YAML.len());
    }

    #[tokio::test]
    async fn sync_reset_build_state_when_doc_changes() {
        let db = test_db();
        sync_catalog_to_db(&db).await.unwrap();

        // Simulate a finished build of system/base-desktop.
        {
            let conn = db.connect().unwrap();
            conn.execute(
                "UPDATE desktop_templates SET build_status = 'ready', \
                 golden_snapshot_id = 'golden' WHERE ref = 'system/base-desktop'",
                [],
            )
            .unwrap();
        }

        // Patch the stored doc, then sync: the catalog doc wins, build resets.
        {
            let conn = db.connect().unwrap();
            conn.execute(
                "UPDATE desktop_templates SET spec_yaml = 'stale: doc' \
                 WHERE ref = 'system/base-desktop'",
                [],
            )
            .unwrap();
        }
        let (inserted, updated) = sync_catalog_to_db(&db).await.unwrap();
        assert_eq!(inserted, 0);
        assert_eq!(updated, 1);
        let (status, golden): (Option<String>, Option<String>) = {
            let conn = db.connect().unwrap();
            conn.query_row(
                "SELECT build_status, golden_snapshot_id FROM desktop_templates \
                 WHERE ref = 'system/base-desktop'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap()
        };
        assert_eq!(status, None);
        assert_eq!(golden, None);
    }
}
