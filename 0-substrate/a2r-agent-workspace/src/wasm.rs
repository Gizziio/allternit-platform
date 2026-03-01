//! WASM bindings for browser integration
//!
//! This module provides WebAssembly bindings for using the agent workspace
//! in browser environments (e.g., Shell UI).
//!
//! # Example (JavaScript)
//!
//! ```javascript
//! import init, { WorkspaceApi } from 'a2r-agent-workspace';
//!
//! // Initialize WASM module
//! await init();
//!
//! // Create workspace API
//! const workspace = new WorkspaceApi("/path/to/workspace");
//! const result = await workspace.boot();
//! console.log(result);
//! ```

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use crate::{WorkspaceMetadata, WorkspaceLayers};

/// Initialize the WASM module
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

/// Workspace API exposed to JavaScript
#[wasm_bindgen]
pub struct WorkspaceApi {
    path: String,
}

#[wasm_bindgen]
impl WorkspaceApi {
    /// Create a new workspace API handle
    #[wasm_bindgen(constructor)]
    pub fn new(path: String) -> Self {
        Self { path }
    }

    /// Get the workspace path
    #[wasm_bindgen(getter)]
    pub fn path(&self) -> String {
        self.path.clone()
    }

    /// Boot the workspace (simulated for WASM - in real implementation, 
    /// the Shell UI would use the HTTP backend to an actual server)
    pub async fn boot(&self) -> JsValue {
        let result = serde_json::json!({
            "success": true,
            "path": self.path,
            "message": "Workspace API initialized (WASM mode)",
            "note": "For full functionality, use HTTP backend to connect to CLI server"
        });
        
        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::UNDEFINED)
    }

    /// Get workspace metadata (placeholder - returns default structure)
    #[wasm_bindgen(js_name = getMetadata)]
    pub fn get_metadata(&self) -> JsValue {
        let metadata = WorkspaceMetadata {
            workspace_id: "wasm-placeholder".to_string(),
            workspace_version: "0.1.0".to_string(),
            agent_name: "WASM Agent".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            layers: WorkspaceLayers {
                cognitive: true,
                identity: true,
                governance: true,
                skills: true,
                business: false,
            },
        };
        
        serde_wasm_bindgen::to_value(&metadata).unwrap_or(JsValue::UNDEFINED)
    }

    /// Check if a tool is allowed (placeholder implementation)
    #[wasm_bindgen(js_name = checkTool)]
    pub fn check_tool(&self, tool_id: String) -> JsValue {
        let result = serde_json::json!({
            "tool_id": tool_id,
            "allowed": true,
            "requires_approval": false,
            "reason": null,
            "note": "WASM mode - use HTTP backend for actual policy enforcement"
        });
        
        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::UNDEFINED)
    }

    /// Validate workspace structure (basic check)
    #[wasm_bindgen(js_name = validateStructure)]
    pub fn validate_structure(&self, files: JsValue) -> JsValue {
        let files: Vec<String> = match serde_wasm_bindgen::from_value(files) {
            Ok(f) => f,
            Err(_) => return serde_wasm_bindgen::to_value(&serde_json::json!({
                "valid": false,
                "error": "Invalid files input"
            })).unwrap_or(JsValue::UNDEFINED),
        };
        
        let required = ["AGENTS.md", "IDENTITY.md"];
        let missing: Vec<&str> = required.iter()
            .filter(|&&r| !files.iter().any(|f| f.ends_with(r)))
            .copied()
            .collect();
        
        let result = serde_json::json!({
            "valid": missing.is_empty(),
            "missing_files": missing,
            "found_files": files.len()
        });
        
        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::UNDEFINED)
    }
}

/// Policy check request/response types
#[derive(Serialize, Deserialize)]
pub struct PolicyCheckRequest {
    pub tool_id: String,
    pub context: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
pub struct PolicyCheckResponse {
    pub allowed: bool,
    pub requires_approval: bool,
    pub reason: Option<String>,
}

/// Standalone policy check function
#[wasm_bindgen(js_name = checkPolicy)]
pub fn check_policy(request_js: JsValue) -> JsValue {
    let request: PolicyCheckRequest = match serde_wasm_bindgen::from_value(request_js) {
        Ok(r) => r,
        Err(_) => return serde_wasm_bindgen::to_value(&serde_json::json!({
            "allowed": false,
            "requires_approval": false,
            "reason": "Invalid request"
        })).unwrap_or(JsValue::UNDEFINED),
    };
    
    // Simplified policy check (WASM placeholder)
    let response = PolicyCheckResponse {
        allowed: !request.tool_id.starts_with("dangerous."),
        requires_approval: request.tool_id.starts_with("filesystem.") || request.tool_id.starts_with("network."),
        reason: None,
    };
    
    serde_wasm_bindgen::to_value(&response).unwrap_or(JsValue::UNDEFINED)
}

/// Core files that should be present in a valid workspace
#[wasm_bindgen(js_name = getCoreFiles)]
pub fn get_core_files() -> JsValue {
    let files: Vec<&str> = crate::CORE_FILES.to_vec();
    serde_wasm_bindgen::to_value(&files).unwrap_or(JsValue::UNDEFINED)
}

/// Re-export wasm_bindgen for use in bindings
pub use wasm_bindgen;
