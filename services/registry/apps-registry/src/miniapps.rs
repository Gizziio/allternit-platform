//! HTTP handlers for the `/v1/miniapps` marketplace registry API.
//!
//! Persistence lives in `miniapp_store.rs` (PostgreSQL) and object storage in
//! `asset_store.rs` (S3-compatible). These handlers only validate requests,
//! enforce bearer/admin/worker tokens, and map store errors to status codes.
//!
//! Visibility rules: the public API only ever exposes verified listings,
//! verified versions, and published assets. Reviewers (admin token) and the
//! owning publisher (bearer token) additionally see pending/rejected versions
//! and quarantined assets. Intake workers (worker token) only claim jobs and
//! report results; they never see publisher or reviewer credentials.

use axum::{
    Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::postgres::PgPool;
use std::collections::HashMap;

use crate::asset_store::{AssetStore, AssetStoreError, storage_key, validate_upload};
use crate::miniapp_store::{
    AssetRow, IntakeJobRow, ListFilter, MiniAppRow, MiniAppStore, MiniAppStoreError,
    PublisherKeyRow, REQUIRED_STAGES, ReviewAction, ScanReportRow, VersionRow, manifest_id,
};

#[derive(Clone)]
pub struct MiniAppRegistryState {
    pub(crate) store: MiniAppStore,
    pub(crate) assets: Option<AssetStore>,
    pub(crate) admin_token: String,
    pub(crate) worker_token: String,
    pub(crate) intake_enforced: bool,
}

/// Registry API representation of a listing: the version manifest flattened
/// with marketplace metadata. `submitted_at`/`reviewed_at` are unix seconds.
#[derive(Clone, Serialize)]
pub struct MiniAppListing {
    #[serde(flatten)]
    pub manifest: Value,
    pub publisher: String,
    pub status: String,
    pub version: String,
    pub submitted_at: u64,
    pub reviewed_at: Option<u64>,
    pub review_notes: Option<String>,
}

#[derive(Deserialize)]
struct ListQuery {
    status: Option<String>,
    search: Option<String>,
    limit: Option<usize>,
    cursor: Option<String>,
}

#[derive(Serialize)]
struct ListResponse {
    items: Vec<Value>,
    #[serde(rename = "nextCursor", skip_serializing_if = "Option::is_none")]
    next_cursor: Option<String>,
    /// True when the marketplace-wide emergency kill switch is enabled;
    /// clients should treat the marketplace as unavailable and must not
    /// install or update community miniapps.
    #[serde(rename = "killSwitch")]
    kill_switch: bool,
}

#[derive(Deserialize)]
struct Submission {
    manifest: Value,
}

#[derive(Deserialize)]
struct Review {
    status: String,
    notes: Option<String>,
    version: Option<String>,
    /// Reviewer identity recorded in the audit trail. Defaults to "admin";
    /// the review console sends the authenticated reviewer's identity.
    actor: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallEvent {
    version: String,
    event: String,
    platform: Option<String>,
    client_version: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Rating {
    user_id: String,
    rating: i16,
    review_text: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UploadRequest {
    kind: String,
    sha256: String,
    size: i64,
    mime: String,
    version: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompleteUpload {
    kind: String,
    sha256: String,
    size: i64,
    mime: String,
    version: Option<String>,
    storage_key: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UploadGrantResponse {
    storage_key: String,
    upload_url: String,
    headers: HashMap<String, String>,
    expires_at: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadResponse {
    download_url: String,
    expires_at: u64,
}

#[derive(Deserialize)]
struct VersionsQuery {
    status: Option<String>,
}

#[derive(Deserialize)]
struct ReleaseQuery {
    version: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VersionSummary {
    version: String,
    status: String,
    submitted_at: u64,
    changelog: Option<String>,
    signed: bool,
    /// Asset kinds registered for this version.
    assets: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReleaseAssetInfo {
    pub(crate) id: i64,
    pub(crate) kind: String,
    pub(crate) sha256: String,
    pub(crate) size_bytes: i64,
    pub(crate) mime: String,
    pub(crate) quarantined: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) download_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) expires_at: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VersionDetail {
    version: String,
    status: String,
    manifest: Value,
    publisher: String,
    signature: Option<String>,
    publisher_key: Option<String>,
    submitted_at: u64,
    changelog: Option<String>,
    assets: Vec<ReleaseAssetInfo>,
}

/// Everything the desktop installer needs to install one immutable version:
/// the manifest, its signature, and checksummed download URLs for the
/// published assets (including the release archive).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReleaseDescriptor {
    id: String,
    publisher: String,
    version: String,
    manifest: Value,
    signature: Option<String>,
    publisher_key: Option<String>,
    submitted_at: u64,
    assets: Vec<ReleaseAssetInfo>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClaimRequest {
    worker: String,
}

/// Job descriptor handed to an intake worker: the immutable version content
/// plus presigned quarantine URLs for its assets (e.g. the release archive).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct IntakeJobDescriptor {
    job_id: i64,
    miniapp_id: String,
    version: String,
    manifest: Value,
    signature: Option<String>,
    publisher_key: Option<String>,
    assets: Vec<ReleaseAssetInfo>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StageResult {
    worker: String,
    stage: String,
    scanner: String,
    status: String,
    #[serde(default)]
    summary: Value,
    report_storage_key: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FailRequest {
    worker: String,
    error: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReportUploadRequest {
    sha256: String,
    size: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct IntakeStatusResponse {
    job: Option<IntakeJobRow>,
    reports: Vec<ScanReportRow>,
}

fn valid_manifest(value: &Value) -> bool {
    manifest_id(value).is_some_and(|id| id.len() > 1 && id.len() <= 200)
        && value
            .get("name")
            .and_then(Value::as_str)
            .is_some_and(|v| !v.trim().is_empty())
        && value
            .get("description")
            .and_then(Value::as_str)
            .is_some_and(|v| !v.trim().is_empty())
        && value.get("category").and_then(Value::as_str).is_some()
}

pub(crate) fn bearer(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("authorization")?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
}

pub(crate) fn store_error_status(error: MiniAppStoreError) -> StatusCode {
    match error {
        MiniAppStoreError::NotFound => StatusCode::NOT_FOUND,
        MiniAppStoreError::Forbidden => StatusCode::FORBIDDEN,
        MiniAppStoreError::VersionConflict(_) | MiniAppStoreError::Conflict(_) => {
            StatusCode::CONFLICT
        }
        MiniAppStoreError::UnsignedRelease
        | MiniAppStoreError::NoReviewableVersion
        | MiniAppStoreError::KeyNotActive => StatusCode::UNPROCESSABLE_ENTITY,
        MiniAppStoreError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

fn asset_error_status(error: AssetStoreError) -> StatusCode {
    match error {
        AssetStoreError::Invalid(_) | AssetStoreError::VerificationFailed => {
            StatusCode::UNPROCESSABLE_ENTITY
        }
        AssetStoreError::NotFound => StatusCode::NOT_FOUND,
        AssetStoreError::Storage(_) => StatusCode::BAD_GATEWAY,
    }
}

fn listing(miniapp: &MiniAppRow, version: &VersionRow) -> MiniAppListing {
    MiniAppListing {
        manifest: version.manifest.clone(),
        publisher: miniapp.publisher_id.clone(),
        status: miniapp.status.clone(),
        version: version.version.clone(),
        submitted_at: version.submitted_at.timestamp().max(0) as u64,
        reviewed_at: miniapp.reviewed_at.map(|t| t.timestamp().max(0) as u64),
        review_notes: miniapp.review_notes.clone(),
    }
}

pub(crate) fn changelog_of(manifest: &Value) -> Option<String> {
    manifest
        .get("release")
        .and_then(|release| release.get("changelog"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

/// Admin token or the owning publisher may see non-public data (pending and
/// rejected versions, quarantined assets, intake status).
fn privileged_access(
    state: &MiniAppRegistryState,
    headers: &HeaderMap,
    miniapp: &MiniAppRow,
) -> bool {
    let token = bearer(headers);
    (!state.admin_token.is_empty() && token == Some(state.admin_token.as_str()))
        || token == Some(miniapp.publisher_id.as_str())
}

/// Intake endpoints require the shared worker token; when it is unset the
/// pipeline is disabled and they answer 503.
fn worker_authorized(state: &MiniAppRegistryState, headers: &HeaderMap) -> Result<(), StatusCode> {
    if state.worker_token.is_empty() {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    if bearer(headers) != Some(state.worker_token.as_str()) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(())
}

/// Full scan reports live under content-addressed keys in the quarantine
/// bucket; validate the shape before trusting the reference.
fn valid_report_key(key: &str) -> bool {
    let Some(hex_part) = key.strip_prefix("assets/") else {
        return false;
    };
    hex_part.len() == 64
        && hex_part.bytes().all(|b| b.is_ascii_hexdigit())
        && !hex_part.bytes().any(|b| b.is_ascii_uppercase())
}

/// Fetch the miniapp and enforce that the bearer token owns it.
async fn owned_miniapp(
    state: &MiniAppRegistryState,
    headers: &HeaderMap,
    id: &str,
) -> Result<MiniAppRow, StatusCode> {
    let publisher = bearer(headers)
        .filter(|value| !value.is_empty())
        .ok_or(StatusCode::UNAUTHORIZED)?;
    let miniapp = state
        .store
        .get_miniapp(id)
        .await
        .map_err(store_error_status)?
        .ok_or(StatusCode::NOT_FOUND)?;
    if miniapp.publisher_id != publisher {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(miniapp)
}

/// Build API asset descriptors, presigning download URLs when storage is
/// configured. Presign failures degrade to a missing URL rather than failing
/// the whole request.
pub(crate) async fn asset_infos(
    state: &MiniAppRegistryState,
    assets: Vec<AssetRow>,
) -> Vec<ReleaseAssetInfo> {
    let mut infos = Vec::with_capacity(assets.len());
    for asset in assets {
        let (download_url, expires_at) = match state.assets.as_ref() {
            Some(store) => match store
                .presign_download(&asset.storage_key, asset.quarantined)
                .await
            {
                Ok((url, expires)) => (Some(url), Some(expires)),
                Err(error) => {
                    eprintln!("failed to presign download for asset {}: {error}", asset.id);
                    (None, None)
                }
            },
            None => (None, None),
        };
        infos.push(ReleaseAssetInfo {
            id: asset.id,
            kind: asset.kind,
            sha256: asset.sha256,
            size_bytes: asset.size_bytes,
            mime: asset.mime,
            quarantined: asset.quarantined,
            download_url,
            expires_at,
        });
    }
    infos
}

/// Opaque pagination cursor: `<name byte length>:<name><id>`. The explicit
/// length keeps arbitrary manifest names and ids unambiguous.
fn encode_cursor(name: &str, id: &str) -> String {
    format!("{}:{}{}", name.len(), name, id)
}

fn decode_cursor(raw: &str) -> Option<(String, String)> {
    let (len, rest) = raw.split_once(':')?;
    let len: usize = len.parse().ok()?;
    if rest.len() < len || !rest.is_char_boundary(len) {
        return None;
    }
    let (name, id) = rest.split_at(len);
    if id.is_empty() {
        return None;
    }
    Some((name.to_string(), id.to_string()))
}

async fn list(
    State(state): State<MiniAppRegistryState>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>, StatusCode> {
    let limit = query.limit.unwrap_or(100).clamp(1, 250);
    let cursor = match query.cursor.as_deref() {
        Some(raw) => Some(decode_cursor(raw).ok_or(StatusCode::BAD_REQUEST)?),
        None => None,
    };
    let mut rows = state
        .store
        .list(ListFilter {
            status: query.status,
            search: query.search,
            cursor,
            limit: limit as i64 + 1,
        })
        .await
        .map_err(store_error_status)?;
    // Emergency kill switches: an enabled marketplace switch empties the
    // listing entirely; an enabled per-miniapp switch hides that listing.
    let killed = state
        .store
        .enabled_kill_scopes()
        .await
        .map_err(store_error_status)?;
    if killed.iter().any(|scope| scope == "marketplace") {
        return Ok(Json(ListResponse {
            items: Vec::new(),
            next_cursor: None,
            kill_switch: true,
        }));
    }
    if !killed.is_empty() {
        rows.retain(|row| !killed.iter().any(|scope| scope == &row.id));
    }
    let next_cursor = if rows.len() > limit {
        rows.truncate(limit);
        rows.last()
            .map(|row| encode_cursor(row.name.as_str(), row.id.as_str()))
    } else {
        None
    };
    let items = rows
        .into_iter()
        .filter_map(|row| {
            let mut manifest = row.manifest;
            manifest
                .as_object_mut()?
                .insert("publisher".into(), Value::String(row.publisher_id));
            Some(manifest)
        })
        .collect();
    Ok(Json(ListResponse {
        items,
        next_cursor,
        kill_switch: false,
    }))
}

async fn submit(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Json(body): Json<Submission>,
) -> Result<(StatusCode, Json<MiniAppListing>), StatusCode> {
    let publisher = bearer(&headers)
        .filter(|value| !value.is_empty())
        .ok_or(StatusCode::UNAUTHORIZED)?
        .to_string();
    if !valid_manifest(&body.manifest) {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    state
        .store
        .submit(&publisher, &body.manifest)
        .await
        .map(|(miniapp, version, created)| {
            let status = if created {
                StatusCode::CREATED
            } else {
                StatusCode::OK
            };
            (status, Json(listing(&miniapp, &version)))
        })
        .map_err(store_error_status)
}

/// Copy a newly approved version's assets from quarantine to the published
/// bucket. Best-effort: the review is already committed, so failures are
/// logged and the affected assets stay quarantined. Publication is idempotent
/// (content-addressed keys) and can be retried by re-approving.
async fn publish_version_assets(state: &MiniAppRegistryState, version_id: i64) {
    let Some(assets) = state.assets.as_ref() else {
        return;
    };
    let pending = match state.store.quarantined_assets_for_version(version_id).await {
        Ok(pending) => pending,
        Err(error) => {
            eprintln!("failed to list quarantined assets for version {version_id}: {error}");
            return;
        }
    };
    let mut published = Vec::new();
    for asset in &pending {
        match assets.publish(&asset.storage_key).await {
            Ok(()) => published.push(asset.id),
            Err(error) => eprintln!(
                "failed to publish asset {} ({}): {error}",
                asset.id, asset.storage_key
            ),
        }
    }
    if !published.is_empty() {
        if let Err(error) = state.store.mark_assets_published(&published).await {
            eprintln!("failed to mark assets published for version {version_id}: {error}");
        }
    }
}

async fn review(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<Review>,
) -> Result<Json<MiniAppListing>, StatusCode> {
    if state.admin_token.is_empty() || bearer(&headers) != Some(state.admin_token.as_str()) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let action = match body.status.as_str() {
        "verified" | "approve" => ReviewAction::Approve,
        "rejected" | "reject" => ReviewAction::Reject,
        "request_changes" => ReviewAction::RequestChanges,
        "revoke" => ReviewAction::Revoke,
        "quarantine" => ReviewAction::Quarantine,
        _ => return Err(StatusCode::UNPROCESSABLE_ENTITY),
    };
    if action == ReviewAction::Approve && state.intake_enforced {
        // With intake enforcement on, approval requires completed automated
        // pipeline evidence for the version that will be approved. The target
        // resolution mirrors the one in `MiniAppStore::review`.
        let target = match body.version.as_deref() {
            Some(requested) => state
                .store
                .get_version(&id, requested)
                .await
                .map_err(store_error_status)?,
            None => state
                .store
                .list_versions(&id, Some("pending"))
                .await
                .map_err(store_error_status)?
                .into_iter()
                .next(),
        };
        let target = target.ok_or(StatusCode::UNPROCESSABLE_ENTITY)?;
        let job = state
            .store
            .intake_job_for_version(target.id)
            .await
            .map_err(store_error_status)?;
        if !matches!(job, Some(job) if job.status == "awaiting_review") {
            return Err(StatusCode::UNPROCESSABLE_ENTITY);
        }
    }
    // The actor comes from the review request (the review console sends the
    // authenticated reviewer identity); it is attribution, not authentication
    // — the admin token above is the authorization barrier.
    let actor = body
        .actor
        .as_deref()
        .map(str::trim)
        .filter(|actor| !actor.is_empty() && actor.len() <= 200)
        .unwrap_or("admin");
    let (miniapp, version) = state
        .store
        .review(
            &id,
            actor,
            action,
            body.notes.as_deref(),
            body.version.as_deref(),
        )
        .await
        .map_err(store_error_status)?;
    let version = version.ok_or(StatusCode::UNPROCESSABLE_ENTITY)?;
    if action == ReviewAction::Approve {
        publish_version_assets(&state, version.id).await;
    }
    Ok(Json(listing(&miniapp, &version)))
}

async fn install_event(
    State(state): State<MiniAppRegistryState>,
    Path(id): Path<String>,
    Json(body): Json<InstallEvent>,
) -> Result<StatusCode, StatusCode> {
    if body.version.trim().is_empty()
        || !matches!(
            body.event.as_str(),
            "install" | "update" | "rollback" | "uninstall" | "launch"
        )
    {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    state
        .store
        .record_install_event(
            &id,
            body.version.trim(),
            &body.event,
            body.platform.as_deref(),
            body.client_version.as_deref(),
        )
        .await
        .map_err(store_error_status)?;
    Ok(StatusCode::CREATED)
}

async fn rate(
    State(state): State<MiniAppRegistryState>,
    Path(id): Path<String>,
    Json(body): Json<Rating>,
) -> Result<StatusCode, StatusCode> {
    if body.user_id.trim().is_empty() || !(1..=5).contains(&body.rating) {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    state
        .store
        .upsert_rating(
            &id,
            body.user_id.trim(),
            body.rating,
            body.review_text.as_deref(),
        )
        .await
        .map_err(store_error_status)?;
    Ok(StatusCode::CREATED)
}

async fn create_upload(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UploadRequest>,
) -> Result<(StatusCode, Json<UploadGrantResponse>), StatusCode> {
    let assets = state
        .assets
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    owned_miniapp(&state, &headers, &id).await?;
    validate_upload(&body.kind, &body.sha256, body.size, &body.mime).map_err(asset_error_status)?;
    // Assets attach to an already-submitted version; fail fast if it is missing.
    if let Some(version) = body.version.as_deref() {
        if state
            .store
            .get_version(&id, version)
            .await
            .map_err(store_error_status)?
            .is_none()
        {
            return Err(StatusCode::NOT_FOUND);
        }
    }
    let grant = assets
        .presign_upload(&body.sha256, body.size, &body.mime)
        .await
        .map_err(asset_error_status)?;
    Ok((
        StatusCode::CREATED,
        Json(UploadGrantResponse {
            storage_key: grant.storage_key,
            upload_url: grant.upload_url,
            headers: grant.headers.into_iter().collect(),
            expires_at: grant.expires_at,
        }),
    ))
}

async fn complete_upload(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<CompleteUpload>,
) -> Result<(StatusCode, Json<AssetRow>), StatusCode> {
    let assets = state
        .assets
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    owned_miniapp(&state, &headers, &id).await?;
    validate_upload(&body.kind, &body.sha256, body.size, &body.mime).map_err(asset_error_status)?;
    // The object key must be the content address; otherwise checksum
    // verification could be satisfied by an unrelated object.
    if body.storage_key != storage_key(&body.sha256) {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    let version_id = match body.version.as_deref() {
        Some(version) => Some(
            state
                .store
                .get_version(&id, version)
                .await
                .map_err(store_error_status)?
                .ok_or(StatusCode::NOT_FOUND)?
                .id,
        ),
        None => None,
    };
    assets
        .verify_upload(&body.storage_key, &body.sha256, body.size)
        .await
        .map_err(asset_error_status)?;
    let asset = state
        .store
        .upsert_release_asset(
            &id,
            version_id,
            &body.kind,
            &body.storage_key,
            &body.sha256,
            body.size,
            &body.mime,
        )
        .await
        .map_err(store_error_status)?;
    Ok((StatusCode::CREATED, Json(asset)))
}

async fn download_asset(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Path((id, asset_id)): Path<(String, i64)>,
) -> Result<Json<DownloadResponse>, StatusCode> {
    let assets = state
        .assets
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    let asset = state
        .store
        .get_asset(asset_id)
        .await
        .map_err(store_error_status)?
        .ok_or(StatusCode::NOT_FOUND)?;
    if asset.miniapp_id != id {
        return Err(StatusCode::NOT_FOUND);
    }
    let is_admin =
        !state.admin_token.is_empty() && bearer(&headers) == Some(state.admin_token.as_str());
    if asset.quarantined && !is_admin {
        // Quarantined content is only reachable by reviewers and scanners.
        return Err(StatusCode::NOT_FOUND);
    }
    let (download_url, expires_at) = assets
        .presign_download(&asset.storage_key, asset.quarantined)
        .await
        .map_err(asset_error_status)?;
    Ok(Json(DownloadResponse {
        download_url,
        expires_at,
    }))
}

async fn versions(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Query(query): Query<VersionsQuery>,
) -> Result<Json<Vec<VersionSummary>>, StatusCode> {
    let miniapp = state
        .store
        .get_miniapp(&id)
        .await
        .map_err(store_error_status)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let privileged = privileged_access(&state, &headers, &miniapp);
    if !privileged && miniapp.status != "verified" {
        return Err(StatusCode::NOT_FOUND);
    }
    let status = if privileged {
        query.status
    } else {
        Some("verified".to_string())
    };
    let version_rows = state
        .store
        .list_versions(&id, status.as_deref())
        .await
        .map_err(store_error_status)?;
    let asset_rows = state
        .store
        .assets_for_miniapp(&id)
        .await
        .map_err(store_error_status)?;
    let mut kinds_by_version: HashMap<i64, Vec<String>> = HashMap::new();
    for asset in asset_rows {
        if !privileged && asset.quarantined {
            continue;
        }
        if let Some(version_id) = asset.version_id {
            kinds_by_version
                .entry(version_id)
                .or_default()
                .push(asset.kind);
        }
    }
    let summaries = version_rows
        .into_iter()
        .map(|version| {
            let assets = kinds_by_version.remove(&version.id).unwrap_or_default();
            VersionSummary {
                version: version.version,
                status: version.status,
                submitted_at: version.submitted_at.timestamp().max(0) as u64,
                changelog: changelog_of(&version.manifest),
                signed: version.signature.is_some() && version.publisher_key.is_some(),
                assets,
            }
        })
        .collect();
    Ok(Json(summaries))
}

async fn version_detail(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Path((id, version)): Path<(String, String)>,
) -> Result<Json<VersionDetail>, StatusCode> {
    let miniapp = state
        .store
        .get_miniapp(&id)
        .await
        .map_err(store_error_status)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let privileged = privileged_access(&state, &headers, &miniapp);
    let version_row = state
        .store
        .get_version(&id, &version)
        .await
        .map_err(store_error_status)?
        .ok_or(StatusCode::NOT_FOUND)?;
    if !privileged && (miniapp.status != "verified" || version_row.status != "verified") {
        // Non-verified content is not distinguishable from absent content.
        return Err(StatusCode::NOT_FOUND);
    }
    let asset_rows = state
        .store
        .assets_for_version(version_row.id, !privileged)
        .await
        .map_err(store_error_status)?;
    let assets = asset_infos(&state, asset_rows).await;
    let changelog = changelog_of(&version_row.manifest);
    Ok(Json(VersionDetail {
        version: version_row.version,
        status: version_row.status,
        manifest: version_row.manifest,
        publisher: miniapp.publisher_id,
        signature: version_row.signature,
        publisher_key: version_row.publisher_key,
        submitted_at: version_row.submitted_at.timestamp().max(0) as u64,
        changelog,
        assets,
    }))
}

/// Public install descriptor for the desktop app. Only verified listings and
/// verified versions are served: revoked or quarantined miniapps answer 404.
async fn release(
    State(state): State<MiniAppRegistryState>,
    Path(id): Path<String>,
    Query(query): Query<ReleaseQuery>,
) -> Result<Json<ReleaseDescriptor>, StatusCode> {
    let miniapp = state
        .store
        .get_miniapp(&id)
        .await
        .map_err(store_error_status)?
        .ok_or(StatusCode::NOT_FOUND)?;
    if miniapp.status != "verified" {
        return Err(StatusCode::NOT_FOUND);
    }
    // Kill switches stop installs and updates: clients fetch this descriptor
    // before every install/update, so refusing here halts distribution even
    // for versions that remain 'verified' in the database.
    let killed = state
        .store
        .enabled_kill_scopes()
        .await
        .map_err(store_error_status)?;
    if killed
        .iter()
        .any(|scope| scope == "marketplace" || scope == &id)
    {
        return Err(StatusCode::NOT_FOUND);
    }
    let version_row = match query.version.as_deref() {
        Some(requested) => state
            .store
            .get_version(&id, requested)
            .await
            .map_err(store_error_status)?
            .ok_or(StatusCode::NOT_FOUND)?,
        None => state
            .store
            .latest_verified_version(&id)
            .await
            .map_err(store_error_status)?
            .ok_or(StatusCode::NOT_FOUND)?,
    };
    if version_row.status != "verified" {
        return Err(StatusCode::NOT_FOUND);
    }
    let asset_rows = state
        .store
        .assets_for_version(version_row.id, true)
        .await
        .map_err(store_error_status)?;
    let assets = asset_infos(&state, asset_rows).await;
    Ok(Json(ReleaseDescriptor {
        id: miniapp.id,
        publisher: miniapp.publisher_id,
        version: version_row.version,
        manifest: version_row.manifest,
        signature: version_row.signature,
        publisher_key: version_row.publisher_key,
        submitted_at: version_row.submitted_at.timestamp().max(0) as u64,
        assets,
    }))
}

/// Worker endpoint: claim the oldest queued intake job. Returns `null` when
/// the queue is empty; workers poll on an interval.
async fn claim_intake(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Json(body): Json<ClaimRequest>,
) -> Result<Json<Option<IntakeJobDescriptor>>, StatusCode> {
    worker_authorized(&state, &headers)?;
    let worker = body.worker.trim();
    if worker.is_empty() || worker.len() > 200 {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    let Some(job) = state
        .store
        .claim_intake_job(worker)
        .await
        .map_err(store_error_status)?
    else {
        return Ok(Json(None));
    };
    let version_row = state
        .store
        .get_version_by_id(job.version_id)
        .await
        .map_err(store_error_status)?
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    // Workers download the release archive from the quarantine bucket.
    let asset_rows = state
        .store
        .assets_for_version(job.version_id, false)
        .await
        .map_err(store_error_status)?;
    let assets = asset_infos(&state, asset_rows).await;
    Ok(Json(Some(IntakeJobDescriptor {
        job_id: job.id,
        miniapp_id: job.miniapp_id,
        version: version_row.version,
        manifest: version_row.manifest,
        signature: version_row.signature,
        publisher_key: version_row.publisher_key,
        assets,
    })))
}

/// Worker endpoint: report one pipeline stage result. A `fail` fails the job;
/// when every required stage has passed, the job moves to `awaiting_review`.
async fn report_intake_result(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Path(job_id): Path<i64>,
    Json(body): Json<StageResult>,
) -> Result<Json<IntakeJobRow>, StatusCode> {
    worker_authorized(&state, &headers)?;
    if !REQUIRED_STAGES.contains(&body.stage.as_str())
        || !matches!(body.status.as_str(), "pass" | "warn" | "fail")
        || body.worker.trim().is_empty()
        || body.scanner.trim().is_empty()
    {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    if body
        .report_storage_key
        .as_deref()
        .is_some_and(|key| !valid_report_key(key))
    {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    let job = state
        .store
        .report_stage_result(
            job_id,
            body.worker.trim(),
            &body.stage,
            body.scanner.trim(),
            &body.status,
            &body.summary,
            body.report_storage_key.as_deref(),
        )
        .await
        .map_err(store_error_status)?;
    Ok(Json(job))
}

/// Worker endpoint: mark the claimed job failed (worker/infra error).
async fn fail_intake(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Path(job_id): Path<i64>,
    Json(body): Json<FailRequest>,
) -> Result<Json<IntakeJobRow>, StatusCode> {
    worker_authorized(&state, &headers)?;
    if body.worker.trim().is_empty() || body.error.trim().is_empty() {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    let job = state
        .store
        .fail_intake_job(job_id, body.worker.trim(), body.error.trim())
        .await
        .map_err(store_error_status)?;
    Ok(Json(job))
}

/// Admin endpoint: return a job to the queue (worker crash, fixed scanner).
async fn requeue_intake(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Path(job_id): Path<i64>,
) -> Result<Json<IntakeJobRow>, StatusCode> {
    if state.admin_token.is_empty() || bearer(&headers) != Some(state.admin_token.as_str()) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let job = state
        .store
        .requeue_intake_job(job_id)
        .await
        .map_err(store_error_status)?;
    Ok(Json(job))
}

/// Worker endpoint: presign an upload for a full scan report body into the
/// quarantine bucket; the resulting storage key is referenced in stage results.
async fn report_upload(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Path(job_id): Path<i64>,
    Json(body): Json<ReportUploadRequest>,
) -> Result<(StatusCode, Json<UploadGrantResponse>), StatusCode> {
    worker_authorized(&state, &headers)?;
    let assets = state
        .assets
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    let job = state
        .store
        .get_intake_job(job_id)
        .await
        .map_err(store_error_status)?
        .ok_or(StatusCode::NOT_FOUND)?;
    if job.status != "claimed" {
        return Err(StatusCode::CONFLICT);
    }
    validate_upload("scan_report", &body.sha256, body.size, "application/json")
        .map_err(asset_error_status)?;
    let grant = assets
        .presign_upload(&body.sha256, body.size, "application/json")
        .await
        .map_err(asset_error_status)?;
    Ok((
        StatusCode::CREATED,
        Json(UploadGrantResponse {
            storage_key: grant.storage_key,
            upload_url: grant.upload_url,
            headers: grant.headers.into_iter().collect(),
            expires_at: grant.expires_at,
        }),
    ))
}

/// Publisher/reviewer endpoint: intake job state and scan evidence for a
/// version. This is the submission-status tracking surface.
async fn intake_status(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Path((id, version)): Path<(String, String)>,
) -> Result<Json<IntakeStatusResponse>, StatusCode> {
    let miniapp = state
        .store
        .get_miniapp(&id)
        .await
        .map_err(store_error_status)?
        .ok_or(StatusCode::NOT_FOUND)?;
    if !privileged_access(&state, &headers, &miniapp) {
        return Err(StatusCode::FORBIDDEN);
    }
    let version_row = state
        .store
        .get_version(&id, &version)
        .await
        .map_err(store_error_status)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let job = state
        .store
        .intake_job_for_version(version_row.id)
        .await
        .map_err(store_error_status)?;
    let reports = state
        .store
        .scan_reports_for_version(version_row.id)
        .await
        .map_err(store_error_status)?;
    Ok(Json(IntakeStatusResponse { job, reports }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterKey {
    public_key: String,
}

/// Ed25519 public keys are 32 bytes, base64-encoded (standard or URL-safe).
fn valid_ed25519_public_key(value: &str) -> bool {
    use base64::{Engine as _, engine::general_purpose};
    let trimmed = value.trim();
    if trimmed.len() > 128 {
        return false;
    }
    for decoded in [
        general_purpose::STANDARD.decode(trimmed),
        general_purpose::URL_SAFE.decode(trimmed),
        general_purpose::URL_SAFE_NO_PAD.decode(trimmed),
    ] {
        if let Ok(bytes) = decoded {
            return bytes.len() == 32;
        }
    }
    false
}

/// Register a publisher signing key. Idempotent for active keys; a revoked
/// key can never be re-registered (409).
async fn register_key(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Json(body): Json<RegisterKey>,
) -> Result<Json<PublisherKeyRow>, StatusCode> {
    let publisher = bearer(&headers)
        .filter(|value| !value.is_empty())
        .ok_or(StatusCode::UNAUTHORIZED)?;
    if !valid_ed25519_public_key(&body.public_key) {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    state
        .store
        .register_publisher_key(publisher, body.public_key.trim())
        .await
        .map(Json)
        .map_err(store_error_status)
}

async fn list_keys(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
) -> Result<Json<Vec<PublisherKeyRow>>, StatusCode> {
    let publisher = bearer(&headers)
        .filter(|value| !value.is_empty())
        .ok_or(StatusCode::UNAUTHORIZED)?;
    state
        .store
        .list_publisher_keys(publisher)
        .await
        .map(Json)
        .map_err(store_error_status)
}

async fn revoke_key(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Path(fingerprint): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let publisher = bearer(&headers)
        .filter(|value| !value.is_empty())
        .ok_or(StatusCode::UNAUTHORIZED)?;
    if fingerprint.len() != 64 || !fingerprint.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    match state
        .store
        .revoke_publisher_key(publisher, &fingerprint)
        .await
        .map_err(store_error_status)?
    {
        true => Ok(StatusCode::NO_CONTENT),
        false => Err(StatusCode::NOT_FOUND),
    }
}

pub fn router(pool: PgPool, assets: Option<AssetStore>) -> Router {
    let state = MiniAppRegistryState {
        store: MiniAppStore::new(pool),
        assets,
        admin_token: std::env::var("MINIAPP_REGISTRY_ADMIN_TOKEN").unwrap_or_default(),
        worker_token: std::env::var("MINIAPP_INTAKE_WORKER_TOKEN").unwrap_or_default(),
        // Set MINIAPP_INTAKE_ENFORCE=1 in production so approvals require the
        // automated pipeline to have completed (job in awaiting_review).
        intake_enforced: std::env::var("MINIAPP_INTAKE_ENFORCE")
            .is_ok_and(|v| matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes")),
    };
    Router::new()
        .route("/v1/miniapps", get(list))
        .route("/v1/miniapps/submissions", post(submit))
        .route("/v1/publishers/keys", post(register_key))
        .route("/v1/publishers/keys", get(list_keys))
        .route("/v1/publishers/keys/:fingerprint/revoke", post(revoke_key))
        .route("/v1/miniapps/:id/review", post(review))
        .route("/v1/miniapps/:id/install-events", post(install_event))
        .route("/v1/miniapps/:id/ratings", post(rate))
        .route("/v1/miniapps/:id/uploads", post(create_upload))
        .route("/v1/miniapps/:id/uploads/complete", post(complete_upload))
        .route(
            "/v1/miniapps/:id/assets/:asset_id/download",
            get(download_asset),
        )
        .route("/v1/miniapps/:id/versions", get(versions))
        .route("/v1/miniapps/:id/versions/:version", get(version_detail))
        .route(
            "/v1/miniapps/:id/versions/:version/intake",
            get(intake_status),
        )
        .route("/v1/miniapps/:id/release", get(release))
        .route("/v1/intake/jobs/claim", post(claim_intake))
        .route(
            "/v1/intake/jobs/:job_id/results",
            post(report_intake_result),
        )
        .route("/v1/intake/jobs/:job_id/fail", post(fail_intake))
        .route("/v1/intake/jobs/:job_id/requeue", post(requeue_intake))
        .route("/v1/intake/jobs/:job_id/report-upload", post(report_upload))
        .merge(crate::miniapp_admin::routes())
        .with_state(state)
}
