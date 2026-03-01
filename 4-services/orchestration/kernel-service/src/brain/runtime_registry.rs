use anyhow::Result;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeState {
    pub runtime_id: String,
    pub installed: bool,
    pub last_verified: i64,
    pub auth_complete: bool,
    pub detected_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliRuntimeDefinition {
    pub id: String,
    pub name: String,
    pub vendor: String,
    pub logo_asset: String,

    pub check_cmd: String,
    pub install_cmd: Option<String>,
    pub install_platform: Option<PlatformCommands>,

    pub run_cmd: String,
    pub run_args: Vec<String>,

    pub auth_required: bool,
    pub auth_cmd: Option<String>,
    pub auth_instructions: Option<String>,
    pub auth_detection_regex: Option<String>,

    pub event_mode: String,
    pub capabilities: Vec<String>,

    pub runtime_type: RuntimeType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeType {
    Api,
    Cli,
    Local,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformCommands {
    pub darwin: Option<String>,
    pub linux: Option<String>,
    pub windows: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RuntimeGroup {
    pub title: String,
    pub runtimes: Vec<CliRuntimeDefinition>,
}

#[derive(Debug, Serialize)]
pub struct ListRuntimesResponse {
    pub groups: Vec<RuntimeGroup>,
}

#[derive(Clone)]
pub struct RuntimeRegistry {
    runtime_states: Arc<RwLock<HashMap<String, RuntimeState>>>,
}

impl Default for RuntimeRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl RuntimeRegistry {
    pub fn new() -> Self {
        RuntimeRegistry {
            runtime_states: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn get_runtime_state(&self, runtime_id: &str) -> Option<RuntimeState> {
        tokio::task::block_in_place(|| {
            let states = self.runtime_states.blocking_read();
            states.get(runtime_id).cloned()
        })
    }

    pub async fn update_runtime_state(&self, state: RuntimeState) {
        let mut states = self.runtime_states.write().await;
        states.insert(state.runtime_id.clone(), state);
    }

    pub async fn mark_installed(&self, runtime_id: &str, version: Option<String>) {
        let current = self.get_runtime_state(runtime_id);
        let new_state = RuntimeState {
            runtime_id: runtime_id.to_string(),
            installed: true,
            last_verified: Utc::now().timestamp(),
            auth_complete: current.map(|c| c.auth_complete).unwrap_or(false),
            detected_version: version,
        };
        self.update_runtime_state(new_state).await;
    }

    pub async fn mark_auth_complete(&self, runtime_id: &str) {
        let mut state = self
            .get_runtime_state(runtime_id)
            .unwrap_or_else(|| RuntimeState {
                runtime_id: runtime_id.to_string(),
                installed: false,
                last_verified: 0,
                auth_complete: false,
                detected_version: None,
            });
        state.auth_complete = true;
        state.last_verified = Utc::now().timestamp();
        self.update_runtime_state(state).await;
    }

    pub async fn get_all_states(&self) -> Vec<RuntimeState> {
        let states = self.runtime_states.read().await;
        states.values().cloned().collect()
    }
}

impl RuntimeRegistry {
    pub fn load_presets() -> Result<Vec<CliRuntimeDefinition>> {
        let presets = vec![
            Self::claude_code_preset(),
            Self::aider_preset(),
            Self::goose_preset(),
            Self::codex_preset(),
            Self::qwen_cli_preset(),
            Self::amp_cli_preset(),
            Self::open_code_cli_preset(),
            Self::cursor_cli_preset(),
            Self::anthropic_api_preset(),
            Self::openai_api_preset(),
            Self::google_gemini_preset(),
            Self::mistral_api_preset(),
            Self::qwen_api_preset(),
            Self::amp_api_preset(),
            Self::zai_api_preset(),
            Self::ollama_preset(),
        ];

        Ok(presets)
    }

    pub fn get_runtime_definition(runtime_id: &str) -> Option<CliRuntimeDefinition> {
        match runtime_id {
            "claude-code" => Some(Self::claude_code_preset()),
            "aider" => Some(Self::aider_preset()),
            "goose" => Some(Self::goose_preset()),
            "codex" => Some(Self::codex_preset()),
            "qwen-cli" => Some(Self::qwen_cli_preset()),
            "amp-cli" => Some(Self::amp_cli_preset()),
            "open-code-cli" => Some(Self::open_code_cli_preset()),
            "cursor-cli" => Some(Self::cursor_cli_preset()),
            "anthropic-api" => Some(Self::anthropic_api_preset()),
            "openai-api" => Some(Self::openai_api_preset()),
            "google-gemini" => Some(Self::google_gemini_preset()),
            "mistral-api" => Some(Self::mistral_api_preset()),
            "qwen-api" => Some(Self::qwen_api_preset()),
            "amp-api" => Some(Self::amp_api_preset()),
            "zai-api" => Some(Self::zai_api_preset()),
            "ollama" => Some(Self::ollama_preset()),
            _ => None,
        }
    }

    pub fn list_all_definitions() -> ListRuntimesResponse {
        let presets = Self::load_presets().unwrap_or_default();

        let groups = vec![
            RuntimeGroup {
                title: "Cloud / API Agents".to_string(),
                runtimes: presets
                    .iter()
                    .filter(|r| matches!(r.runtime_type, RuntimeType::Api))
                    .cloned()
                    .collect(),
            },
            RuntimeGroup {
                title: "Local Model Agents".to_string(),
                runtimes: presets
                    .iter()
                    .filter(|r| matches!(r.runtime_type, RuntimeType::Local))
                    .cloned()
                    .collect(),
            },
            RuntimeGroup {
                title: "CLI-Wrapped Agents".to_string(),
                runtimes: presets
                    .iter()
                    .filter(|r| matches!(r.runtime_type, RuntimeType::Cli))
                    .cloned()
                    .collect(),
            },
        ];

        ListRuntimesResponse { groups }
    }

    fn claude_code_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "claude-code".to_string(),
            name: "Claude Code".to_string(),
            vendor: "Anthropic".to_string(),
            logo_asset: "claude-logo.svg".to_string(),

            check_cmd: "claude-code --version".to_string(),
            install_cmd: Some("claude-code --install".to_string()),
            install_platform: Some(PlatformCommands {
                darwin: Some("brew install claude-code".to_string()),
                linux: Some("curl -fsSL https://claude.ai/install.sh | sh".to_string()),
                windows: Some("winget install Anthropic.ClaudeCode".to_string()),
            }),

            run_cmd: "claude-code".to_string(),
            run_args: vec![],

            auth_required: true,
            auth_cmd: None,
            auth_instructions: Some(
                "First run will prompt for API key. Enter your Anthropic API key when prompted."
                    .to_string(),
            ),
            auth_detection_regex: Some("Successfully authenticated|API key set".to_string()),

            event_mode: "acp".to_string(),
            capabilities: vec![
                "code".to_string(),
                "terminal".to_string(),
                "files".to_string(),
                "chat".to_string(),
            ],

            runtime_type: RuntimeType::Cli,
        }
    }

    fn aider_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "aider".to_string(),
            name: "Aider".to_string(),
            vendor: "Aider AI".to_string(),
            logo_asset: "aider-logo.svg".to_string(),

            check_cmd: "aider --version".to_string(),
            install_cmd: Some("pip install aider-chat".to_string()),
            install_platform: Some(PlatformCommands {
                darwin: Some("pip install aider-chat".to_string()),
                linux: Some("pip install aider-chat".to_string()),
                windows: Some("pip install aider-chat".to_string()),
            }),

            run_cmd: "aider".to_string(),
            run_args: vec!["--stream".to_string()],

            auth_required: false,
            auth_cmd: None,
            auth_instructions: None,
            auth_detection_regex: None,

            event_mode: "jsonl".to_string(),
            capabilities: vec![
                "code".to_string(),
                "terminal".to_string(),
                "files".to_string(),
                "git".to_string(),
            ],

            runtime_type: RuntimeType::Cli,
        }
    }

    fn goose_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "goose".to_string(),
            name: "Goose".to_string(),
            vendor: "Block".to_string(),
            logo_asset: "goose-logo.svg".to_string(),

            check_cmd: "goose --version".to_string(),
            install_cmd: Some("goose install".to_string()),
            install_platform: Some(PlatformCommands {
                darwin: Some("brew install goose".to_string()),
                linux: Some("curl -fsSL https://goose.dev/install.sh | sh".to_string()),
                windows: Some("winget install Block.Goose".to_string()),
            }),

            run_cmd: "goose".to_string(),
            run_args: vec![],

            auth_required: true,
            auth_cmd: Some("goose auth".to_string()),
            auth_instructions: Some("Run 'goose auth' to configure your API keys".to_string()),
            auth_detection_regex: Some("Authentication successful".to_string()),

            event_mode: "acp".to_string(),
            capabilities: vec![
                "code".to_string(),
                "terminal".to_string(),
                "files".to_string(),
            ],

            runtime_type: RuntimeType::Cli,
        }
    }

    fn codex_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "codex".to_string(),
            name: "Codex".to_string(),
            vendor: "OpenAI".to_string(),
            logo_asset: "openai-logo.svg".to_string(),

            check_cmd: "codex --version".to_string(),
            install_cmd: Some("npm install -g @openai/codex".to_string()),
            install_platform: Some(PlatformCommands {
                darwin: Some("npm install -g @openai/codex".to_string()),
                linux: Some("npm install -g @openai/codex".to_string()),
                windows: Some("npm install -g @openai/codex".to_string()),
            }),

            run_cmd: "codex".to_string(),
            run_args: vec![],

            auth_required: true,
            auth_cmd: Some("codex auth".to_string()),
            auth_instructions: Some(
                "Run 'codex auth' to configure your OpenAI API key".to_string(),
            ),
            auth_detection_regex: Some("Authentication successful".to_string()),

            event_mode: "jsonl".to_string(),
            capabilities: vec![
                "code".to_string(),
                "terminal".to_string(),
                "files".to_string(),
            ],

            runtime_type: RuntimeType::Cli,
        }
    }

    fn qwen_cli_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "qwen-cli".to_string(),
            name: "Qwen CLI".to_string(),
            vendor: "Alibaba Cloud".to_string(),
            logo_asset: "qwen-logo.svg".to_string(),

            check_cmd: "qwen --version".to_string(),
            install_cmd: Some("pip install qwen-cli".to_string()),
            install_platform: Some(PlatformCommands {
                darwin: Some("pip install qwen-cli".to_string()),
                linux: Some("pip install qwen-cli".to_string()),
                windows: Some("pip install qwen-cli".to_string()),
            }),

            run_cmd: "qwen".to_string(),
            run_args: vec!["chat".to_string()],

            auth_required: true,
            auth_cmd: None,
            auth_instructions: Some("First run requires API key configuration".to_string()),
            auth_detection_regex: Some("Authentication successful|API key configured".to_string()),

            event_mode: "jsonl".to_string(),
            capabilities: vec![
                "code".to_string(),
                "terminal".to_string(),
                "files".to_string(),
            ],

            runtime_type: RuntimeType::Cli,
        }
    }

    fn amp_cli_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "amp-cli".to_string(),
            name: "AMP CLI".to_string(),
            vendor: "AMP".to_string(),
            logo_asset: "amp-logo.svg".to_string(),

            check_cmd: "amp --version".to_string(),
            install_cmd: Some("npm install -g @amp/cli".to_string()),
            install_platform: Some(PlatformCommands {
                darwin: Some("npm install -g @amp/cli".to_string()),
                linux: Some("npm install -g @amp/cli".to_string()),
                windows: Some("npm install -g @amp/cli".to_string()),
            }),

            run_cmd: "amp".to_string(),
            run_args: vec!["assistant".to_string()],

            auth_required: true,
            auth_cmd: None,
            auth_instructions: Some("Configure API key on first run".to_string()),
            auth_detection_regex: Some("Connected to AMP|Authentication complete".to_string()),

            event_mode: "jsonl".to_string(),
            capabilities: vec![
                "code".to_string(),
                "terminal".to_string(),
                "files".to_string(),
            ],

            runtime_type: RuntimeType::Cli,
        }
    }

    fn open_code_cli_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "open-code-cli".to_string(),
            name: "Open Code CLI".to_string(),
            vendor: "Open Code".to_string(),
            logo_asset: "open-code-logo.svg".to_string(),

            check_cmd: "open-code --version".to_string(),
            install_cmd: Some("npm install -g @opencode/cli".to_string()),
            install_platform: Some(PlatformCommands {
                darwin: Some("npm install -g @opencode/cli".to_string()),
                linux: Some("npm install -g @opencode/cli".to_string()),
                windows: Some("npm install -g @opencode/cli".to_string()),
            }),

            run_cmd: "open-code".to_string(),
            run_args: vec![],

            auth_required: true,
            auth_cmd: None,
            auth_instructions: Some("First run requires API key or login".to_string()),
            auth_detection_regex: Some("Successfully authenticated|Ready to assist".to_string()),

            event_mode: "acp".to_string(),
            capabilities: vec![
                "code".to_string(),
                "terminal".to_string(),
                "files".to_string(),
                "ui-automation".to_string(),
            ],

            runtime_type: RuntimeType::Cli,
        }
    }

    fn cursor_cli_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "cursor-cli".to_string(),
            name: "Cursor CLI".to_string(),
            vendor: "Cursor AI".to_string(),
            logo_asset: "cursor-logo.svg".to_string(),

            check_cmd: "cursor --version".to_string(),
            install_cmd: Some("npm install -g @cursor/cli".to_string()),
            install_platform: Some(PlatformCommands {
                darwin: Some("npm install -g @cursor/cli".to_string()),
                linux: Some("npm install -g @cursor/cli".to_string()),
                windows: Some("npm install -g @cursor/cli".to_string()),
            }),

            run_cmd: "cursor".to_string(),
            run_args: vec!["chat".to_string()],

            auth_required: true,
            auth_cmd: None,
            auth_instructions: Some("Configure Cursor account on first launch".to_string()),
            auth_detection_regex: Some("Authenticated|Connected to Cursor".to_string()),

            event_mode: "jsonl".to_string(),
            capabilities: vec![
                "code".to_string(),
                "terminal".to_string(),
                "files".to_string(),
            ],

            runtime_type: RuntimeType::Cli,
        }
    }

    fn anthropic_api_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "anthropic-api".to_string(),
            name: "Anthropic Claude API".to_string(),
            vendor: "Anthropic".to_string(),
            logo_asset: "claude-logo.svg".to_string(),

            check_cmd: "echo 'API key required'".to_string(),
            install_cmd: None,
            install_platform: None,

            run_cmd: "anthropic".to_string(),
            run_args: vec![],

            auth_required: true,
            auth_cmd: None,
            auth_instructions: Some("Enter your Anthropic API key".to_string()),
            auth_detection_regex: None,

            event_mode: "acp".to_string(),
            capabilities: vec!["chat".to_string(), "vision".to_string(), "code".to_string()],

            runtime_type: RuntimeType::Api,
        }
    }

    fn openai_api_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "openai-api".to_string(),
            name: "OpenAI GPT".to_string(),
            vendor: "OpenAI".to_string(),
            logo_asset: "openai-logo.svg".to_string(),

            check_cmd: "echo 'API key required'".to_string(),
            install_cmd: None,
            install_platform: None,

            run_cmd: "openai".to_string(),
            run_args: vec![],

            auth_required: true,
            auth_cmd: None,
            auth_instructions: Some("Enter your OpenAI API key".to_string()),
            auth_detection_regex: None,

            event_mode: "acp".to_string(),
            capabilities: vec!["chat".to_string(), "vision".to_string(), "code".to_string()],

            runtime_type: RuntimeType::Api,
        }
    }

    fn google_gemini_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "google-gemini".to_string(),
            name: "Google Gemini".to_string(),
            vendor: "Google".to_string(),
            logo_asset: "gemini-logo.svg".to_string(),

            check_cmd: "echo 'API key required'".to_string(),
            install_cmd: None,
            install_platform: None,

            run_cmd: "gemini".to_string(),
            run_args: vec![],

            auth_required: true,
            auth_cmd: None,
            auth_instructions: Some("Enter your Google AI API key".to_string()),
            auth_detection_regex: None,

            event_mode: "acp".to_string(),
            capabilities: vec!["chat".to_string(), "vision".to_string(), "code".to_string()],

            runtime_type: RuntimeType::Api,
        }
    }

    fn mistral_api_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "mistral-api".to_string(),
            name: "Mistral API".to_string(),
            vendor: "Mistral AI".to_string(),
            logo_asset: "mistral-logo.svg".to_string(),

            check_cmd: "curl -s -I https://api.mistral.ai/v1".to_string(),
            install_cmd: None,
            install_platform: None,

            run_cmd: "python".to_string(),
            run_args: vec![
                "-m".to_string(),
                "a2r_kernel".to_string(),
                "--provider".to_string(),
                "mistral".to_string(),
            ],

            auth_required: true,
            auth_cmd: None,
            auth_instructions: Some("Enter Mistral API key".to_string()),
            auth_detection_regex: Some("Valid API key|Authentication successful".to_string()),

            event_mode: "terminal".to_string(),
            capabilities: vec!["chat".to_string(), "vision".to_string(), "code".to_string()],

            runtime_type: RuntimeType::Api,
        }
    }

    fn qwen_api_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "qwen-api".to_string(),
            name: "Qwen API".to_string(),
            vendor: "Alibaba Cloud".to_string(),
            logo_asset: "qwen-logo.svg".to_string(),

            check_cmd: "curl -s -I https://dashscope.aliyuncs.com/api".to_string(),
            install_cmd: None,
            install_platform: None,

            run_cmd: "python".to_string(),
            run_args: vec![
                "-m".to_string(),
                "a2r_kernel".to_string(),
                "--provider".to_string(),
                "qwen".to_string(),
            ],

            auth_required: true,
            auth_cmd: None,
            auth_instructions: Some("Enter Alibaba Cloud API key".to_string()),
            auth_detection_regex: Some("API key valid|Connection established".to_string()),

            event_mode: "terminal".to_string(),
            capabilities: vec!["chat".to_string(), "vision".to_string(), "code".to_string()],

            runtime_type: RuntimeType::Api,
        }
    }

    fn amp_api_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "amp-api".to_string(),
            name: "AMP API".to_string(),
            vendor: "AMP".to_string(),
            logo_asset: "amp-logo.svg".to_string(),

            check_cmd: "curl -s -I https://api.amp.ai/health".to_string(),
            install_cmd: None,
            install_platform: None,

            run_cmd: "python".to_string(),
            run_args: vec![
                "-m".to_string(),
                "a2r_kernel".to_string(),
                "--provider".to_string(),
                "amp".to_string(),
            ],

            auth_required: true,
            auth_cmd: None,
            auth_instructions: Some("Enter AMP API key".to_string()),
            auth_detection_regex: Some("Key verified|Connection successful".to_string()),

            event_mode: "terminal".to_string(),
            capabilities: vec!["chat".to_string(), "vision".to_string()],

            runtime_type: RuntimeType::Api,
        }
    }

    fn zai_api_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "zai-api".to_string(),
            name: "Zai API".to_string(),
            vendor: "Zai".to_string(),
            logo_asset: "zai-logo.svg".to_string(),

            check_cmd: "curl -s -I https://api.zai.ai/v1".to_string(),
            install_cmd: None,
            install_platform: None,

            run_cmd: "python".to_string(),
            run_args: vec![
                "-m".to_string(),
                "a2r_kernel".to_string(),
                "--provider".to_string(),
                "zai".to_string(),
            ],

            auth_required: true,
            auth_cmd: None,
            auth_instructions: Some("Enter Zai API key".to_string()),
            auth_detection_regex: Some("API key validated|Connection successful".to_string()),

            event_mode: "terminal".to_string(),
            capabilities: vec!["chat".to_string(), "code".to_string()],

            runtime_type: RuntimeType::Api,
        }
    }

    fn ollama_preset() -> CliRuntimeDefinition {
        CliRuntimeDefinition {
            id: "ollama".to_string(),
            name: "Ollama".to_string(),
            vendor: "Ollama".to_string(),
            logo_asset: "ollama-logo.svg".to_string(),

            check_cmd: "ollama --version".to_string(),
            install_cmd: Some("ollama --version".to_string()),
            install_platform: Some(PlatformCommands {
                darwin: Some("brew install ollama".to_string()),
                linux: Some("curl -fsSL https://ollama.com/install.sh | sh".to_string()),
                windows: Some("winget install Ollama.Ollama".to_string()),
            }),

            run_cmd: "ollama".to_string(),
            run_args: vec!["run".to_string(), "llama3".to_string()],

            auth_required: false,
            auth_cmd: None,
            auth_instructions: None,
            auth_detection_regex: None,

            event_mode: "terminal".to_string(),
            capabilities: vec!["chat".to_string(), "code".to_string()],

            runtime_type: RuntimeType::Local,
        }
    }
}
