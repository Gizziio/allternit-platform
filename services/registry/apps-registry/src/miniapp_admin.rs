//! Review administration API (`/v1/admin/…`).
//!
//! Internal endpoints backing the reviewer console. Every route requires the
//! admin bearer token; there is no public access. The detail endpoint returns
//! both the candidate and the previously verified manifest verbatim so the
//! console (and any other tooling) can compute and cross-check diffs itself —
//! the registry stores evidence, it does not summarize it away.
//!
//! Kill switches provide the emergency stop: while a scope is enabled, the
//! public listing hides affected entries and the release endpoint refuses to
//! serve install descriptors (enforced in `miniapps.rs`).

use axum::{
    Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::miniapp_store::{
    InstallEventRow, IntakeJobRow, KillSwitchEventRow, KillSwitchRow, RatingSummary,
    ReviewQueueRow, ReviewRow, ScanReportRow, VersionRow, key_fingerprint,
};
use crate::miniapps::{
    MiniAppRegistryState, ReleaseAssetInfo, asset_infos, bearer, changelog_of, store_error_status,
};

#[derive(Deserialize)]
pub(crate) struct QueueQuery {
    limit: Option<usize>,
    cursor: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct QueueResponse {
    items: Vec<ReviewQueueRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    next_cursor: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct DetailQuery {
    version: Option<String>,
}

/// One scan report plus a presigned URL to its full stored payload.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScanReportInfo {
    #[serde(flatten)]
    report: ScanReportRow,
    #[serde(skip_serializing_if = "Option::is_none")]
    download_url: Option<String>,
}

/// Version block of the review detail: the manifest under review.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReviewVersionInfo {
    version: String,
    status: String,
    manifest: Value,
    signature: Option<String>,
    publisher_key: Option<String>,
    publisher_key_fingerprint: Option<String>,
    submitted_at: u64,
    changelog: Option<String>,
}

/// Everything the review console renders for one decision: candidate and
/// previous-verified manifests, pipeline evidence, assets, audit history,
/// install telemetry, and the kill-switch state.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReviewDetail {
    miniapp_id: String,
    name: String,
    publisher: String,
    status: String,
    review_notes: Option<String>,
    reviewed_at: Option<u64>,
    reviewed_by: Option<String>,
    candidate: ReviewVersionInfo,
    previous_verified: Option<ReviewVersionInfo>,
    intake_job: Option<IntakeJobRow>,
    scan_reports: Vec<ScanReportInfo>,
    assets: Vec<ReleaseAssetInfo>,
    reviews: Vec<ReviewRow>,
    install_events: Vec<InstallEventRow>,
    rating: RatingSummary,
    kill_switched: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct KillSwitchRequest {
    /// "marketplace" or a miniapp id.
    scope: String,
    enabled: bool,
    reason: Option<String>,
    actor: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct KillSwitchState {
    switches: Vec<KillSwitchRow>,
    events: Vec<KillSwitchEventRow>,
}

fn admin_authorized(state: &MiniAppRegistryState, headers: &HeaderMap) -> Result<(), StatusCode> {
    if state.admin_token.is_empty() || bearer(headers) != Some(state.admin_token.as_str()) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(())
}

/// Queue cursor: `<submitted_at millis>:<version_id>`.
fn encode_queue_cursor(submitted_at: DateTime<Utc>, version_id: i64) -> String {
    format!("{}:{}", submitted_at.timestamp_millis(), version_id)
}

fn decode_queue_cursor(raw: &str) -> Option<(DateTime<Utc>, i64)> {
    let (millis, id) = raw.split_once(':')?;
    let millis: i64 = millis.parse().ok()?;
    let id: i64 = id.parse().ok()?;
    Some((DateTime::from_timestamp_millis(millis)?, id))
}

async fn review_queue(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Query(query): Query<QueueQuery>,
) -> Result<Json<QueueResponse>, StatusCode> {
    admin_authorized(&state, &headers)?;
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let cursor = match query.cursor.as_deref() {
        Some(raw) => Some(decode_queue_cursor(raw).ok_or(StatusCode::BAD_REQUEST)?),
        None => None,
    };
    let mut rows = state
        .store
        .review_queue(cursor, limit as i64 + 1)
        .await
        .map_err(store_error_status)?;
    let next_cursor = if rows.len() > limit {
        rows.truncate(limit);
        rows.last()
            .map(|row| encode_queue_cursor(row.submitted_at, row.version_id))
    } else {
        None
    };
    Ok(Json(QueueResponse {
        items: rows,
        next_cursor,
    }))
}

fn version_info(row: &VersionRow) -> ReviewVersionInfo {
    ReviewVersionInfo {
        version: row.version.clone(),
        status: row.status.clone(),
        manifest: row.manifest.clone(),
        signature: row.signature.clone(),
        publisher_key: row.publisher_key.clone(),
        publisher_key_fingerprint: row.publisher_key.as_deref().map(key_fingerprint),
        submitted_at: row.submitted_at.timestamp().max(0) as u64,
        changelog: changelog_of(&row.manifest),
    }
}

async fn review_detail(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Query(query): Query<DetailQuery>,
) -> Result<Json<ReviewDetail>, StatusCode> {
    admin_authorized(&state, &headers)?;
    let miniapp = state
        .store
        .get_miniapp(&id)
        .await
        .map_err(store_error_status)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Candidate: the requested version, else the newest pending one.
    let candidate = match query.version.as_deref() {
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
    }
    .ok_or(StatusCode::NOT_FOUND)?;

    let previous_verified = state
        .store
        .latest_verified_version(&id)
        .await
        .map_err(store_error_status)?
        .filter(|row| row.id != candidate.id);

    let intake_job = state
        .store
        .intake_job_for_version(candidate.id)
        .await
        .map_err(store_error_status)?;

    let reports = state
        .store
        .scan_reports_for_version(candidate.id)
        .await
        .map_err(store_error_status)?;
    let mut scan_reports = Vec::with_capacity(reports.len());
    for report in reports {
        let download_url = match (&report.storage_key, state.assets.as_ref()) {
            (Some(key), Some(assets)) => match assets.presign_download(key, true).await {
                Ok((url, _)) => Some(url),
                Err(error) => {
                    eprintln!("failed to presign scan report {}: {error}", report.id);
                    None
                }
            },
            _ => None,
        };
        scan_reports.push(ScanReportInfo {
            report,
            download_url,
        });
    }

    let asset_rows = state
        .store
        .assets_for_version(candidate.id, false)
        .await
        .map_err(store_error_status)?;
    let assets = asset_infos(&state, asset_rows).await;

    let reviews = state
        .store
        .reviews_for_miniapp(&id, 50)
        .await
        .map_err(store_error_status)?;
    let install_events = state
        .store
        .install_events_for_miniapp(&id, 50)
        .await
        .map_err(store_error_status)?;
    let rating = state
        .store
        .rating_summary(&id)
        .await
        .map_err(store_error_status)?;
    let killed = state
        .store
        .enabled_kill_scopes()
        .await
        .map_err(store_error_status)?;

    Ok(Json(ReviewDetail {
        miniapp_id: miniapp.id,
        name: miniapp.name,
        publisher: miniapp.publisher_id,
        status: miniapp.status,
        review_notes: miniapp.review_notes,
        reviewed_at: miniapp.reviewed_at.map(|t| t.timestamp().max(0) as u64),
        reviewed_by: miniapp.reviewed_by,
        candidate: version_info(&candidate),
        previous_verified: previous_verified.as_ref().map(version_info),
        intake_job,
        scan_reports,
        assets,
        reviews,
        install_events,
        rating,
        kill_switched: killed.iter().any(|scope| scope == &id),
    }))
}

async fn get_kill_switches(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
) -> Result<Json<KillSwitchState>, StatusCode> {
    admin_authorized(&state, &headers)?;
    let switches = state
        .store
        .kill_switches()
        .await
        .map_err(store_error_status)?;
    let events = state
        .store
        .kill_switch_events(50)
        .await
        .map_err(store_error_status)?;
    Ok(Json(KillSwitchState { switches, events }))
}

async fn set_kill_switch(
    State(state): State<MiniAppRegistryState>,
    headers: HeaderMap,
    Json(body): Json<KillSwitchRequest>,
) -> Result<Json<KillSwitchRow>, StatusCode> {
    admin_authorized(&state, &headers)?;
    let scope = body.scope.trim();
    if scope.is_empty() || scope.len() > 200 {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    if scope != "marketplace" {
        // Per-miniapp switches must name an existing miniapp so typos cannot
        // create a false sense of safety.
        state
            .store
            .get_miniapp(scope)
            .await
            .map_err(store_error_status)?
            .ok_or(StatusCode::NOT_FOUND)?;
    }
    let actor = body
        .actor
        .as_deref()
        .map(str::trim)
        .filter(|actor| !actor.is_empty() && actor.len() <= 200)
        .unwrap_or("admin");
    let row = state
        .store
        .set_kill_switch(scope, body.enabled, actor, body.reason.as_deref())
        .await
        .map_err(store_error_status)?;
    Ok(Json(row))
}

/// Routes merged into the miniapps router before `.with_state(...)`.
pub(crate) fn routes() -> Router<MiniAppRegistryState> {
    Router::new()
        .route("/v1/admin/review-queue", get(review_queue))
        .route("/v1/admin/miniapps/:id/review-detail", get(review_detail))
        .route("/v1/admin/kill-switches", get(get_kill_switches))
        .route("/v1/admin/kill-switches", post(set_kill_switch))
}
