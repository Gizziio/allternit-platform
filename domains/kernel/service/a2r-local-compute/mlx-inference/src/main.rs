use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{BufReader, BufWriter, Read, Write};
use std::os::unix::net::UnixStream;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::timeout;
use tracing::{error, info};

use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
struct AppState {
    python_process: Arc<Mutex<Option<Child>>>,
    socket_path: String,
    model_path: String,
    startup_error: Option<String>,
}

#[derive(Deserialize)]
struct InferenceRequest {
    prompt: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
}

#[derive(Serialize, Deserialize)]
struct InferenceResponse {
    text: String,
    #[serde(default, alias = "model")]
    model_used: String,
    status: String,
    generation_time: Option<f64>,
    input_tokens: Option<u32>,
    output_tokens: Option<u32>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    service: String,
    timestamp: u64,
}

async fn handle_generate(
    State(state): State<Arc<AppState>>,
    Json(req): Json<InferenceRequest>,
) -> Result<Json<InferenceResponse>, StatusCode> {
    info!("Received inference request for prompt: {}", req.prompt);

    if state.python_process.lock().await.is_none() {
        error!(
            "MLX inference unavailable: {}",
            state.startup_error.as_deref().unwrap_or("python process not running")
        );
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    // Prepare the request data to send to Python
    let request_data = json!({
        "prompt": req.prompt,
        "max_tokens": req.max_tokens.unwrap_or(100),
        "temperature": req.temperature.unwrap_or(0.7)
    });

    // Send request to Python process via Unix socket
    let response = send_to_python(&state.socket_path, &request_data)
        .await
        .map_err(|e| {
            error!("Failed to communicate with Python process: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Parse the response
    let response: InferenceResponse = serde_json::from_value(response)
        .map_err(|e| {
            error!("Failed to parse Python response: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(response))
}

async fn handle_health_check(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HealthResponse>, StatusCode> {
    let status = if state.python_process.lock().await.is_some() {
        "healthy"
    } else {
        "degraded"
    };
    Ok(Json(HealthResponse {
        status: status.to_string(),
        service: "mlx-inference".to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    }))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    info!("Starting MLX Inference Service...");

    // Get configuration from environment
    let model_path = env::var("MLX_MODEL_PATH")
        .unwrap_or_else(|_| "/models/mlx/Qwen2-7B-Instruct-4bit".to_string());
    let socket_path = env::var("MLX_SOCKET_PATH")
        .unwrap_or_else(|_| "/tmp/mlx-inference.sock".to_string());

    // Ensure the socket directory exists
    if let Some(parent) = std::path::Path::new(&socket_path).parent() {
        fs::create_dir_all(parent)?;
    }

    // Start the Python process
    info!("Starting Python inference process...");
    let script_path = env::var("MLX_INFERENCE_SCRIPT")
        .unwrap_or_else(|_| format!("{}/app/inference.py", env!("CARGO_MANIFEST_DIR")));
    let mut python_process = Command::new("python3")
        .arg(&script_path)
        .arg("--model")
        .arg(&model_path)
        .arg("--socket")
        .arg(&socket_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            error!("Failed to start Python process: {}", e);
            e
        })?;

    // Give the Python process time to start up
    tokio::time::sleep(Duration::from_secs(2)).await;

    // Check if the process is still running
    let mut startup_error = None;
    if let Some(exit_status) = python_process.try_wait()? {
        let mut stderr = String::new();
        if let Some(ref mut stderr_pipe) = python_process.stderr {
            let _ = stderr_pipe.read_to_string(&mut stderr);
        }
        let err = format!(
            "Python process exited early with status: {:?}, stderr: {}",
            exit_status, stderr
        );
        error!("{}", err);
        startup_error = Some(err);
    }

    if startup_error.is_none() {
        info!("Python process started successfully");
    } else {
        info!("Continuing without MLX backend (degraded mode)");
    }

    // Create app state
    let app_state = Arc::new(AppState {
        python_process: Arc::new(Mutex::new(if startup_error.is_none() { Some(python_process) } else { None })),
        socket_path,
        model_path,
        startup_error,
    });

    // Create web server
    let app = Router::new()
        .route("/v1/generate", post(handle_generate))
        .route("/health", get(handle_health_check))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3508".to_string());
    let addr = format!("{}:{}", host, port);
    info!("MLX Inference Service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn send_to_python(socket_path: &str, request: &serde_json::Value) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    // Serialize the request
    let request_json = serde_json::to_string(request)?;
    let request_bytes = request_json.as_bytes();
    let length_bytes = (request_bytes.len() as u32).to_be_bytes();

    // Connect to the Unix socket with timeout
    let stream = timeout(Duration::from_secs(10), async {
        UnixStream::connect(socket_path)
    }).await??;

    let mut writer = BufWriter::new(stream);
    
    // Send length and request
    writer.write_all(&length_bytes)?;
    writer.write_all(request_bytes)?;
    writer.flush()?;

    // Read response length
    let mut reader = BufReader::new(writer.into_inner()?);
    let mut length_bytes = [0u8; 4];
    reader.read_exact(&mut length_bytes)?;
    let response_length = u32::from_be_bytes(length_bytes) as usize;

    // Read response
    let mut response_bytes = vec![0u8; response_length];
    reader.read_exact(&mut response_bytes)?;
    
    let response_json = String::from_utf8(response_bytes)?;
    let response: serde_json::Value = serde_json::from_str(&response_json)?;

    Ok(response)
}
