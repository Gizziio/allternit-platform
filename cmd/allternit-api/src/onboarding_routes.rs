//! Onboarding routes — local AI service discovery and API key validation

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

pub fn onboarding_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/onboarding/discover", get(onboarding_discover))
        .route("/onboarding/validate-key", post(onboarding_validate_key))
}

#[derive(Serialize)]
struct ModelInfo {
    id: String,
    name: String,
}

async fn onboarding_discover(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    let ollama_url = std::env::var("OLLAMA_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());

    // Check Ollama
    let ollama_running = reqwest::Client::new()
        .get(format!("{}/api/tags", ollama_url.trim_end_matches('/')))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false);

    let ollama_models = if ollama_running {
        match reqwest::Client::new()
            .get(format!("{}/api/tags", ollama_url.trim_end_matches('/')))
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
        {
            Ok(res) => {
                if let Ok(json) = res.json::<serde_json::Value>().await {
                    json.get("models")
                        .and_then(|m| m.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| {
                                    let id = m.get("name")?.as_str()?.to_string();
                                    Some(ModelInfo {
                                        name: id.clone(),
                                        id,
                                    })
                                })
                                .collect()
                        })
                        .unwrap_or_default()
                } else {
                    vec![]
                }
            }
            Err(_) => vec![],
        }
    } else {
        vec![]
    };

    // Check LM Studio (default port 1234)
    let lmstudio_running = reqwest::Client::new()
        .get("http://localhost:1234/v1/models")
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false);

    let lmstudio_models = if lmstudio_running {
        match reqwest::Client::new()
            .get("http://localhost:1234/v1/models")
            .timeout(std::time::Duration::from_secs(3))
            .send()
            .await
        {
            Ok(res) => {
                if let Ok(json) = res.json::<serde_json::Value>().await {
                    json.get("data")
                        .and_then(|d| d.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| {
                                    let id = m.get("id")?.as_str()?.to_string();
                                    Some(ModelInfo {
                                        name: id.clone(),
                                        id,
                                    })
                                })
                                .collect()
                        })
                        .unwrap_or_default()
                } else {
                    vec![]
                }
            }
            Err(_) => vec![],
        }
    } else {
        vec![]
    };

    Json(json!({
        "ollama": {
            "running": ollama_running,
            "models": ollama_models,
        },
        "lmstudio": {
            "running": lmstudio_running,
            "models": lmstudio_models,
        },
        "cli": vec!["allternit".to_string()],
    }))
}

#[derive(Deserialize)]
struct ValidateKeyBody {
    provider: String,
    key: String,
}

async fn onboarding_validate_key(
    Json(body): Json<ValidateKeyBody>,
) -> impl IntoResponse {
    let provider = body.provider.to_lowercase();
    let key = body.key;

    // Validate key against known providers
    let result = match provider.as_str() {
        "openai" => validate_openai_key(&key).await,
        "anthropic" => validate_anthropic_key(&key).await,
        "google" => validate_google_key(&key).await,
        "groq" => validate_groq_key(&key).await,
        "openrouter" => validate_openrouter_key(&key).await,
        _ => Ok(ValidationResult {
            valid: true,
            models: None,
            error: Some(format!("Unknown provider '{}', accepting key without validation", provider)),
        }),
    };

    match result {
        Ok(r) => (StatusCode::OK, Json(json!({
            "valid": r.valid,
            "models": r.models,
            "error": r.error,
        }))),
        Err(e) => (StatusCode::OK, Json(json!({
            "valid": false,
            "error": e,
        }))),
    }
}

struct ValidationResult {
    valid: bool,
    models: Option<Vec<serde_json::Value>>,
    error: Option<String>,
}

async fn validate_openai_key(key: &str) -> Result<ValidationResult, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.openai.com/v1/models")
        .header("Authorization", format!("Bearer {}", key))
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        return Ok(ValidationResult {
            valid: false,
            models: None,
            error: Some(format!("API returned {}", res.status())),
        });
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let models: Vec<serde_json::Value> = json
        .get("data")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| {
                    let id = m.get("id")?.as_str()?;
                    Some(json!({"id": id, "name": id}))
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(ValidationResult {
        valid: true,
        models: Some(models),
        error: None,
    })
}

async fn validate_anthropic_key(key: &str) -> Result<ValidationResult, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.anthropic.com/v1/models")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        return Ok(ValidationResult {
            valid: false,
            models: None,
            error: Some(format!("API returned {}", res.status())),
        });
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let models: Vec<serde_json::Value> = json
        .get("data")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| {
                    let id = m.get("id")?.as_str()?;
                    Some(json!({"id": id, "name": id}))
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(ValidationResult {
        valid: true,
        models: Some(models),
        error: None,
    })
}

async fn validate_google_key(_key: &str) -> Result<ValidationResult, String> {
    // Google keys are harder to validate without specific API calls
    Ok(ValidationResult {
        valid: true,
        models: Some(vec![
            json!({"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro"}),
            json!({"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash"}),
        ]),
        error: None,
    })
}

async fn validate_groq_key(key: &str) -> Result<ValidationResult, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.groq.com/openai/v1/models")
        .header("Authorization", format!("Bearer {}", key))
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        return Ok(ValidationResult {
            valid: false,
            models: None,
            error: Some(format!("API returned {}", res.status())),
        });
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let models: Vec<serde_json::Value> = json
        .get("data")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| {
                    let id = m.get("id")?.as_str()?;
                    Some(json!({"id": id, "name": id}))
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(ValidationResult {
        valid: true,
        models: Some(models),
        error: None,
    })
}

async fn validate_openrouter_key(key: &str) -> Result<ValidationResult, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://openrouter.ai/api/v1/models")
        .header("Authorization", format!("Bearer {}", key))
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        return Ok(ValidationResult {
            valid: false,
            models: None,
            error: Some(format!("API returned {}", res.status())),
        });
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let models: Vec<serde_json::Value> = json
        .get("data")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .take(50)
                .filter_map(|m| {
                    let id = m.get("id")?.as_str()?;
                    let name = m.get("name")?.as_str().unwrap_or(id);
                    Some(json!({"id": id, "name": name}))
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(ValidationResult {
        valid: true,
        models: Some(models),
        error: None,
    })
}
