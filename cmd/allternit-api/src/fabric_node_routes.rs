//! Private Fabric node control-plane routes.
//!
//! Public daemon routes are mounted at `/v1/fabric/nodes` so the node daemon
//! can reach them with a simple enrollment token. Admin routes are mounted at
//! `/api/v1/admin/fabric/nodes` and require organization admin auth.

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Extension,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    fabric::node_registry::{
        hash_token, FabricNodeRecord, FabricNodeRegistry, FabricNodeStatus, NodeCapacity,
    },
    AppState,
};

pub fn public_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/v1/fabric/nodes/enroll", post(enroll))
        .route("/v1/fabric/nodes/:id/heartbeat", post(heartbeat))
        .route(
            "/v1/fabric/nodes/:id/assignments/:assignment_id/status",
            post(update_assignment_status),
        )
        .route("/v1/fabric/nodes/:id/usage", post(submit_usage))
}

pub fn admin_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/admin/fabric/nodes", get(list_nodes))
        .route("/admin/fabric/nodes/enrollment-token", post(create_enrollment_token))
        .route("/admin/fabric/nodes/enrollment-tokens", get(list_enrollment_tokens))
        .route("/admin/fabric/nodes/:id/approve", post(approve_node))
        .route("/admin/fabric/nodes/:id/reject", post(reject_node))
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
    tracing::warn!(error = %err, "fabric node operation failed");
    ApiError::new(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        err.to_string(),
    )
}

fn extract_bearer(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
}

fn authenticate_node(
    registry: &FabricNodeRegistry,
    node_id: &str,
    token: &str,
) -> Result<FabricNodeRecord, ApiError> {
    let hashed = hash_token(token);
    let node = registry
        .get(node_id)
        .map_err(internal)?
        .ok_or_else(|| error(StatusCode::NOT_FOUND, "node_not_found", "No such node"))?;
    if node.node_token_hash.as_deref() != Some(&hashed) {
        return Err(error(
            StatusCode::UNAUTHORIZED,
            "invalid_token",
            "Token does not match node",
        ));
    }
    Ok(node)
}

#[derive(Debug, Deserialize)]
struct EnrollRequest {
    organization_id: String,
    display_name: String,
    region: String,
    capability: NodeCapacity,
}

#[derive(Debug, Serialize)]
struct EnrollResponse {
    node_id: String,
    status: String,
    node_token: String,
}

async fn enroll(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<EnrollRequest>,
) -> Result<Json<EnrollResponse>, ApiError> {
    let token = extract_bearer(&headers).ok_or_else(|| {
        error(StatusCode::UNAUTHORIZED, "missing_token", "Bearer token required")
    })?;

    let registry = FabricNodeRegistry::new(state.db.clone());
    let hashed = hash_token(token);

    // If a node already exists for this enrollment token, rotate its node token
    // and return it (idempotent re-enrollment).
    if let Some(existing) = registry.get_by_token_hash(&hashed).map_err(internal)? {
        let node_token = registry.rotate_node_token(&existing.id).map_err(internal)?;
        return Ok(Json(EnrollResponse {
            node_id: existing.id,
            status: existing.status.as_str().to_string(),
            node_token,
        }));
    }

    // If this hash matches a pending enrollment token created by an admin,
    // validate it belongs to the requested organization.
    let enrollment_token = registry
        .get_enrollment_token_by_hash(&hashed)
        .map_err(internal)?;
    if let Some(ref et) = enrollment_token {
        if et.status != "pending" {
            return Err(error(
                StatusCode::FORBIDDEN,
                "token_used",
                "Enrollment token has already been used or revoked",
            ));
        }
        if et.organization_id != req.organization_id {
            return Err(error(
                StatusCode::FORBIDDEN,
                "wrong_organization",
                "Token belongs to a different organization",
            ));
        }
    }

    let node_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now();
    let node = FabricNodeRecord {
        id: node_id.clone(),
        organization_id: req.organization_id,
        display_name: Some(req.display_name),
        status: FabricNodeStatus::Pending,
        region: Some(req.region),
        identity_fingerprint: None,
        enrollment_token_hash: Some(hashed),
        node_token_hash: None,
        labels: std::collections::HashMap::new(),
        created_at: now,
        updated_at: now,
        approved_at: None,
        last_heartbeat_at: None,
    };

    registry.insert(&node).map_err(internal)?;
    let mut capability = req.capability;
    capability.node_id = node_id.clone();
    registry.record_heartbeat(&node_id, &capability).map_err(internal)?;
    let node_token = registry.rotate_node_token(&node_id).map_err(internal)?;

    // Mark the admin-created enrollment token as used and link it to the node.
    if let Some(et) = enrollment_token {
        registry
            .mark_enrollment_token_used(&et.id, &node_id)
            .map_err(internal)?;
    }

    Ok(Json(EnrollResponse {
        node_id,
        status: node.status.as_str().to_string(),
        node_token,
    }))
}

#[derive(Debug, Deserialize)]
struct HeartbeatRequest {
    capability: NodeCapacity,
}

#[derive(Debug, Serialize)]
struct AssignmentResponse {
    assignment_id: String,
    resource_id: String,
    kind: String,
    class: String,
    payload: Option<Value>,
}

#[derive(Debug, Serialize)]
struct HeartbeatResponse {
    status: String,
    assignments: Vec<AssignmentResponse>,
}

async fn heartbeat(
    State(state): State<Arc<AppState>>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    Json(req): Json<HeartbeatRequest>,
) -> Result<Json<HeartbeatResponse>, ApiError> {
    let token = extract_bearer(&headers).ok_or_else(|| {
        error(StatusCode::UNAUTHORIZED, "missing_token", "Bearer token required")
    })?;

    let registry = FabricNodeRegistry::new(state.db.clone());
    let node = authenticate_node(&registry, &node_id, token)?;

    let mut capability = req.capability;
    capability.node_id = node_id.clone();
    registry.record_heartbeat(&node_id, &capability).map_err(internal)?;

    let pending = registry
        .list_pending_assignments_for_node(&node_id)
        .map_err(internal)?;
    let assignments: Vec<AssignmentResponse> = pending
        .into_iter()
        .map(|a| AssignmentResponse {
            assignment_id: a.id,
            resource_id: a.resource_id,
            kind: a.kind,
            class: a.class,
            payload: a
                .payload
                .and_then(|p| serde_json::from_str(&p).ok())
                .or_else(|| Some(Value::Null)),
        })
        .collect();

    Ok(Json(HeartbeatResponse {
        status: node.status.as_str().to_string(),
        assignments,
    }))
}

#[derive(Debug, Deserialize)]
struct AssignmentStatusRequest {
    status: String,
}

async fn update_assignment_status(
    State(state): State<Arc<AppState>>,
    Path((node_id, assignment_id)): Path<(String, String)>,
    headers: HeaderMap,
    Json(req): Json<AssignmentStatusRequest>,
) -> Result<Json<Value>, ApiError> {
    let token = extract_bearer(&headers).ok_or_else(|| {
        error(StatusCode::UNAUTHORIZED, "missing_token", "Bearer token required")
    })?;

    let registry = FabricNodeRegistry::new(state.db.clone());
    authenticate_node(&registry, &node_id, token)?;

    registry
        .update_assignment_status(&assignment_id, &req.status)
        .map_err(internal)?;

    Ok(Json(json!({"assignment_id": assignment_id, "status": req.status})))
}

#[derive(Debug, Deserialize)]
struct UsageEventRequest {
    resource_id: String,
    event_type: String,
    quantity: f64,
    unit: String,
    measured_at: Option<String>,
    #[serde(default)]
    placement_id: Option<String>,
}

async fn submit_usage(
    State(state): State<Arc<AppState>>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    Json(req): Json<UsageEventRequest>,
) -> Result<Json<Value>, ApiError> {
    let token = extract_bearer(&headers).ok_or_else(|| {
        error(StatusCode::UNAUTHORIZED, "missing_token", "Bearer token required")
    })?;

    let registry = FabricNodeRegistry::new(state.db.clone());
    authenticate_node(&registry, &node_id, token)?;

    let measured_at = req
        .measured_at
        .as_deref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .unwrap_or_else(chrono::Utc::now);

    registry
        .record_usage_event(
            &req.resource_id,
            &req.event_type,
            req.quantity,
            &req.unit,
            Some(measured_at),
            req.placement_id.as_deref(),
        )
        .map_err(internal)?;

    Ok(Json(json!({"status": "recorded"})))
}

fn admin_org(user: &AuthUser) -> Result<String, ApiError> {
    user.organization_id.clone().ok_or_else(|| {
        error(
            StatusCode::FORBIDDEN,
            "organization_required",
            "An active organization is required.",
        )
    })
}

async fn list_nodes(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<Value>, ApiError> {
    let org = admin_org(&user)?;
    let conn = state.db.connect().map_err(internal)?;
    if !crate::rbac::is_org_admin(&conn, &org, &user.user_id).map_err(internal)? {
        return Err(error(
            StatusCode::FORBIDDEN,
            "insufficient_role",
            "Only organization owners/admins can manage fabric nodes.",
        ));
    }

    let registry = FabricNodeRegistry::new(state.db.clone());
    let nodes = registry.list_by_organization(&org).map_err(internal)?;
    Ok(Json(json!({"nodes": nodes})))
}

async fn approve_node(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(node_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let org = admin_org(&user)?;
    let conn = state.db.connect().map_err(internal)?;
    if !crate::rbac::is_org_admin(&conn, &org, &user.user_id).map_err(internal)? {
        return Err(error(
            StatusCode::FORBIDDEN,
            "insufficient_role",
            "Only organization owners/admins can manage fabric nodes.",
        ));
    }

    let registry = FabricNodeRegistry::new(state.db.clone());
    let node = registry
        .get(&node_id)
        .map_err(internal)?
        .ok_or_else(|| error(StatusCode::NOT_FOUND, "node_not_found", "No such node"))?;

    if node.organization_id != org {
        return Err(error(StatusCode::FORBIDDEN, "wrong_organization", "Node belongs to a different organization"));
    }

    registry
        .update_status(&node_id, FabricNodeStatus::Active)
        .map_err(internal)?;
    Ok(Json(json!({"id": node_id, "status": "active"})))
}

async fn reject_node(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(node_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let org = admin_org(&user)?;
    let conn = state.db.connect().map_err(internal)?;
    if !crate::rbac::is_org_admin(&conn, &org, &user.user_id).map_err(internal)? {
        return Err(error(
            StatusCode::FORBIDDEN,
            "insufficient_role",
            "Only organization owners/admins can manage fabric nodes.",
        ));
    }

    let registry = FabricNodeRegistry::new(state.db.clone());
    let node = registry
        .get(&node_id)
        .map_err(internal)?
        .ok_or_else(|| error(StatusCode::NOT_FOUND, "node_not_found", "No such node"))?;

    if node.organization_id != org {
        return Err(error(StatusCode::FORBIDDEN, "wrong_organization", "Node belongs to a different organization"));
    }

    registry
        .update_status(&node_id, FabricNodeStatus::Rejected)
        .map_err(internal)?;
    Ok(Json(json!({"id": node_id, "status": "rejected"})))
}

#[derive(Debug, Deserialize)]
struct CreateEnrollmentTokenRequest {
    display_name: Option<String>,
}

async fn create_enrollment_token(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<CreateEnrollmentTokenRequest>,
) -> Result<Json<Value>, ApiError> {
    let org = admin_org(&user)?;
    let conn = state.db.connect().map_err(internal)?;
    if !crate::rbac::is_org_admin(&conn, &org, &user.user_id).map_err(internal)? {
        return Err(error(
            StatusCode::FORBIDDEN,
            "insufficient_role",
            "Only organization owners/admins can manage fabric nodes.",
        ));
    }
    drop(conn);

    let registry = FabricNodeRegistry::new(state.db.clone());
    let (record, plain) = registry
        .create_enrollment_token(&org, req.display_name.as_deref())
        .map_err(internal)?;

    Ok(Json(json!({
        "id": record.id,
        "organization_id": record.organization_id,
        "display_name": record.display_name,
        "status": record.status,
        "token": plain,
        "created_at": record.created_at.to_rfc3339(),
    })))
}

async fn list_enrollment_tokens(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Result<Json<Value>, ApiError> {
    let org = admin_org(&user)?;
    let conn = state.db.connect().map_err(internal)?;
    if !crate::rbac::is_org_admin(&conn, &org, &user.user_id).map_err(internal)? {
        return Err(error(
            StatusCode::FORBIDDEN,
            "insufficient_role",
            "Only organization owners/admins can manage fabric nodes.",
        ));
    }
    drop(conn);

    let registry = FabricNodeRegistry::new(state.db.clone());
    let tokens = registry.list_enrollment_tokens(&org).map_err(internal)?;
    Ok(Json(json!({
        "tokens": tokens.iter().map(|t| json!({
            "id": t.id,
            "organization_id": t.organization_id,
            "display_name": t.display_name,
            "status": t.status,
            "node_id": t.node_id,
            "created_at": t.created_at.to_rfc3339(),
            "used_at": t.used_at.map(|d| d.to_rfc3339()),
        })).collect::<Vec<_>>()
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_capability() -> NodeCapacity {
        use chrono::Utc;
        let mut cap = allternitos_cloud_contracts::NodeCapabilityRecord {
            schema_version: "1.0.0".to_string(),
            node_id: "node_test".to_string(),
            recorded_at: Utc::now(),
            hardware: allternitos_cloud_contracts::NodeHardware {
                cpu: allternitos_cloud_contracts::CpuInfo {
                    vendor: "unknown".to_string(),
                    model: "unknown".to_string(),
                    cores: 8,
                    threads: 8,
                    sockets: None,
                    base_frequency_mhz: None,
                    flags: Vec::new(),
                    numa_nodes: None,
                },
                memory: allternitos_cloud_contracts::MemoryInfo {
                    total_bytes: 16_384 * 1_048_576,
                    memory_type: "unknown".to_string(),
                    speed_mhz: None,
                    channels: None,
                    measured_bandwidth_gbps: None,
                },
                storage: Vec::new(),
                network: Vec::new(),
            },
            accelerators: Vec::new(),
            topology: allternitos_cloud_contracts::NodeTopology::default(),
            software: allternitos_cloud_contracts::NodeSoftware {
                fabric_os_version: "unknown".to_string(),
                kernel_version: "unknown".to_string(),
                libvirt_version: None,
                containerd_version: None,
                qemu_version: None,
                wireguard_version: None,
            },
            fabric: allternitos_cloud_contracts::NodeFabric {
                wireguard_public_key: "pending_enrollment".to_string(),
                fabric_address: None,
                region: Some("us-east".to_string()),
                zone: None,
                rack: None,
                role: Some("cloud".to_string()),
                join_token_hash: None,
            },
            measured_bandwidth: allternitos_cloud_contracts::MeasuredBandwidth::default(),
            health: allternitos_cloud_contracts::NodeHealth {
                status: "active".to_string(),
                last_checked_at: None,
                alerts: Vec::new(),
            },
            workers: allternitos_cloud_contracts::Workers::default(),
        };
        cap.node_id = "node_test".to_string();
        cap
    }

    fn capability_json() -> Value {
        serde_json::to_value(test_capability()).unwrap()
    }

    fn enroll_body(organization_id: &str, display_name: &str, region: &str) -> Value {
        json!({
            "organization_id": organization_id,
            "display_name": display_name,
            "region": region,
            "capability": capability_json(),
        })
    }

    fn heartbeat_body() -> Value {
        json!({"capability": capability_json()})
    }

    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use rusqlite::params;
    use std::collections::HashMap;
    use tower::ServiceExt;

    fn seed_org_and_node(state: &AppState, token: &str) -> String {
        let conn = state.db.connect().expect("test db conn");
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name, status) VALUES ('org-1', 'Test Org', 'active')",
            [],
        )
        .unwrap();

        let node_id = "node-1".to_string();
        let hashed = hash_token(token);
        let now = chrono::Utc::now();
        let record = FabricNodeRecord {
            id: node_id.clone(),
            organization_id: "org-1".to_string(),
            display_name: Some("test node".to_string()),
            status: FabricNodeStatus::Active,
            region: Some("us-east".to_string()),
            identity_fingerprint: None,
            enrollment_token_hash: Some(hashed.clone()),
            node_token_hash: Some(hashed),
            labels: HashMap::new(),
            created_at: now,
            updated_at: now,
            approved_at: Some(now),
            last_heartbeat_at: Some(now),
        };
        let registry = FabricNodeRegistry::new(state.db.clone());
        registry.insert(&record).unwrap();
        registry.record_heartbeat(&node_id, &test_capability()).unwrap();
        drop(conn);
        node_id
    }

    fn seed_fabric_resource(state: &AppState, resource_id: &str, org_id: &str) {
        let conn = state.db.connect().expect("test db conn");
        conn.execute(
            "INSERT INTO fabric_resources (id, organization_id, kind, class, status) VALUES (?1, ?2, 'compute', 's', 'pending')",
            params![resource_id, org_id],
        )
        .unwrap();
    }

    async fn body_json(body: Body) -> Value {
        let bytes = body.collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap_or_else(|_| Value::Null)
    }

    #[tokio::test]
    async fn heartbeat_returns_pending_assignment() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let token = "enrollment-token";
        let node_id = seed_org_and_node(&state, token);
        seed_fabric_resource(&state, "resource-1", "org-1");

        let registry = FabricNodeRegistry::new(state.db.clone());
        registry
            .create_assignment(&node_id, "resource-1", "compute", "s", 1, 2048, 0, None)
            .unwrap();

        let app = public_router().with_state(state.clone());
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/fabric/nodes/{}/heartbeat", node_id))
                    .header("Authorization", format!("Bearer {}", token))
                    .header("content-type", "application/json")
                    .body(Body::from(heartbeat_body().to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        let assignments = body["assignments"].as_array().unwrap();
        assert_eq!(assignments.len(), 1);
        assert_eq!(assignments[0]["resource_id"], "resource-1");
        assert_eq!(assignments[0]["kind"], "compute");
    }

    #[tokio::test]
    async fn assignment_status_update_requires_valid_token() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let token = "enrollment-token";
        let node_id = seed_org_and_node(&state, token);
        seed_fabric_resource(&state, "resource-1", "org-1");

        let registry = FabricNodeRegistry::new(state.db.clone());
        let assignment_id = registry
            .create_assignment(&node_id, "resource-1", "compute", "s", 1, 2048, 0, None)
            .unwrap();

        let app = public_router().with_state(state.clone());
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!(
                        "/v1/fabric/nodes/{}/assignments/{}/status",
                        node_id, assignment_id
                    ))
                    .header("Authorization", format!("Bearer {}", token))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"status":"accepted"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);

        let pending = registry.list_pending_assignments_for_node(&node_id).unwrap();
        assert!(pending.is_empty());
    }

    #[tokio::test]
    async fn usage_event_is_recorded() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let token = "enrollment-token";
        let node_id = seed_org_and_node(&state, token);
        seed_fabric_resource(&state, "resource-1", "org-1");

        let app = public_router().with_state(state.clone());
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/fabric/nodes/{}/usage", node_id))
                    .header("Authorization", format!("Bearer {}", token))
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"resource_id":"resource-1","event_type":"compute_seconds","quantity":12.5,"unit":"seconds"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        let status = resp.status();
        if status != StatusCode::OK {
            let body = body_json(resp.into_body()).await;
            panic!("usage endpoint returned {}: {}", status, body);
        }

        let conn = state.db.connect().unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM fabric_usage_events WHERE resource_id = ?1",
                params!["resource-1"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn enrollment_returns_node_token() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let conn = state.db.connect().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name, status) VALUES ('org-1', 'Test Org', 'active')",
            [],
        )
        .unwrap();
        drop(conn);

        let app = public_router().with_state(state.clone());
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/fabric/nodes/enroll")
                    .header("Authorization", "Bearer enrollment-token")
                    .header("content-type", "application/json")
                    .body(Body::from(enroll_body("org-1", "test", "us-east").to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp.into_body()).await;
        assert!(!body["node_token"].as_str().unwrap().is_empty());

        let registry = FabricNodeRegistry::new(state.db.clone());
        let node = registry.get(body["node_id"].as_str().unwrap()).unwrap().unwrap();
        assert_eq!(
            node.node_token_hash,
            Some(hash_token(body["node_token"].as_str().unwrap()))
        );
    }

    #[tokio::test]
    async fn heartbeat_rejects_invalid_node_token() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let token = "enrollment-token";
        let node_id = seed_org_and_node(&state, token);

        let app = public_router().with_state(state.clone());
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/fabric/nodes/{}/heartbeat", node_id))
                    .header("Authorization", "Bearer wrong-token")
                    .header("content-type", "application/json")
                    .body(Body::from(heartbeat_body().to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn re_enrollment_rotates_node_token() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let conn = state.db.connect().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name, status) VALUES ('org-1', 'Test Org', 'active')",
            [],
        )
        .unwrap();
        drop(conn);

        let app = public_router().with_state(state.clone());
        let body = enroll_body("org-1", "test", "us-east").to_string();

        let resp1 = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/fabric/nodes/enroll")
                    .header("Authorization", "Bearer enrollment-token")
                    .header("content-type", "application/json")
                    .body(Body::from(body.clone()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp1.status(), StatusCode::OK);
        let first = body_json(resp1.into_body()).await;

        let resp2 = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/fabric/nodes/enroll")
                    .header("Authorization", "Bearer enrollment-token")
                    .header("content-type", "application/json")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp2.status(), StatusCode::OK);
        let second = body_json(resp2.into_body()).await;

        assert_eq!(first["node_id"], second["node_id"]);
        assert_ne!(first["node_token"], second["node_token"]);
    }

    fn seed_org_user(conn: &rusqlite::Connection, org_id: &str, user_id: &str, role: &str) {
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name) VALUES (?1, ?2)",
            rusqlite::params![org_id, "Test Org"],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email) VALUES (?1, ?2)",
            rusqlite::params![user_id, format!("{}@test.local", user_id)],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organization_members (id, organization_id, user_id, role)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![format!("{}:{}", org_id, user_id), org_id, user_id, role],
        )
        .unwrap();
    }

    fn auth_user(org_id: Option<&str>, user_id: &str) -> AuthUser {
        AuthUser {
            user_id: user_id.to_string(),
            email: Some(format!("{}@test.local", user_id)),
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: org_id.map(|s| s.to_string()),
            organization_role: None,
            organization_slug: None,
        }
    }

    #[tokio::test]
    async fn admin_can_create_and_list_enrollment_tokens() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let conn = state.db.connect().unwrap();
        seed_org_user(&conn, "org-1", "owner-1", "owner");
        drop(conn);

        let app = admin_router().with_state(state.clone());
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/admin/fabric/nodes/enrollment-token")
                    .header("content-type", "application/json")
                    .extension(auth_user(Some("org-1"), "owner-1"))
                    .body(Body::from(r#"{"display_name":"desktop-rig"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let create_body = body_json(resp.into_body()).await;
        assert_eq!(create_body["status"], "pending");
        assert!(!create_body["token"].as_str().unwrap().is_empty());

        let resp = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/admin/fabric/nodes/enrollment-tokens")
                    .extension(auth_user(Some("org-1"), "owner-1"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let list_body = body_json(resp.into_body()).await;
        let tokens = list_body["tokens"].as_array().unwrap();
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens[0]["display_name"], "desktop-rig");
    }

    #[tokio::test]
    async fn enrollment_with_admin_token_marks_it_used() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let conn = state.db.connect().unwrap();
        seed_org_user(&conn, "org-1", "owner-1", "owner");
        drop(conn);

        let admin_app = admin_router().with_state(state.clone());
        let resp = admin_app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/admin/fabric/nodes/enrollment-token")
                    .header("content-type", "application/json")
                    .extension(auth_user(Some("org-1"), "owner-1"))
                    .body(Body::from(r#"{"display_name":"desktop-rig"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let create_body = body_json(resp.into_body()).await;
        let plain_token = create_body["token"].as_str().unwrap();

        let public_app = public_router().with_state(state.clone());
        let body = enroll_body("org-1", "test", "us-east").to_string();
        let resp = public_app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/fabric/nodes/enroll")
                    .header("Authorization", format!("Bearer {}", plain_token))
                    .header("content-type", "application/json")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(resp.status(), StatusCode::OK);
        let enroll_body = body_json(resp.into_body()).await;
        let node_id = enroll_body["node_id"].as_str().unwrap();

        let registry = FabricNodeRegistry::new(state.db.clone());
        let tokens = registry.list_enrollment_tokens("org-1").unwrap();
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens[0].status, "used");
        assert_eq!(tokens[0].node_id.as_deref(), Some(node_id));
    }

}
