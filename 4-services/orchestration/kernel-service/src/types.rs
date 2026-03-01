use a2rchitech_tools_gateway::WriteScope;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleInstance {
    pub capsule_id: String,
    pub framework_id: String,
    pub title: String,
    pub created_at: i64,
    pub state: serde_json::Value,
    pub active_canvas_id: Option<String>,
    pub persistence_mode: String,
    pub sandbox_policy: Option<serde_json::Value>,
    pub tool_scope: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasInstance {
    pub canvas_id: String,
    pub capsule_id: String,
    pub view_type: String,
    pub title: String,
    pub state: serde_json::Value,
    pub columns: Option<serde_json::Value>,
    pub actions: Option<serde_json::Value>,
    pub layout: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEvent {
    pub event_id: String,
    pub timestamp: i64,
    pub kind: String,
    pub capsule_id: Option<String>,
    pub payload: serde_json::Value,
    pub parent_ids: Vec<String>,
    pub root_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    pub artifact_id: String,
    pub capsule_id: String,
    pub artifact_type: String,
    pub content: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentRequest {
    pub intent_text: String,
    pub agent_id: Option<String>,
    pub execution_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DispatchResponse {
    pub capsule: CapsuleInstance,
    pub canvases: Vec<CanvasInstance>,
    pub events: Vec<JournalEvent>,
    pub artifacts: Vec<Artifact>,
    pub pattern_id: Option<String>,
    pub confidence: f64,
    pub situation: Option<Situation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Situation {
    pub id: String,
    pub intent_tokens: Vec<serde_json::Value>,
    pub interaction_spec: InteractionSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractionSpec {
    pub transition: String,
    pub importance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionRequest {
    pub action_id: String,
    pub capsule_id: String,
    pub view_id: String,
    pub context: serde_json::Value,
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionResponse {
    pub success: bool,
    pub message: Option<String>,
    pub events: Vec<JournalEvent>,
    pub state_updates: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSpec {
    pub id: String,
    pub intent_type: String,
    pub user_goal: String,
    pub inputs: Vec<serde_json::Value>,
    pub constraints: Vec<String>,
    pub success_criteria: Vec<String>,
    pub output_contract: OutputContract,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputContract {
    pub format: String,
    pub schema_ref: Option<String>,
    pub constraints: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandSpec {
    pub id: String,
    pub verb: String,
    pub object: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptPattern {
    pub id: String,
    pub intent_type: String,
    pub template: String,
    pub reasoning_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantIdentity {
    pub id: String,
    pub name: String,
    pub persona: String,
    pub preferences: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSpec {
    pub id: String,
    pub role: String,
    pub description: String,
    pub tools: Vec<String>,
    pub policies: Vec<String>,
    #[serde(default)]
    pub publisher: AgentPublisher,
    #[serde(default)]
    pub signature: AgentSignature,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentPublisher {
    pub publisher_id: String,
    pub public_key_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentSignature {
    pub manifest_sig: String,
    pub bundle_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillPackage {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub installed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunProfile {
    pub id: String,
    pub mode: String, // "instant", "studio", "builder"
    pub budget_limit: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Suggestion {
    pub id: String,
    pub title: String,
    pub description: String,
    pub action_payload: serde_json::Value,
    pub priority: String,
}

#[derive(Debug, Deserialize)]
pub struct EvidenceAddRequest {
    pub target: String,
}

#[derive(Debug, Deserialize)]
pub struct CapsulePatchRequest {
    pub spec_patch: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct ActionExecuteRequest {
    pub tool_id: String,
    pub parameters: serde_json::Value,
    pub identity_id: Option<String>,
    pub session_id: Option<String>,
    pub tenant_id: Option<String>,
    pub run_id: Option<String>,
    pub workflow_id: Option<String>,
    pub node_id: Option<String>,
    pub wih_id: Option<String>,
    pub write_scope: Option<WriteScope>,
    pub trace_id: Option<String>,
    pub idempotency_key: Option<String>,
    pub retry_count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModeRequest {
    pub mode: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModeResponse {
    pub mode: String,
}

#[derive(Debug, Deserialize)]
pub struct SessionCommitRequest {
    pub description: String,
    pub session_state: serde_json::Value,
    pub mode: String,
}

#[derive(Debug, Serialize)]
pub struct SessionCommitResponse {
    pub session_id: String,
}

#[derive(Debug, Deserialize)]
pub struct SessionBranchRequest {
    pub branch_name: String,
}

#[derive(Debug, Serialize)]
pub struct SessionBranchResponse {
    pub session_id: String,
}

#[derive(Debug, Deserialize)]
pub struct SessionHistoryQuery {
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct SessionHistoryResponse {
    pub sessions: Vec<SessionInfo>,
}

#[derive(Debug, Serialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub description: String,
    pub created_at: u64,
}

#[derive(Debug, Deserialize)]
pub struct SessionResetRequest {}

#[derive(Debug, Serialize)]
pub struct SessionResetResponse {
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct SessionLogQuery {
    pub session_id: String,
}

#[derive(Debug, Serialize)]
pub struct SessionLogResponse {
    pub log: Vec<SessionEntry>,
}

#[derive(Debug, Serialize)]
pub struct SessionEntry {
    pub entry_type: String,
    pub content: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub workspace_id: String,
    pub repo_path: String,
    pub worktree_path: Option<String>,
    pub intent: String,
    pub agent_profile: Option<String>,
    pub status: String, // "queued"|"running"|"blocked"|"needs_review"|"done"|"failed"|"cancelled"
    pub active_run_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Run {
    pub id: String,
    pub task_id: String,
    pub created_at: i64,
    pub started_at: Option<i64>,
    pub ended_at: Option<i64>,
    pub terminal_session_id: Option<String>,
    pub status: String,
    pub tokens: Option<i32>,
    pub cost: Option<f64>,
    pub duration_ms: Option<i64>,
    pub review_ready: bool,
    pub review_summary: Option<String>,
    pub canvas_enabled: bool,
    pub canvas_stream_id: Option<String>,
    pub last_frame_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "t")]
pub enum OrchestratorEvent {
    #[serde(rename = "TASK_CREATED")]
    TaskCreated { task: Task },
    #[serde(rename = "RUN_STARTED")]
    RunStarted { run: Run },
    #[serde(rename = "RUN_OUTPUT")]
    RunOutput {
        run_id: String,
        data: String,
        ts: i64,
    },
    #[serde(rename = "RUN_STATE_CHANGED")]
    RunStateChanged {
        run_id: String,
        status: String,
        ts: i64,
    },
    #[serde(rename = "REVIEW_READY")]
    ReviewReady {
        run_id: String,
        summary: String,
        ts: i64,
    },
    #[serde(rename = "CANVAS_FRAME")]
    CanvasFrame {
        run_id: String,
        frame: serde_json::Value,
        ts: i64,
    },
}
