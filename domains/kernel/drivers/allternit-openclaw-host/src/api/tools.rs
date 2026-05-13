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

/// Maps tool_id to its showcase UI kind string, or None if it's a regular tool.
fn get_showcase_kind(tool_id: &str) -> Option<&'static str> {
    match tool_id {
        "generate_email_draft" => Some("email-draft"),
        "generate_sms_draft" => Some("sms-draft"),
        "generate_recipe" => Some("recipe"),
        "generate_image_search" => Some("image-search"),
        "generate_app_recommendations" => Some("app-recommendations"),
        "generate_model_comparison" => Some("model-comparison"),
        "generate_mock_chat" => Some("mock-chat"),
        "generate_levee_wizard" => Some("levee-wizard"),
        "generate_map" => Some("map"),
        "generate_image" => Some("image"),
        _ => None,
    }
}

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
pub(crate) fn get_builtin_tools() -> Vec<ToolDefinitionResponse> {
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
        ToolDefinitionResponse {
            id: "generate_email_draft".to_string(),
            name: "generate_email_draft".to_string(),
            description: "Draft a professional email".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "to": { "type": "string", "description": "Recipient email address" },
                    "from": { "type": "string", "description": "Sender email address" },
                    "subject": { "type": "string", "description": "Email subject" },
                    "context": { "type": "string", "description": "Context or intent for the email body" }
                },
                "required": ["to", "subject", "context"]
            }),
            category: "showcase".to_string(),
        },
        ToolDefinitionResponse {
            id: "generate_sms_draft".to_string(),
            name: "generate_sms_draft".to_string(),
            description: "Draft an SMS conversation thread".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "to": { "type": "string", "description": "Recipient name or number" },
                    "context": { "type": "string", "description": "Context or topic for the messages" }
                },
                "required": ["to", "context"]
            }),
            category: "showcase".to_string(),
        },
        ToolDefinitionResponse {
            id: "generate_recipe".to_string(),
            name: "generate_recipe".to_string(),
            description: "Generate a recipe with ingredients and steps".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "Recipe name" },
                    "servings": { "type": "integer", "description": "Number of servings", "default": 4 },
                    "dietary": { "type": "string", "description": "Dietary restrictions (vegan, gluten-free, etc.)" }
                },
                "required": ["name"]
            }),
            category: "showcase".to_string(),
        },
        ToolDefinitionResponse {
            id: "generate_image_search".to_string(),
            name: "generate_image_search".to_string(),
            description: "Search and return image results for a query".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Image search query" },
                    "count": { "type": "integer", "description": "Number of images to return", "default": 6 }
                },
                "required": ["query"]
            }),
            category: "showcase".to_string(),
        },
        ToolDefinitionResponse {
            id: "generate_app_recommendations".to_string(),
            name: "generate_app_recommendations".to_string(),
            description: "Recommend apps for a given category or use case".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "category": { "type": "string", "description": "App category (productivity, health, finance, etc.)" },
                    "use_case": { "type": "string", "description": "Specific use case description" },
                    "platform": { "type": "string", "enum": ["ios", "android", "both"], "default": "both" }
                },
                "required": ["category"]
            }),
            category: "showcase".to_string(),
        },
        ToolDefinitionResponse {
            id: "generate_model_comparison".to_string(),
            name: "generate_model_comparison".to_string(),
            description: "Compare AI models across features and capabilities".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "models": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "List of model names to compare"
                    },
                    "features": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Features to compare across"
                    }
                },
                "required": ["models"]
            }),
            category: "showcase".to_string(),
        },
        ToolDefinitionResponse {
            id: "generate_mock_chat".to_string(),
            name: "generate_mock_chat".to_string(),
            description: "Generate a mock chat conversation for demonstration".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "style": { "type": "string", "enum": ["imessage", "whatsapp", "slack", "generic"], "default": "imessage" },
                    "topic": { "type": "string", "description": "Conversation topic or scenario" },
                    "participants": { "type": "integer", "description": "Number of participants", "default": 2 }
                },
                "required": ["topic"]
            }),
            category: "showcase".to_string(),
        },
        ToolDefinitionResponse {
            id: "generate_levee_wizard".to_string(),
            name: "generate_levee_wizard".to_string(),
            description: "Generate a step-by-step wizard or onboarding flow".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "Wizard title" },
                    "topic": { "type": "string", "description": "What the wizard guides the user through" },
                    "steps": { "type": "integer", "description": "Number of steps", "default": 4 }
                },
                "required": ["topic"]
            }),
            category: "showcase".to_string(),
        },
        ToolDefinitionResponse {
            id: "generate_map".to_string(),
            name: "generate_map".to_string(),
            description: "Render an interactive map centered on a location with optional markers".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "Map title" },
                    "lat": { "type": "number", "description": "Center latitude" },
                    "lng": { "type": "number", "description": "Center longitude" },
                    "zoom": { "type": "integer", "description": "Zoom level 1-19", "default": 13 },
                    "location": { "type": "string", "description": "Location name for the center marker label" },
                    "markers": {
                        "type": "array",
                        "description": "Additional markers to place",
                        "items": {
                            "type": "object",
                            "properties": {
                                "lat": { "type": "number" },
                                "lng": { "type": "number" },
                                "label": { "type": "string" },
                                "popup": { "type": "string" }
                            },
                            "required": ["lat", "lng"]
                        }
                    }
                },
                "required": ["lat", "lng"]
            }),
            category: "showcase".to_string(),
        },
        ToolDefinitionResponse {
            id: "generate_image".to_string(),
            name: "generate_image".to_string(),
            description: "Generate an image from a text prompt".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "prompt": { "type": "string", "description": "Image generation prompt" },
                    "style": {
                        "type": "string",
                        "enum": ["photorealistic", "illustration", "painting", "sketch", "3d-render"],
                        "default": "photorealistic"
                    },
                    "seed": { "type": "integer", "description": "Random seed for reproducibility" }
                },
                "required": ["prompt"]
            }),
            category: "showcase".to_string(),
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
                // Showcase tools emit a typed Ui event so the frontend renders a rich component.
                if let Some(kind) = get_showcase_kind(&tool_id) {
                    yield Ok(StreamEvent::Ui {
                        session_id: session_id_clone.clone(),
                        kind: kind.to_string(),
                        payload: value.clone(),
                        timestamp: Utc::now().to_rfc3339(),
                    }.to_sse_event());
                }

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
pub(crate) async fn execute_tool_internal(
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

        "generate_email_draft" => {
            let to = args.get("to").and_then(|v| v.as_str()).unwrap_or("recipient@example.com");
            let from = args.get("from").and_then(|v| v.as_str());
            let subject = args.get("subject").and_then(|v| v.as_str()).unwrap_or("Hello");
            let context = args.get("context").and_then(|v| v.as_str()).unwrap_or("");

            let body = format!(
                "Hi,\n\nI'm writing regarding: {}.\n\nPlease let me know if you have any questions or need additional information.\n\nBest regards",
                context
            );

            let mut result = serde_json::json!({
                "to": to,
                "subject": subject,
                "body": body,
            });
            if let Some(f) = from {
                result["from"] = serde_json::Value::String(f.to_string());
            }
            Ok(result)
        }

        "generate_sms_draft" => {
            let to = args.get("to").and_then(|v| v.as_str()).unwrap_or("Friend");
            let context = args.get("context").and_then(|v| v.as_str()).unwrap_or("hello");

            Ok(serde_json::json!({
                "to": to,
                "messages": [
                    { "role": "user", "text": format!("Hey! {}", context) },
                    { "role": "other", "text": "That sounds great! When works for you?" },
                    { "role": "user", "text": "How about tomorrow afternoon?" },
                    { "role": "other", "text": "Perfect, see you then!" }
                ]
            }))
        }

        "generate_recipe" => {
            let name = args.get("name").and_then(|v| v.as_str()).unwrap_or("Pasta");
            let servings = args.get("servings").and_then(|v| v.as_u64()).unwrap_or(4) as u32;
            let dietary = args.get("dietary").and_then(|v| v.as_str()).unwrap_or("");

            let description = if dietary.is_empty() {
                format!("A delicious {} recipe", name)
            } else {
                format!("A {} {} recipe", dietary, name)
            };

            Ok(serde_json::json!({
                "name": name,
                "description": description,
                "servings": servings,
                "prepTimeMinutes": 15,
                "cookTimeMinutes": 25,
                "ingredients": [
                    { "amount": "2 cups", "name": "main ingredient", "optional": false },
                    { "amount": "1 tbsp", "name": "olive oil", "optional": false },
                    { "amount": "2 cloves", "name": "garlic, minced", "optional": false },
                    { "amount": "1 tsp", "name": "salt", "optional": false },
                    { "amount": "1/2 tsp", "name": "black pepper", "optional": false },
                    { "amount": "fresh herbs", "name": "to taste", "optional": true }
                ],
                "steps": [
                    "Prepare all ingredients and bring to room temperature.",
                    "Heat olive oil in a large pan over medium heat.",
                    "Add garlic and cook until fragrant, about 1 minute.",
                    "Add main ingredient and season with salt and pepper.",
                    "Cook for 20–25 minutes until done, stirring occasionally.",
                    "Garnish with fresh herbs and serve immediately."
                ]
            }))
        }

        "generate_image_search" => {
            let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("nature");
            let count = args.get("count").and_then(|v| v.as_u64()).unwrap_or(6) as usize;

            let results: Vec<Value> = (0..count)
                .map(|i| {
                    serde_json::json!({
                        "id": format!("img-{}", i),
                        "title": format!("{} photo {}", query, i + 1),
                        "url": format!("https://picsum.photos/seed/{}{}/800/600", query.replace(' ', ""), i),
                        "thumbnail": format!("https://picsum.photos/seed/{}{}/400/300", query.replace(' ', ""), i),
                        "width": 800,
                        "height": 600,
                    })
                })
                .collect();

            Ok(serde_json::json!({
                "query": query,
                "results": results,
            }))
        }

        "generate_app_recommendations" => {
            let category = args.get("category").and_then(|v| v.as_str()).unwrap_or("productivity");
            let platform = args.get("platform").and_then(|v| v.as_str()).unwrap_or("both");

            Ok(serde_json::json!({
                "title": format!("Top {} Apps", category),
                "apps": [
                    {
                        "name": format!("{} Pro", category),
                        "description": format!("The leading {} app with powerful features", category),
                        "rating": 4.8,
                        "reviews": 12500,
                        "platform": platform,
                        "category": category,
                        "iconColor": "#6366f1",
                        "price": "Free"
                    },
                    {
                        "name": format!("{}Hub", category),
                        "description": format!("All-in-one {} solution for teams and individuals", category),
                        "rating": 4.6,
                        "reviews": 8900,
                        "platform": platform,
                        "category": category,
                        "iconColor": "#0ea5e9",
                        "price": "$4.99/mo"
                    },
                    {
                        "name": format!("Smart{}", category),
                        "description": format!("AI-powered {} assistant", category),
                        "rating": 4.5,
                        "reviews": 5200,
                        "platform": platform,
                        "category": category,
                        "iconColor": "#10b981",
                        "price": "Free"
                    }
                ]
            }))
        }

        "generate_model_comparison" => {
            let models = args
                .get("models")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
                .unwrap_or_else(|| vec!["Claude 3.5 Sonnet", "GPT-4o", "Gemini 1.5 Pro"]);

            let features = args
                .get("features")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
                .unwrap_or_else(|| vec!["Context window", "Reasoning", "Speed", "Cost", "Vision"]);

            let ratings: Vec<Value> = models
                .iter()
                .enumerate()
                .map(|(i, name)| {
                    let scores: Vec<Value> = features
                        .iter()
                        .map(|_| serde_json::json!(((90 - i * 5) as f64) / 10.0))
                        .collect();
                    serde_json::json!({
                        "model": name,
                        "scores": scores,
                    })
                })
                .collect();

            Ok(serde_json::json!({
                "title": "Model Comparison",
                "models": models,
                "features": features,
                "ratings": ratings,
                "variant": "table",
            }))
        }

        "generate_mock_chat" => {
            let style = args.get("style").and_then(|v| v.as_str()).unwrap_or("imessage");
            let topic = args.get("topic").and_then(|v| v.as_str()).unwrap_or("catching up");

            Ok(serde_json::json!({
                "style": style,
                "messages": [
                    { "role": "other", "text": format!("Hey! Have you thought about {}?", topic) },
                    { "role": "user", "text": "Yeah, I've been thinking about it a lot actually." },
                    { "role": "other", "text": "What do you think we should do?" },
                    { "role": "user", "text": "I think we should go for it. What's the worst that could happen?" },
                    { "role": "other", "text": "You're right. Let's do it! 🎉" }
                ]
            }))
        }

        "generate_levee_wizard" => {
            let title = args.get("title").and_then(|v| v.as_str());
            let topic = args.get("topic").and_then(|v| v.as_str()).unwrap_or("getting started");
            let step_count = args.get("steps").and_then(|v| v.as_u64()).unwrap_or(4) as usize;

            let wizard_title = title.unwrap_or(topic).to_string();

            let steps: Vec<Value> = (0..step_count)
                .map(|i| {
                    serde_json::json!({
                        "id": format!("step-{}", i + 1),
                        "title": format!("Step {}: {}", i + 1, match i {
                            0 => "Getting started",
                            1 => "Configuration",
                            2 => "Customization",
                            _ => "Complete setup",
                        }),
                        "description": format!("Complete step {} of {}", i + 1, step_count),
                        "completed": false,
                    })
                })
                .collect();

            Ok(serde_json::json!({
                "title": wizard_title,
                "subtitle": format!("Follow these steps to complete your {} setup", topic),
                "steps": steps,
            }))
        }

        "generate_map" => {
            let title = args.get("title").and_then(|v| v.as_str()).unwrap_or("Map");
            let lat = args.get("lat").and_then(|v| v.as_f64()).unwrap_or(51.505);
            let lng = args.get("lng").and_then(|v| v.as_f64()).unwrap_or(-0.09);
            let zoom = args.get("zoom").and_then(|v| v.as_u64()).unwrap_or(13);
            let location = args.get("location").and_then(|v| v.as_str()).unwrap_or("");

            // Build markers from locations array if provided
            let markers = if let Some(locs) = args.get("markers").and_then(|v| v.as_array()) {
                locs.clone()
            } else if !location.is_empty() {
                vec![serde_json::json!({ "lat": lat, "lng": lng, "label": location })]
            } else {
                vec![]
            };

            Ok(serde_json::json!({
                "title": title,
                "lat": lat,
                "lng": lng,
                "zoom": zoom,
                "markers": markers,
            }))
        }

        "generate_image" => {
            let prompt = args.get("prompt").and_then(|v| v.as_str()).unwrap_or("abstract art");
            let style = args.get("style").and_then(|v| v.as_str()).unwrap_or("photorealistic");
            let seed = args.get("seed").and_then(|v| v.as_u64()).unwrap_or(42);

            // Use Picsum for placeholder images seeded by prompt hash
            let seed_val = prompt.bytes().fold(seed, |acc, b| acc.wrapping_add(b as u64));
            let url = format!("https://picsum.photos/seed/{}/1024/768", seed_val);

            Ok(serde_json::json!({
                "url": url,
                "prompt": prompt,
                "style": style,
                "width": 1024,
                "height": 768,
                "alt": prompt,
            }))
        }

        _ => Err(format!("Unknown tool: {}", tool_id)),
    }
}
