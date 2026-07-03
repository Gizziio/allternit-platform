//! Integration tests for the cowork runtime.
//!
//! These tests use a mock Rails client and a temporary directory so they can
//! run without a real Rails backend.

use std::sync::{Arc, Mutex};

use allternit_cowork_runtime::{
    CheckpointManager, ClientType, CoworkEvent, CreateJobSpec, CreateRunSpec, JobState,
    PermissionSet, RailsClient, RunManager, RunManagerConfig, RunMode, RunState,
};

/// Mock Rails client that records calls in memory.
#[derive(Default, Clone)]
struct MockRailsClient {
    inner: Arc<Mutex<MockRailsState>>,
}

#[derive(Default)]
struct MockRailsState {
    dags: Vec<(String, CreateRunSpec)>,
    nodes: Vec<(String, String, CreateJobSpec)>,
    run_state_updates: Vec<(String, RunState)>,
    job_state_updates: Vec<(String, JobState)>,
    events: Vec<CoworkEvent>,
}

#[async_trait::async_trait]
impl RailsClient for MockRailsClient {
    async fn create_dag(
        &self,
        run_id: allternit_cowork_runtime::RunId,
        spec: &CreateRunSpec,
    ) -> anyhow::Result<String> {
        let dag_id = format!("dag-{}", run_id);
        self.inner.lock().unwrap().dags.push((dag_id.clone(), spec.clone()));
        Ok(dag_id)
    }

    async fn create_node(
        &self,
        dag_id: &str,
        job_id: allternit_cowork_runtime::JobId,
        spec: &CreateJobSpec,
    ) -> anyhow::Result<String> {
        let node_id = format!("node-{}", job_id);
        self.inner
            .lock()
            .unwrap()
            .nodes
            .push((dag_id.to_string(), node_id.clone(), spec.clone()));
        Ok(node_id)
    }

    async fn update_run_state(&self, dag_id: &str, state: RunState) -> anyhow::Result<()> {
        self.inner
            .lock()
            .unwrap()
            .run_state_updates
            .push((dag_id.to_string(), state));
        Ok(())
    }

    async fn update_job_state(&self, node_id: &str, state: JobState) -> anyhow::Result<()> {
        self.inner
            .lock()
            .unwrap()
            .job_state_updates
            .push((node_id.to_string(), state));
        Ok(())
    }

    async fn request_lease(&self, _resource_id: &str, _owner_id: &str) -> anyhow::Result<bool> {
        Ok(true)
    }

    async fn release_lease(&self, _resource_id: &str, _owner_id: &str) -> anyhow::Result<()> {
        Ok(())
    }

    async fn append_event(&self, event: &CoworkEvent) -> anyhow::Result<()> {
        self.inner.lock().unwrap().events.push(event.clone());
        Ok(())
    }
}

fn test_config(data_dir: std::path::PathBuf) -> RunManagerConfig {
    RunManagerConfig {
        data_dir,
        rails_base_url: "http://127.0.0.1:3021".to_string(),
        attachment_timeout_secs: 300,
        lease_duration_secs: 60,
        max_checkpoint_age_hours: 24,
    }
}

#[tokio::test]
async fn test_run_lifecycle() {
    let tmp = tempfile::tempdir().unwrap();
    let client = Arc::new(MockRailsClient::default());
    let config = test_config(tmp.path().to_path_buf());
    let (manager, _events) = RunManager::new(config, client.clone()).await.unwrap();

    let run = manager
        .create_run(CreateRunSpec {
            tenant_id: "tenant-1".to_string(),
            workspace_id: "ws-1".to_string(),
            initiator: "test".to_string(),
            mode: RunMode::Cowork,
            entrypoint: "echo hello".to_string(),
            policy_profile: None,
        })
        .await
        .unwrap();

    assert_eq!(run.state, RunState::Created);
    assert_eq!(run.mode, RunMode::Cowork);
    assert!(!run.dag_id.is_empty());

    manager.transition_run_state(run.id, RunState::Planned).await.unwrap();
    manager.transition_run_state(run.id, RunState::Queued).await.unwrap();
    manager.transition_run_state(run.id, RunState::Running).await.unwrap();

    let fetched = manager.get_run(run.id).await.unwrap();
    assert_eq!(fetched.state, RunState::Running);

    manager.transition_run_state(run.id, RunState::Completed).await.unwrap();
    let completed = manager.get_run(run.id).await.unwrap();
    assert!(completed.state.is_terminal());
    assert!(completed.completed_at.is_some());

    // Give the async event forwarder a chance to run.
    tokio::task::yield_now().await;
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;

    let state = client.inner.lock().unwrap();
    assert_eq!(state.run_state_updates.len(), 4);
    assert!(
        state.events.iter().any(|e| matches!(e, CoworkEvent::RunCreated { .. })),
        "expected a RunCreated event, got {:?}",
        state.events
    );
}

#[tokio::test]
async fn test_invalid_run_transition_fails() {
    let tmp = tempfile::tempdir().unwrap();
    let client = Arc::new(MockRailsClient::default());
    let config = test_config(tmp.path().to_path_buf());
    let (manager, _events) = RunManager::new(config, client.clone()).await.unwrap();

    let run = manager
        .create_run(CreateRunSpec {
            tenant_id: "tenant-1".to_string(),
            workspace_id: "ws-1".to_string(),
            initiator: "test".to_string(),
            mode: RunMode::Cowork,
            entrypoint: "echo hello".to_string(),
            policy_profile: None,
        })
        .await
        .unwrap();

    let err = manager
        .transition_run_state(run.id, RunState::Completed)
        .await
        .unwrap_err();
    assert!(err.to_string().contains("Invalid state transition"));
}

#[tokio::test]
async fn test_job_lifecycle() {
    let tmp = tempfile::tempdir().unwrap();
    let client = Arc::new(MockRailsClient::default());
    let config = test_config(tmp.path().to_path_buf());
    let (manager, _events) = RunManager::new(config, client.clone()).await.unwrap();

    let run = manager
        .create_run(CreateRunSpec {
            tenant_id: "tenant-1".to_string(),
            workspace_id: "ws-1".to_string(),
            initiator: "test".to_string(),
            mode: RunMode::Cowork,
            entrypoint: "echo hello".to_string(),
            policy_profile: None,
        })
        .await
        .unwrap();

    let job = manager
        .create_job(CreateJobSpec {
            run_id: run.id,
            job_type: "shell".to_string(),
            priority: 0,
            payload: serde_json::json!({"cmd": "echo hello"}),
            max_retries: 3,
            timeout_sec: 60,
        })
        .await
        .unwrap();

    assert_eq!(job.state, JobState::Scheduled);

    manager.transition_job_state(job.id, JobState::Queued).await.unwrap();
    manager.transition_job_state(job.id, JobState::Running).await.unwrap();

    let fetched = manager.get_job(job.id).await.unwrap();
    assert_eq!(fetched.state, JobState::Running);
    assert!(fetched.started_at.is_some());

    manager.transition_job_state(job.id, JobState::Completed).await.unwrap();
    let completed = manager.get_job(job.id).await.unwrap();
    assert!(completed.state.is_terminal());
    assert!(completed.completed_at.is_some());
}

#[tokio::test]
async fn test_checkpoint_create_and_recover() {
    let tmp = tempfile::tempdir().unwrap();
    let client = Arc::new(MockRailsClient::default());
    let config = test_config(tmp.path().to_path_buf());
    let (manager, _events) = RunManager::new(config, client.clone()).await.unwrap();

    let run = manager
        .create_run(CreateRunSpec {
            tenant_id: "tenant-1".to_string(),
            workspace_id: "ws-1".to_string(),
            initiator: "test".to_string(),
            mode: RunMode::Cowork,
            entrypoint: "echo hello".to_string(),
            policy_profile: None,
        })
        .await
        .unwrap();

    let cursor = serde_json::json!({
        "event_cursor": "42",
        "memory": {"key": "value"},
    });

    let checkpoint = manager
        .checkpoint(run.id, None, 1, cursor.clone())
        .await
        .unwrap();

    assert_eq!(checkpoint.run_id, run.id);
    assert_eq!(checkpoint.step_index, 1);
    assert_eq!(checkpoint.cursor_state, cursor);

    let list = manager.list_checkpoints(run.id).await.unwrap();
    assert_eq!(list.len(), 1);

    // recover() transitions the run to Recovering, which is only valid from Queued.
    manager.transition_run_state(run.id, RunState::Planned).await.unwrap();
    manager.transition_run_state(run.id, RunState::Queued).await.unwrap();

    let recovered = manager.recover(run.id).await.unwrap().expect("checkpoint should exist");
    assert_eq!(recovered.0.id, checkpoint.id);
    assert_eq!(recovered.1, "42");

    let run_state = manager.get_run(run.id).await.unwrap();
    assert_eq!(run_state.state, RunState::Recovering);
}

#[tokio::test]
async fn test_attachment_lifecycle() {
    let tmp = tempfile::tempdir().unwrap();
    let client = Arc::new(MockRailsClient::default());
    let config = test_config(tmp.path().to_path_buf());
    let (manager, _events) = RunManager::new(config, client.clone()).await.unwrap();

    let run = manager
        .create_run(CreateRunSpec {
            tenant_id: "tenant-1".to_string(),
            workspace_id: "ws-1".to_string(),
            initiator: "test".to_string(),
            mode: RunMode::Cowork,
            entrypoint: "echo hello".to_string(),
            policy_profile: None,
        })
        .await
        .unwrap();

    manager.transition_run_state(run.id, RunState::Planned).await.unwrap();
    manager.transition_run_state(run.id, RunState::Queued).await.unwrap();
    manager.transition_run_state(run.id, RunState::Running).await.unwrap();

    let attachment = manager
        .attach(run.id, ClientType::Terminal, "session-1".to_string(), PermissionSet::operator())
        .await
        .unwrap();

    assert_eq!(attachment.run_id, run.id);
    assert_eq!(attachment.client_type, ClientType::Terminal);

    let active = manager.list_attachments(run.id).await.unwrap();
    assert_eq!(active.len(), 1);

    let reattached = manager.reattach(&attachment.reconnect_token, Some("10".to_string())).await.unwrap();
    assert_eq!(reattached.id, attachment.id);

    manager.detach(attachment.id).await.unwrap();
    let active_after = manager.list_attachments(run.id).await.unwrap();
    assert!(active_after.is_empty());
}

#[tokio::test]
async fn test_cannot_attach_to_non_running_run() {
    let tmp = tempfile::tempdir().unwrap();
    let client = Arc::new(MockRailsClient::default());
    let config = test_config(tmp.path().to_path_buf());
    let (manager, _events) = RunManager::new(config, client.clone()).await.unwrap();

    let run = manager
        .create_run(CreateRunSpec {
            tenant_id: "tenant-1".to_string(),
            workspace_id: "ws-1".to_string(),
            initiator: "test".to_string(),
            mode: RunMode::Cowork,
            entrypoint: "echo hello".to_string(),
            policy_profile: None,
        })
        .await
        .unwrap();

    let err = manager
        .attach(run.id, ClientType::Web, "session-1".to_string(), PermissionSet::read_only())
        .await
        .unwrap_err();
    assert!(err.to_string().contains("not in attachable state"));
}

#[tokio::test]
async fn test_checkpoint_manager_prune() {
    let tmp = tempfile::tempdir().unwrap();
    let cm = CheckpointManager::new(tmp.path().to_path_buf(), "http://127.0.0.1:3021")
        .await
        .unwrap();

    let run_id = allternit_cowork_runtime::RunId::new();

    for i in 0..3 {
        let _ = cm
            .create(
                run_id,
                None,
                i,
                serde_json::json!({"index": i}),
                vec![],
                vec![],
            )
            .await
            .unwrap();
    }

    // Small sleep to ensure distinct timestamps.
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;

    let deleted = cm.prune(run_id, 1).await.unwrap();
    assert_eq!(deleted, 2);

    let remaining = cm.list(run_id).await.unwrap();
    assert_eq!(remaining.len(), 1);
}
