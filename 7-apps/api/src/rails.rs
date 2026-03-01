//! A2R Agent System Rails Client
//!
//! Provides integration with the Agent System Rails for agent task planning,
//! work execution, and policy gates (DAG/WIH/leases/ledger/vault/mail/gate).
//!
//! Environment:
//!   - A2R_RAILS_URL: URL of the rails service (default: http://127.0.0.1:3011)

use axum::{
    extract::{Json, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Rails service configuration
#[derive(Clone)]
pub struct RailsClient {
    base_url: String,
    http_client: reqwest::Client,
}

impl RailsClient {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url,
            http_client: reqwest::Client::new(),
        }
    }

    pub fn from_env() -> Self {
        let base_url =
            std::env::var("A2R_RAILS_URL").unwrap_or_else(|_| "http://127.0.0.1:3011".to_string());
        Self::new(base_url)
    }

    // ============================================================================
    // Health
    // ============================================================================

    pub async fn health_check(&self) -> Result<bool, reqwest::Error> {
        let response = self
            .http_client
            .get(format!("{}/health", self.base_url))
            .send()
            .await?;
        Ok(response.status().is_success())
    }

    // ============================================================================
    // PLAN
    // ============================================================================

    pub async fn plan_new(&self, request: PlanNewRequest) -> Result<PlanNewResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/plan", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn plan_refine(
        &self,
        request: PlanRefineRequest,
    ) -> Result<PlanRefineResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/plan/refine", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn plan_show(&self, dag_id: &str) -> Result<PlanShowResponse, RailsError> {
        let response = self
            .http_client
            .get(format!("{}/v1/plan/{}", self.base_url, dag_id))
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    // ============================================================================
    // DAG
    // ============================================================================

    pub async fn dag_render(
        &self,
        dag_id: &str,
        format: Option<&str>,
    ) -> Result<DagRenderResponse, RailsError> {
        let mut url = format!("{}/v1/dags/{}/render", self.base_url, dag_id);
        if let Some(fmt) = format {
            url = format!("{}?format={}", url, fmt);
        }
        let response = self
            .http_client
            .get(url)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    // ============================================================================
    // WIH
    // ============================================================================

    pub async fn wih_list(&self, request: WihListRequest) -> Result<WihListResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/wihs", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn wih_pickup(
        &self,
        request: WihPickupRequest,
    ) -> Result<WihPickupResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/wihs/pickup", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn wih_context(&self, wih_id: &str) -> Result<WihContextResponse, RailsError> {
        let response = self
            .http_client
            .get(format!("{}/v1/wihs/{}/context", self.base_url, wih_id))
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn wih_sign_open(
        &self,
        wih_id: &str,
        request: WihSignOpenRequest,
    ) -> Result<WihSignOpenResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/wihs/{}/sign", self.base_url, wih_id))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn wih_close(
        &self,
        wih_id: &str,
        request: WihCloseRequest,
    ) -> Result<WihCloseResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/wihs/{}/close", self.base_url, wih_id))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    // ============================================================================
    // LEASE
    // ============================================================================

    pub async fn lease_request(&self, request: LeaseRequest) -> Result<LeaseResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/leases", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn lease_release(&self, lease_id: &str) -> Result<LeaseReleaseResponse, RailsError> {
        let response = self
            .http_client
            .delete(format!("{}/v1/leases/{}", self.base_url, lease_id))
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    // ============================================================================
    // LEDGER
    // ============================================================================

    pub async fn ledger_tail(
        &self,
        request: LedgerTailRequest,
    ) -> Result<Vec<serde_json::Value>, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/ledger/tail", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn ledger_trace(
        &self,
        request: LedgerTraceRequest,
    ) -> Result<Vec<serde_json::Value>, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/ledger/trace", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    // ============================================================================
    // INDEX
    // ============================================================================

    pub async fn index_rebuild(&self) -> Result<IndexRebuildResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/index/rebuild", self.base_url))
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    // ============================================================================
    // MAIL
    // ============================================================================

    pub async fn mail_ensure_thread(
        &self,
        request: MailEnsureThreadRequest,
    ) -> Result<MailEnsureThreadResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/mail/threads", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn mail_send(
        &self,
        request: MailSendRequest,
    ) -> Result<MailSendResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/mail/send", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn mail_request_review(
        &self,
        request: MailRequestReviewRequest,
    ) -> Result<serde_json::Value, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/mail/review", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn mail_decide(
        &self,
        request: MailDecideRequest,
    ) -> Result<serde_json::Value, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/mail/decide", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn mail_inbox(
        &self,
        thread_id: Option<&str>,
        limit: Option<usize>,
    ) -> Result<Vec<serde_json::Value>, RailsError> {
        let mut url = format!("{}/v1/mail/inbox", self.base_url);
        let mut params = Vec::new();
        if let Some(tid) = thread_id {
            params.push(format!("thread_id={}", tid));
        }
        if let Some(lim) = limit {
            params.push(format!("limit={}", lim));
        }
        if !params.is_empty() {
            url = format!("{}?{}", url, params.join("&"));
        }

        let response = self
            .http_client
            .get(url)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn mail_ack(&self, request: MailAckRequest) -> Result<serde_json::Value, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/mail/ack", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn mail_reserve(
        &self,
        request: MailReserveRequest,
    ) -> Result<serde_json::Value, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/mail/reserve", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn mail_release(&self, lease_id: &str) -> Result<serde_json::Value, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/mail/release/{}", self.base_url, lease_id))
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn mail_share(
        &self,
        request: MailShareRequest,
    ) -> Result<serde_json::Value, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/mail/share", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn mail_archive(
        &self,
        request: MailArchiveRequest,
    ) -> Result<serde_json::Value, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/mail/archive", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn mail_guard(
        &self,
        request: MailGuardRequest,
    ) -> Result<serde_json::Value, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/mail/guard", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    // ============================================================================
    // GATE
    // ============================================================================

    pub async fn gate_status(&self) -> Result<GateStatusResponse, RailsError> {
        let response = self
            .http_client
            .get(format!("{}/v1/gate/status", self.base_url))
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn gate_check(
        &self,
        request: GateCheckRequest,
    ) -> Result<GateCheckResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/gate/check", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn gate_rules(&self) -> Result<GateRulesResponse, RailsError> {
        let response = self
            .http_client
            .get(format!("{}/v1/gate/rules", self.base_url))
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn gate_verify(&self, json: bool) -> Result<GateVerifyResponse, RailsError> {
        let response = self
            .http_client
            .get(format!("{}/v1/gate/verify?json={}", self.base_url, json))
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn gate_decision(
        &self,
        request: GateDecisionRequest,
    ) -> Result<GateDecisionResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/gate/decision", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn gate_mutate(
        &self,
        request: GateMutateRequest,
    ) -> Result<GateMutateResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/gate/mutate", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    // ============================================================================
    // VAULT
    // ============================================================================

    pub async fn vault_archive(
        &self,
        request: VaultArchiveRequest,
    ) -> Result<VaultArchiveResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/vault/archive", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    pub async fn vault_status(&self) -> Result<VaultStatusResponse, RailsError> {
        let response = self
            .http_client
            .get(format!("{}/v1/vault/status", self.base_url))
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }

    // ============================================================================
    // INIT
    // ============================================================================

    pub async fn init_system(&self) -> Result<InitResponse, RailsError> {
        let response = self
            .http_client
            .post(format!("{}/v1/init", self.base_url))
            .send()
            .await
            .map_err(|e| RailsError::Http(e.to_string()))?;

        handle_response(response).await
    }
}

async fn handle_response<T: serde::de::DeserializeOwned>(
    response: reqwest::Response,
) -> Result<T, RailsError> {
    if response.status().is_success() {
        response
            .json()
            .await
            .map_err(|e| RailsError::Parse(e.to_string()))
    } else {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        Err(RailsError::Service(format!("{}: {}", status, text)))
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RailsError {
    #[error("HTTP error: {0}")]
    Http(String),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Service error: {0}")]
    Service(String),
}

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanNewRequest {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dag_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanNewResponse {
    pub prompt_id: String,
    pub dag_id: String,
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanRefineRequest {
    pub dag_id: String,
    pub delta: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mutations: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanRefineResponse {
    pub delta_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanShowResponse {
    pub dag_id: String,
    pub dag: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagRenderResponse {
    pub dag_id: String,
    pub format: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WihListRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dag_id: Option<String>,
    #[serde(default)]
    pub ready_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WihListResponse {
    pub wihs: Vec<WihInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WihInfo {
    pub wih_id: String,
    pub node_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dag_id: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WihPickupRequest {
    pub dag_id: String,
    pub node_id: String,
    pub agent_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(default)]
    pub fresh: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WihPickupResponse {
    pub wih_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_pack_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WihContextResponse {
    pub wih_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_pack: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WihSignOpenRequest {
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WihSignOpenResponse {
    pub signed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WihCloseRequest {
    pub status: String,
    #[serde(default)]
    pub evidence: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WihCloseResponse {
    pub closed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseRequest {
    pub wih_id: String,
    pub agent_id: String,
    pub paths: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ttl_seconds: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseResponse {
    pub lease_id: String,
    pub granted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseReleaseResponse {
    pub released: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedgerTailRequest {
    #[serde(default = "default_tail_count")]
    pub count: usize,
}

fn default_tail_count() -> usize {
    50
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedgerTraceRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wih_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexRebuildResponse {
    pub indexed_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailEnsureThreadRequest {
    pub topic: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailEnsureThreadResponse {
    pub thread_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailSendRequest {
    pub thread_id: String,
    pub body_ref: String,
    #[serde(default)]
    pub attachments: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailSendResponse {
    pub sent: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailRequestReviewRequest {
    pub thread_id: String,
    pub wih_id: String,
    pub diff_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailDecideRequest {
    pub thread_id: String,
    pub approve: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailAckRequest {
    pub thread_id: String,
    pub message_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailReserveRequest {
    pub wih_id: String,
    pub agent_id: String,
    pub paths: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ttl: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailShareRequest {
    pub thread_id: String,
    pub asset_ref: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailArchiveRequest {
    pub thread_id: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailGuardRequest {
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateStatusResponse {
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateCheckRequest {
    pub wih_id: String,
    pub tool: String,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateCheckResponse {
    pub allowed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateRulesResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rules: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateVerifyResponse {
    pub ok: bool,
    pub ledger_chain_ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ledger_chain_issues: Option<Vec<String>>,
    pub cycle_dags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateDecisionRequest {
    pub note: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default)]
    pub links: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateDecisionResponse {
    pub decision_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateMutateRequest {
    pub dag_id: String,
    pub note: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mutations: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateMutateResponse {
    pub decision_id: String,
    pub mutation_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultArchiveRequest {
    pub wih_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultArchiveResponse {
    pub archived: bool,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultJobStatus {
    pub wih_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultStatusResponse {
    pub jobs: Vec<VaultJobStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitResponse {
    pub initialized: bool,
    pub stores: Vec<String>,
}

// ============================================================================
// API Routes
// ============================================================================

pub fn create_rails_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        // Health
        .route("/api/v1/rails/health", get(rails_health))
        // PLAN
        .route("/api/v1/rails/plan", post(plan_new_handler))
        .route("/api/v1/rails/plan/refine", post(plan_refine_handler))
        .route("/api/v1/rails/plan/:dag_id", get(plan_show_handler))
        // DAG
        .route("/api/v1/rails/dags/:dag_id/render", get(dag_render_handler))
        // WIH
        .route("/api/v1/rails/wihs", post(wih_list_handler))
        .route("/api/v1/rails/wihs/pickup", post(wih_pickup_handler))
        .route(
            "/api/v1/rails/wihs/:wih_id/context",
            get(wih_context_handler),
        )
        .route(
            "/api/v1/rails/wihs/:wih_id/sign",
            post(wih_sign_open_handler),
        )
        .route("/api/v1/rails/wihs/:wih_id/close", post(wih_close_handler))
        // LEASE
        .route("/api/v1/rails/leases", post(lease_request_handler))
        .route(
            "/api/v1/rails/leases/:lease_id",
            delete(lease_release_handler),
        )
        // LEDGER
        .route("/api/v1/rails/ledger/tail", post(ledger_tail_handler))
        .route("/api/v1/rails/ledger/trace", post(ledger_trace_handler))
        // INDEX
        .route("/api/v1/rails/index/rebuild", post(index_rebuild_handler))
        // MAIL
        .route(
            "/api/v1/rails/mail/threads",
            post(mail_ensure_thread_handler),
        )
        .route("/api/v1/rails/mail/send", post(mail_send_handler))
        .route(
            "/api/v1/rails/mail/review",
            post(mail_request_review_handler),
        )
        .route("/api/v1/rails/mail/decide", post(mail_decide_handler))
        .route("/api/v1/rails/mail/inbox", get(mail_inbox_handler))
        .route("/api/v1/rails/mail/ack", post(mail_ack_handler))
        .route("/api/v1/rails/mail/reserve", post(mail_reserve_handler))
        .route(
            "/api/v1/rails/mail/release/:lease_id",
            post(mail_release_handler),
        )
        .route("/api/v1/rails/mail/share", post(mail_share_handler))
        .route("/api/v1/rails/mail/archive", post(mail_archive_handler))
        .route("/api/v1/rails/mail/guard", post(mail_guard_handler))
        // GATE
        .route("/api/v1/rails/gate/status", get(gate_status_handler))
        .route("/api/v1/rails/gate/check", post(gate_check_handler))
        .route("/api/v1/rails/gate/rules", get(gate_rules_handler))
        .route("/api/v1/rails/gate/verify", get(gate_verify_handler))
        .route("/api/v1/rails/gate/decision", post(gate_decision_handler))
        .route("/api/v1/rails/gate/mutate", post(gate_mutate_handler))
        // VAULT
        .route("/api/v1/rails/vault/archive", post(vault_archive_handler))
        .route("/api/v1/rails/vault/status", get(vault_status_handler))
        // INIT
        .route("/api/v1/rails/init", post(init_handler))
}

// ============================================================================
// Route Handlers
// ============================================================================

async fn rails_health() -> impl IntoResponse {
    let client = RailsClient::from_env();
    match client.health_check().await {
        Ok(true) => (
            StatusCode::OK,
            Json(serde_json::json!({ "status": "healthy" })),
        ),
        Ok(false) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "status": "unhealthy" })),
        ),
        Err(e) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "status": "error", "message": e.to_string() })),
        ),
    }
}

async fn plan_new_handler(
    Json(request): Json<PlanNewRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.plan_new(request).await {
        Ok(response) => Ok((StatusCode::CREATED, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn plan_refine_handler(
    Json(request): Json<PlanRefineRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.plan_refine(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn plan_show_handler(Path(dag_id): Path<String>) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.plan_show(&dag_id).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn dag_render_handler(
    Path(dag_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    let format = params.get("format").map(|s| s.as_str());
    match client.dag_render(&dag_id, format).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn wih_list_handler(
    Json(request): Json<WihListRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.wih_list(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn wih_pickup_handler(
    Json(request): Json<WihPickupRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.wih_pickup(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn wih_context_handler(Path(wih_id): Path<String>) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.wih_context(&wih_id).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn wih_sign_open_handler(
    Path(wih_id): Path<String>,
    Json(request): Json<WihSignOpenRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.wih_sign_open(&wih_id, request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn wih_close_handler(
    Path(wih_id): Path<String>,
    Json(request): Json<WihCloseRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.wih_close(&wih_id, request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn lease_request_handler(
    Json(request): Json<LeaseRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.lease_request(request).await {
        Ok(response) => Ok((StatusCode::CREATED, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn lease_release_handler(
    Path(lease_id): Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.lease_release(&lease_id).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn ledger_tail_handler(
    Json(request): Json<LedgerTailRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.ledger_tail(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn ledger_trace_handler(
    Json(request): Json<LedgerTraceRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.ledger_trace(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn index_rebuild_handler() -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.index_rebuild().await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn mail_ensure_thread_handler(
    Json(request): Json<MailEnsureThreadRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.mail_ensure_thread(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn mail_send_handler(
    Json(request): Json<MailSendRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.mail_send(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn mail_request_review_handler(
    Json(request): Json<MailRequestReviewRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.mail_request_review(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn mail_decide_handler(
    Json(request): Json<MailDecideRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.mail_decide(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn mail_inbox_handler(
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    let thread_id = params.get("thread_id").map(|s| s.as_str());
    let limit = params.get("limit").and_then(|s| s.parse().ok());
    match client.mail_inbox(thread_id, limit).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn mail_ack_handler(
    Json(request): Json<MailAckRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.mail_ack(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn mail_reserve_handler(
    Json(request): Json<MailReserveRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.mail_reserve(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn mail_release_handler(
    Path(lease_id): Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.mail_release(&lease_id).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn mail_share_handler(
    Json(request): Json<MailShareRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.mail_share(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn mail_archive_handler(
    Json(request): Json<MailArchiveRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.mail_archive(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn mail_guard_handler(
    Json(request): Json<MailGuardRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.mail_guard(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn gate_status_handler() -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.gate_status().await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn gate_check_handler(
    Json(request): Json<GateCheckRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.gate_check(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn gate_rules_handler() -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.gate_rules().await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn gate_verify_handler(
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    let json = params.get("json").map(|s| s == "true").unwrap_or(false);
    match client.gate_verify(json).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn gate_decision_handler(
    Json(request): Json<GateDecisionRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.gate_decision(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn gate_mutate_handler(
    Json(request): Json<GateMutateRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.gate_mutate(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn vault_archive_handler(
    Json(request): Json<VaultArchiveRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.vault_archive(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn vault_status_handler() -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.vault_status().await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn init_handler() -> Result<impl IntoResponse, StatusCode> {
    let client = RailsClient::from_env();
    match client.init_system().await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
