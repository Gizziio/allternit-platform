//! REST API routes for computer lifecycle management.

use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::substrate::{
    ComputerHandle, ComputerSpec, ComputerState, ExecResult, Substrate, SubstrateError,
};

// ---------------------------------------------------------------------------
// Request/response types.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateComputerRequest {
    pub name: String,
    pub os: String,
    pub image: String,
    #[serde(default = "default_cpu_cores")]
    pub cpu_cores: u32,
    #[serde(default = "default_memory_mb")]
    pub memory_mb: u32,
    #[serde(default = "default_disk_mb")]
    pub disk_mb: u32,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub profiles: Option<Vec<String>>,
}

fn default_cpu_cores() -> u32 {
    2
}
fn default_memory_mb() -> u32 {
    4096
}
fn default_disk_mb() -> u32 {
    20480
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputerResponse {
    pub native_id: String,
    pub host: String,
    pub state: ComputerState,
    pub metadata: HashMap<String, String>,
}

impl From<ComputerHandle> for ComputerResponse {
    fn from(handle: ComputerHandle) -> Self {
        Self {
            native_id: handle.native_id,
            host: handle.host,
            state: handle.state,
            metadata: handle.metadata,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecRequest {
    pub command: Vec<String>,
}

// ---------------------------------------------------------------------------
// Error representation.
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("substrate error: {0}")]
    Substrate(#[from] SubstrateError),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = match &self {
            ApiError::Substrate(SubstrateError::NotFound(_)) => StatusCode::NOT_FOUND,
            ApiError::Substrate(SubstrateError::Timeout) => StatusCode::GATEWAY_TIMEOUT,
            ApiError::Substrate(SubstrateError::Api { status: 404, .. }) => StatusCode::NOT_FOUND,
            _ => StatusCode::BAD_GATEWAY,
        };
        let body = serde_json::json!({ "error": self.to_string() });
        (status, Json(body)).into_response()
    }
}

// ---------------------------------------------------------------------------
// Router.
// ---------------------------------------------------------------------------

/// Build the computer lifecycle router backed by the given substrate.
pub fn router(substrate: Arc<dyn Substrate>) -> Router {
    Router::new()
        .route("/v1/computers", post(create))
        .route("/v1/computers/:id", get(get_by_id).delete(delete_by_id))
        .route("/v1/computers/:id/start", post(start))
        .route("/v1/computers/:id/stop", post(stop))
        .route("/v1/computers/:id/exec", post(exec))
        .with_state(substrate)
}

// ---------------------------------------------------------------------------
// Handlers.
// ---------------------------------------------------------------------------

async fn create(
    State(substrate): State<Arc<dyn Substrate>>,
    Json(req): Json<CreateComputerRequest>,
) -> Result<(StatusCode, Json<ComputerResponse>), ApiError> {
    let spec = ComputerSpec {
        name: req.name,
        os: req.os,
        image: req.image,
        cpu_cores: req.cpu_cores,
        memory_mb: req.memory_mb,
        disk_mb: req.disk_mb,
        env: req.env,
        profiles: req.profiles.unwrap_or_default(),
    };
    let handle = substrate.create(spec).await?;
    Ok((StatusCode::CREATED, Json(handle.into())))
}

async fn get_by_id(
    State(substrate): State<Arc<dyn Substrate>>,
    Path(id): Path<String>,
) -> Result<Json<ComputerResponse>, ApiError> {
    let handle = substrate.get(&id).await?;
    Ok(Json(handle.into()))
}

async fn delete_by_id(
    State(substrate): State<Arc<dyn Substrate>>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    substrate.delete(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn start(
    State(substrate): State<Arc<dyn Substrate>>,
    Path(id): Path<String>,
) -> Result<Json<ComputerResponse>, ApiError> {
    let handle = substrate.start(&id).await?;
    Ok(Json(handle.into()))
}

async fn stop(
    State(substrate): State<Arc<dyn Substrate>>,
    Path(id): Path<String>,
) -> Result<Json<ComputerResponse>, ApiError> {
    let handle = substrate.stop(&id).await?;
    Ok(Json(handle.into()))
}

async fn exec(
    State(substrate): State<Arc<dyn Substrate>>,
    Path(id): Path<String>,
    Json(req): Json<ExecRequest>,
) -> Result<Json<ExecResult>, ApiError> {
    let result = substrate
        .exec(&id, &req.command, &std::collections::HashMap::new())
        .await?;
    Ok(Json(result))
}

// ---------------------------------------------------------------------------
// Tests with an in-memory mock substrate.
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use axum::body::{to_bytes, Body};
    use http::{Request, StatusCode as HttpStatus};
    use std::sync::Mutex;
    use tower::ServiceExt;

    struct MockSubstrate {
        computers: Mutex<HashMap<String, ComputerHandle>>,
    }

    impl MockSubstrate {
        fn new() -> Self {
            Self {
                computers: Mutex::new(HashMap::new()),
            }
        }
    }

    #[async_trait]
    impl Substrate for MockSubstrate {
        async fn create(&self, spec: ComputerSpec) -> Result<ComputerHandle, SubstrateError> {
            let mut map = self.computers.lock().unwrap();
            let handle = ComputerHandle {
                native_id: spec.name.clone(),
                host: "mock-host".to_string(),
                state: ComputerState::Creating,
                metadata: spec.env.clone(),
            };
            map.insert(spec.name.clone(), handle.clone());
            drop(map);
            Ok(handle)
        }

        async fn start(&self, native_id: &str) -> Result<ComputerHandle, SubstrateError> {
            let mut map = self.computers.lock().unwrap();
            let handle = map
                .get_mut(native_id)
                .ok_or_else(|| SubstrateError::NotFound(native_id.to_string()))?;
            handle.state = ComputerState::Running;
            let clone = handle.clone();
            drop(map);
            Ok(clone)
        }

        async fn stop(&self, native_id: &str) -> Result<ComputerHandle, SubstrateError> {
            let mut map = self.computers.lock().unwrap();
            let handle = map
                .get_mut(native_id)
                .ok_or_else(|| SubstrateError::NotFound(native_id.to_string()))?;
            handle.state = ComputerState::Stopped;
            let clone = handle.clone();
            drop(map);
            Ok(clone)
        }

        async fn delete(&self, native_id: &str) -> Result<(), SubstrateError> {
            let mut map = self.computers.lock().unwrap();
            map.remove(native_id)
                .ok_or_else(|| SubstrateError::NotFound(native_id.to_string()))?;
            drop(map);
            Ok(())
        }

        async fn get(&self, native_id: &str) -> Result<ComputerHandle, SubstrateError> {
            let map = self.computers.lock().unwrap();
            let handle = map
                .get(native_id)
                .ok_or_else(|| SubstrateError::NotFound(native_id.to_string()))?;
            let clone = handle.clone();
            drop(map);
            Ok(clone)
        }

        async fn exec(
            &self,
            _native_id: &str,
            command: &[String],
            _env: &std::collections::HashMap<String, String>,
        ) -> Result<ExecResult, SubstrateError> {
            Ok(ExecResult {
                exit_code: 0,
                stdout: command.join(" "),
                stderr: String::new(),
            })
        }

        async fn create_snapshot(
            &self,
            _native_id: &str,
            _snapshot_id: &str,
            _stateful: bool,
        ) -> Result<(), SubstrateError> {
            Ok(())
        }

        async fn restore_snapshot(
            &self,
            _native_id: &str,
            _snapshot_id: &str,
        ) -> Result<(), SubstrateError> {
            Ok(())
        }

        async fn delete_snapshot(
            &self,
            _native_id: &str,
            _snapshot_id: &str,
        ) -> Result<(), SubstrateError> {
            Ok(())
        }

        async fn list_snapshots(
            &self,
            _native_id: &str,
        ) -> Result<Vec<crate::substrate::SnapshotInfo>, SubstrateError> {
            Ok(Vec::new())
        }
    }

    fn test_app() -> Router {
        router(Arc::new(MockSubstrate::new()))
    }

    async fn body_json<T: serde::de::DeserializeOwned>(body: Body) -> T {
        let bytes = to_bytes(body, usize::MAX).await.unwrap();
        serde_json::from_slice(&bytes).unwrap()
    }

    #[tokio::test]
    async fn create_computer_returns_201() {
        let app = test_app();
        let req = Request::builder()
            .method("POST")
            .uri("/v1/computers")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::json!({
                    "name": "desk-1",
                    "os": "linux",
                    "image": "ubuntu/24.04/cloud"
                })
                .to_string(),
            ))
            .unwrap();
        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), HttpStatus::CREATED);
        let body: ComputerResponse = body_json(response.into_body()).await;
        assert_eq!(body.native_id, "desk-1");
        assert_eq!(body.state, ComputerState::Creating);
    }

    #[tokio::test]
    async fn get_computer_returns_state() {
        let app = test_app();
        let create = Request::builder()
            .method("POST")
            .uri("/v1/computers")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::json!({
                    "name": "desk-get",
                    "os": "linux",
                    "image": "ubuntu/24.04/cloud"
                })
                .to_string(),
            ))
            .unwrap();
        app.clone().oneshot(create).await.unwrap();

        let get = Request::builder()
            .method("GET")
            .uri("/v1/computers/desk-get")
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(get).await.unwrap();
        assert_eq!(response.status(), HttpStatus::OK);
        let body: ComputerResponse = body_json(response.into_body()).await;
        assert_eq!(body.native_id, "desk-get");
    }

    #[tokio::test]
    async fn start_and_stop_update_state() {
        let app = test_app();
        let create = Request::builder()
            .method("POST")
            .uri("/v1/computers")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::json!({
                    "name": "desk-cycle",
                    "os": "linux",
                    "image": "ubuntu/24.04/cloud"
                })
                .to_string(),
            ))
            .unwrap();
        app.clone().oneshot(create).await.unwrap();

        let start = Request::builder()
            .method("POST")
            .uri("/v1/computers/desk-cycle/start")
            .body(Body::empty())
            .unwrap();
        let response = app.clone().oneshot(start).await.unwrap();
        assert_eq!(response.status(), HttpStatus::OK);
        let body: ComputerResponse = body_json(response.into_body()).await;
        assert_eq!(body.state, ComputerState::Running);

        let stop = Request::builder()
            .method("POST")
            .uri("/v1/computers/desk-cycle/stop")
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(stop).await.unwrap();
        assert_eq!(response.status(), HttpStatus::OK);
        let body: ComputerResponse = body_json(response.into_body()).await;
        assert_eq!(body.state, ComputerState::Stopped);
    }

    #[tokio::test]
    async fn delete_computer_returns_204() {
        let app = test_app();
        let create = Request::builder()
            .method("POST")
            .uri("/v1/computers")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::json!({
                    "name": "desk-delete",
                    "os": "linux",
                    "image": "ubuntu/24.04/cloud"
                })
                .to_string(),
            ))
            .unwrap();
        app.clone().oneshot(create).await.unwrap();

        let delete = Request::builder()
            .method("DELETE")
            .uri("/v1/computers/desk-delete")
            .body(Body::empty())
            .unwrap();
        let response = app.clone().oneshot(delete).await.unwrap();
        assert_eq!(response.status(), HttpStatus::NO_CONTENT);

        let get = Request::builder()
            .method("GET")
            .uri("/v1/computers/desk-delete")
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(get).await.unwrap();
        assert_eq!(response.status(), HttpStatus::NOT_FOUND);
    }

    #[tokio::test]
    async fn exec_runs_command() {
        let app = test_app();
        let create = Request::builder()
            .method("POST")
            .uri("/v1/computers")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::json!({
                    "name": "desk-exec",
                    "os": "linux",
                    "image": "ubuntu/24.04/cloud"
                })
                .to_string(),
            ))
            .unwrap();
        app.clone().oneshot(create).await.unwrap();

        let exec = Request::builder()
            .method("POST")
            .uri("/v1/computers/desk-exec/exec")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::json!({ "command": ["echo", "hello"] }).to_string(),
            ))
            .unwrap();
        let response = app.oneshot(exec).await.unwrap();
        assert_eq!(response.status(), HttpStatus::OK);
        let body: ExecResult = body_json(response.into_body()).await;
        assert_eq!(body.exit_code, 0);
        assert_eq!(body.stdout, "echo hello");
    }

    #[tokio::test]
    async fn missing_computer_returns_404() {
        let app = test_app();
        let get = Request::builder()
            .method("GET")
            .uri("/v1/computers/missing")
            .body(Body::empty())
            .unwrap();
        let response = app.oneshot(get).await.unwrap();
        assert_eq!(response.status(), HttpStatus::NOT_FOUND);
    }
}
