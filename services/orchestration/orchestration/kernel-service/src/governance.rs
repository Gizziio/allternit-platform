use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::Path;
use uuid::Uuid;

use allternit_governor::PolicyEngine as NativePolicyEngine;
use allternit_substrate::PolicyContext;

#[derive(Debug, Deserialize)]
pub struct GovernanceEvaluateRequest {
    pub session_id: String,
    pub tool: String,
    pub action: serde_json::Value,
    pub security_level: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GovernanceEvaluateResponse {
    pub decision: String,
    pub reason: String,
}

pub async fn evaluate_policy(
    Json(request): Json<GovernanceEvaluateRequest>,
) -> Result<Json<GovernanceEvaluateResponse>, (StatusCode, String)> {
    let engine = NativePolicyEngine::new();
    let context = PolicyContext {
        agent_id: request.session_id,
        tool: request.tool,
        arguments: request.action,
        security_level: request
            .security_level
            .unwrap_or_else(|| "standard".to_string()),
    };

    match engine.evaluate(&context).await {
        Ok(decision) => Ok(Json(GovernanceEvaluateResponse {
            decision,
            reason: "Evaluated by allternit-governor native engine".to_string(),
        })),
        Err(err) => Err((StatusCode::INTERNAL_SERVER_ERROR, err.to_string())),
    }
}

pub async fn submit_receipt(
    Json(payload): Json<serde_json::Value>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let receipt_id = payload
        .get("receipt_id")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string())
        .unwrap_or_else(|| format!("receipt-{}", Uuid::new_v4()));
    let run_id = payload
        .get("run_id")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    let receipt_dir = Path::new(".allternit/receipts").join(run_id);
    fs::create_dir_all(&receipt_dir)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let receipt_path = receipt_dir.join(format!("{}.json", receipt_id));
    let data = serde_json::to_vec_pretty(&payload)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    fs::write(&receipt_path, data)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "status": "ok",
        "receipt_id": receipt_id,
        "path": receipt_path.to_string_lossy(),
    })))
}
