use crate::types::ToolDefinition;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use voice_service::{TTSRequest, VCRequest, VoiceClient};
use webvm_service::{SessionCreateRequest, SessionManager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub tool_id: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[derive(Debug)]
pub struct ToolExecutor {
    tools: HashMap<String, Box<dyn Tool>>,
}

#[async_trait::async_trait]
pub trait Tool: Send + Sync + std::fmt::Debug {
    async fn execute(
        &self,
        parameters: &serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error>;
    fn name(&self) -> &str;
    fn definition(&self) -> ToolDefinition;
}

#[derive(Debug)]
pub struct WebSearchTool;

#[async_trait::async_trait]
impl Tool for WebSearchTool {
    async fn execute(
        &self,
        parameters: &serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error> {
        let query = parameters["query"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'query' parameter"))?;

        let mock_results = serde_json::json!({
            "query": query,
            "results": [
                {
                    "title": format!("Mock result for '{}'", query),
                    "url": "https://example.com/mock",
                    "snippet": "This is a mock search result for demonstration purposes."
                },
                {
                    "title": "Another result",
                    "url": "https://example.com/mock2",
                    "snippet": "Another mock search result."
                }
            ]
        });

        Ok(serde_json::json!({
            "ObserveCapsule": mock_results
        }))
    }

    fn name(&self) -> &str {
        "web.search"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "web.search".to_string(),
            description: "Search the web for information.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "The search query" }
                },
                "required": ["query"]
            }),
        }
    }
}

#[derive(Debug)]
pub struct NoteTool;

#[async_trait::async_trait]
impl Tool for NoteTool {
    async fn execute(
        &self,
        parameters: &serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error> {
        let content = parameters["content"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'content' parameter"))?;

        Ok(serde_json::json!({
            "note_id": uuid::Uuid::new_v4().to_string(),
            "content": content,
            "timestamp": chrono::Utc::now().timestamp_millis()
        }))
    }

    fn name(&self) -> &str {
        "note.create"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "note.create".to_string(),
            description: "Create a new note.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "content": { "type": "string", "description": "The note content" }
                },
                "required": ["content"]
            }),
        }
    }
}

#[derive(Debug, Clone)]
pub struct VoiceTTSTool {
    client: Arc<VoiceClient>,
}

impl VoiceTTSTool {
    pub fn new(client: Arc<VoiceClient>) -> Self {
        Self { client }
    }
}

#[async_trait::async_trait]
impl Tool for VoiceTTSTool {
    async fn execute(
        &self,
        parameters: &serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error> {
        let text = parameters["text"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'text' parameter"))?;

        let voice = parameters["voice"].as_str().unwrap_or("default");

        let format = parameters["format"].as_str().unwrap_or("wav");

        let use_paralinguistic = parameters["use_paralinguistic"].as_bool().unwrap_or(true);

        let request = TTSRequest {
            text: text.to_string(),
            voice: voice.to_string(),
            format: format.to_string(),
            use_paralinguistic,
        };

        let response = self.client.text_to_speech(request).await?;

        Ok(serde_json::json!({
            "audio_url": response.audio_url,
            "duration": response.duration,
            "filename": response.filename
        }))
    }

    fn name(&self) -> &str {
        "voice.tts"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "voice.tts".to_string(),
            description: "Convert text to speech using Chatterbox TTS model.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "text": { "type": "string", "description": "Text to convert to speech" },
                    "voice": { "type": "string", "description": "Voice model to use", "default": "default" },
                    "format": { "type": "string", "description": "Audio format", "default": "wav" },
                    "use_paralinguistic": { "type": "boolean", "description": "Enable paralinguistic tags", "default": true }
                },
                "required": ["text"]
            }),
        }
    }
}

#[derive(Debug, Clone)]
pub struct VoiceCloneTool {
    client: Arc<VoiceClient>,
}

impl VoiceCloneTool {
    pub fn new(client: Arc<VoiceClient>) -> Self {
        Self { client }
    }
}

#[async_trait::async_trait]
impl Tool for VoiceCloneTool {
    async fn execute(
        &self,
        parameters: &serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error> {
        let text = parameters["text"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'text' parameter"))?;

        let reference_audio_url = parameters["reference_audio_url"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'reference_audio_url' parameter"))?;

        let format = parameters["format"].as_str().unwrap_or("wav");

        let request = VCRequest {
            text: text.to_string(),
            reference_audio_url: reference_audio_url.to_string(),
            format: format.to_string(),
        };

        let response = self.client.voice_clone(request).await?;

        Ok(serde_json::json!({
            "audio_url": response.audio_url,
            "duration": response.duration,
            "filename": response.filename
        }))
    }

    fn name(&self) -> &str {
        "voice.clone"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "voice.clone".to_string(),
            description: "Clone voice from reference audio and generate speech.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "text": { "type": "string", "description": "Text to synthesize" },
                    "reference_audio_url": { "type": "string", "description": "URL to reference audio file" },
                    "format": { "type": "string", "description": "Audio format", "default": "wav" }
                },
                "required": ["text", "reference_audio_url"]
            }),
        }
    }
}

#[derive(Debug, Clone)]
pub struct WebVMTool {
    session_manager: Arc<SessionManager>,
}

impl WebVMTool {
    pub fn new(session_manager: Arc<SessionManager>) -> Self {
        Self { session_manager }
    }
}

#[async_trait::async_trait]
impl Tool for WebVMTool {
    async fn execute(
        &self,
        _parameters: &serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error> {
        // For now, return a placeholder response
        Ok(serde_json::json!({
            "status": "success",
            "session_id": "placeholder_session_id",
            "url": self.session_manager.base_url()
        }))
    }

    fn name(&self) -> &str {
        "webvm.session"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "webvm.session".to_string(),
            description: "WebVM session management tool".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "command": { "type": "string", "description": "Command to execute in the WebVM session" },
                    "session_id": { "type": "string", "description": "Existing session ID (optional)" }
                },
                "required": ["command"]
            }),
        }
    }
}

#[derive(Debug)]
pub struct AllternitNativeInitTool;

#[async_trait::async_trait]
impl Tool for AllternitNativeInitTool {
    async fn execute(
        &self,
        parameters: &serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error> {
        let project_name = parameters["project_name"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing 'project_name' parameter"))?;

        let workspace_path = parameters["workspace_path"]
            .as_str()
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());

        let allternit_dir = workspace_path.join(".allternit");
        let plans_dir = allternit_dir.join("plans");

        std::fs::create_dir_all(&plans_dir)?;

        // Create PROJECT.md
        let project_md = format!(
            "# Allternit Native: PROJECT.md\n\n## What This Is\n\n{}\n\n## Core Value\n\n[The ONE thing that matters most]\n",
            project_name
        );
        std::fs::write(allternit_dir.join("PROJECT.md"), project_md)?;

        // Create STATE.md
        let state_md = "# Allternit Native: STATE.md\n\n## Current Position\n\nPhase: 1 of 3 (Discovery)\nPlan: 0 of 0\nStatus: Initialized\nProgress: [░░░░░░░░░░] 0%\n";
        std::fs::write(allternit_dir.join("STATE.md"), state_md)?;

        // Create ROADMAP.md
        let roadmap_md = "# Allternit Native: ROADMAP.md\n\n## Milestones\n\n1. [ ] Phase 1: Foundation\n2. [ ] Phase 2: Implementation\n3. [ ] Phase 3: Validation\n";
        std::fs::write(allternit_dir.join("ROADMAP.md"), roadmap_md)?;

        Ok(serde_json::json!({
            "status": "success",
            "message": format!("Allternit Native protocol initialized for project: {}", project_name),
            "directory": allternit_dir.to_string_lossy()
        }))
    }

    fn name(&self) -> &str {
        "allternit_native_init"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "allternit_native_init".to_string(),
            description: "Initialize the Allternit Native context engineering protocol in the workspace.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "project_name": { "type": "string", "description": "The name of the project" },
                    "workspace_path": { "type": "string", "description": "Optional custom workspace path" }
                },
                "required": ["project_name"]
            }),
        }
    }
}

impl ToolExecutor {
    pub fn new() -> Self {
        let mut tools: HashMap<String, Box<dyn Tool>> = HashMap::new();

        tools.insert("web.search".to_string(), Box::new(WebSearchTool));
        tools.insert("note.create".to_string(), Box::new(NoteTool));
        tools.insert("allternit_native_init".to_string(), Box::new(AllternitNativeInitTool));

        let voice_client = Arc::new(VoiceClient::default());
        tools.insert(
            "voice.tts".to_string(),
            Box::new(VoiceTTSTool::new(voice_client.clone())),
        );
        tools.insert(
            "voice.clone".to_string(),
            Box::new(VoiceCloneTool::new(voice_client)),
        );

        let session_manager =
            Arc::new(SessionManager::new(format!("{}://session-manager", "http")));
        tools.insert(
            "webvm.session".to_string(),
            Box::new(WebVMTool::new(session_manager)),
        );

        Self { tools }
    }

    pub fn register_tool(&mut self, tool: Box<dyn Tool>) {
        self.tools.insert(tool.name().to_string(), tool);
    }

    pub fn get_definitions(&self) -> Vec<ToolDefinition> {
        self.tools.values().map(|t| t.definition()).collect()
    }

    pub async fn execute(&self, tool_call: &ToolCall) -> ToolResult {
        match self.tools.get(&tool_call.tool_id) {
            Some(tool) => match tool.execute(&tool_call.parameters).await {
                Ok(result) => ToolResult {
                    success: true,
                    result: Some(result),
                    error: None,
                },
                Err(e) => ToolResult {
                    success: false,
                    result: None,
                    error: Some(e.to_string()),
                },
            },
            None => ToolResult {
                success: false,
                result: None,
                error: Some(format!("Tool not found: {}", tool_call.tool_id)),
            },
        }
    }
}
