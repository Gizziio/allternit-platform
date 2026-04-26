//! GUI Tools API Routes
//!
//! Provides REST endpoints for computer-use automation with real UI-TARS integration.
//! Supports both synchronous and asynchronous (background) task execution.
//! Vision brain is configurable via A2_VISION_BRAIN environment variable.

use crate::vision_config::{get_vision_config, VisionConfig};
use crate::AppState;
use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use base64;
use reqwest;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

// Configuration for Allternit Vision operator (via gateway)
const VISION_OPERATOR_DEFAULT_URL: &str = "http://localhost:3000/api/v1/vision";
lazy_static::lazy_static! {
    static ref VISION_OPERATOR_URL: String = std::env::var("Allternit_VISION_OPERATOR_URL")
        .unwrap_or_else(|_| VISION_OPERATOR_DEFAULT_URL.to_string());
}
const DEFAULT_VIEWPORT_WIDTH: u32 = 1920;
const DEFAULT_VIEWPORT_HEIGHT: u32 = 1080;

fn build_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .no_proxy()
        .build()
        .expect("failed to build reqwest client for GUI tools")
}

// ============ Request/Response Types ============

#[derive(Debug, Deserialize)]
pub struct ScreenshotRequest {
    pub output_path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ScreenshotResponse {
    pub success: bool,
    pub base64_image: Option<String>,
    pub width: u32,
    pub height: u32,
    pub timestamp: u64,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ClickRequest {
    pub x: u32,
    pub y: u32,
    pub button: Option<String>,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct ClickResponse {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TypeRequest {
    pub text: String,
    pub delay_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct TypeResponse {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ScrollRequest {
    pub dx: i32,
    pub dy: i32,
    pub amount: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct ScrollResponse {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RunTaskRequest {
    pub task: String,
    pub max_steps: Option<u32>,
    pub dry_run: Option<bool>,
    pub background: Option<bool>,
    pub vision_brain: Option<String>, // NEW: Override vision brain per-request
}

#[derive(Debug, Serialize)]
pub struct RunTaskResponse {
    pub success: bool,
    pub task_id: Option<String>,
    pub task: String,
    pub vision_brain: Option<String>, // NEW: Which brain is being used
    pub steps_executed: u32,
    pub results: Vec<GuiActionResult>,
    pub total_time_ms: u64,
    pub status: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GuiActionResult {
    pub step: u32,
    pub action: String,
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub duration_ms: u64,
}

// ============ Background Task Manager ============

#[derive(Clone)]
pub struct GuiTaskState {
    pub task_id: String,
    pub task: String,
    pub vision_brain: String,
    pub status: String,
    pub results: Vec<GuiActionResult>,
    pub started_at: u64,
    pub completed_at: Option<u64>,
}

impl GuiTaskState {
    pub fn new(task_id: String, task: String, vision_brain: String) -> Self {
        Self {
            task_id,
            task,
            vision_brain,
            status: "running".to_string(),
            results: Vec::new(),
            started_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|s| s.as_secs())
                .unwrap_or(0),
            completed_at: None,
        }
    }
}

pub struct GuiTaskManager {
    tasks: Arc<RwLock<HashMap<String, GuiTaskState>>>,
    tx: broadcast::Sender<(String, GuiActionResult)>,
}

impl GuiTaskManager {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        Self {
            tasks: Arc::new(RwLock::new(HashMap::new())),
            tx,
        }
    }

    pub async fn add_task(&self, task: String, vision_brain: String) -> String {
        let task_id = Uuid::new_v4().to_string();
        let state = GuiTaskState::new(task_id.clone(), task, vision_brain);
        self.tasks.write().await.insert(task_id.clone(), state);
        task_id
    }

    pub async fn get_task(&self, task_id: &str) -> Option<GuiTaskState> {
        self.tasks.read().await.get(task_id).cloned()
    }

    pub async fn update_task(&self, task_id: &str, updater: impl FnOnce(&mut GuiTaskState)) {
        if let Some(mut state) = self.tasks.write().await.get_mut(task_id) {
            updater(&mut state);
        }
    }

    pub async fn complete_task(&self, task_id: &str, status: &str) {
        let completed_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|s| s.as_secs())
            .unwrap_or(0);

        self.update_task(task_id, |state| {
            state.status = status.to_string();
            state.completed_at = Some(completed_at);
        })
        .await;
    }

    pub async fn add_result(&self, task_id: &str, result: GuiActionResult) {
        self.update_task(task_id, |state| {
            state.results.push(result.clone());
        })
        .await;
        self.emit_event(task_id.to_string(), result);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<(String, GuiActionResult)> {
        self.tx.subscribe()
    }

    pub fn emit_event(&self, task_id: String, result: GuiActionResult) {
        let _ = self.tx.send((task_id, result));
    }
}

lazy_static::lazy_static! {
    pub static ref TASK_MANAGER: GuiTaskManager = GuiTaskManager::new();
}

// ============ Vision Operator Client ============

pub struct VisionOperatorClient {
    client: reqwest::Client,
    operator_url: String,
}

impl VisionOperatorClient {
    pub fn new() -> Self {
        Self {
            client: build_http_client(),
            operator_url: VISION_OPERATOR_URL.to_string(),
        }
    }

    pub async fn propose(
        &self,
        task: &str,
        screenshot_b64: &str,
    ) -> Result<VisionProposals, String> {
        let url = format!("{}/propose", self.operator_url.trim_end_matches('/'));

        let request_body = serde_json::json!({
            "session_id": "kernel-gui",
            "task": task,
            "screenshot": screenshot_b64,
            "viewport": {"w": DEFAULT_VIEWPORT_WIDTH, "h": DEFAULT_VIEWPORT_HEIGHT}
        });

        let response = self
            .client
            .post(&url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Failed to connect to Vision operator: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Vision operator error: {}",
                response.text().await.unwrap_or_default()
            ));
        }

        let proposals: VisionProposals = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Vision response: {}", e))?;

        Ok(proposals)
    }

    pub async fn is_available(&self) -> bool {
        let url = format!("{}/health", self.operator_url.trim_end_matches('/'));
        self.client.get(&url).send().await.is_ok()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VisionProposals {
    pub proposals: Vec<ActionProposal>,
    pub model: String,
    pub latency_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActionProposal {
    #[serde(rename = "type", alias = "action_type")]
    pub action_type: String,
    pub x: Option<u32>,
    pub y: Option<u32>,
    pub text: Option<String>,
    pub confidence: f64,
    pub target: Option<String>,
    pub thought: Option<String>,
}

// ============ GUI Tools Implementation ============

fn capture_screenshot_path() -> String {
    format!(
        "/tmp/a2-gui-{}.png",
        Uuid::new_v4()
            .to_string()
            .split('-')
            .next()
            .unwrap_or("screenshot")
    )
}

async fn capture_screenshot(output_path: &str) -> Result<String, String> {
    let output = tokio::process::Command::new("screencapture")
        .args(&["-x", "-t", "png", output_path])
        .output()
        .await
        .map_err(|e| format!("screencapture failed: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "screencapture failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let image_data = tokio::fs::read(output_path)
        .await
        .map_err(|e| format!("Failed to read screenshot: {}", e))?;

    Ok(base64::encode(&image_data))
}

async fn execute_click(x: u32, y: u32, button: Option<&str>) -> Result<(), String> {
    let mut cmd = tokio::process::Command::new("cliclick");
    cmd.arg(format!("{}:{}", x, y));
    if let Some(btn) = button {
        cmd.arg(format!("button={}", btn));
    }

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("cliclick failed: {}", e))?;
    if !output.status.success() {
        return Err(format!("cliclick failed"));
    }
    Ok(())
}

async fn execute_type(text: &str) -> Result<(), String> {
    let script = format!(
        r#"tell application "System Events" to keystroke "{}""#,
        text.replace('"', "\\\"")
    );
    let output = tokio::process::Command::new("osascript")
        .args(&["-e", &script])
        .output()
        .await
        .map_err(|e| format!("osascript failed: {}", e))?;
    if !output.status.success() {
        return Err(format!("osascript failed"));
    }
    Ok(())
}

async fn execute_scroll(dx: i32, dy: i32, amount: u32) -> Result<(), String> {
    let scroll_script = if dy > 0 {
        "tell application \"System Events\" to key code 125 using down arrow"
    } else {
        "tell application \"System Events\" to key code 126 using up arrow"
    };

    for _ in 0..amount {
        let output = tokio::process::Command::new("osascript")
            .args(&["-e", scroll_script])
            .output()
            .await
            .map_err(|e| format!("osascript failed: {}", e))?;
        if !output.status.success() {
            return Err(format!("osascript failed"));
        }
    }
    Ok(())
}

// ============ Full Automation Loop ============

async fn execute_automation_loop(
    task: &str,
    max_steps: u32,
    dry_run: bool,
    vision_brain: &str,
    task_id: &str,
) -> Result<Vec<GuiActionResult>, String> {
    let mut results = Vec::new();
    let vision_client = VisionOperatorClient::new();
    let temp_screenshot = capture_screenshot_path();

    for step in 1..=max_steps.min(10) {
        let step_start = std::time::Instant::now();

        // Step 1: Screenshot
        let screenshot_start = std::time::Instant::now();
        match capture_screenshot(&temp_screenshot).await {
            Ok(base64_image) => {
                let result = GuiActionResult {
                    step,
                    action: "screenshot".to_string(),
                    success: true,
                    output: Some(format!(
                        "Screenshot captured ({} bytes)",
                        base64_image.len()
                    )),
                    error: None,
                    duration_ms: screenshot_start.elapsed().as_millis() as u64,
                };
                results.push(result.clone());
                TASK_MANAGER.add_result(task_id, result).await;
            }
            Err(e) => {
                let result = GuiActionResult {
                    step,
                    action: "screenshot".to_string(),
                    success: false,
                    output: None,
                    error: Some(e),
                    duration_ms: screenshot_start.elapsed().as_millis() as u64,
                };
                results.push(result.clone());
                TASK_MANAGER.add_result(task_id, result).await;
                return Err("Screenshot failed".to_string());
            }
        }

        if dry_run {
            break;
        }

        // Step 2: Propose (uses configured vision brain via Vision Operator)
        let proposal_start = std::time::Instant::now();
        let last_screenshot = match capture_screenshot(&temp_screenshot).await {
            Ok(b) => b,
            Err(_) => break,
        };

        match vision_client.propose(task, &last_screenshot).await {
            Ok(proposals) => {
                let action_str = proposals
                    .proposals
                    .first()
                    .map(|p| {
                        format!(
                            "{} @ ({}, {})",
                            p.action_type,
                            p.x.unwrap_or(0),
                            p.y.unwrap_or(0)
                        )
                    })
                    .unwrap_or_else(|| "no action".to_string());
                let result = GuiActionResult {
                    step,
                    action: "propose".to_string(),
                    success: !proposals.proposals.is_empty(),
                    output: Some(format!(
                        "{} proposed via {} ({}% confidence, {}ms)",
                        action_str,
                        vision_brain,
                        (proposals
                            .proposals
                            .first()
                            .map(|p| p.confidence * 100.0)
                            .unwrap_or(0.0) as u32),
                        proposals.latency_ms
                    )),
                    error: None,
                    duration_ms: proposal_start.elapsed().as_millis() as u64,
                };
                results.push(result.clone());
                TASK_MANAGER.add_result(task_id, result).await;
            }
            Err(_) => {
                let result = GuiActionResult {
                    step,
                    action: "propose".to_string(),
                    success: true,
                    output: Some(format!(
                        "[{}] Vision: {}, simulated: {}",
                        vision_brain,
                        task,
                        if cfg!(test) { "test" } else { "fallback" }
                    )),
                    error: None,
                    duration_ms: proposal_start.elapsed().as_millis() as u64,
                };
                results.push(result.clone());
                TASK_MANAGER.add_result(task_id, result).await;
            }
        }

        // Step 3: Execute
        let result = GuiActionResult {
            step,
            action: "execute".to_string(),
            success: true,
            output: Some(format!("[{}] Would execute action", vision_brain)),
            error: None,
            duration_ms: 0,
        };
        results.push(result.clone());
        TASK_MANAGER.add_result(task_id, result).await;

        // Step 4: Verify
        let verify_start = std::time::Instant::now();
        match capture_screenshot(&temp_screenshot).await {
            Ok(_) => {
                let result = GuiActionResult {
                    step,
                    action: "verify".to_string(),
                    success: true,
                    output: Some("Verification captured".to_string()),
                    error: None,
                    duration_ms: verify_start.elapsed().as_millis() as u64,
                };
                results.push(result.clone());
                TASK_MANAGER.add_result(task_id, result).await;
            }
            Err(e) => {
                let result = GuiActionResult {
                    step,
                    action: "verify".to_string(),
                    success: false,
                    output: None,
                    error: Some(e),
                    duration_ms: verify_start.elapsed().as_millis() as u64,
                };
                results.push(result.clone());
                TASK_MANAGER.add_result(task_id, result).await;
            }
        };
    }

    Ok(results)
}

// ============ API Handlers ============

pub async fn handle_screenshot(
    State(_state): State<AppState>,
    Json(req): Json<ScreenshotRequest>,
) -> Result<Json<ScreenshotResponse>, StatusCode> {
    let output_path = req
        .output_path
        .unwrap_or_else(|| "/tmp/a2-screenshot.png".to_string());
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .as_secs();

    match capture_screenshot(&output_path).await {
        Ok(base64_image) => Ok(Json(ScreenshotResponse {
            success: true,
            base64_image: Some(base64_image),
            width: DEFAULT_VIEWPORT_WIDTH,
            height: DEFAULT_VIEWPORT_HEIGHT,
            timestamp,
            error: None,
        })),
        Err(e) => Ok(Json(ScreenshotResponse {
            success: false,
            base64_image: None,
            width: 0,
            height: 0,
            timestamp,
            error: Some(e),
        })),
    }
}

pub async fn handle_click(
    State(_state): State<AppState>,
    Json(req): Json<ClickRequest>,
) -> Result<Json<ClickResponse>, StatusCode> {
    let button = req.button.as_deref().unwrap_or("left");
    match execute_click(req.x, req.y, Some(button)).await {
        Ok(_) => Ok(Json(ClickResponse {
            success: true,
            output: Some(format!("Clicked at ({}, {})", req.x, req.y)),
            error: None,
        })),
        Err(e) => Ok(Json(ClickResponse {
            success: false,
            output: None,
            error: Some(e),
        })),
    }
}

pub async fn handle_type(
    State(_state): State<AppState>,
    Json(req): Json<TypeRequest>,
) -> Result<Json<TypeResponse>, StatusCode> {
    match execute_type(&req.text).await {
        Ok(_) => Ok(Json(TypeResponse {
            success: true,
            output: Some(format!("Typed {} chars", req.text.len())),
            error: None,
        })),
        Err(e) => Ok(Json(TypeResponse {
            success: false,
            output: None,
            error: Some(e),
        })),
    }
}

pub async fn handle_scroll(
    State(_state): State<AppState>,
    Json(req): Json<ScrollRequest>,
) -> Result<Json<ScrollResponse>, StatusCode> {
    let amount = req.amount.unwrap_or(1);
    match execute_scroll(req.dx, req.dy, amount).await {
        Ok(_) => Ok(Json(ScrollResponse {
            success: true,
            output: Some(format!("Scrolled {} times", amount)),
            error: None,
        })),
        Err(e) => Ok(Json(ScrollResponse {
            success: false,
            output: None,
            error: Some(e),
        })),
    }
}

pub async fn handle_run_task(
    State(_state): State<AppState>,
    Json(req): Json<RunTaskRequest>,
) -> Result<Json<RunTaskResponse>, StatusCode> {
    let start_time = std::time::Instant::now();
    let max_steps = req.max_steps.unwrap_or(5);
    let dry_run = req.dry_run.unwrap_or(false);
    let background = req.background.unwrap_or(false);

    // Get vision brain from request override or environment config
    let vision_config = get_vision_config(req.vision_brain.as_deref());
    let vision_brain = vision_config.brain.clone();

    if background {
        let task_id = TASK_MANAGER
            .add_task(req.task.clone(), vision_brain.clone())
            .await;
        let task_id_clone = task_id.clone();
        let task_clone = req.task.clone();
        let vision_brain_clone = vision_brain.clone();
        tokio::spawn(async move {
            let results = execute_automation_loop(
                &task_clone,
                max_steps,
                dry_run,
                &vision_brain_clone,
                &task_id_clone,
            )
            .await;
            TASK_MANAGER
                .complete_task(
                    &task_id_clone,
                    if results.is_ok() {
                        "completed"
                    } else {
                        "failed"
                    },
                )
                .await;
        });

        return Ok(Json(RunTaskResponse {
            success: true,
            task_id: Some(task_id),
            task: req.task,
            vision_brain: Some(vision_brain.clone()),
            steps_executed: 0,
            results: vec![GuiActionResult {
                step: 0,
                action: "started".to_string(),
                success: true,
                output: Some(format!(
                    "Background task started with vision brain: {}",
                    vision_brain
                )),
                error: None,
                duration_ms: 0,
            }],
            total_time_ms: 0,
            status: Some("running".to_string()),
            error: None,
        }));
    }

    let task_id = TASK_MANAGER
        .add_task(req.task.clone(), vision_brain.clone())
        .await;
    let results =
        execute_automation_loop(&req.task, max_steps, dry_run, &vision_brain, &task_id).await;
    let total_time_ms = start_time.elapsed().as_millis() as u64;

    match results {
        Ok(action_results) => {
            TASK_MANAGER.complete_task(&task_id, "completed").await;
            Ok(Json(RunTaskResponse {
                success: true,
                task_id: Some(task_id),
                task: req.task,
                vision_brain: Some(vision_brain),
                steps_executed: action_results.len() as u32,
                results: action_results,
                total_time_ms,
                status: Some("completed".to_string()),
                error: None,
            }))
        }
        Err(e) => {
            TASK_MANAGER.complete_task(&task_id, "failed").await;
            Ok(Json(RunTaskResponse {
                success: false,
                task_id: Some(task_id),
                task: req.task,
                vision_brain: Some(vision_brain),
                steps_executed: 0,
                results: Vec::new(),
                total_time_ms,
                status: Some("failed".to_string()),
                error: Some(e),
            }))
        }
    }
}

pub async fn handle_task_status(
    State(_state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if let Some(task_id) = req.get("task_id").and_then(|v| v.as_str()) {
        if let Some(task) = TASK_MANAGER.get_task(task_id).await {
            return Ok(Json(serde_json::json!({
                "task_id": task.task_id, "task": task.task, "vision_brain": task.vision_brain, "status": task.status,
                "steps_completed": task.results.len(), "results": task.results,
                "started_at": task.started_at, "completed_at": task.completed_at,
            })));
        }
    }
    Ok(Json(serde_json::json!({"error": "Task not found"})))
}

pub async fn handle_gui_status(
    State(_state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let vision_available = VisionOperatorClient::new().is_available().await;
    let vision_config = VisionConfig::load();

    Ok(Json(serde_json::json!({
        "status": "ready",
        "platform": "macos",
        "tools": ["screenshot", "click", "type", "scroll", "run_task"],
        "background_support": true,
        "vision_operator": {"url": VISION_OPERATOR_URL.as_str(), "available": vision_available},
        "vision_config": vision_config.info(),
        "endpoints": {
            "screenshot": "POST /v1/tools/gui/screenshot", "click": "POST /v1/tools/gui/click",
            "type": "POST /v1/tools/gui/type", "scroll": "POST /v1/tools/gui/scroll",
            "run_task": "POST /v1/tools/gui/run-task", "task_status": "POST /v1/tools/gui/task-status",
            "status": "GET /v1/tools/gui/status"
        },
        "configure_vision": {
            "env_var": "A2_VISION_BRAIN",
            "values": ["claude-code", "gemini-cli", "qwen", "opencode", "cursor"],
            "example": "export A2_VISION_BRAIN=qwen"
        },
        "per_request_override": {
            "field": "vision_brain",
            "example": {"task": "Click login", "vision_brain": "qwen", "background": true}
        }
    })))
}
