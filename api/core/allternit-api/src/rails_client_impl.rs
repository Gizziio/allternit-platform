//! Rails HTTP client implementation
//!
//! Implements the RailsClient trait from allternit-cowork-runtime
//! to communicate with the Allternit Rails service.

use async_trait::async_trait;
use allternit_cowork_runtime::{
    CreateJobSpec, CreateRunSpec, CoworkEvent, JobId, JobState, RunId, RunState,
};
use std::sync::Arc;
use tracing::{debug, error, info, warn};

/// HTTP client for Rails service communication
pub struct RailsHttpClient {
    base_url: String,
    workspace_id: String,
    client: reqwest::Client,
}

impl RailsHttpClient {
    /// Create a new Rails HTTP client
    pub fn new(base_url: impl Into<String>, workspace_id: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            workspace_id: workspace_id.into(),
            client: reqwest::Client::new(),
        }
    }

    /// Get the base URL
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// Get the workspace ID
    pub fn workspace_id(&self) -> &str {
        &self.workspace_id
    }

    // Helper method for DAG operations
    async fn create_dag_in_rails(&self, dag_spec: &serde_json::Value) -> anyhow::Result<String> {
        let url = format!("{}/dags", self.base_url);

        let response = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "dag": dag_spec,
                "workspace_id": self.workspace_id
            }))
            .send()
            .await?;

        if response.status().is_success() {
            let body: serde_json::Value = response.json().await?;
            let dag_id = body["id"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing dag id in response"))?;
            Ok(dag_id.to_string())
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(anyhow::anyhow!("Rails error {}: {}", status, text))
        }
    }

    // Helper method for node operations
    async fn create_node_in_rails(
        &self,
        dag_id: &str,
        node_spec: &serde_json::Value,
    ) -> anyhow::Result<String> {
        let url = format!("{}/dags/{}/nodes", self.base_url, dag_id);

        let response = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "node": node_spec
            }))
            .send()
            .await?;

        if response.status().is_success() {
            let body: serde_json::Value = response.json().await?;
            let node_id = body["id"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing node id in response"))?;
            Ok(node_id.to_string())
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(anyhow::anyhow!("Rails error {}: {}", status, text))
        }
    }

    // Helper to append event to ledger
    async fn append_ledger_event(&self, event: &CoworkEvent) -> anyhow::Result<()> {
        let url = format!("{}/ledger/events", self.base_url);

        let event_json = serde_json::to_value(event)?;

        let response = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "event": event_json,
                "workspace_id": self.workspace_id
            }))
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(anyhow::anyhow!("Ledger error {}: {}", status, text))
        }
    }
}

#[async_trait]
impl allternit_cowork_runtime::RailsClient for RailsHttpClient {
    async fn create_dag(&self, run_id: RunId, spec: &CreateRunSpec) -> anyhow::Result<String> {
        info!(run_id = %run_id, "Creating DAG in Rails");

        let dag_spec = serde_json::json!({
            "name": format!("cowork-run-{}", run_id),
            "description": format!("Cowork run: {}", spec.entrypoint),
            "status": "created",
            "meta": {
                "run_id": run_id.to_string(),
                "entrypoint": spec.entrypoint,
                "mode": spec.mode.to_string(),
                "initiator": spec.initiator,
            }
        });

        self.create_dag_in_rails(&dag_spec).await
    }

    async fn create_node(
        &self,
        dag_id: &str,
        job_id: JobId,
        spec: &CreateJobSpec,
    ) -> anyhow::Result<String> {
        debug!(dag_id = %dag_id, job_id = %job_id, "Creating node in Rails DAG");

        let node_spec = serde_json::json!({
            "name": format!("job-{}", job_id),
            "job_type": spec.job_type,
            "priority": spec.priority,
            "status": "scheduled",
            "payload": spec.payload,
            "max_retries": spec.max_retries,
            "timeout_sec": spec.timeout_sec,
        });

        self.create_node_in_rails(dag_id, &node_spec).await
    }

    async fn update_run_state(&self, dag_id: &str, state: RunState) -> anyhow::Result<()> {
        let url = format!("{}/dags/{}", self.base_url, dag_id);

        let status_str = match state {
            RunState::Created => "created",
            RunState::Planned => "planned",
            RunState::Queued => "queued",
            RunState::Running => "running",
            RunState::Paused => "paused",
            RunState::AwaitingApproval => "awaiting_approval",
            RunState::Recovering => "recovering",
            RunState::Completed => "completed",
            RunState::Failed => "failed",
            RunState::Cancelled => "cancelled",
        };

        let response = self
            .client
            .patch(&url)
            .json(&serde_json::json!({
                "dag": {
                    "status": status_str
                }
            }))
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(anyhow::anyhow!("Update error {}: {}", status, text))
        }
    }

    async fn update_job_state(&self, node_id: &str, state: JobState) -> anyhow::Result<()> {
        let url = format!("{}/nodes/{}", self.base_url, node_id);

        let status_str = match state {
            JobState::Scheduled => "scheduled",
            JobState::Queued => "queued",
            JobState::Leased => "leased",
            JobState::Starting => "starting",
            JobState::Running => "running",
            JobState::Checkpointing => "checkpointing",
            JobState::AwaitingApproval => "awaiting_approval",
            JobState::RetryBackoff => "retry_backoff",
            JobState::Completed => "completed",
            JobState::Failed => "failed",
            JobState::DeadLetter => "dead_letter",
            JobState::Cancelled => "cancelled",
        };

        let response = self
            .client
            .patch(&url)
            .json(&serde_json::json!({
                "node": {
                    "status": status_str
                }
            }))
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(anyhow::anyhow!("Update error {}: {}", status, text))
        }
    }

    async fn request_lease(&self, resource_id: &str, owner_id: &str) -> anyhow::Result<bool> {
        let url = format!("{}/leases", self.base_url);

        let response = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "lease": {
                    "resource_id": resource_id,
                    "owner_id": owner_id,
                    "ttl_seconds": 60
                }
            }))
            .send()
            .await?;

        match response.status() {
            reqwest::StatusCode::CREATED | reqwest::StatusCode::OK => Ok(true),
            reqwest::StatusCode::CONFLICT => Ok(false),
            status => {
                let text = response.text().await.unwrap_or_default();
                Err(anyhow::anyhow!("Lease error {}: {}", status, text))
            }
        }
    }

    async fn release_lease(&self, resource_id: &str, owner_id: &str) -> anyhow::Result<()> {
        let url = format!("{}/leases/release", self.base_url);

        let response = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "resource_id": resource_id,
                "owner_id": owner_id
            }))
            .send()
            .await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(anyhow::anyhow!("Release error {}: {}", status, text))
        }
    }

    async fn append_event(&self, event: &CoworkEvent) -> anyhow::Result<()> {
        debug!("Appending event to Rails ledger");
        self.append_ledger_event(event).await
    }
}

/// Create a shared Rails client
pub fn create_rails_client(
    base_url: impl Into<String>,
    workspace_id: impl Into<String>,
) -> Arc<dyn allternit_cowork_runtime::RailsClient> {
    Arc::new(RailsHttpClient::new(base_url, workspace_id))
}
