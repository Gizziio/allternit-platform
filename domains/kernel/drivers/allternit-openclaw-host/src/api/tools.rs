//! Tool Execution API Routes (N20)
//!
//! Provides tool listing and execution for agent sessions.
//! Includes both synchronous and streaming execution modes.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{sse::Event, Sse},
    Json,
};
use chrono::Utc;
use futures::Stream;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::convert::Infallible;
use std::time::Instant;
use uuid::Uuid;

use super::{AgentApiState, ApiError};
use crate::api::chat::{StreamEvent, ToolCall, ToolResult};

/// Tool definition response
#[derive(Debug, Serialize, Clone)]
pub struct ToolDefinitionResponse {
    pub id: String,
    pub name: String,
    pub description: String,
    pub parameters: Value,
    pub category: String,
}

/// Tool execution request
#[derive(Debug, Deserialize)]
pub struct ToolExecuteRequest {
    pub tool_id: String,
    pub arguments: HashMap<String, Value>,
}

/// Tool execution response
#[derive(Debug, Serialize)]
pub struct ToolExecuteResponse {
    pub tool_id: String,
    pub result: Value,
    pub success: bool,
    pub execution_time_ms: u64,
}

/// List of built-in tools
fn get_builtin_tools() -> Vec<ToolDefinitionResponse> {
    vec![
        ToolDefinitionResponse {
            id: "get_weather".to_string(),
            name: "get_weather".to_string(),
            description: "Get current weather information for a location".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City name or coordinates"
                    },
                    "units": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "default": "celsius"
                    }
                },
                "required": ["location"]
            }),
            category: "utility".to_string(),
        },
        ToolDefinitionResponse {
            id: "get_time".to_string(),
            name: "get_time".to_string(),
            description: "Get current time for a timezone".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "timezone": {
                        "type": "string",
                        "description": "Timezone (e.g., 'UTC', 'America/New_York')",
                        "default": "UTC"
                    }
                }
            }),
            category: "utility".to_string(),
        },
        ToolDefinitionResponse {
            id: "execute_code".to_string(),
            name: "execute_code".to_string(),
            description: "Execute code in a sandboxed environment".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "language": {
                        "type": "string",
                        "enum": ["python", "javascript", "rust", "bash"],
                        "description": "Programming language"
                    },
                    "code": {
                        "type": "string",
                        "description": "Code to execute"
                    }
                },
                "required": ["language", "code"]
            }),
            category: "code".to_string(),
        },
        ToolDefinitionResponse {
            id: "search_web".to_string(),
            name: "search_web".to_string(),
            description: "Search the web for information".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query"
                    },
                    "num_results": {
                        "type": "integer",
                        "default": 5,
                        "description": "Number of results to return"
                    }
                },
                "required": ["query"]
            }),
            category: "search".to_string(),
        },
        ToolDefinitionResponse {
            id: "create_canvas".to_string(),
            name: "create_canvas".to_string(),
            description: "Create a new canvas for visualization or content".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Canvas title"
                    },
                    "type": {
                        "type": "string",
                        "enum": ["code", "markdown", "json", "text", "diagram"],
                        "description": "Type of canvas content"
                    },
                    "content": {
                        "type": "string",
                        "description": "Initial content"
                    }
                },
                "required": ["title", "type"]
            }),
            category: "canvas".to_string(),
        },
        ToolDefinitionResponse {
            id: "read_file".to_string(),
            name: "read_file".to_string(),
            description: "Read contents of a file".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "File path"
                    }
                },
                "required": ["path"]
            }),
            category: "filesystem".to_string(),
        },
        ToolDefinitionResponse {
            id: "write_file".to_string(),
            name: "write_file".to_string(),
            description: "Write content to a file".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "File path"
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write"
                    }
                },
                "required": ["path", "content"]
            }),
            category: "filesystem".to_string(),
        },
    ]
}

/// List all available tools
pub async fn list_tools(
    State(_state): State<AgentApiState>,
) -> Result<Json<Vec<ToolDefinitionResponse>>, (StatusCode, Json<ApiError>)> {
    Ok(Json(get_builtin_tools()))
}

/// Execute a tool in a session
pub async fn execute_tool(
    State(_state): State<AgentApiState>,
    Path(_session_id): Path<String>,
    Json(req): Json<ToolExecuteRequest>,
) -> Result<Json<ToolExecuteResponse>, (StatusCode, Json<ApiError>)> {
    let start = Instant::now();

    // Execute the tool
    let result = execute_tool_internal(&req.tool_id, &req.arguments).await;
    let execution_time_ms = start.elapsed().as_millis() as u64;

    match result {
        Ok(value) => Ok(Json(ToolExecuteResponse {
            tool_id: req.tool_id,
            result: value,
            success: true,
            execution_time_ms,
        })),
        Err(error) => Ok(Json(ToolExecuteResponse {
            tool_id: req.tool_id,
            result: serde_json::json!({"error": error}),
            success: false,
            execution_time_ms,
        })),
    }
}

/// Stream tool execution progress
pub async fn stream_tool_execution(
    State(_state): State<AgentApiState>,
    Path(session_id): Path<String>,
    Json(req): Json<ToolExecuteRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, (StatusCode, Json<ApiError>)> {
    use async_stream::stream;

    let tool_id = req.tool_id.clone();
    let args = req.arguments.clone();
    let session_id_clone = session_id.clone();

    let s = stream! {
        let start = Instant::now();

        // Send start event
        yield Ok(StreamEvent::ToolCall {
            session_id: session_id_clone.clone(),
            tool_call: ToolCall {
                id: Uuid::new_v4().to_string(),
                name: tool_id.clone(),
                arguments: serde_json::to_value(&args).unwrap_or_default(),
            },
            timestamp: Utc::now().to_rfc3339(),
        }.to_sse_event());

        // Simulate execution time
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        // Execute and get result
        let result = execute_tool_internal(&tool_id, &args).await;
        let execution_time_ms = start.elapsed().as_millis() as u64;

        match result {
            Ok(value) => {
                yield Ok(StreamEvent::ToolResult {
                    session_id: session_id_clone.clone(),
                    tool_result: ToolResult {
                        tool_call_id: tool_id.clone(),
                        result: value,
                        error: None,
                    },
                    timestamp: Utc::now().to_rfc3339(),
                }.to_sse_event());
            }
            Err(error) => {
                yield Ok(StreamEvent::ToolError {
                    session_id: session_id_clone.clone(),
                    tool_call_id: tool_id.clone(),
                    error,
                    timestamp: Utc::now().to_rfc3339(),
                }.to_sse_event());
            }
        }

        // Send done
        yield Ok(StreamEvent::Done {
            session_id: session_id_clone,
            timestamp: Utc::now().to_rfc3339(),
        }.to_sse_event());
    };

    Ok(Sse::new(s))
}

/// Internal tool execution
async fn execute_tool_internal(
    tool_id: &str,
    args: &HashMap<String, Value>,
) -> Result<Value, String> {
    match tool_id {
        "get_weather" => {
            let location = args
                .get("location")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown");
            let units = args
                .get("units")
                .and_then(|v| v.as_str())
                .unwrap_or("celsius");

            let temp = if units == "fahrenheit" { 72 } else { 22 };

            Ok(serde_json::json!({
                "location": location,
                "temperature": temp,
                "units": units,
                "condition": "Sunny",
                "humidity": 45,
                "wind_speed": 10
            }))
        }

        "get_time" => {
            let timezone = args
                .get("timezone")
                .and_then(|v| v.as_str())
                .unwrap_or("UTC");

            Ok(serde_json::json!({
                "time": Utc::now().to_rfc3339(),
                "timezone": timezone,
                "formatted": Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string()
            }))
        }

        "execute_code" => {
            let language = args
                .get("language")
                .and_then(|v| v.as_str())
                .unwrap_or("python");
            let code = args.get("code").and_then(|v| v.as_str()).unwrap_or("");

            // In a real implementation, this would use a sandbox
            Ok(serde_json::json!({
                "language": language,
                "executed": true,
                "output": format!("Executed {} code ({} bytes)", language, code.len()),
                "exit_code": 0
            }))
        }

        "search_web" => {
            let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("");
            let num_results = args
                .get("num_results")
                .and_then(|v| v.as_u64())
                .unwrap_or(5) as usize;

            let results: Vec<Value> = (0..num_results)
                .map(|i| {
                    serde_json::json!({
                        "title": format!("Result {} for '{}'", i + 1, query),
                        "url": format!("https://example.com/result/{}", i),
                        "snippet": format!("This is a mock search result snippet for '{}'...", query)
                    })
                })
                .collect();

            Ok(serde_json::json!({
                "query": query,
                "results": results,
                "total": num_results
            }))
        }

        "create_canvas" => {
            let title = args
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Untitled");
            let canvas_type = args.get("type").and_then(|v| v.as_str()).unwrap_or("text");
            let content = args.get("content").and_then(|v| v.as_str()).unwrap_or("");

            Ok(serde_json::json!({
                "canvas_id": Uuid::new_v4().to_string(),
                "title": title,
                "type": canvas_type,
                "content": content,
                "created": Utc::now().to_rfc3339()
            }))
        }

        "read_file" => {
            let path = args.get("path").and_then(|v| v.as_str()).unwrap_or("");

            Ok(serde_json::json!({
                "path": path,
                "content": format!("// Mock content of file: {}\n// In production, this would read actual file content", path),
                "size": 0,
                "exists": true
            }))
        }

        "write_file" => {
            let path = args.get("path").and_then(|v| v.as_str()).unwrap_or("");
            let content = args.get("content").and_then(|v| v.as_str()).unwrap_or("");

            Ok(serde_json::json!({
                "path": path,
                "bytes_written": content.len(),
                "success": true
            }))
        }

        _ => Err(format!("Unknown tool: {}", tool_id)),
    }
}
