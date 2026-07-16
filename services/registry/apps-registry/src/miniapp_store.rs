//! PostgreSQL persistence for the miniapps marketplace registry.
//!
//! This module is the repository layer for the `/v1/miniapps` API; HTTP
//! handlers in `miniapps.rs` translate its errors into status codes and own
//! request/response shapes. All multi-write operations run in transactions so
//! review state, immutable version rows, and the audit trail stay consistent.

use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use sqlx::FromRow;
use sqlx::postgres::PgPool;
use thiserror::Error;

/// Version used when a submitted manifest does not declare one. Resubmission
/// of the same version with different content is rejected, so publishers must
/// bump `version` to publish changes.
const DEFAULT_VERSION: &str = "0.0.0";

/// Ordered pipeline stages an intake worker must report before a version is
/// eligible for human review. All stages must report `pass` or `warn`; any
/// `fail` fails the job.
pub const REQUIRED_STAGES: [&str; 11] = [
    "schema_validation",
    "signature_validation",
    "repo_check",
    "license_check",
    "secret_scan",
    "dependency_scan",
    "malware_scan",
    "sbom",
    "install_test",
    "health_test",
    "ui_test",
];

#[derive(Debug, Error)]
pub enum MiniAppStoreError {
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("miniapp not found")]
    NotFound,
    #[error("miniapp is owned by a different publisher")]
    Forbidden,
    #[error("version {0} already exists with different content; bump the manifest version")]
    VersionConflict(String),
    #[error("release signature and publisher key are required before verification")]
    UnsignedRelease,
    #[error("the release signing key is revoked or not registered to this publisher")]
    KeyNotActive,
    #[error("no reviewable version found for this miniapp")]
    NoReviewableVersion,
    #[error("conflict: {0}")]
    Conflict(String),
}

#[derive(Debug, Clone, FromRow)]
pub struct MiniAppRow {
    pub id: String,
    pub publisher_id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub status: String,
    pub review_notes: Option<String>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub reviewed_by: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct VersionRow {
    pub id: i64,
    pub miniapp_id: String,
    pub version: String,
    pub manifest: Value,
    pub signature: Option<String>,
    pub publisher_key: Option<String>,
    pub status: String,
    pub submitted_at: DateTime<Utc>,
}

/// One marketplace listing: a miniapp joined with the manifest of its latest
/// version matching the requested status.
#[derive(Debug, Clone, FromRow)]
pub struct ListingRow {
    pub id: String,
    pub publisher_id: String,
    pub name: String,
    pub version: String,
    pub manifest: Value,
    pub submitted_at: DateTime<Utc>,
}

/// A content-addressed asset registered against a miniapp (and optionally a
/// specific version). Serialized for the asset intake endpoints.
#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetRow {
    pub id: i64,
    pub miniapp_id: String,
    pub version_id: Option<i64>,
    pub kind: String,
    pub storage_key: String,
    pub sha256: String,
    pub size_bytes: i64,
    pub mime: String,
    pub quarantined: bool,
    pub created_at: DateTime<Utc>,
}

/// One quarantined intake pipeline job per version. Workers claim queued jobs,
/// report stage results, and the job lands in `awaiting_review` once every
/// [`REQUIRED_STAGES`] stage has a passing report.
#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntakeJobRow {
    pub id: i64,
    pub miniapp_id: String,
    pub version_id: i64,
    pub status: String,
    pub claimed_by: Option<String>,
    pub claimed_at: Option<DateTime<Utc>>,
    pub attempts: i32,
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A single pipeline stage result, reported by an isolated worker.
#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanReportRow {
    pub id: i64,
    pub miniapp_id: String,
    pub version_id: Option<i64>,
    pub stage: Option<String>,
    pub scanner: String,
    pub status: String,
    pub summary: Value,
    pub storage_key: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewAction {
    Approve,
    Reject,
    RequestChanges,
    Revoke,
    Quarantine,
}

impl ReviewAction {
    fn as_str(self) -> &'static str {
        match self {
            ReviewAction::Approve => "approve",
            ReviewAction::Reject => "reject",
            ReviewAction::RequestChanges => "request_changes",
            ReviewAction::Revoke => "revoke",
            ReviewAction::Quarantine => "quarantine",
        }
    }

    fn targets_version(self) -> bool {
        matches!(
            self,
            ReviewAction::Approve | ReviewAction::Reject | ReviewAction::RequestChanges
        )
    }
}

#[derive(Debug)]
pub struct ListFilter {
    pub status: Option<String>,
    pub search: Option<String>,
    /// Keyset cursor: return listings ordered after this `(name, id)` pair.
    pub cursor: Option<(String, String)>,
    /// Maximum rows to return; callers pass `limit + 1` to detect more pages.
    pub limit: i64,
}

#[derive(Clone)]
pub struct MiniAppStore {
    pool: PgPool,
}

/// Manifest `id` field accessor shared with the HTTP layer.
pub fn manifest_id(value: &Value) -> Option<&str> {
    value.get("id")?.as_str()
}

fn manifest_version(value: &Value) -> &str {
    value
        .get("version")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|version| !version.is_empty())
        .unwrap_or(DEFAULT_VERSION)
}

fn release_field<'a>(value: &'a Value, field: &str) -> Option<&'a str> {
    value.get("release")?.get(field)?.as_str()
}

/// Fingerprint of a publisher Ed25519 public key: hex-encoded SHA-256 of the
/// canonical (base64) public key string. Only public keys are ever stored.
pub fn key_fingerprint(public_key: &str) -> String {
    let digest = Sha256::digest(public_key.as_bytes());
    let mut fingerprint = String::with_capacity(digest.len() * 2);
    for byte in digest {
        fingerprint.push_str(&format!("{byte:02x}"));
    }
    fingerprint
}

impl MiniAppStore {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Marketplace listing with keyset pagination and full-text search.
    ///
    /// For each miniapp the manifest served belongs to the latest version
    /// whose status matches the requested filter, so a verified listing keeps
    /// serving its last verified release while a newer version is pending.
    pub async fn list(&self, filter: ListFilter) -> Result<Vec<ListingRow>, MiniAppStoreError> {
        let (cursor_name, cursor_id) = match filter.cursor {
            Some((name, id)) => (Some(name), Some(id)),
            None => (None, None),
        };
        let rows = sqlx::query_as::<_, ListingRow>(
            "SELECT
                 m.id AS id,
                 m.publisher_id AS publisher_id,
                 m.name AS name,
                 v.version AS version,
                 v.manifest AS manifest,
                 v.submitted_at AS submitted_at
             FROM miniapps m
             JOIN LATERAL (
                 SELECT v2.version, v2.manifest, v2.submitted_at, v2.id
                 FROM miniapp_versions v2
                 WHERE v2.miniapp_id = m.id
                   AND ($1::text IS NULL OR v2.status = $1 OR $1 IN ('revoked', 'quarantined'))
                 ORDER BY v2.submitted_at DESC, v2.id DESC
                 LIMIT 1
             ) v ON TRUE
             WHERE ($1::text IS NULL OR m.status = $1)
               AND ($2::text IS NULL
                    OR to_tsvector('simple', coalesce(m.name, '') || ' ' || coalesce(m.description, '') || ' ' || m.id)
                       @@ plainto_tsquery('simple', $2))
               AND ($3::text IS NULL OR (lower(m.name), m.id) > (lower($3::text), $4::text))
             ORDER BY lower(m.name), m.id
             LIMIT $5",
        )
        .bind(filter.status)
        .bind(filter.search)
        .bind(cursor_name)
        .bind(cursor_id)
        .bind(filter.limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    /// Accept a submission from a publisher.
    ///
    /// Runs in one transaction: upsert the publisher, enforce ownership of an
    /// existing miniapp, insert an immutable `(miniapp_id, version)` row,
    /// record the submission, and register any release signing key.
    ///
    /// Returns the listing row, the version row, and whether new content was
    /// created. Resubmitting an identical manifest for an existing version is
    /// an idempotent success (`created == false`); resubmitting different
    /// content under the same version is a [`MiniAppStoreError::VersionConflict`].
    pub async fn submit(
        &self,
        publisher_token: &str,
        manifest: &Value,
    ) -> Result<(MiniAppRow, VersionRow, bool), MiniAppStoreError> {
        let id = manifest_id(manifest)
            .ok_or_else(|| MiniAppStoreError::VersionConflict("missing manifest id".into()))?
            .to_string();
        let name = manifest
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let description = manifest
            .get("description")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let category = manifest
            .get("category")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let version = manifest_version(manifest);
        let signature = release_field(manifest, "signature");
        let publisher_key = release_field(manifest, "publisherKey");

        let mut tx = self.pool.begin().await?;

        sqlx::query("INSERT INTO publishers (id) VALUES ($1) ON CONFLICT (id) DO NOTHING")
            .bind(publisher_token)
            .execute(&mut *tx)
            .await?;

        let existing = sqlx::query_as::<_, MiniAppRow>("SELECT * FROM miniapps WHERE id = $1")
            .bind(&id)
            .fetch_optional(&mut *tx)
            .await?;

        let miniapp = match existing {
            None => {
                sqlx::query_as::<_, MiniAppRow>(
                    "INSERT INTO miniapps (id, publisher_id, name, description, category)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING *",
                )
                .bind(&id)
                .bind(publisher_token)
                .bind(name)
                .bind(description)
                .bind(category)
                .fetch_one(&mut *tx)
                .await?
            }
            Some(row) => {
                if row.publisher_id != publisher_token {
                    return Err(MiniAppStoreError::Forbidden);
                }
                sqlx::query_as::<_, MiniAppRow>(
                    "UPDATE miniapps
                     SET name = $2, description = $3, category = $4, updated_at = now()
                     WHERE id = $1
                     RETURNING *",
                )
                .bind(&id)
                .bind(name)
                .bind(description)
                .bind(category)
                .fetch_one(&mut *tx)
                .await?
            }
        };

        let inserted = sqlx::query_as::<_, VersionRow>(
            "INSERT INTO miniapp_versions (miniapp_id, version, manifest, signature, publisher_key)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (miniapp_id, version) DO NOTHING
             RETURNING *",
        )
        .bind(&id)
        .bind(version)
        .bind(manifest)
        .bind(signature)
        .bind(publisher_key)
        .fetch_optional(&mut *tx)
        .await?;

        let (version_row, created) = match inserted {
            Some(row) => (row, true),
            None => {
                let existing = sqlx::query_as::<_, VersionRow>(
                    "SELECT * FROM miniapp_versions WHERE miniapp_id = $1 AND version = $2",
                )
                .bind(&id)
                .bind(version)
                .fetch_one(&mut *tx)
                .await?;
                if existing.manifest != *manifest {
                    return Err(MiniAppStoreError::VersionConflict(version.to_string()));
                }
                (existing, false)
            }
        };

        if created {
            sqlx::query(
                "INSERT INTO submissions (miniapp_id, version_id, publisher_id, manifest)
                 VALUES ($1, $2, $3, $4)",
            )
            .bind(&id)
            .bind(version_row.id)
            .bind(publisher_token)
            .bind(manifest)
            .execute(&mut *tx)
            .await?;

            // Every new version enters the quarantined intake pipeline.
            sqlx::query(
                "INSERT INTO intake_jobs (miniapp_id, version_id)
                 VALUES ($1, $2)
                 ON CONFLICT (version_id) DO NOTHING",
            )
            .bind(&id)
            .bind(version_row.id)
            .execute(&mut *tx)
            .await?;
        }

        if let Some(public_key) = publisher_key {
            sqlx::query(
                "INSERT INTO publisher_keys (publisher_id, key_fingerprint, public_key)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (publisher_id, key_fingerprint) DO NOTHING",
            )
            .bind(publisher_token)
            .bind(key_fingerprint(public_key))
            .bind(public_key)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok((miniapp, version_row, created))
    }

    /// Apply a review action to a miniapp in a single transaction: transition
    /// the target version (for approve/reject), append to the audit trail,
    /// and recompute the listing status. Approving requires the release to
    /// carry a signature and publisher key.
    ///
    /// When `version` is `None`, the latest pending version is targeted for
    /// version-scoped actions and the latest version overall for
    /// listing-scoped actions (revoke/quarantine).
    pub async fn review(
        &self,
        miniapp_id: &str,
        actor: &str,
        action: ReviewAction,
        notes: Option<&str>,
        version: Option<&str>,
    ) -> Result<(MiniAppRow, Option<VersionRow>), MiniAppStoreError> {
        let mut tx = self.pool.begin().await?;

        sqlx::query_as::<_, MiniAppRow>("SELECT * FROM miniapps WHERE id = $1 FOR UPDATE")
            .bind(miniapp_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(MiniAppStoreError::NotFound)?;

        let target: Option<VersionRow> = match version {
            Some(version) => {
                let row = sqlx::query_as::<_, VersionRow>(
                    "SELECT * FROM miniapp_versions WHERE miniapp_id = $1 AND version = $2",
                )
                .bind(miniapp_id)
                .bind(version)
                .fetch_optional(&mut *tx)
                .await?;
                if row.is_none() {
                    return Err(MiniAppStoreError::NotFound);
                }
                row
            }
            None if action.targets_version() => {
                sqlx::query_as::<_, VersionRow>(
                    "SELECT * FROM miniapp_versions
                     WHERE miniapp_id = $1 AND status = 'pending'
                     ORDER BY submitted_at DESC, id DESC
                     LIMIT 1",
                )
                .bind(miniapp_id)
                .fetch_optional(&mut *tx)
                .await?
            }
            None => {
                sqlx::query_as::<_, VersionRow>(
                    "SELECT * FROM miniapp_versions
                     WHERE miniapp_id = $1
                     ORDER BY submitted_at DESC, id DESC
                     LIMIT 1",
                )
                .bind(miniapp_id)
                .fetch_optional(&mut *tx)
                .await?
            }
        };

        if action.targets_version() && target.is_none() {
            return Err(MiniAppStoreError::NoReviewableVersion);
        }

        match action {
            ReviewAction::Approve => {
                let target = target
                    .as_ref()
                    .ok_or(MiniAppStoreError::NoReviewableVersion)?;
                if target.signature.is_none() || target.publisher_key.is_none() {
                    return Err(MiniAppStoreError::UnsignedRelease);
                }
                // The signing key must be registered with this publisher and
                // still active: a revoked or rotated-out key must not be able
                // to produce a new verified release.
                let fingerprint = key_fingerprint(target.publisher_key.as_deref().unwrap_or(""));
                let key_active = sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS (
                         SELECT 1 FROM publisher_keys k
                         JOIN miniapps m ON m.publisher_id = k.publisher_id
                         WHERE m.id = $1 AND k.key_fingerprint = $2 AND k.status = 'active'
                     )",
                )
                .bind(miniapp_id)
                .bind(&fingerprint)
                .fetch_one(&mut *tx)
                .await?;
                if !key_active {
                    return Err(MiniAppStoreError::KeyNotActive);
                }
                sqlx::query("UPDATE miniapp_versions SET status = 'verified' WHERE id = $1")
                    .bind(target.id)
                    .execute(&mut *tx)
                    .await?;
            }
            ReviewAction::Reject => {
                let target = target
                    .as_ref()
                    .ok_or(MiniAppStoreError::NoReviewableVersion)?;
                sqlx::query("UPDATE miniapp_versions SET status = 'rejected' WHERE id = $1")
                    .bind(target.id)
                    .execute(&mut *tx)
                    .await?;
            }
            ReviewAction::RequestChanges | ReviewAction::Revoke | ReviewAction::Quarantine => {}
        }

        sqlx::query(
            "INSERT INTO reviews (miniapp_id, version_id, actor, action, notes)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(miniapp_id)
        .bind(target.as_ref().map(|row| row.id))
        .bind(actor)
        .bind(action.as_str())
        .bind(notes)
        .execute(&mut *tx)
        .await?;

        let miniapp = match action {
            ReviewAction::Revoke | ReviewAction::Quarantine => {
                let status = if action == ReviewAction::Revoke {
                    "revoked"
                } else {
                    "quarantined"
                };
                sqlx::query_as::<_, MiniAppRow>(
                    "UPDATE miniapps
                     SET status = $2, review_notes = $3, reviewed_at = now(), reviewed_by = $4,
                         updated_at = now()
                     WHERE id = $1
                     RETURNING *",
                )
                .bind(miniapp_id)
                .bind(status)
                .bind(notes)
                .bind(actor)
                .fetch_one(&mut *tx)
                .await?
            }
            _ => {
                sqlx::query_as::<_, MiniAppRow>(
                    "UPDATE miniapps
                     SET status = CASE
                             WHEN EXISTS (SELECT 1 FROM miniapp_versions v
                                          WHERE v.miniapp_id = $1 AND v.status = 'verified')
                                 THEN 'verified'
                             WHEN EXISTS (SELECT 1 FROM miniapp_versions v
                                          WHERE v.miniapp_id = $1 AND v.status = 'pending')
                                 THEN 'pending'
                             ELSE 'rejected'
                         END,
                         review_notes = $2, reviewed_at = now(), reviewed_by = $3,
                         updated_at = now()
                     WHERE id = $1
                     RETURNING *",
                )
                .bind(miniapp_id)
                .bind(notes)
                .bind(actor)
                .fetch_one(&mut *tx)
                .await?
            }
        };

        let target = match target {
            Some(row) => Some(
                sqlx::query_as::<_, VersionRow>("SELECT * FROM miniapp_versions WHERE id = $1")
                    .bind(row.id)
                    .fetch_one(&mut *tx)
                    .await?,
            ),
            None => None,
        };

        tx.commit().await?;
        Ok((miniapp, target))
    }

    /// Record a desktop lifecycle event (install/update/rollback/uninstall/
    /// launch) reported by a client.
    pub async fn record_install_event(
        &self,
        miniapp_id: &str,
        version: &str,
        event: &str,
        platform: Option<&str>,
        client_version: Option<&str>,
    ) -> Result<(), MiniAppStoreError> {
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM miniapps WHERE id = $1)")
                .bind(miniapp_id)
                .fetch_one(&self.pool)
                .await?;
        if !exists {
            return Err(MiniAppStoreError::NotFound);
        }
        sqlx::query(
            "INSERT INTO install_events (miniapp_id, version, event, platform, client_version)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(miniapp_id)
        .bind(version)
        .bind(event)
        .bind(platform)
        .bind(client_version)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Create or update a user's 1-5 star rating of a miniapp.
    pub async fn upsert_rating(
        &self,
        miniapp_id: &str,
        user_id: &str,
        rating: i16,
        review_text: Option<&str>,
    ) -> Result<(), MiniAppStoreError> {
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM miniapps WHERE id = $1)")
                .bind(miniapp_id)
                .fetch_one(&self.pool)
                .await?;
        if !exists {
            return Err(MiniAppStoreError::NotFound);
        }
        sqlx::query(
            "INSERT INTO ratings (miniapp_id, user_id, rating, review_text)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (miniapp_id, user_id)
             DO UPDATE SET rating = EXCLUDED.rating,
                           review_text = EXCLUDED.review_text,
                           updated_at = now()",
        )
        .bind(miniapp_id)
        .bind(user_id)
        .bind(rating)
        .bind(review_text)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Attach a scan result to a version. Used by the quarantined intake
    /// pipeline; the full report lives in object storage.
    #[allow(dead_code)]
    pub async fn insert_scan_report(
        &self,
        miniapp_id: &str,
        version_id: Option<i64>,
        scanner: &str,
        status: &str,
        summary: &Value,
        storage_key: Option<&str>,
    ) -> Result<i64, MiniAppStoreError> {
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO scan_reports (miniapp_id, version_id, scanner, status, summary, storage_key)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id",
        )
        .bind(miniapp_id)
        .bind(version_id)
        .bind(scanner)
        .bind(status)
        .bind(summary)
        .bind(storage_key)
        .fetch_one(&self.pool)
        .await?;
        Ok(id)
    }

    /// Register a verified upload as a content-addressed asset. Inserts are
    /// quarantined by default; re-registering the same content moves the
    /// version pointer and keeps the existing quarantine state.
    pub async fn upsert_release_asset(
        &self,
        miniapp_id: &str,
        version_id: Option<i64>,
        kind: &str,
        storage_key: &str,
        sha256: &str,
        size_bytes: i64,
        mime: &str,
    ) -> Result<AssetRow, MiniAppStoreError> {
        let row = sqlx::query_as::<_, AssetRow>(
            "INSERT INTO release_assets
                 (miniapp_id, version_id, kind, storage_key, sha256, size_bytes, mime)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (miniapp_id, kind, storage_key)
             DO UPDATE SET version_id = COALESCE(EXCLUDED.version_id, release_assets.version_id)
             RETURNING *",
        )
        .bind(miniapp_id)
        .bind(version_id)
        .bind(kind)
        .bind(storage_key)
        .bind(sha256)
        .bind(size_bytes)
        .bind(mime)
        .fetch_one(&self.pool)
        .await?;
        Ok(row)
    }

    pub async fn get_miniapp(&self, id: &str) -> Result<Option<MiniAppRow>, MiniAppStoreError> {
        let row = sqlx::query_as::<_, MiniAppRow>("SELECT * FROM miniapps WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row)
    }

    pub async fn get_version(
        &self,
        miniapp_id: &str,
        version: &str,
    ) -> Result<Option<VersionRow>, MiniAppStoreError> {
        let row = sqlx::query_as::<_, VersionRow>(
            "SELECT * FROM miniapp_versions WHERE miniapp_id = $1 AND version = $2",
        )
        .bind(miniapp_id)
        .bind(version)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }

    pub async fn get_asset(&self, asset_id: i64) -> Result<Option<AssetRow>, MiniAppStoreError> {
        let row = sqlx::query_as::<_, AssetRow>("SELECT * FROM release_assets WHERE id = $1")
            .bind(asset_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row)
    }

    /// Quarantined assets attached to a version, pending publication.
    pub async fn quarantined_assets_for_version(
        &self,
        version_id: i64,
    ) -> Result<Vec<AssetRow>, MiniAppStoreError> {
        let rows = sqlx::query_as::<_, AssetRow>(
            "SELECT * FROM release_assets WHERE version_id = $1 AND quarantined
             ORDER BY id",
        )
        .bind(version_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    /// Mark assets as published after their objects have been copied to the
    /// published bucket.
    pub async fn mark_assets_published(&self, asset_ids: &[i64]) -> Result<(), MiniAppStoreError> {
        sqlx::query("UPDATE release_assets SET quarantined = FALSE WHERE id = ANY($1)")
            .bind(asset_ids)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Versions of a miniapp, newest first, optionally filtered by status.
    pub async fn list_versions(
        &self,
        miniapp_id: &str,
        status: Option<&str>,
    ) -> Result<Vec<VersionRow>, MiniAppStoreError> {
        let rows = sqlx::query_as::<_, VersionRow>(
            "SELECT * FROM miniapp_versions
             WHERE miniapp_id = $1 AND ($2::text IS NULL OR status = $2)
             ORDER BY submitted_at DESC, id DESC",
        )
        .bind(miniapp_id)
        .bind(status)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    /// Newest verified version of a miniapp, if any.
    pub async fn latest_verified_version(
        &self,
        miniapp_id: &str,
    ) -> Result<Option<VersionRow>, MiniAppStoreError> {
        let row = sqlx::query_as::<_, VersionRow>(
            "SELECT * FROM miniapp_versions
             WHERE miniapp_id = $1 AND status = 'verified'
             ORDER BY submitted_at DESC, id DESC
             LIMIT 1",
        )
        .bind(miniapp_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }

    /// Assets attached to a version. `published_only` hides quarantined rows.
    pub async fn assets_for_version(
        &self,
        version_id: i64,
        published_only: bool,
    ) -> Result<Vec<AssetRow>, MiniAppStoreError> {
        let rows = sqlx::query_as::<_, AssetRow>(
            "SELECT * FROM release_assets
             WHERE version_id = $1 AND (NOT $2 OR quarantined = FALSE)
             ORDER BY kind, id",
        )
        .bind(version_id)
        .bind(published_only)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    /// All assets registered for a miniapp, any quarantine state.
    pub async fn assets_for_miniapp(
        &self,
        miniapp_id: &str,
    ) -> Result<Vec<AssetRow>, MiniAppStoreError> {
        let rows = sqlx::query_as::<_, AssetRow>(
            "SELECT * FROM release_assets WHERE miniapp_id = $1 ORDER BY id",
        )
        .bind(miniapp_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    /// All scan reports recorded for a version, oldest first.
    pub async fn scan_reports_for_version(
        &self,
        version_id: i64,
    ) -> Result<Vec<ScanReportRow>, MiniAppStoreError> {
        let rows = sqlx::query_as::<_, ScanReportRow>(
            "SELECT * FROM scan_reports WHERE version_id = $1 ORDER BY id",
        )
        .bind(version_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    pub async fn get_version_by_id(
        &self,
        version_id: i64,
    ) -> Result<Option<VersionRow>, MiniAppStoreError> {
        let row = sqlx::query_as::<_, VersionRow>("SELECT * FROM miniapp_versions WHERE id = $1")
            .bind(version_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row)
    }

    pub async fn get_intake_job(
        &self,
        job_id: i64,
    ) -> Result<Option<IntakeJobRow>, MiniAppStoreError> {
        let row = sqlx::query_as::<_, IntakeJobRow>("SELECT * FROM intake_jobs WHERE id = $1")
            .bind(job_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row)
    }

    pub async fn intake_job_for_version(
        &self,
        version_id: i64,
    ) -> Result<Option<IntakeJobRow>, MiniAppStoreError> {
        let row =
            sqlx::query_as::<_, IntakeJobRow>("SELECT * FROM intake_jobs WHERE version_id = $1")
                .bind(version_id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(row)
    }

    /// Atomically claim the oldest queued job for a worker. Concurrent workers
    /// skip over each other via `FOR UPDATE SKIP LOCKED`.
    pub async fn claim_intake_job(
        &self,
        worker: &str,
    ) -> Result<Option<IntakeJobRow>, MiniAppStoreError> {
        let row = sqlx::query_as::<_, IntakeJobRow>(
            "UPDATE intake_jobs
             SET status = 'claimed', claimed_by = $1, claimed_at = now(),
                 attempts = attempts + 1, updated_at = now()
             WHERE id = (
                 SELECT id FROM intake_jobs
                 WHERE status = 'queued'
                 ORDER BY id
                 FOR UPDATE SKIP LOCKED
                 LIMIT 1
             )
             RETURNING *",
        )
        .bind(worker)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }

    /// Record one pipeline stage result from the claiming worker. A `fail`
    /// result fails the job; once every required stage has a `pass`/`warn`
    /// report the job moves to `awaiting_review` for the human gate.
    pub async fn report_stage_result(
        &self,
        job_id: i64,
        worker: &str,
        stage: &str,
        scanner: &str,
        status: &str,
        summary: &Value,
        storage_key: Option<&str>,
    ) -> Result<IntakeJobRow, MiniAppStoreError> {
        let mut tx = self.pool.begin().await?;

        let job =
            sqlx::query_as::<_, IntakeJobRow>("SELECT * FROM intake_jobs WHERE id = $1 FOR UPDATE")
                .bind(job_id)
                .fetch_optional(&mut *tx)
                .await?
                .ok_or(MiniAppStoreError::NotFound)?;
        if job.status != "claimed" {
            return Err(MiniAppStoreError::Conflict(format!(
                "job {job_id} is not claimed (status: {})",
                job.status
            )));
        }
        if job.claimed_by.as_deref() != Some(worker) {
            return Err(MiniAppStoreError::Forbidden);
        }

        sqlx::query(
            "INSERT INTO scan_reports (miniapp_id, version_id, stage, scanner, status, summary, storage_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(&job.miniapp_id)
        .bind(job.version_id)
        .bind(stage)
        .bind(scanner)
        .bind(status)
        .bind(summary)
        .bind(storage_key)
        .execute(&mut *tx)
        .await?;

        let job = if status == "fail" {
            sqlx::query_as::<_, IntakeJobRow>(
                "UPDATE intake_jobs
                 SET status = 'failed', last_error = $2, updated_at = now()
                 WHERE id = $1
                 RETURNING *",
            )
            .bind(job_id)
            .bind(stage)
            .fetch_one(&mut *tx)
            .await?
        } else {
            let passed: i64 = sqlx::query_scalar(
                "SELECT COUNT(DISTINCT stage) FROM scan_reports
                 WHERE version_id = $1 AND status IN ('pass', 'warn')",
            )
            .bind(job.version_id)
            .fetch_one(&mut *tx)
            .await?;
            if passed >= REQUIRED_STAGES.len() as i64 {
                sqlx::query_as::<_, IntakeJobRow>(
                    "UPDATE intake_jobs
                     SET status = 'awaiting_review', updated_at = now()
                     WHERE id = $1
                     RETURNING *",
                )
                .bind(job_id)
                .fetch_one(&mut *tx)
                .await?
            } else {
                job
            }
        };

        tx.commit().await?;
        Ok(job)
    }

    /// Mark a claimed job failed (worker/infra error). The version stays
    /// pending; an admin can requeue the job.
    pub async fn fail_intake_job(
        &self,
        job_id: i64,
        worker: &str,
        error: &str,
    ) -> Result<IntakeJobRow, MiniAppStoreError> {
        let mut tx = self.pool.begin().await?;
        let job =
            sqlx::query_as::<_, IntakeJobRow>("SELECT * FROM intake_jobs WHERE id = $1 FOR UPDATE")
                .bind(job_id)
                .fetch_optional(&mut *tx)
                .await?
                .ok_or(MiniAppStoreError::NotFound)?;
        if job.status != "claimed" {
            return Err(MiniAppStoreError::Conflict(format!(
                "job {job_id} is not claimed (status: {})",
                job.status
            )));
        }
        if job.claimed_by.as_deref() != Some(worker) {
            return Err(MiniAppStoreError::Forbidden);
        }
        let job = sqlx::query_as::<_, IntakeJobRow>(
            "UPDATE intake_jobs
             SET status = 'failed', last_error = $2, updated_at = now()
             WHERE id = $1
             RETURNING *",
        )
        .bind(job_id)
        .bind(error)
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(job)
    }

    /// Return a job to the queue (e.g. after a worker crash or a fixed
    /// scanner). Admin-only; clears claim state but keeps attempts.
    pub async fn requeue_intake_job(&self, job_id: i64) -> Result<IntakeJobRow, MiniAppStoreError> {
        let row = sqlx::query_as::<_, IntakeJobRow>(
            "UPDATE intake_jobs
             SET status = 'queued', claimed_by = NULL, claimed_at = NULL,
                 last_error = NULL, updated_at = now()
             WHERE id = $1
             RETURNING *",
        )
        .bind(job_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(MiniAppStoreError::NotFound)?;
        Ok(row)
    }

    /// Revoke a publisher signing key. Key rotation is a new key registration
    /// plus revocation of the previous fingerprint.
    pub async fn revoke_publisher_key(
        &self,
        publisher_id: &str,
        fingerprint: &str,
    ) -> Result<bool, MiniAppStoreError> {
        let result = sqlx::query(
            "UPDATE publisher_keys
             SET status = 'revoked', revoked_at = now()
             WHERE publisher_id = $1 AND key_fingerprint = $2 AND status <> 'revoked'",
        )
        .bind(publisher_id)
        .bind(fingerprint)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Review queue: every pending version, oldest submission first (FIFO so
    /// nothing starves), with intake pipeline status and scan tallies. Keyset
    /// pagination on (submitted_at, version id).
    pub async fn review_queue(
        &self,
        cursor: Option<(DateTime<Utc>, i64)>,
        limit: i64,
    ) -> Result<Vec<ReviewQueueRow>, MiniAppStoreError> {
        let rows = sqlx::query_as::<_, ReviewQueueRow>(
            "SELECT v.id AS version_id, v.miniapp_id, m.name, m.publisher_id, v.version,
                    v.submitted_at, v.signature IS NOT NULL AND v.publisher_key IS NOT NULL AS signed,
                    j.status AS intake_status,
                    COALESCE(s.fail_count, 0) AS scan_failures,
                    COALESCE(s.warn_count, 0) AS scan_warnings
             FROM miniapp_versions v
             JOIN miniapps m ON m.id = v.miniapp_id
             LEFT JOIN intake_jobs j ON j.version_id = v.id
             LEFT JOIN (
                 SELECT version_id,
                        COUNT(*) FILTER (WHERE status = 'fail') AS fail_count,
                        COUNT(*) FILTER (WHERE status = 'warn') AS warn_count
                 FROM scan_reports GROUP BY version_id
             ) s ON s.version_id = v.id
             WHERE v.status = 'pending'
               AND ($1::timestamptz IS NULL OR (v.submitted_at, v.id) > ($1, $2))
             ORDER BY v.submitted_at ASC, v.id ASC
             LIMIT $3",
        )
        .bind(cursor.map(|(submitted_at, _)| submitted_at))
        .bind(cursor.map(|(_, id)| id).unwrap_or(0))
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    /// Append-only review/audit history for one miniapp, newest first.
    pub async fn reviews_for_miniapp(
        &self,
        miniapp_id: &str,
        limit: i64,
    ) -> Result<Vec<ReviewRow>, MiniAppStoreError> {
        let rows = sqlx::query_as::<_, ReviewRow>(
            "SELECT * FROM reviews WHERE miniapp_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2",
        )
        .bind(miniapp_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    /// Recent client-reported lifecycle events for one miniapp, newest first.
    pub async fn install_events_for_miniapp(
        &self,
        miniapp_id: &str,
        limit: i64,
    ) -> Result<Vec<InstallEventRow>, MiniAppStoreError> {
        let rows = sqlx::query_as::<_, InstallEventRow>(
            "SELECT * FROM install_events WHERE miniapp_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2",
        )
        .bind(miniapp_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    /// Rating aggregate for one miniapp.
    pub async fn rating_summary(
        &self,
        miniapp_id: &str,
    ) -> Result<RatingSummary, MiniAppStoreError> {
        let row = sqlx::query_as::<_, RatingSummary>(
            "SELECT COALESCE(AVG(rating), 0)::float8 AS average, COUNT(*) AS count
             FROM ratings WHERE miniapp_id = $1",
        )
        .bind(miniapp_id)
        .fetch_one(&self.pool)
        .await?;
        Ok(row)
    }

    /// Set a kill switch and record the transition in the audit trail.
    pub async fn set_kill_switch(
        &self,
        scope: &str,
        enabled: bool,
        actor: &str,
        reason: Option<&str>,
    ) -> Result<KillSwitchRow, MiniAppStoreError> {
        let mut tx = self.pool.begin().await?;
        let row = sqlx::query_as::<_, KillSwitchRow>(
            "INSERT INTO kill_switches (scope, enabled, reason, actor)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (scope) DO UPDATE
             SET enabled = $2, reason = $3, actor = $4, updated_at = now()
             RETURNING *",
        )
        .bind(scope)
        .bind(enabled)
        .bind(reason)
        .bind(actor)
        .fetch_one(&mut *tx)
        .await?;
        sqlx::query(
            "INSERT INTO kill_switch_events (scope, enabled, reason, actor)
             VALUES ($1, $2, $3, $4)",
        )
        .bind(scope)
        .bind(enabled)
        .bind(reason)
        .bind(actor)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(row)
    }

    pub async fn kill_switches(&self) -> Result<Vec<KillSwitchRow>, MiniAppStoreError> {
        let rows = sqlx::query_as::<_, KillSwitchRow>("SELECT * FROM kill_switches ORDER BY scope")
            .fetch_all(&self.pool)
            .await?;
        Ok(rows)
    }

    pub async fn kill_switch_events(
        &self,
        limit: i64,
    ) -> Result<Vec<KillSwitchEventRow>, MiniAppStoreError> {
        let rows = sqlx::query_as::<_, KillSwitchEventRow>(
            "SELECT * FROM kill_switch_events ORDER BY created_at DESC, id DESC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    /// Scopes with an enabled kill switch; callers check membership for the
    /// 'marketplace' scope and individual miniapp ids.
    pub async fn enabled_kill_scopes(&self) -> Result<Vec<String>, MiniAppStoreError> {
        let rows: Vec<(String,)> = sqlx::query_as("SELECT scope FROM kill_switches WHERE enabled")
            .fetch_all(&self.pool)
            .await?;
        Ok(rows.into_iter().map(|(scope,)| scope).collect())
    }

    /// Register a publisher Ed25519 public key. Re-registering an active key
    /// is idempotent; re-registering a revoked key is rejected — rotation
    /// means registering a NEW key, never resurrecting a revoked one.
    pub async fn register_publisher_key(
        &self,
        publisher_id: &str,
        public_key: &str,
    ) -> Result<PublisherKeyRow, MiniAppStoreError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("INSERT INTO publishers (id) VALUES ($1) ON CONFLICT (id) DO NOTHING")
            .bind(publisher_id)
            .execute(&mut *tx)
            .await?;
        let fingerprint = key_fingerprint(public_key);
        let inserted = sqlx::query_as::<_, PublisherKeyRow>(
            "INSERT INTO publisher_keys (publisher_id, key_fingerprint, public_key)
             VALUES ($1, $2, $3)
             ON CONFLICT (publisher_id, key_fingerprint) DO NOTHING
             RETURNING *",
        )
        .bind(publisher_id)
        .bind(&fingerprint)
        .bind(public_key)
        .fetch_optional(&mut *tx)
        .await?;
        let row = match inserted {
            Some(row) => row,
            None => {
                let existing = sqlx::query_as::<_, PublisherKeyRow>(
                    "SELECT * FROM publisher_keys
                     WHERE publisher_id = $1 AND key_fingerprint = $2",
                )
                .bind(publisher_id)
                .bind(&fingerprint)
                .fetch_one(&mut *tx)
                .await?;
                if existing.status == "revoked" {
                    return Err(MiniAppStoreError::Conflict(
                        "this key was revoked and cannot be re-registered".into(),
                    ));
                }
                existing
            }
        };
        tx.commit().await?;
        Ok(row)
    }

    /// All signing keys of a publisher, active and revoked, newest first.
    pub async fn list_publisher_keys(
        &self,
        publisher_id: &str,
    ) -> Result<Vec<PublisherKeyRow>, MiniAppStoreError> {
        let rows = sqlx::query_as::<_, PublisherKeyRow>(
            "SELECT * FROM publisher_keys
             WHERE publisher_id = $1
             ORDER BY created_at DESC, id DESC",
        )
        .bind(publisher_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }
}

/// One entry of the reviewer work queue: a pending version with the evidence
/// summary a reviewer triages on.
#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewQueueRow {
    pub version_id: i64,
    pub miniapp_id: String,
    pub name: String,
    pub publisher_id: String,
    pub version: String,
    pub submitted_at: DateTime<Utc>,
    pub signed: bool,
    pub intake_status: Option<String>,
    pub scan_failures: i64,
    pub scan_warnings: i64,
}

/// One row of the append-only review/audit trail.
#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRow {
    pub id: i64,
    pub miniapp_id: String,
    pub version_id: Option<i64>,
    pub actor: String,
    pub action: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// One client-reported install/launch/rollback event.
#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallEventRow {
    pub id: i64,
    pub miniapp_id: String,
    pub version: String,
    pub event: String,
    pub platform: Option<String>,
    pub client_version: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct RatingSummary {
    pub average: f64,
    pub count: i64,
}

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KillSwitchRow {
    pub scope: String,
    pub enabled: bool,
    pub reason: Option<String>,
    pub actor: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KillSwitchEventRow {
    pub id: i64,
    pub scope: String,
    pub enabled: bool,
    pub reason: Option<String>,
    pub actor: String,
    pub created_at: DateTime<Utc>,
}

/// A publisher's registered Ed25519 signing key. Only public keys are ever
/// stored or returned.
#[derive(Debug, Clone, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublisherKeyRow {
    pub id: i64,
    pub publisher_id: String,
    pub key_fingerprint: String,
    pub public_key: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}
