//! Integration tests for the cowork scheduler.
//!
//! These tests use a mock job handler and a temporary SQLite database so they
//! can run without a real Rails backend.

use std::sync::{Arc, Mutex};

use allternit_cowork_scheduler::{
    api, CreateScheduleRequest, JobContext, JobHandler, Scheduler, SchedulerError,
};

/// Mock job handler that records execution contexts.
#[derive(Default, Clone)]
struct MockHandler {
    calls: Arc<Mutex<Vec<JobContext>>>,
}

impl MockHandler {
    fn new() -> Self {
        Self::default()
    }

    fn calls(&self) -> Vec<JobContext> {
        self.calls.lock().unwrap().clone()
    }
}

#[async_trait::async_trait]
impl JobHandler for MockHandler {
    async fn execute(&self, ctx: JobContext) -> allternit_cowork_scheduler::Result<()> {
        self.calls.lock().unwrap().push(ctx);
        Ok(())
    }
}

fn create_req(name: &str, cron: &str, entrypoint: &str) -> CreateScheduleRequest {
    CreateScheduleRequest {
        name: name.to_string(),
        cron: cron.to_string(),
        timezone: None,
        entrypoint: entrypoint.to_string(),
        args: None,
        env: None,
        priority: None,
        timeout_secs: None,
        run_mode: None,
    }
}

#[tokio::test]
async fn test_schedule_crud() {
    let tmp = tempfile::tempdir().unwrap();
    let handler = Arc::new(MockHandler::new());
    let scheduler = Scheduler::with_handler(tmp.path().join("scheduler.db"), "http://api.test", handler)
        .await
        .unwrap();

    let created = scheduler
        .create_schedule("owner-1", create_req("Daily", "0 9 * * *", "echo hello"))
        .await
        .unwrap();

    assert_eq!(created.name, "Daily");
    assert_eq!(created.cron, "0 9 * * *");
    assert_eq!(created.entrypoint, "echo hello");
    assert!(created.enabled);
    assert_eq!(created.owner, "owner-1");

    let fetched = scheduler.get_schedule(&created.id).await.unwrap();
    assert_eq!(fetched.id, created.id);

    let list = scheduler.list_schedules().await.unwrap();
    assert_eq!(list.len(), 1);

    let owner_list = scheduler.list_schedules_for_owner("owner-1").await.unwrap();
    assert_eq!(owner_list.len(), 1);

    let other_owner = scheduler.list_schedules_for_owner("owner-2").await.unwrap();
    assert!(other_owner.is_empty());

    scheduler.delete_schedule(&created.id).await.unwrap();
    let err = scheduler.get_schedule(&created.id).await.unwrap_err();
    assert!(
        matches!(err, SchedulerError::NotFound(_)),
        "expected NotFound, got {:?}",
        err
    );
}

#[tokio::test]
async fn test_enable_disable_schedule() {
    let tmp = tempfile::tempdir().unwrap();
    let handler = Arc::new(MockHandler::new());
    let scheduler = Scheduler::with_handler(tmp.path().join("scheduler.db"), "http://api.test", handler)
        .await
        .unwrap();

    let created = scheduler
        .create_schedule("owner-1", create_req("Toggle", "0 9 * * *", "echo hello"))
        .await
        .unwrap();

    let disabled = scheduler.disable_schedule(&created.id).await.unwrap();
    assert!(!disabled.enabled);

    let enabled = scheduler.enable_schedule(&created.id).await.unwrap();
    assert!(enabled.enabled);
}

#[tokio::test]
async fn test_invalid_cron_rejected() {
    let tmp = tempfile::tempdir().unwrap();
    let handler = Arc::new(MockHandler::new());
    let scheduler = Scheduler::with_handler(tmp.path().join("scheduler.db"), "http://api.test", handler)
        .await
        .unwrap();

    let err = scheduler
        .create_schedule("owner-1", create_req("Bad", "not a cron", "echo hello"))
        .await
        .unwrap_err();

    assert!(matches!(err, SchedulerError::InvalidCron(_)));
}

#[tokio::test]
async fn test_run_now_triggers_handler() {
    let tmp = tempfile::tempdir().unwrap();
    let handler = Arc::new(MockHandler::new());
    let scheduler = Scheduler::with_handler(tmp.path().join("scheduler.db"), "http://api.test", handler.clone())
        .await
        .unwrap();

    let created = scheduler
        .create_schedule("owner-1", create_req("Manual", "0 9 * * *", "echo run"))
        .await
        .unwrap();

    scheduler.run_now(&created.id).await.unwrap();

    let calls = handler.calls();
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].schedule_id, created.id);
    assert_eq!(calls[0].entrypoint, "echo run");

    let fetched = scheduler.get_schedule(&created.id).await.unwrap();
    assert!(fetched.last_triggered_at.is_some());
}

#[tokio::test]
async fn test_wake_due_schedules_triggers_only_due() {
    let tmp = tempfile::tempdir().unwrap();
    let handler = Arc::new(MockHandler::new());
    let scheduler = Scheduler::with_handler(tmp.path().join("scheduler.db"), "http://api.test", handler.clone())
        .await
        .unwrap();

    // A schedule due in the past.
    let due = scheduler
        .create_schedule(
            "owner-1",
            CreateScheduleRequest {
                name: "Due".to_string(),
                cron: "* * * * *".to_string(),
                timezone: None,
                entrypoint: "echo due".to_string(),
                args: None,
                env: None,
                priority: None,
                timeout_secs: None,
                run_mode: None,
            },
        )
        .await
        .unwrap();
    let mut due = due;
    due.next_run_at = Some(chrono::Utc::now() - chrono::Duration::minutes(1));
    scheduler.save_schedule(&due).await.unwrap();

    // A schedule far in the future.
    let future = scheduler
        .create_schedule(
            "owner-1",
            CreateScheduleRequest {
                name: "Future".to_string(),
                cron: "0 0 1 1 *".to_string(),
                timezone: None,
                entrypoint: "echo future".to_string(),
                args: None,
                env: None,
                priority: None,
                timeout_secs: None,
                run_mode: None,
            },
        )
        .await
        .unwrap();

    // A disabled schedule with a past next_run.
    let disabled = scheduler
        .create_schedule(
            "owner-1",
            CreateScheduleRequest {
                name: "Disabled".to_string(),
                cron: "* * * * *".to_string(),
                timezone: None,
                entrypoint: "echo disabled".to_string(),
                args: None,
                env: None,
                priority: None,
                timeout_secs: None,
                run_mode: None,
            },
        )
        .await
        .unwrap();
    scheduler.disable_schedule(&disabled.id).await.unwrap();
    let mut disabled = scheduler.get_schedule(&disabled.id).await.unwrap();
    disabled.next_run_at = Some(chrono::Utc::now() - chrono::Duration::minutes(1));
    scheduler.save_schedule(&disabled).await.unwrap();

    let triggered = scheduler.wake_due_schedules().await.unwrap();
    assert_eq!(triggered.len(), 1);
    assert_eq!(triggered[0], due.id);

    let calls = handler.calls();
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].schedule_id, due.id);

    // The future schedule should not have been triggered.
    let future_fetched = scheduler.get_schedule(&future.id).await.unwrap();
    assert!(future_fetched.last_triggered_at.is_none());
}

#[tokio::test]
async fn test_wake_does_not_retrigger_recently_triggered() {
    let tmp = tempfile::tempdir().unwrap();
    let handler = Arc::new(MockHandler::new());
    let scheduler = Scheduler::with_handler(tmp.path().join("scheduler.db"), "http://api.test", handler.clone())
        .await
        .unwrap();

    let due = scheduler
        .create_schedule(
            "owner-1",
            CreateScheduleRequest {
                name: "Due".to_string(),
                cron: "* * * * *".to_string(),
                timezone: None,
                entrypoint: "echo due".to_string(),
                args: None,
                env: None,
                priority: None,
                timeout_secs: None,
                run_mode: None,
            },
        )
        .await
        .unwrap();

    // Force next_run to the past, then trigger manually.
    let mut due = due;
    due.next_run_at = Some(chrono::Utc::now() - chrono::Duration::minutes(1));
    scheduler.save_schedule(&due).await.unwrap();

    scheduler.run_now(&due.id).await.unwrap();

    // Wake should not re-trigger because last_triggered_at >= next_run_at.
    let triggered = scheduler.wake_due_schedules().await.unwrap();
    assert!(triggered.is_empty());
}

#[tokio::test]
async fn test_api_list_schedules() {
    let tmp = tempfile::tempdir().unwrap();
    let handler = Arc::new(MockHandler::new());
    let scheduler = Arc::new(tokio::sync::RwLock::new(
        Scheduler::with_handler(tmp.path().join("scheduler.db"), "http://api.test", handler)
            .await
            .unwrap(),
    ));

    {
        let sched = scheduler.write().await;
        sched
            .create_schedule("owner-1", create_req("API Test", "0 9 * * *", "echo api"))
            .await
            .unwrap();
    }

    let state = Arc::new(api::ApiState { scheduler });
    let app = api::api_router(state);

    let response = axum::body::to_bytes(
        tower::ServiceExt::oneshot(
            app,
            axum::extract::Request::builder()
                .uri("/schedules")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap()
        .into_body(),
        usize::MAX,
    )
    .await
    .unwrap();

    let body: serde_json::Value = serde_json::from_slice(&response).unwrap();
    let schedules = body.as_array().unwrap();
    assert_eq!(schedules.len(), 1);
    assert_eq!(schedules[0]["name"], "API Test");
    assert_eq!(schedules[0]["status"], "active");
}

#[tokio::test]
async fn test_api_create_and_get_schedule() {
    let tmp = tempfile::tempdir().unwrap();
    let handler = Arc::new(MockHandler::new());
    let scheduler = Arc::new(tokio::sync::RwLock::new(
        Scheduler::with_handler(tmp.path().join("scheduler.db"), "http://api.test", handler)
            .await
            .unwrap(),
    ));

    let state = Arc::new(api::ApiState { scheduler });
    let app = api::api_router(state);

    let create_payload = serde_json::json!({
        "name": "Created via API",
        "schedule": "0 10 * * *",
        "entrypoint": "echo created",
    });

    let response = tower::ServiceExt::oneshot(
        app.clone(),
        axum::extract::Request::builder()
            .method("POST")
            .uri("/schedules")
            .header("content-type", "application/json")
            .body(axum::body::Body::from(create_payload.to_string()))
            .unwrap(),
    )
    .await
    .unwrap();

    assert_eq!(response.status(), axum::http::StatusCode::CREATED);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let created: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    let id = created["id"].as_str().unwrap();

    let get_response = tower::ServiceExt::oneshot(
        app,
        axum::extract::Request::builder()
            .uri(format!("/schedules/{}", id))
            .body(axum::body::Body::empty())
            .unwrap(),
    )
    .await
    .unwrap();

    assert_eq!(get_response.status(), axum::http::StatusCode::OK);
}

#[tokio::test]
async fn test_api_update_status_pause() {
    let tmp = tempfile::tempdir().unwrap();
    let handler = Arc::new(MockHandler::new());
    let scheduler = Arc::new(tokio::sync::RwLock::new(
        Scheduler::with_handler(tmp.path().join("scheduler.db"), "http://api.test", handler)
            .await
            .unwrap(),
    ));

    let created = {
        let sched = scheduler.write().await;
        sched
            .create_schedule("owner-1", create_req("Pause", "0 9 * * *", "echo pause"))
            .await
            .unwrap()
    };

    let state = Arc::new(api::ApiState { scheduler });
    let app = api::api_router(state);

    let patch_payload = serde_json::json!({ "status": "paused" });
    let response = tower::ServiceExt::oneshot(
        app,
        axum::extract::Request::builder()
            .method("PATCH")
            .uri(format!("/schedules/{}", created.id))
            .header("content-type", "application/json")
            .body(axum::body::Body::from(patch_payload.to_string()))
            .unwrap(),
    )
    .await
    .unwrap();

    assert_eq!(response.status(), axum::http::StatusCode::OK);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body["status"], "paused");
}

#[tokio::test]
async fn test_api_wake_endpoint() {
    let tmp = tempfile::tempdir().unwrap();
    let handler = Arc::new(MockHandler::new());
    let scheduler = Arc::new(tokio::sync::RwLock::new(
        Scheduler::with_handler(tmp.path().join("scheduler.db"), "http://api.test", handler)
            .await
            .unwrap(),
    ));

    let schedule_id = {
        let sched = scheduler.write().await;
        let schedule = sched
            .create_schedule(
                "owner-1",
                CreateScheduleRequest {
                    name: "Wake".to_string(),
                    cron: "* * * * *".to_string(),
                    timezone: None,
                    entrypoint: "echo wake".to_string(),
                    args: None,
                    env: None,
                    priority: None,
                    timeout_secs: None,
                    run_mode: None,
                },
            )
            .await
            .unwrap();
        schedule.id.clone()
    };

    {
        let sched = scheduler.write().await;
        let mut schedule = sched.get_schedule(&schedule_id).await.unwrap();
        schedule.next_run_at = Some(chrono::Utc::now() - chrono::Duration::minutes(1));
        sched.save_schedule(&schedule).await.unwrap();
    }

    let state = Arc::new(api::ApiState { scheduler });
    let app = api::api_router(state);

    let response = tower::ServiceExt::oneshot(
        app,
        axum::extract::Request::builder()
            .method("POST")
            .uri("/wake")
            .body(axum::body::Body::empty())
            .unwrap(),
    )
    .await
    .unwrap();

    assert_eq!(response.status(), axum::http::StatusCode::OK);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body["triggered"], 1);
    assert!(body["jobs"].as_array().unwrap().len() == 1);
}
