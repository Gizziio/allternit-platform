//! Test harness for integration tests
//!
//! Provides a TestApp struct for setting up test environment
//! with in-memory database and HTTP client.

use a2r_cloud_api::{
    create_router, ApiState,
    db::cowork_models::*,
};
use axum::{body::Body, http::Request, http::StatusCode, response::Response};
use sqlx::SqlitePool;
use std::sync::Arc;
use tempfile::TempDir;
use tokio::sync::broadcast;
use tower::ServiceExt;

/// Test application wrapper
pub struct TestApp {
    pub db: SqlitePool,
    pub router: axum::Router,
    pub temp_dir: TempDir,
    pub event_tx: broadcast::Sender<a2r_cloud_api::DeploymentEvent>,
}

impl TestApp {
    /// Create a new test application with in-memory database
    pub async fn new() -> Self {
        // Create temp directory for database
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");
        let database_url = format!("sqlite://{}", db_path.display());

        // Initialize database
        let db = Self::init_test_db(&database_url).await;

        // Create broadcast channel for events
        let (event_tx, _event_rx) = broadcast::channel::<a2r_cloud_api::DeploymentEvent>(100);

        // Create API state
        let state = Arc::new(ApiState {
            db: db.clone(),
            ssh_executor: a2r_cloud_ssh::SshExecutor::new(),
            event_tx: event_tx.clone(),
        });

        // Create router
        let router = create_router(state);

        Self {
            db,
            router,
            temp_dir,
            event_tx,
        }
    }

    /// Initialize test database with migrations
    async fn init_test_db(database_url: &str) -> SqlitePool {
        let pool = sqlx::SqlitePool::connect(database_url)
            .await
            .expect("Failed to connect to test database");

        // Run migrations
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("Failed to run migrations");

        pool
    }

    /// Make a GET request
    pub async fn get(&self, path: &str) -> Response {
        let request = Request::builder()
            .uri(path)
            .method("GET")
            .body(Body::empty())
            .unwrap();

        self.router.clone().oneshot(request).await.unwrap()
    }

    /// Make a POST request with JSON body
    pub async fn post<T: serde::Serialize>(&self, path: &str, body: T) -> Response {
        let json_body = serde_json::to_string(&body).unwrap();
        let request = Request::builder()
            .uri(path)
            .method("POST")
            .header("Content-Type", "application/json")
            .body(Body::from(json_body))
            .unwrap();

        self.router.clone().oneshot(request).await.unwrap()
    }

    /// Make a PUT request with JSON body
    pub async fn put<T: serde::Serialize>(&self, path: &str, body: T) -> Response {
        let json_body = serde_json::to_string(&body).unwrap();
        let request = Request::builder()
            .uri(path)
            .method("PUT")
            .header("Content-Type", "application/json")
            .body(Body::from(json_body))
            .unwrap();

        self.router.clone().oneshot(request).await.unwrap()
    }

    /// Make a DELETE request
    pub async fn delete(&self, path: &str) -> Response {
        let request = Request::builder()
            .uri(path)
            .method("DELETE")
            .body(Body::empty())
            .unwrap();

        self.router.clone().oneshot(request).await.unwrap()
    }

    /// Parse response body as JSON
    pub async fn parse_json<T: serde::de::DeserializeOwned>(response: Response) -> T {
        let status = response.status();
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        
        serde_json::from_slice(&body)
            .unwrap_or_else(|e| {
                let body_str = String::from_utf8_lossy(&body);
                panic!(
                    "Failed to parse JSON response (status: {}): {}\nBody: {}",
                    status, e, body_str
                )
            })
    }

    /// Assert that response status is success (2xx)
    pub fn assert_success(response: &Response) -> StatusCode {
        let status = response.status();
        assert!(
            status.is_success(),
            "Expected success status, got {:?}",
            status
        );
        status
    }

    /// Assert that response status equals expected
    pub fn assert_status(response: &Response, expected: StatusCode) -> StatusCode {
        let status = response.status();
        assert_eq!(
            status, expected,
            "Expected status {:?}, got {:?}",
            expected, status
        );
        status
    }

    // ============================================================================
    // Run Helpers
    // ============================================================================

    /// Create a new run
    pub async fn create_run(&self, name: &str) -> Run {
        let request = CreateRunRequest {
            name: name.to_string(),
            description: Some(format!("Test run: {}", name)),
            mode: RunMode::Local,
            config: RunConfig {
                command: Some("echo".to_string()),
                args: Some(vec!["hello".to_string()]),
                ..Default::default()
            },
            auto_start: false,
        };

        let response = self.post("/api/v1/runs", request).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Start a run
    pub async fn start_run(&self, run_id: &str) -> Run {
        let response = self.post(&format!("/api/v1/runs/{}/start", run_id), serde_json::json!({})).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Pause a run
    pub async fn pause_run(&self, run_id: &str) -> Run {
        let response = self.post(&format!("/api/v1/runs/{}/pause", run_id), serde_json::json!({})).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Resume a run
    pub async fn resume_run(&self, run_id: &str) -> Run {
        let response = self.post(&format!("/api/v1/runs/{}/resume", run_id), serde_json::json!({})).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Cancel a run
    pub async fn cancel_run(&self, run_id: &str) -> Run {
        let response = self.post(&format!("/api/v1/runs/{}/cancel", run_id), serde_json::json!({})).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Get a run by ID
    pub async fn get_run(&self, run_id: &str) -> Run {
        let response = self.get(&format!("/api/v1/runs/{}", run_id)).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Get events for a run
    pub async fn get_run_events(&self, run_id: &str) -> Vec<Event> {
        let response = self.get(&format!("/api/v1/runs/{}/events", run_id)).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    // ============================================================================
    // Approval Helpers
    // ============================================================================

    /// Create an approval request
    pub async fn create_approval(&self, run_id: &str, title: &str) -> ApprovalRequest {
        let request = CreateApprovalRequest {
            run_id: run_id.to_string(),
            step_cursor: None,
            priority: Some(ApprovalPriority::Normal),
            title: title.to_string(),
            description: Some("Test approval request".to_string()),
            action_type: Some("test_action".to_string()),
            action_params: None,
            reasoning: Some("Need approval for testing".to_string()),
            requested_by: Some("test".to_string()),
            timeout_seconds: None,
        };

        let response = self.post("/api/v1/approvals", request).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Approve an approval request
    pub async fn approve_request(&self, approval_id: &str, message: Option<&str>) -> ApprovalRequest {
        let body = ApprovalResponse {
            approved: true,
            message: message.map(|m| m.to_string()),
            modified_params: None,
        };

        let response = self.post(&format!("/api/v1/approvals/{}/approve", approval_id), body).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Deny an approval request
    pub async fn deny_request(&self, approval_id: &str, message: Option<&str>) -> ApprovalRequest {
        let body = ApprovalResponse {
            approved: false,
            message: message.map(|m| m.to_string()),
            modified_params: None,
        };

        let response = self.post(&format!("/api/v1/approvals/{}/deny", approval_id), body).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Get an approval request
    pub async fn get_approval(&self, approval_id: &str) -> ApprovalRequest {
        let response = self.get(&format!("/api/v1/approvals/{}", approval_id)).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    // ============================================================================
    // Schedule Helpers
    // ============================================================================

    /// Create a schedule
    pub async fn create_schedule(&self, name: &str, cron_expr: &str) -> Schedule {
        let request = serde_json::json!({
            "name": name,
            "description": "Test schedule",
            "cron_expr": cron_expr,
            "natural_lang": "Test schedule",
            "timezone": "UTC",
            "job_template": {
                "command": "echo".to_string(),
                "args": Some(vec!["scheduled".to_string()]),
                "env": None,
                "working_dir": None,
                "timeout_seconds": None,
            },
            "enabled": true,
        });

        let response = self.post("/api/v1/schedules", request).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Trigger a schedule manually
    pub async fn trigger_schedule(&self, schedule_id: &str) -> serde_json::Value {
        let response = self.post(&format!("/api/v1/schedules/{}/trigger", schedule_id), serde_json::json!({})).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Get a schedule
    pub async fn get_schedule(&self, schedule_id: &str) -> Schedule {
        let response = self.get(&format!("/api/v1/schedules/{}", schedule_id)).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    // ============================================================================
    // Attachment Helpers
    // ============================================================================

    /// Attach a client to a run
    pub async fn attach_to_run(&self, run_id: &str, client_type: ClientType, user_id: Option<&str>) -> serde_json::Value {
        let request = serde_json::json!({
            "client_type": client_type,
            "user_id": user_id,
        });

        let response = self.post(&format!("/api/v1/runs/{}/attach", run_id), request).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Detach a client from a run
    pub async fn detach_from_run(&self, run_id: &str, client_id: &str) -> serde_json::Value {
        let request = serde_json::json!({
            "client_id": client_id,
        });

        let response = self.post(&format!("/api/v1/runs/{}/detach", run_id), request).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Get attachments for a run
    pub async fn get_run_attachments(&self, run_id: &str) -> Vec<Attachment> {
        let response = self.get(&format!("/api/v1/runs/{}/attachments", run_id)).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    // ============================================================================
    // Job Helpers
    // ============================================================================

    /// Create a job for a run
    pub async fn create_job(&self, run_id: &str, name: &str) -> Job {
        let request = serde_json::json!({
            "name": name,
            "description": "Test job",
            "priority": 0,
            "config": {
                "command": "echo".to_string(),
                "args": Some(vec!["job".to_string()]),
                "env": None,
                "working_dir": None,
                "timeout_seconds": None,
            },
        });

        let response = self.post(&format!("/api/v1/runs/{}/jobs", run_id), request).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Start a job
    pub async fn start_job(&self, run_id: &str, job_id: &str) -> Job {
        let response = self.post(&format!("/api/v1/runs/{}/jobs/{}/start", run_id, job_id), serde_json::json!({})).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Complete a job
    pub async fn complete_job(&self, run_id: &str, job_id: &str, result: serde_json::Value) -> Job {
        let response = self.post(&format!("/api/v1/runs/{}/jobs/{}/complete", run_id, job_id), result).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }

    /// Get a job
    pub async fn get_job(&self, run_id: &str, job_id: &str) -> Job {
        let response = self.get(&format!("/api/v1/runs/{}/jobs/{}", run_id, job_id)).await;
        Self::assert_success(&response);
        Self::parse_json(response).await
    }
}

/// Test context that cleans up after tests
drop_impl! {
    impl Drop for TestApp {
        fn drop(&mut self) {
            // Database is cleaned up automatically when temp_dir is dropped
        }
    }
}

// Helper macro for implementing Drop
#[macro_export]
macro_rules! drop_impl {
    (impl Drop for $type:ty { fn drop(&mut self) $body:block }) => {
        impl Drop for $type {
            fn drop(&mut self) $body
        }
    };
}
