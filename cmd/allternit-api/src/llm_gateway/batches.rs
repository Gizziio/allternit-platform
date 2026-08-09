//! Phase 5 batch metadata storage, provider execution, and polling.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;
use tracing::{info, warn};

use crate::{db::DbHandle, AppState};

use super::{
    auth::LlmKeyContext,
    translate::{validate_request, ChatCompletionRequest, OpenAiErrorResponse},
};

#[derive(Debug, Deserialize)]
pub struct CreateBatchRequest {
    pub requests: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Batch {
    pub id: String,
    pub object: &'static str,
    pub status: String,
    pub request_count: usize,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cancelled_at: Option<String>,
}

pub struct BatchesService {
    db: DbHandle,
}

impl BatchesService {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    pub fn create(&self, key: &LlmKeyContext, requests: &[Value]) -> rusqlite::Result<Batch> {
        let id = format!("batch_{}", uuid::Uuid::new_v4().simple());
        let requests_json = serde_json::to_string(requests)
            .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?;
        let conn = self.db.connect()?;
        conn.execute(
            "INSERT INTO llm_batches (id, virtual_key_id, user_id, tenant_id, requests_json, status)
             VALUES (?1, ?2, ?3, ?4, ?5, 'validating')",
            params![id, key.key_id, key.user_id, key.tenant_id, requests_json],
        )?;
        self.get(&key.key_id, &id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn list(&self, key_id: &str) -> rusqlite::Result<Vec<Batch>> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, status, requests_json, created_at, updated_at, cancelled_at
             FROM llm_batches WHERE virtual_key_id = ?1 ORDER BY created_at DESC, id DESC",
        )?;
        let rows = stmt.query_map([key_id], batch_from_row)?;
        rows.collect()
    }

    pub fn get(&self, key_id: &str, id: &str) -> rusqlite::Result<Option<Batch>> {
        let conn = self.db.connect()?;
        conn.query_row(
            "SELECT id, status, requests_json, created_at, updated_at, cancelled_at
             FROM llm_batches WHERE virtual_key_id = ?1 AND id = ?2",
            params![key_id, id],
            batch_from_row,
        )
        .optional()
    }

    pub fn cancel(&self, key_id: &str, id: &str) -> rusqlite::Result<Option<Batch>> {
        let conn = self.db.connect()?;
        conn.execute(
            "UPDATE llm_batches SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
             WHERE virtual_key_id = ?1 AND id = ?2 AND status NOT IN ('cancelled', 'completed', 'failed')",
            params![key_id, id],
        )?;
        drop(conn);
        self.get(key_id, id)
    }

    pub fn results(&self, key_id: &str, id: &str) -> rusqlite::Result<Option<Value>> {
        let conn = self.db.connect()?;
        conn.query_row(
            "SELECT results_json FROM llm_batches WHERE virtual_key_id = ?1 AND id = ?2",
            params![key_id, id],
            |row| {
                let raw: String = row.get(0)?;
                serde_json::from_str(&raw).map_err(|err| {
                    rusqlite::Error::FromSqlConversionFailure(
                        0,
                        rusqlite::types::Type::Text,
                        Box::new(err),
                    )
                })
            },
        )
        .optional()
    }
}

fn batch_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Batch> {
    let requests_json: String = row.get(2)?;
    let request_count = serde_json::from_str::<Vec<Value>>(&requests_json)
        .map(|requests| requests.len())
        .unwrap_or(0);
    Ok(Batch {
        id: row.get(0)?,
        object: "batch",
        status: row.get(1)?,
        request_count,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
        cancelled_at: row.get(5)?,
    })
}

fn internal_error(err: impl std::fmt::Display) -> Response {
    OpenAiErrorResponse::new(
        StatusCode::INTERNAL_SERVER_ERROR,
        format!("Internal error: {err}"),
        "server_error",
        None,
        Some(super::translate::error_code::INTERNAL_ERROR),
    )
    .into_response()
}

fn not_found(id: &str) -> Response {
    OpenAiErrorResponse::new(
        StatusCode::NOT_FOUND,
        format!("Batch `{id}` was not found."),
        "invalid_request_error",
        Some("id"),
        Some(super::translate::error_code::INVALID_REQUEST),
    )
    .into_response()
}

pub async fn create_batch(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
    Json(body): Json<CreateBatchRequest>,
) -> Response {
    if body.requests.is_empty() {
        return OpenAiErrorResponse::invalid_request(
            "`requests` must contain at least one request.",
            Some("requests"),
        )
        .into_response();
    }
    for (index, value) in body.requests.iter().enumerate() {
        let request: ChatCompletionRequest = match serde_json::from_value(value.clone()) {
            Ok(request) => request,
            Err(err) => {
                return OpenAiErrorResponse::invalid_request(
                    format!("Invalid request at index {index}: {err}"),
                    Some("requests"),
                )
                .into_response()
            }
        };
        if let Err(err) = validate_request(&request) {
            return err.into_response();
        }
        if !key.model_allowed(&request.model) {
            return OpenAiErrorResponse::new(
                StatusCode::FORBIDDEN,
                format!(
                    "This API key is not allowed to use model `{}`.",
                    request.model
                ),
                "permission_error",
                Some("model"),
                Some(super::translate::error_code::PERMISSION_DENIED),
            )
            .into_response();
        }
    }
    match BatchesService::new(state.db.clone()).create(&key, &body.requests) {
        Ok(batch) => (StatusCode::CREATED, Json(batch)).into_response(),
        Err(err) => internal_error(err),
    }
}

pub async fn list_batches(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
) -> Response {
    match BatchesService::new(state.db.clone()).list(&key.key_id) {
        Ok(data) => Json(json!({ "object": "list", "data": data })).into_response(),
        Err(err) => internal_error(err),
    }
}

pub async fn get_batch(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
    Path(id): Path<String>,
) -> Response {
    match BatchesService::new(state.db.clone()).get(&key.key_id, &id) {
        Ok(Some(batch)) => Json(batch).into_response(),
        Ok(None) => not_found(&id),
        Err(err) => internal_error(err),
    }
}

pub async fn cancel_batch(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
    Path(id): Path<String>,
) -> Response {
    match BatchesService::new(state.db.clone()).cancel(&key.key_id, &id) {
        Ok(Some(batch)) => Json(batch).into_response(),
        Ok(None) => not_found(&id),
        Err(err) => internal_error(err),
    }
}

pub async fn batch_results(
    State(state): State<Arc<AppState>>,
    Extension(key): Extension<LlmKeyContext>,
    Path(id): Path<String>,
) -> Response {
    match BatchesService::new(state.db.clone()).results(&key.key_id, &id) {
        Ok(Some(data)) => Json(json!({ "object": "list", "data": data })).into_response(),
        Ok(None) => not_found(&id),
        Err(err) => internal_error(err),
    }
}

// ─── Batch error schema ─────────────────────────────────────────────────────

/// Per-request error object returned in batch results.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BatchRequestError {
    pub index: usize,
    pub code: String,
    pub message: String,
}

impl BatchRequestError {
    pub fn new(index: usize, code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            index,
            code: code.into(),
            message: message.into(),
        }
    }
}

// ─── Provider abstraction ───────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub enum BatchJobStatus {
    Validating,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

impl BatchJobStatus {
    fn from_wire(s: &str) -> Self {
        match s.to_ascii_lowercase().as_str() {
            "validating" => BatchJobStatus::Validating,
            "in_progress" | "processing" | "queued" => BatchJobStatus::InProgress,
            "completed" | "done" => BatchJobStatus::Completed,
            "failed" | "error" => BatchJobStatus::Failed,
            "cancelled" | "canceled" => BatchJobStatus::Cancelled,
            _ => BatchJobStatus::InProgress,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ProviderBatchJob {
    pub id: String,
    pub status: String,
}

#[derive(Debug, Clone)]
pub struct ProviderBatchStatus {
    pub status: BatchJobStatus,
    pub results: Option<Vec<Value>>,
}

#[derive(Debug, Clone)]
pub struct BatchProviderError {
    pub is_transient: bool,
    pub code: String,
    pub message: String,
}

impl BatchProviderError {
    pub fn transient(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            is_transient: true,
            code: code.into(),
            message: message.into(),
        }
    }

    pub fn permanent(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            is_transient: false,
            code: code.into(),
            message: message.into(),
        }
    }
}

#[async_trait::async_trait]
pub trait BatchProvider: Send + Sync {
    async fn submit(&self, requests: &[Value]) -> Result<ProviderBatchJob, BatchProviderError>;
    async fn poll(&self, provider_batch_id: &str) -> Result<ProviderBatchStatus, BatchProviderError>;
}

// ─── Generic HTTP batch provider ────────────────────────────────────────────

/// A generic HTTP provider that speaks an OpenAI-style `/v1/batches` surface.
pub struct HttpBatchProvider {
    client: reqwest::Client,
    base_url: String,
    api_key: Option<String>,
}

impl HttpBatchProvider {
    pub fn new(base_url: String, api_key: Option<String>) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key,
        }
    }

    pub fn from_config(config: &crate::config::AppConfig) -> Self {
        let base_url = std::env::var("ALLTERNIT_BATCH_PROVIDER_URL")
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| config.terminal_server_url());
        let api_key = std::env::var("ALLTERNIT_BATCH_PROVIDER_KEY")
            .ok()
            .filter(|s| !s.is_empty());
        Self::new(base_url, api_key)
    }
}

#[async_trait::async_trait]
impl BatchProvider for HttpBatchProvider {
    async fn submit(&self, requests: &[Value]) -> Result<ProviderBatchJob, BatchProviderError> {
        let url = format!("{}/v1/batches", self.base_url);
        let body = json!({
            "endpoint": "/v1/chat/completions",
            "requests": requests,
        });
        let mut req = self.client.post(&url).json(&body);
        if let Some(key) = &self.api_key {
            req = req.header("Authorization", format!("Bearer {key}"));
        }
        let resp = req.send().await.map_err(|err| {
            if err.is_timeout() || err.is_connect() {
                BatchProviderError::transient("provider_unavailable", err.to_string())
            } else {
                BatchProviderError::transient("provider_error", err.to_string())
            }
        })?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if status.is_server_error() {
            return Err(BatchProviderError::transient(
                "provider_server_error",
                format!("{status}: {text}"),
            ));
        }
        if !status.is_success() {
            return Err(BatchProviderError::permanent(
                "provider_client_error",
                format!("{status}: {text}"),
            ));
        }

        let value: Value = serde_json::from_str(&text).map_err(|err| {
            BatchProviderError::permanent("provider_decode_error", err.to_string())
        })?;
        let id = value
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| {
                BatchProviderError::permanent("provider_missing_id", "batch id missing from response".to_string())
            })?;
        let status = value
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("in_progress")
            .to_string();
        Ok(ProviderBatchJob { id: id.to_string(), status })
    }

    async fn poll(&self, provider_batch_id: &str) -> Result<ProviderBatchStatus, BatchProviderError> {
        let url = format!("{}/v1/batches/{}", self.base_url, provider_batch_id);
        let mut req = self.client.get(&url);
        if let Some(key) = &self.api_key {
            req = req.header("Authorization", format!("Bearer {key}"));
        }
        let resp = req.send().await.map_err(|err| {
            if err.is_timeout() || err.is_connect() {
                BatchProviderError::transient("provider_unavailable", err.to_string())
            } else {
                BatchProviderError::transient("provider_error", err.to_string())
            }
        })?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if status.is_server_error() {
            return Err(BatchProviderError::transient(
                "provider_server_error",
                format!("{status}: {text}"),
            ));
        }
        if !status.is_success() {
            return Err(BatchProviderError::permanent(
                "provider_client_error",
                format!("{status}: {text}"),
            ));
        }

        let value: Value = serde_json::from_str(&text).map_err(|err| {
            BatchProviderError::permanent("provider_decode_error", err.to_string())
        })?;
        let job_status = value
            .get("status")
            .and_then(Value::as_str)
            .map(BatchJobStatus::from_wire)
            .unwrap_or(BatchJobStatus::InProgress);
        let results = value
            .get("results")
            .and_then(Value::as_array)
            .cloned();
        Ok(ProviderBatchStatus {
            status: job_status,
            results,
        })
    }
}

// ─── Background worker ──────────────────────────────────────────────────────

const WORKER_INTERVAL: Duration = Duration::from_secs(5);
const MAX_RETRIES: usize = 3;

struct PendingBatch {
    id: String,
    status: String,
    requests_json: String,
    provider_batch_id: Option<String>,
    retry_count: usize,
}

pub struct BatchWorker<P: BatchProvider> {
    db: DbHandle,
    provider: Arc<P>,
}

impl<P: BatchProvider> BatchWorker<P> {
    pub fn new(db: DbHandle, provider: Arc<P>) -> Self {
        Self { db, provider }
    }

    pub async fn run(self, interval: Duration) {
        let mut interval = tokio::time::interval(interval);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            interval.tick().await;
            if let Err(err) = self.process_once().await {
                warn!(error = %err, "Batch worker iteration failed");
            }
        }
    }

    async fn process_once(&self) -> rusqlite::Result<()> {
        let db = self.db.clone();
        let batches = tokio::task::spawn_blocking(move || -> rusqlite::Result<Vec<PendingBatch>> {
            let conn = db.connect()?;
            let mut stmt = conn.prepare(
                "SELECT id, status, requests_json, provider_batch_id, retry_count
                 FROM llm_batches
                 WHERE status IN ('validating', 'in_progress')
                 ORDER BY created_at ASC",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(PendingBatch {
                    id: row.get(0)?,
                    status: row.get(1)?,
                    requests_json: row.get(2)?,
                    provider_batch_id: row.get(3)?,
                    retry_count: row.get::<_, i64>(4)? as usize,
                })
            })?;
            rows.collect()
        })
        .await
        .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))??;

        for batch in batches {
            if let Err(err) = self.process_batch(batch).await {
                warn!(error = %err, "Failed to process batch");
            }
        }
        Ok(())
    }

    async fn process_batch(&self, batch: PendingBatch) -> rusqlite::Result<()> {
        let requests: Vec<Value> =
            serde_json::from_str(&batch.requests_json).unwrap_or_default();
        let request_count = requests.len().max(1);

        match batch.status.as_str() {
            "validating" => match self.provider.submit(&requests).await {
                Ok(job) => {
                    if BatchJobStatus::from_wire(&job.status) == BatchJobStatus::Completed {
                        // Some providers complete synchronously; fetch results now.
                        match self.provider.poll(&job.id).await {
                            Ok(poll) if poll.status == BatchJobStatus::Completed => {
                                self.complete(&batch.id, &job.id, poll.results.unwrap_or_default())
                                    .await?;
                            }
                            _ => self.mark_in_progress(&batch.id, &job.id).await?,
                        }
                    } else {
                        self.mark_in_progress(&batch.id, &job.id).await?;
                    }
                }
                Err(err) => {
                    self.handle_provider_error(&batch, request_count, err).await?;
                }
            },
            "in_progress" => {
                if let Some(provider_id) = &batch.provider_batch_id {
                    match self.provider.poll(provider_id).await {
                        Ok(poll) => match poll.status {
                            BatchJobStatus::Completed => {
                                self.complete(
                                    &batch.id,
                                    provider_id,
                                    poll.results.unwrap_or_default(),
                                )
                                .await?;
                            }
                            BatchJobStatus::Failed => {
                                let errors = error_results(
                                    request_count,
                                    "provider_failed",
                                    "Provider reported the batch failed",
                                );
                                self.fail(&batch.id, errors).await?;
                            }
                            BatchJobStatus::Cancelled => self.cancel(&batch.id).await?,
                            _ => {}
                        },
                        Err(err) => {
                            self.handle_provider_error(&batch, request_count, err).await?;
                        }
                    }
                } else {
                    let errors = error_results(
                        request_count,
                        "missing_provider_batch_id",
                        "Batch has no provider batch id",
                    );
                    self.fail(&batch.id, errors).await?;
                }
            }
            _ => {}
        }
        Ok(())
    }

    async fn handle_provider_error(
        &self,
        batch: &PendingBatch,
        request_count: usize,
        err: BatchProviderError,
    ) -> rusqlite::Result<()> {
        if err.is_transient && batch.retry_count < MAX_RETRIES {
            self.increment_retry(&batch.id).await?;
            info!(batch_id = %batch.id, retry = batch.retry_count + 1, "Transient batch provider error; will retry");
            Ok(())
        } else {
            let errors = error_results(request_count, err.code, err.message);
            self.fail(&batch.id, errors).await
        }
    }

    async fn mark_in_progress(&self, id: &str, provider_batch_id: &str) -> rusqlite::Result<()> {
        let db = self.db.clone();
        let id = id.to_string();
        let provider_batch_id = provider_batch_id.to_string();
        tokio::task::spawn_blocking(move || {
            let conn = db.connect()?;
            conn.execute(
                "UPDATE llm_batches
                 SET status = 'in_progress', provider_batch_id = ?2,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?1",
                params![id, provider_batch_id],
            )?;
            Ok(())
        })
        .await
        .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?
    }

    async fn complete(
        &self,
        id: &str,
        provider_batch_id: &str,
        results: Vec<Value>,
    ) -> rusqlite::Result<()> {
        let db = self.db.clone();
        let id = id.to_string();
        let provider_batch_id = provider_batch_id.to_string();
        let results_json = serde_json::to_string(&results)
            .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?;
        tokio::task::spawn_blocking(move || {
            let conn = db.connect()?;
            conn.execute(
                "UPDATE llm_batches
                 SET status = 'completed', provider_batch_id = ?2,
                     results_json = ?3, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?1",
                params![id, provider_batch_id, results_json],
            )?;
            Ok(())
        })
        .await
        .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?
    }

    async fn fail(&self, id: &str, errors: Vec<Value>) -> rusqlite::Result<()> {
        let db = self.db.clone();
        let id = id.to_string();
        let errors_json = serde_json::to_string(&errors)
            .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?;
        tokio::task::spawn_blocking(move || {
            let conn = db.connect()?;
            conn.execute(
                "UPDATE llm_batches
                 SET status = 'failed', results_json = ?2,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?1",
                params![id, errors_json],
            )?;
            Ok(())
        })
        .await
        .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?
    }

    async fn cancel(&self, id: &str) -> rusqlite::Result<()> {
        let db = self.db.clone();
        let id = id.to_string();
        tokio::task::spawn_blocking(move || {
            let conn = db.connect()?;
            conn.execute(
                "UPDATE llm_batches
                 SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?1",
                params![id],
            )?;
            Ok(())
        })
        .await
        .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?
    }

    async fn increment_retry(&self, id: &str) -> rusqlite::Result<()> {
        let db = self.db.clone();
        let id = id.to_string();
        tokio::task::spawn_blocking(move || {
            let conn = db.connect()?;
            conn.execute(
                "UPDATE llm_batches
                 SET retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?1",
                params![id],
            )?;
            Ok(())
        })
        .await
        .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?
    }
}

pub fn spawn_batch_worker(state: Arc<AppState>) -> tokio::task::JoinHandle<()> {
    let provider = Arc::new(HttpBatchProvider::from_config(&state.config));
    let worker = BatchWorker::new(state.db.clone(), provider);
    info!("Starting batch execution worker");
    tokio::spawn(async move {
        worker.run(WORKER_INTERVAL).await;
    })
}

fn error_results(count: usize, code: impl Into<String>, message: impl Into<String>) -> Vec<Value> {
    let code = code.into();
    let message = message.into();
    (0..count)
        .map(|index| {
            json!({
                "index": index,
                "error": {
                    "code": code,
                    "message": message,
                }
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use tempfile::TempDir;

    struct MockProvider {
        submit_results: Mutex<Vec<Result<ProviderBatchJob, BatchProviderError>>>,
        poll_results: Mutex<Vec<Result<ProviderBatchStatus, BatchProviderError>>>,
    }

    impl MockProvider {
        fn new(
            submit_results: Vec<Result<ProviderBatchJob, BatchProviderError>>,
            poll_results: Vec<Result<ProviderBatchStatus, BatchProviderError>>,
        ) -> Self {
            Self {
                submit_results: Mutex::new(submit_results),
                poll_results: Mutex::new(poll_results),
            }
        }
    }

    #[async_trait::async_trait]
    impl BatchProvider for MockProvider {
        async fn submit(&self, _requests: &[Value]) -> Result<ProviderBatchJob, BatchProviderError> {
            self.submit_results.lock().unwrap().remove(0)
        }

        async fn poll(&self, _provider_batch_id: &str) -> Result<ProviderBatchStatus, BatchProviderError> {
            self.poll_results.lock().unwrap().remove(0)
        }
    }

    fn test_db() -> (DbHandle, TempDir) {
        let dir = TempDir::new().unwrap();
        let db = DbHandle::new(dir.path().join("test.db")).unwrap();
        (db, dir)
    }

    fn insert_test_key(db: &DbHandle) -> LlmKeyContext {
        let conn = db.connect().unwrap();
        conn.execute(
            "INSERT INTO users (id, email) VALUES ('u1', 'test@example.com')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO llm_virtual_keys
             (id, user_id, key_hash, key_prefix, allowed_models)
             VALUES ('vk1', 'u1', 'hash', 'ak-test', NULL)",
            [],
        )
        .unwrap();
        LlmKeyContext {
            key_id: "vk1".to_string(),
            user_id: "u1".to_string(),
            tenant_id: None,
            key_prefix: "ak-test".to_string(),
            monthly_budget_cents: None,
            rate_limit_rpm: None,
            allowed_models: None,
        }
    }

    fn sample_requests() -> Vec<Value> {
        vec![
            json!({"model": "allternit-balanced", "messages": [{"role": "user", "content": "Hi"}]}),
            json!({"model": "allternit-balanced", "messages": [{"role": "user", "content": "Bye"}]}),
        ]
    }

    #[tokio::test]
    async fn create_stores_validating_status() {
        let (db, _dir) = test_db();
        let key = insert_test_key(&db);
        let service = BatchesService::new(db.clone());
        let batch = service.create(&key, &sample_requests()).unwrap();
        assert_eq!(batch.status, "validating");
    }

    #[tokio::test]
    async fn worker_submits_validating_batch() {
        let (db, _dir) = test_db();
        let key = insert_test_key(&db);
        let service = BatchesService::new(db.clone());
        let batch = service.create(&key, &sample_requests()).unwrap();

        let provider = Arc::new(MockProvider::new(
            vec![Ok(ProviderBatchJob {
                id: "prov_1".to_string(),
                status: "in_progress".to_string(),
            })],
            vec![],
        ));
        let worker = BatchWorker::new(db.clone(), provider);
        worker.process_once().await.unwrap();

        let updated = service.get(&key.key_id, &batch.id).unwrap().unwrap();
        assert_eq!(updated.status, "in_progress");
    }

    #[tokio::test]
    async fn worker_polls_to_completed() {
        let (db, _dir) = test_db();
        let key = insert_test_key(&db);
        let service = BatchesService::new(db.clone());
        let batch = service.create(&key, &sample_requests()).unwrap();

        let provider = Arc::new(MockProvider::new(
            vec![Ok(ProviderBatchJob {
                id: "prov_1".to_string(),
                status: "in_progress".to_string(),
            })],
            vec![Ok(ProviderBatchStatus {
                status: BatchJobStatus::Completed,
                results: Some(vec![json!({"index": 0, "response": {"role": "assistant"}})]),
            })],
        ));
        let worker = BatchWorker::new(db.clone(), provider);
        worker.process_once().await.unwrap(); // submit
        worker.process_once().await.unwrap(); // poll

        let updated = service.get(&key.key_id, &batch.id).unwrap().unwrap();
        assert_eq!(updated.status, "completed");
        let results = service.results(&key.key_id, &batch.id).unwrap().unwrap();
        let arr = results.as_array().unwrap();
        assert_eq!(arr[0]["index"], 0);
        assert!(arr[0]["response"].is_object());
    }

    #[tokio::test]
    async fn worker_returns_errors_alongside_outputs() {
        let (db, _dir) = test_db();
        let key = insert_test_key(&db);
        let service = BatchesService::new(db.clone());
        let batch = service.create(&key, &sample_requests()).unwrap();

        let provider = Arc::new(MockProvider::new(
            vec![Ok(ProviderBatchJob {
                id: "prov_1".to_string(),
                status: "in_progress".to_string(),
            })],
            vec![Ok(ProviderBatchStatus {
                status: BatchJobStatus::Completed,
                results: Some(vec![
                    json!({"index": 0, "response": {"role": "assistant"}}),
                    json!({"index": 1, "error": {"code": "rate_limit", "message": "slow down"}}),
                ]),
            })],
        ));
        let worker = BatchWorker::new(db.clone(), provider);
        worker.process_once().await.unwrap();
        worker.process_once().await.unwrap();

        let results = service.results(&key.key_id, &batch.id).unwrap().unwrap();
        let arr = results.as_array().unwrap();
        assert_eq!(arr.len(), 2);
        assert!(arr[0].get("response").is_some());
        assert_eq!(arr[1]["error"]["code"], "rate_limit");
    }

    #[tokio::test]
    async fn worker_retries_transient_errors_then_succeeds() {
        let (db, _dir) = test_db();
        let key = insert_test_key(&db);
        let service = BatchesService::new(db.clone());
        let batch = service.create(&key, &sample_requests()).unwrap();

        let provider = Arc::new(MockProvider::new(
            vec![
                Err(BatchProviderError::transient("timeout", "provider timeout")),
                Err(BatchProviderError::transient("timeout", "provider timeout")),
                Ok(ProviderBatchJob {
                    id: "prov_1".to_string(),
                    status: "in_progress".to_string(),
                }),
            ],
            vec![Ok(ProviderBatchStatus {
                status: BatchJobStatus::Completed,
                results: Some(vec![json!({"index": 0, "response": {}})]),
            })],
        ));
        let worker = BatchWorker::new(db.clone(), provider);

        worker.process_once().await.unwrap();
        worker.process_once().await.unwrap();
        let after_retries = service.get(&key.key_id, &batch.id).unwrap().unwrap();
        assert_eq!(after_retries.status, "validating");

        worker.process_once().await.unwrap();
        let in_progress = service.get(&key.key_id, &batch.id).unwrap().unwrap();
        assert_eq!(in_progress.status, "in_progress");

        worker.process_once().await.unwrap();
        let completed = service.get(&key.key_id, &batch.id).unwrap().unwrap();
        assert_eq!(completed.status, "completed");
    }

    #[tokio::test]
    async fn worker_fails_after_retry_exhausted() {
        let (db, _dir) = test_db();
        let key = insert_test_key(&db);
        let service = BatchesService::new(db.clone());
        let batch = service.create(&key, &sample_requests()).unwrap();

        let provider = Arc::new(MockProvider::new(
            vec![
                Err(BatchProviderError::transient("timeout", "provider timeout")),
                Err(BatchProviderError::transient("timeout", "provider timeout")),
                Err(BatchProviderError::transient("timeout", "provider timeout")),
                Err(BatchProviderError::transient("timeout", "provider timeout")),
            ],
            vec![],
        ));
        let worker = BatchWorker::new(db.clone(), provider);
        worker.process_once().await.unwrap();
        worker.process_once().await.unwrap();
        worker.process_once().await.unwrap();
        worker.process_once().await.unwrap();

        let failed = service.get(&key.key_id, &batch.id).unwrap().unwrap();
        assert_eq!(failed.status, "failed");
        let results = service.results(&key.key_id, &batch.id).unwrap().unwrap();
        let arr = results.as_array().unwrap();
        assert_eq!(arr.len(), 2);
        assert_eq!(arr[0]["error"]["code"], "timeout");
    }

    #[tokio::test]
    async fn non_transient_error_marks_failed_immediately() {
        let (db, _dir) = test_db();
        let key = insert_test_key(&db);
        let service = BatchesService::new(db.clone());
        let batch = service.create(&key, &sample_requests()).unwrap();

        let provider = Arc::new(MockProvider::new(
            vec![Err(BatchProviderError::permanent(
                "bad_request",
                "invalid batch body",
            ))],
            vec![],
        ));
        let worker = BatchWorker::new(db.clone(), provider);
        worker.process_once().await.unwrap();

        let failed = service.get(&key.key_id, &batch.id).unwrap().unwrap();
        assert_eq!(failed.status, "failed");
    }

    #[tokio::test]
    async fn cancel_batch_prevents_worker_processing() {
        let (db, _dir) = test_db();
        let key = insert_test_key(&db);
        let service = BatchesService::new(db.clone());
        let batch = service.create(&key, &sample_requests()).unwrap();
        service.cancel(&key.key_id, &batch.id).unwrap();

        let provider = Arc::new(MockProvider::new(
            vec![Ok(ProviderBatchJob {
                id: "prov_1".to_string(),
                status: "in_progress".to_string(),
            })],
            vec![],
        ));
        let worker = BatchWorker::new(db.clone(), provider);
        worker.process_once().await.unwrap();

        let unchanged = service.get(&key.key_id, &batch.id).unwrap().unwrap();
        assert_eq!(unchanged.status, "cancelled");
    }
}
