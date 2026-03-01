//! Tool Adapter Trait and Types
//!
//! Defines the ToolAdapter structure and individual tool configurations.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolAdapter {
    pub tool_id: String,
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: Option<HashMap<String, String>>,
    pub cwd: Option<String>,
    pub bootstrap: Vec<String>,
    pub capabilities: ToolCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCapabilities {
    pub supports_chat: bool,
    pub supports_tools: bool,
    pub supports_sessions: bool,
    pub requires_workspace: bool,
}

impl ToolAdapter {
    pub fn opencode() -> Self {
        Self {
            tool_id: "opencode".to_string(),
            name: "OpenCode".to_string(),
            command: "opencode".to_string(),
            args: vec![],
            env: None,
            cwd: None,
            bootstrap: vec!["session start\n".to_string()],
            capabilities: ToolCapabilities {
                supports_chat: true,
                supports_tools: true,
                supports_sessions: true,
                requires_workspace: true,
            },
        }
    }

    pub fn claude_code() -> Self {
        Self {
            tool_id: "claude-code".to_string(),
            name: "Claude Code".to_string(),
            command: "claude".to_string(),
            args: vec![],
            env: None,
            cwd: None,
            bootstrap: vec![],
            capabilities: ToolCapabilities {
                supports_chat: true,
                supports_tools: true,
                supports_sessions: true,
                requires_workspace: true,
            },
        }
    }

    pub fn amp() -> Self {
        Self {
            tool_id: "amp".to_string(),
            name: "Amp (Sourcegraph)".to_string(),
            command: "amp".to_string(),
            args: vec![],
            env: None,
            cwd: None,
            bootstrap: vec![],
            capabilities: ToolCapabilities {
                supports_chat: true,
                supports_tools: false,
                supports_sessions: false,
                requires_workspace: true,
            },
        }
    }

    pub fn aider() -> Self {
        Self {
            tool_id: "aider".to_string(),
            name: "Aider".to_string(),
            command: "aider".to_string(),
            args: vec![],
            env: None,
            cwd: None,
            bootstrap: vec![],
            capabilities: ToolCapabilities {
                supports_chat: true,
                supports_tools: true,
                supports_sessions: false,
                requires_workspace: true,
            },
        }
    }

    pub fn gemini_cli() -> Self {
        Self {
            tool_id: "gemini-cli".to_string(),
            name: "Gemini CLI".to_string(),
            command: "gemini".to_string(),
            args: vec![],
            env: None,
            cwd: None,
            bootstrap: vec![],
            capabilities: ToolCapabilities {
                supports_chat: true,
                supports_tools: false,
                supports_sessions: false,
                requires_workspace: true,
            },
        }
    }

    pub fn cursor() -> Self {
        Self {
            tool_id: "cursor".to_string(),
            name: "Cursor".to_string(),
            command: "cursor".to_string(),
            args: vec![],
            env: None,
            cwd: None,
            bootstrap: vec![],
            capabilities: ToolCapabilities {
                supports_chat: true,
                supports_tools: false,
                supports_sessions: false,
                requires_workspace: false,
            },
        }
    }

    pub fn verdant() -> Self {
        Self {
            tool_id: "verdant".to_string(),
            name: "Verdant".to_string(),
            command: "verdant".to_string(),
            args: vec![],
            env: None,
            cwd: None,
            bootstrap: vec![],
            capabilities: ToolCapabilities {
                supports_chat: true,
                supports_tools: false,
                supports_sessions: false,
                requires_workspace: true,
            },
        }
    }

    pub fn qwen() -> Self {
        Self {
            tool_id: "qwen".to_string(),
            name: "Qwen Code".to_string(),
            command: "qwen-coder".to_string(),
            args: vec![],
            env: None,
            cwd: None,
            bootstrap: vec![],
            capabilities: ToolCapabilities {
                supports_chat: true,
                supports_tools: false,
                supports_sessions: false,
                requires_workspace: true,
            },
        }
    }

    pub fn goose() -> Self {
        Self {
            tool_id: "goose".to_string(),
            name: "Goose CLI".to_string(),
            command: "goose".to_string(),
            args: vec![],
            env: None,
            cwd: None,
            bootstrap: vec![],
            capabilities: ToolCapabilities {
                supports_chat: true,
                supports_tools: false,
                supports_sessions: false,
                requires_workspace: true,
            },
        }
    }

    pub fn codex() -> Self {
        Self {
            tool_id: "codex".to_string(),
            name: "OpenAI Codex CLI".to_string(),
            command: "codex".to_string(),
            args: vec![],
            env: None,
            cwd: None,
            bootstrap: vec![],
            capabilities: ToolCapabilities {
                supports_chat: true,
                supports_tools: true,
                supports_sessions: true,
                requires_workspace: true,
            },
        }
    }

    pub fn kimi_cli() -> Self {
        Self {
            tool_id: "kimi-cli".to_string(),
            name: "Moonshot Kimi CLI".to_string(),
            command: "kimi".to_string(),
            args: vec![],
            env: None,
            cwd: None,
            bootstrap: vec![],
            capabilities: ToolCapabilities {
                supports_chat: true,
                supports_tools: true,
                supports_sessions: true,
                requires_workspace: true,
            },
        }
    }
}
