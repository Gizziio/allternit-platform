use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::Json;

// Re-export the main types for use by other services
pub use function_types::*;

pub mod function_types {
    use serde::{Deserialize, Serialize};

    #[derive(Deserialize, Serialize, Clone, Debug)]
    pub struct FunctionDefinition {
        pub id: String,
        pub name: String,
        pub description: String,
        pub version: String,
        pub platform_support: PlatformSupport,
        pub risk_level: String, // "low", "medium", "high", "critical"
        pub requires_confirmation: bool,
        pub parameters: serde_json::Value,
        pub examples: Vec<FunctionExample>,
        pub execution_context: String, // "local", "remote", "hybrid"
        pub capabilities_required: Vec<String>,
        pub timeout_ms: u64,
        pub category: String,
    }

    #[derive(Deserialize, Serialize, Clone, Debug)]
    pub struct PlatformSupport {
        pub ios: bool,
        pub android: bool,
        pub web: bool,
        pub desktop: bool,
        pub backend: bool,
    }

    #[derive(Deserialize, Serialize, Clone, Debug)]
    pub struct FunctionExample {
        pub description: String,
        pub input: serde_json::Value,
    }
}

#[derive(Debug, Clone)]
pub struct FunctionRegistryState {
    pub function_store: Arc<RwLock<HashMap<String, FunctionDefinition>>>,
}

impl FunctionRegistryState {
    pub fn new() -> Self {
        Self {
            function_store: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn add_function(&self, function: FunctionDefinition) -> Result<(), String> {
        let mut functions = self.function_store.write().map_err(|e| e.to_string())?;
        functions.insert(function.id.clone(), function);
        Ok(())
    }

    pub fn get_function(&self, function_id: &str) -> Option<FunctionDefinition> {
        let functions = self.function_store.read().unwrap();
        functions.get(function_id).cloned()
    }

    pub fn list_functions(&self) -> Vec<FunctionDefinition> {
        let functions = self.function_store.read().unwrap();
        functions.values().cloned().collect()
    }

    pub fn search_functions(&self, category: Option<&str>, platform: Option<&str>, risk_level: Option<&str>, search: Option<&str>) -> Vec<FunctionDefinition> {
        let functions = self.function_store.read().unwrap();

        functions
            .values()
            .filter(|func| {
                // Apply filters
                if let Some(category) = category {
                    if func.category != *category {
                        return false;
                    }
                }

                if let Some(platform) = platform {
                    match platform {
                        "ios" => if !func.platform_support.ios { return false; },
                        "android" => if !func.platform_support.android { return false; },
                        "web" => if !func.platform_support.web { return false; },
                        "desktop" => if !func.platform_support.desktop { return false; },
                        "backend" => if !func.platform_support.backend { return false; },
                        _ => {} // Unknown platform, no filter
                    }
                }

                if let Some(risk_level) = risk_level {
                    if func.risk_level != *risk_level {
                        return false;
                    }
                }

                if let Some(search) = search {
                    if !func.name.to_lowercase().contains(&search.to_lowercase()) &&
                       !func.description.to_lowercase().contains(&search.to_lowercase()) &&
                       !func.id.to_lowercase().contains(&search.to_lowercase()) {
                        return false;
                    }
                }

                true
            })
            .cloned()
            .collect()
    }
}

#[derive(Deserialize)]
pub struct RegisterFunctionRequest {
    pub function: FunctionDefinition,
}

#[derive(Deserialize)]
pub struct QueryFunctionsRequest {
    pub category: Option<String>,
    pub platform: Option<String>,
    pub risk_level: Option<String>,
    pub search: Option<String>,
}

#[derive(Serialize)]
pub struct RegisterFunctionResponse {
    pub success: bool,
    pub function_id: String,
}

// Handler functions that can be used by the service
pub async fn handle_register_function(
    State(state): State<Arc<FunctionRegistryState>>,
    request: Json<RegisterFunctionRequest>,
) -> Result<Json<RegisterFunctionResponse>, StatusCode> {
    let mut functions = state.function_store.write().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    functions.insert(request.function.id.clone(), request.function.clone());

    Ok(Json(RegisterFunctionResponse {
        success: true,
        function_id: request.function.id.clone(),
    }))
}

pub async fn handle_list_functions(
    State(state): State<Arc<FunctionRegistryState>>,
) -> Result<Json<Vec<FunctionDefinition>>, StatusCode> {
    let functions = state.function_store.read().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(functions.values().cloned().collect()))
}

pub async fn handle_search_functions(
    State(state): State<Arc<FunctionRegistryState>>,
    request: Json<QueryFunctionsRequest>,
) -> Result<Json<Vec<FunctionDefinition>>, StatusCode> {
    let functions = state.function_store.read().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let filtered_functions: Vec<FunctionDefinition> = functions
        .values()
        .filter(|func| {
            // Apply filters
            if let Some(ref category) = request.category {
                if func.category != *category {
                    return false;
                }
            }

            if let Some(ref platform) = request.platform {
                match platform.as_str() {
                    "ios" => if !func.platform_support.ios { return false; },
                    "android" => if !func.platform_support.android { return false; },
                    "web" => if !func.platform_support.web { return false; },
                    "desktop" => if !func.platform_support.desktop { return false; },
                    "backend" => if !func.platform_support.backend { return false; },
                    _ => {} // Unknown platform, no filter
                }
            }

            if let Some(ref risk_level) = request.risk_level {
                if func.risk_level != *risk_level {
                    return false;
                }
            }

            if let Some(ref search) = request.search {
                if !func.name.to_lowercase().contains(&search.to_lowercase()) &&
                   !func.description.to_lowercase().contains(&search.to_lowercase()) &&
                   !func.id.to_lowercase().contains(&search.to_lowercase()) {
                    return false;
                }
            }

            true
        })
        .cloned()
        .collect();

    Ok(Json(filtered_functions))
}

pub async fn handle_get_function(
    State(state): State<Arc<FunctionRegistryState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<FunctionDefinition>, StatusCode> {
    let functions = state.function_store.read().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let function = functions.get(&id).ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(function.clone()))
}