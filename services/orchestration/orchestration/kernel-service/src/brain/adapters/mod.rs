//! PTY Brain Tool Adapters
//!
//! This module provides tool-specific configurations for CLI brain tools.
//! Each adapter includes command, args, env, bootstrap patterns, and detection logic.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub mod tool_adapter;

pub use tool_adapter::ToolAdapter;

/// Get tool adapter by tool ID
pub fn get_by_id(tool_id: &str) -> Option<ToolAdapter> {
    match tool_id {
        "opencode" => Some(ToolAdapter::opencode()),
        "claude-code" => Some(ToolAdapter::claude_code()),
        "amp" => Some(ToolAdapter::amp()),
        "aider" => Some(ToolAdapter::aider()),
        "gemini-cli" => Some(ToolAdapter::gemini_cli()),
        "cursor" => Some(ToolAdapter::cursor()),
        "verdant" => Some(ToolAdapter::verdant()),
        "qwen" => Some(ToolAdapter::qwen()),
        "goose" => Some(ToolAdapter::goose()),
        "codex" => Some(ToolAdapter::codex()),
        "kimi-cli" => Some(ToolAdapter::kimi_cli()),
        _ => None,
    }
}

/// Get all available tool adapters
pub fn get_all() -> Vec<ToolAdapter> {
    vec![
        ToolAdapter::opencode(),
        ToolAdapter::claude_code(),
        ToolAdapter::amp(),
        ToolAdapter::aider(),
        ToolAdapter::gemini_cli(),
        ToolAdapter::cursor(),
        ToolAdapter::verdant(),
        ToolAdapter::qwen(),
        ToolAdapter::goose(),
        ToolAdapter::codex(),
        ToolAdapter::kimi_cli(),
    ]
}
