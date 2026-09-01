//! Fabric admin dashboard routes.
//!
//! Mounted under `/api/v1` so admin paths land at
//! `/api/v1/admin/fabric/resources`, `/api/v1/admin/fabric/placements`, and
//! `/api/v1/admin/fabric/usage`. These routes require organization admin role.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use std::str::FromStr;
use std::sync::Arc;

use crate::{
    auth::AuthUser,
    fabric::{
        resources::{FabricPlacementSummary, FabricResource, FabricUsageEvent, ResourceManager},
        sku::ResourceClass,
    },
    AppState,
};
use allternit_computer_cloud::fabric::{ReliabilityTier, ResourceKind};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/admin/fabric/resources", get(list_resources))
        .route("/admin/fabric/placements", get(list_placements))
        .route("/admin/fabric/usage", get(list_usage))
        .route("/admin/fabric/resource-classes", post(create_resource_class))
        .route("/admin/fabric/resource-classes/:id", put(update_resource_class))
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    body: Json<Value>,
}

impl ApiError {
    fn new(status: StatusCode, code: &str, message: impl Into<String>) -> Self {
        Self {
            status,
            body: Json(json!({"error": code, "message": message.into()})),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, self.body).into_response()
    }
}

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    ApiError::new(status, code, message)
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "fabric admin operation failed");
    ApiError::new(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        err.to_string(),
    )
}

fn require_org(user: &AuthUser) -> Result<String, ApiError> {
    user.organization_id.clone().ok_or_else(|| {
        error(
            StatusCode::FORBIDDEN,
            "organization_required",
            "An active organization is required.",
        )
    })
}

fn require_org_admin(conn: &rusqlite::Connection, user: &AuthUser) -> Result<String, ApiError> {
    let org = require_org(user)?;
    if !crate::rbac::is_org_admin(conn, &org, &user.user_id).map_err(internal)? {
        return Err(error(
            StatusCode::FORBIDDEN,
            "insufficient_role",
            "Only organization owners/admins can view Fabric admin data.",
        ));
    }
    Ok(org)
}

#[derive(Debug, Deserialize)]
struct ListResourcesQuery {
    #[serde(default = "default_limit")]
    limit: usize,
    #[serde(default)]
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ListPlacementsQuery {
    #[serde(default = "default_limit")]
    limit: usize,
    #[serde(default)]
    resource_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ListUsageQuery {
    #[serde(default = "default_limit")]
    limit: usize,
    #[serde(default)]
    resource_id: Option<String>,
}

fn default_limit() -> usize {
    100
}

#[derive(Debug, Deserialize)]
struct CreateResourceClassRequest {
    #[serde(default)]
    id: Option<String>,
    kind: String,
    class: String,
    display_name: String,
    vcpu: u32,
    memory_mib: u64,
    gpu_vram_mib: u64,
    reliability_tier: String,
    retail_price_per_hour_cents: i64,
    #[serde(default)]
    retail_price_per_request_cents: i64,
    #[serde(default)]
    retail_price_per_token_cents: i64,
}

#[derive(Debug, Deserialize)]
struct UpdateResourceClassRequest {
    kind: String,
    class: String,
    display_name: String,
    vcpu: u32,
    memory_mib: u64,
    gpu_vram_mib: u64,
    reliability_tier: String,
    retail_price_per_hour_cents: i64,
    #[serde(default)]
    retail_price_per_request_cents: i64,
    #[serde(default)]
    retail_price_per_token_cents: i64,
}

fn parse_kind(kind: &str) -> Result<ResourceKind, ApiError> {
    ResourceKind::from_str(kind).map_err(|e| {
        error(StatusCode::BAD_REQUEST, "invalid_kind", format!("Invalid resource kind '{kind}': {e}"))
    })
}

fn parse_tier(tier: &str) -> Result<ReliabilityTier, ApiError> {
    ReliabilityTier::from_str(tier).map_err(|e| {
        error(StatusCode::BAD_REQUEST, "invalid_reliability_tier", format!("Invalid reliability tier '{tier}': {e}"))
    })
}

fn validate_class_request(
    kind: &str,
    class: &str,
    display_name: &str,
    reliability_tier: &str,
) -> Result<(ResourceKind, ReliabilityTier), ApiError> {
    if class.is_empty() {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "class_required",
            "Resource class identifier is required.",
        ));
    }
    if display_name.is_empty() {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "display_name_required",
            "Display name is required.",
        ));
    }
    let kind = parse_kind(kind)?;
    let tier = parse_tier(reliability_tier)?;
    Ok((kind, tier))
}

fn resource_class_json(class: &ResourceClass) -> Value {
    json!({
        "id": class.id,
        "kind": class.kind.to_string(),
        "class": class.class,
        "display_name": class.display_name,
        "vcpu": class.vcpu,
        "memory_mib": class.memory_mib,
        "gpu_vram_mib": class.gpu_vram_mib,
        "reliability_tier": class.reliability_tier.to_string(),
        "retail_price_per_hour_cents": class.retail_price_per_hour_cents,
        "retail_price_per_request_cents": class.retail_price_per_request_cents,
        "retail_price_per_token_cents": class.retail_price_per_token_cents,
    })
}

async fn create_resource_class(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<CreateResourceClassRequest>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    let catalog = state.resource_class_catalog.clone();
    let user_for_admin = user.clone();

    let class = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal)?;
        require_org_admin(&conn, &user_for_admin)?;

        let (kind, reliability_tier) = validate_class_request(
            &req.kind,
            &req.class,
            &req.display_name,
            &req.reliability_tier,
        )?;

        let id = req.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let full_class = format!("{}.{}", kind, req.class);
        if catalog.get(&full_class).is_some() {
            return Err(error(
                StatusCode::CONFLICT,
                "class_already_exists",
                format!("Resource class {full_class} already exists."),
            ));
        }

        let class = ResourceClass {
            id,
            kind,
            class: req.class,
            display_name: req.display_name,
            vcpu: req.vcpu,
            memory_mib: req.memory_mib,
            gpu_vram_mib: req.gpu_vram_mib,
            reliability_tier,
            retail_price_per_hour_cents: req.retail_price_per_hour_cents,
            retail_price_per_request_cents: req.retail_price_per_request_cents,
            retail_price_per_token_cents: req.retail_price_per_token_cents,
        };

        catalog.upsert_class(&db, class).map_err(internal)
    })
    .await
    .map_err(internal)??;

    Ok(Json(json!({ "class": resource_class_json(&class) })))
}

async fn update_resource_class(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(req): Json<UpdateResourceClassRequest>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    let catalog = state.resource_class_catalog.clone();
    let user_for_admin = user.clone();

    let class = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal)?;
        require_org_admin(&conn, &user_for_admin)?;

        let existing = catalog.classes().into_iter().find(|c| c.id == id).ok_or_else(|| {
            error(StatusCode::NOT_FOUND, "class_not_found", "Resource class not found.")
        })?;

        let (kind, reliability_tier) = validate_class_request(
            &req.kind,
            &req.class,
            &req.display_name,
            &req.reliability_tier,
        )?;

        let new_full_class = format!("{}.{}", kind, req.class);
        if new_full_class != existing.full_class()
            && catalog.get(&new_full_class).is_some()
        {
            return Err(error(
                StatusCode::CONFLICT,
                "class_already_exists",
                format!("Resource class {new_full_class} already exists."),
            ));
        }

        let class = ResourceClass {
            id,
            kind,
            class: req.class,
            display_name: req.display_name,
            vcpu: req.vcpu,
            memory_mib: req.memory_mib,
            gpu_vram_mib: req.gpu_vram_mib,
            reliability_tier,
            retail_price_per_hour_cents: req.retail_price_per_hour_cents,
            retail_price_per_request_cents: req.retail_price_per_request_cents,
            retail_price_per_token_cents: req.retail_price_per_token_cents,
        };

        catalog.upsert_class(&db, class).map_err(internal)
    })
    .await
    .map_err(internal)??;

    Ok(Json(json!({ "class": resource_class_json(&class) })))
}

async fn list_resources(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListResourcesQuery>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    let user_for_admin = user.clone();
    let status = query.status;
    let limit = query.limit;

    let resources = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal)?;
        let org = require_org_admin(&conn, &user_for_admin)?;
        let manager = ResourceManager::new(db);
        manager
            .list_resources(&org, status.as_deref(), limit)
            .map_err(internal)
    })
    .await
    .map_err(internal)??;

    Ok(Json(json!({
        "resources": resources.iter().map(resource_json).collect::<Vec<_>>(),
    })))
}

async fn list_placements(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListPlacementsQuery>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    let user_for_admin = user.clone();
    let resource_id = query.resource_id;
    let limit = query.limit;

    let placements = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal)?;
        let org = require_org_admin(&conn, &user_for_admin)?;
        let manager = ResourceManager::new(db);
        manager
            .list_placements(&org, resource_id.as_deref(), limit)
            .map_err(internal)
    })
    .await
    .map_err(internal)??;

    Ok(Json(json!({
        "placements": placements.iter().map(placement_json).collect::<Vec<_>>(),
    })))
}

async fn list_usage(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListUsageQuery>,
) -> Result<Json<Value>, ApiError> {
    let db = state.db.clone();
    let user_for_admin = user.clone();
    let resource_id = query.resource_id;
    let limit = query.limit;

    let events = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal)?;
        let org = require_org_admin(&conn, &user_for_admin)?;
        let manager = ResourceManager::new(db);
        manager
            .list_usage_events(&org, resource_id.as_deref(), limit)
            .map_err(internal)
    })
    .await
    .map_err(internal)??;

    Ok(Json(json!({
        "usage_events": events.iter().map(usage_event_json).collect::<Vec<_>>(),
    })))
}

fn resource_json(resource: &FabricResource) -> Value {
    json!({
        "id": resource.id,
        "organization_id": resource.organization_id,
        "kind": resource.kind,
        "class": resource.class,
        "display_name": resource.display_name,
        "status": resource.status,
        "provider_kind": resource.provider_kind,
        "provider_resource_id": resource.provider_resource_id,
        "region": resource.region,
        "requested_at": resource.requested_at.to_rfc3339(),
        "provisioned_at": resource.provisioned_at.map(|d| d.to_rfc3339()),
        "terminated_at": resource.terminated_at.map(|d| d.to_rfc3339()),
    })
}

fn placement_json(placement: &FabricPlacementSummary) -> Value {
    fn cents(maybe: &Option<allternitos_cloud_contracts::Money>) -> Option<i64> {
        maybe.as_ref().map(|m| m.minor_units as i64)
    }
    json!({
        "id": placement.id,
        "resource_id": placement.resource_id,
        "provider_kind": placement.provider_kind,
        "provider_resource_id": placement.provider_resource_id,
        "offer_id": placement.offer_id,
        "instance_type": placement.instance_type,
        "region": placement.region,
        "node_id": placement.node_id,
        "ipv4": placement.ipv4,
        "endpoint": placement.endpoint,
        "retail_price_per_hour_cents": cents(&placement.retail_price_per_hour),
        "provider_cost_per_hour_cents": cents(&placement.provider_cost_per_hour),
        "retail_price_per_request_cents": cents(&placement.retail_price_per_request),
        "provider_cost_per_request_cents": cents(&placement.provider_cost_per_request),
        "retail_price_per_token_cents": cents(&placement.retail_price_per_token),
        "provider_cost_per_token_cents": cents(&placement.provider_cost_per_token),
        "status": placement.status,
        "started_at": placement.started_at.to_rfc3339(),
        "ended_at": placement.ended_at.map(|d| d.to_rfc3339()),
        "termination_reason": placement.termination_reason,
    })
}

fn usage_event_json(event: &FabricUsageEvent) -> Value {
    serde_json::to_value(event).unwrap_or_else(|_| json!(null))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use serde_json::Value;
    use tower::ServiceExt;

    fn seed_org_user_role(
        state: &AppState,
        org_id: &str,
        user_id: &str,
        role: &str,
    ) -> AuthUser {
        let conn = state.db.connect().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name, status) VALUES (?1, ?2, 'active')",
            rusqlite::params![org_id, "Test Org"],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email) VALUES (?1, ?2)",
            rusqlite::params![user_id, format!("{user_id}@test.com")],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organization_members (id, organization_id, user_id, role)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![format!("{org_id}-{user_id}"), org_id, user_id, role],
        )
        .unwrap();
        AuthUser {
            user_id: user_id.to_string(),
            organization_id: Some(org_id.to_string()),
            email: Some(format!("{user_id}@test.com")),
            organization_role: Some(role.to_string()),
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_slug: None,
        }
    }

    fn seed_resource(state: &AppState, resource_id: &str, org_id: &str, status: &str) {
        let conn = state.db.connect().unwrap();
        conn.execute(
            "INSERT INTO fabric_resources
             (id, organization_id, kind, class, status, requested_at)
             VALUES (?1, ?2, 'compute', 's', ?3, ?4)",
            rusqlite::params![resource_id, org_id, status, Utc::now().to_rfc3339()],
        )
        .unwrap();
    }

    fn seed_placement(state: &AppState, resource_id: &str, provider_resource_id: &str) {
        let conn = state.db.connect().unwrap();
        conn.execute(
            "INSERT INTO fabric_placements
             (id, resource_id, provider_kind, provider_resource_id, offer_id, instance_type, region,
              retail_price_per_hour_cents, provider_cost_per_hour_cents,
              retail_price_per_request_cents, provider_cost_per_request_cents,
              retail_price_per_token_cents, provider_cost_per_token_cents, started_at)
             VALUES (?1, ?2, 'fake', ?3, 'off_fake_test', 'fake-cpu-small', 'us-east', 5, 3, 0, 0, 0, 0, ?4)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                resource_id,
                provider_resource_id,
                Utc::now().to_rfc3339()
            ],
        )
        .unwrap();
    }

    fn seed_usage_event(state: &AppState, resource_id: &str, event_type: &str, quantity: f64) {
        let conn = state.db.connect().unwrap();
        conn.execute(
            "INSERT INTO fabric_usage_events
             (id, resource_id, event_type, quantity, unit, measured_at)
             VALUES (?1, ?2, ?3, ?4, 'seconds', ?5)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                resource_id,
                event_type,
                quantity,
                Utc::now().to_rfc3339()
            ],
        )
        .unwrap();
    }

    async fn body_json(body: Body) -> Value {
        let bytes = body.collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap_or_else(|_| Value::Null)
    }

    fn build_request(method: &str, uri: &str, user: AuthUser) -> Request<Body> {
        Request::builder()
            .method(method)
            .uri(uri)
            .extension(user)
            .header("content-type", "application/json")
            .body(Body::empty())
            .unwrap()
    }

    fn build_request_with_body(
        method: &str,
        uri: &str,
        user: AuthUser,
        body: Value,
    ) -> Request<Body> {
        Request::builder()
            .method(method)
            .uri(uri)
            .extension(user)
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap()
    }

    #[tokio::test]
    async fn list_resources_requires_admin() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let user = seed_org_user_role(&state, "org-1", "user-1", "member");

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request(
                "GET",
                "/admin/fabric/resources",
                user,
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn list_resources_returns_org_resources() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let admin = seed_org_user_role(&state, "org-1", "admin-1", "owner");
        seed_org_user_role(&state, "org-2", "admin-2", "owner");
        seed_resource(&state, "res-1", "org-1", "active");
        seed_resource(&state, "res-2", "org-2", "active");

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request(
                "GET",
                "/admin/fabric/resources",
                admin,
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        let resources = body["resources"].as_array().unwrap();
        assert_eq!(resources.len(), 1);
        assert_eq!(resources[0]["id"], "res-1");
    }

    #[tokio::test]
    async fn list_resources_filters_by_status() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let admin = seed_org_user_role(&state, "org-1", "admin-1", "owner");
        seed_resource(&state, "res-1", "org-1", "active");
        seed_resource(&state, "res-2", "org-1", "terminated");

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request(
                "GET",
                "/admin/fabric/resources?status=active",
                admin,
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        let resources = body["resources"].as_array().unwrap();
        assert_eq!(resources.len(), 1);
        assert_eq!(resources[0]["status"], "active");
    }

    #[tokio::test]
    async fn list_placements_returns_org_placements() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let admin = seed_org_user_role(&state, "org-1", "admin-1", "owner");
        seed_resource(&state, "res-1", "org-1", "active");
        seed_placement(&state, "res-1", "fake-1");

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request(
                "GET",
                "/admin/fabric/placements",
                admin,
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        let placements = body["placements"].as_array().unwrap();
        assert_eq!(placements.len(), 1);
        assert_eq!(placements[0]["provider_resource_id"], "fake-1");
    }

    #[tokio::test]
    async fn list_placements_filters_by_resource_id() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let admin = seed_org_user_role(&state, "org-1", "admin-1", "owner");
        seed_resource(&state, "res-1", "org-1", "active");
        seed_resource(&state, "res-2", "org-1", "active");
        seed_placement(&state, "res-1", "fake-1");
        seed_placement(&state, "res-2", "fake-2");

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request(
                "GET",
                "/admin/fabric/placements?resource_id=res-1",
                admin,
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        let placements = body["placements"].as_array().unwrap();
        assert_eq!(placements.len(), 1);
        assert_eq!(placements[0]["provider_resource_id"], "fake-1");
    }

    #[tokio::test]
    async fn list_usage_returns_org_events() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let admin = seed_org_user_role(&state, "org-1", "admin-1", "owner");
        seed_resource(&state, "res-1", "org-1", "active");
        seed_usage_event(&state, "res-1", "compute_seconds", 60.0);

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request(
                "GET",
                "/admin/fabric/usage",
                admin,
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        let events = body["usage_events"].as_array().unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["event_type"], "compute_seconds");
    }

    #[tokio::test]
    async fn create_resource_class_requires_admin() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let user = seed_org_user_role(&state, "org-1", "user-1", "member");

        let body = json!({
            "kind": "compute",
            "class": "xl",
            "display_name": "Compute XL",
            "vcpu": 16,
            "memory_mib": 32768,
            "gpu_vram_mib": 0,
            "reliability_tier": "standard",
            "retail_price_per_hour_cents": 99,
        });

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request_with_body(
                "POST",
                "/admin/fabric/resource-classes",
                user,
                body,
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn create_resource_class_admin_succeeds_and_updates_catalog() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let admin = seed_org_user_role(&state, "org-1", "admin-1", "owner");

        let body = json!({
            "id": "compute.xl",
            "kind": "compute",
            "class": "xl",
            "display_name": "Compute XL",
            "vcpu": 16,
            "memory_mib": 32768,
            "gpu_vram_mib": 0,
            "reliability_tier": "premium",
            "retail_price_per_hour_cents": 99,
        });

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request_with_body(
                "POST",
                "/admin/fabric/resource-classes",
                admin,
                body,
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let response = body_json(resp.into_body()).await;
        let class = &response["class"];
        assert_eq!(class["id"], "compute.xl");
        assert_eq!(class["kind"], "compute");
        assert_eq!(class["class"], "xl");
        assert_eq!(class["reliability_tier"], "premium");
        assert_eq!(class["retail_price_per_hour_cents"], 99);

        // Catalog is refreshed in-memory.
        assert!(state.resource_class_catalog.get("compute.xl").is_some());
    }

    #[tokio::test]
    async fn create_resource_class_rejects_invalid_kind() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let admin = seed_org_user_role(&state, "org-1", "admin-1", "owner");

        let body = json!({
            "kind": "unknown",
            "class": "xl",
            "display_name": "Compute XL",
            "vcpu": 16,
            "memory_mib": 32768,
            "gpu_vram_mib": 0,
            "reliability_tier": "standard",
            "retail_price_per_hour_cents": 99,
        });

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request_with_body(
                "POST",
                "/admin/fabric/resource-classes",
                admin,
                body,
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn create_resource_class_rejects_duplicate_class() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let admin = seed_org_user_role(&state, "org-1", "admin-1", "owner");

        let body = json!({
            "id": "compute.s2",
            "kind": "compute",
            "class": "s",
            "display_name": "Duplicate Compute S",
            "vcpu": 4,
            "memory_mib": 8192,
            "gpu_vram_mib": 0,
            "reliability_tier": "standard",
            "retail_price_per_hour_cents": 99,
        });

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request_with_body(
                "POST",
                "/admin/fabric/resource-classes",
                admin,
                body,
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::CONFLICT);
    }

    #[tokio::test]
    async fn update_resource_class_admin_succeeds_and_updates_catalog() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let admin = seed_org_user_role(&state, "org-1", "admin-1", "owner");

        let body = json!({
            "kind": "compute",
            "class": "s",
            "display_name": "Compute S Updated",
            "vcpu": 1,
            "memory_mib": 2048,
            "gpu_vram_mib": 0,
            "reliability_tier": "premium",
            "retail_price_per_hour_cents": 7,
        });

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request_with_body(
                "PUT",
                "/admin/fabric/resource-classes/compute.s",
                admin,
                body,
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let response = body_json(resp.into_body()).await;
        let class = &response["class"];
        assert_eq!(class["id"], "compute.s");
        assert_eq!(class["display_name"], "Compute S Updated");
        assert_eq!(class["reliability_tier"], "premium");
        assert_eq!(class["retail_price_per_hour_cents"], 7);

        let from_catalog = state.resource_class_catalog.get("compute.s").unwrap();
        assert_eq!(from_catalog.retail_price_per_hour_cents, 7);
        assert_eq!(from_catalog.reliability_tier, ReliabilityTier::Premium);
    }

    #[tokio::test]
    async fn update_resource_class_returns_not_found_for_missing_id() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let admin = seed_org_user_role(&state, "org-1", "admin-1", "owner");

        let body = json!({
            "kind": "compute",
            "class": "s",
            "display_name": "Missing",
            "vcpu": 1,
            "memory_mib": 2048,
            "gpu_vram_mib": 0,
            "reliability_tier": "standard",
            "retail_price_per_hour_cents": 1,
        });

        let app = router().with_state(state.clone());
        let resp = app
            .oneshot(build_request_with_body(
                "PUT",
                "/admin/fabric/resource-classes/does-not-exist",
                admin,
                body,
            ))
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }
}
