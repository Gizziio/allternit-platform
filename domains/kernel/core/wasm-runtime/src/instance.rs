//! WASM tool instance management.

use crate::error::{WasmRuntimeError, WasmRuntimeResult};
use crate::host::ToolHostState;
use crate::sandbox::SandboxConfig;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, error, info};
use wasmtime::component::Component;
use wasmtime::Store;

// Import the generated bindings
use crate::bindings::allternit::tool_abi::types::{
    ToolError as WasmToolError, ToolInput as WasmToolInput, ValidationResult,
};
use crate::bindings::ToolComponent;

/// A live instance of a WASM tool.
///
/// This represents a compiled and instantiated tool ready for execution.
pub struct WasmToolInstance {
    /// Wasmtime store containing the instance state
    store: Store<ToolHostState>,

    /// Bound interface to the component instance
    bindings: ToolComponent,

    /// Sandbox configuration
    sandbox_config: SandboxConfig,

    /// When this instance was created
    created_at: DateTime<Utc>,
}

impl WasmToolInstance {
    /// Create a new tool instance.
    pub(crate) async fn new(
        mut store: Store<ToolHostState>,
        component: Arc<Component>,
        sandbox_config: &SandboxConfig,
    ) -> WasmRuntimeResult<Self> {
        debug!("Creating new WASM tool instance");

        // Create a linker with host functions
        let mut linker = wasmtime::component::Linker::new(store.engine());

        // Add host functions to the linker
        crate::host_functions::add_host_functions(&mut linker)
            .map_err(|e| WasmRuntimeError::InstantiationError(e.to_string()))?;

        // Instantiate the component with the linker
        if sandbox_config.async_support {
            return Err(WasmRuntimeError::InstantiationError(
                "async support enabled but bindings are sync; disable async_support or regenerate bindings with async enabled".into(),
            ));
        }

        let (bindings, _) =
            ToolComponent::instantiate(&mut store, &component, &linker).map_err(|e| {
                error!("Failed to instantiate component: {:?}", e);
                WasmRuntimeError::InstantiationError(e.to_string())
            })?;

        Ok(Self {
            store,
            bindings,
            sandbox_config: sandbox_config.clone(),
            created_at: Utc::now(),
        })
    }

    /// Execute the tool with the given input.
    ///
    /// This calls the tool's `execute` function as defined in the WIT interface.
    pub async fn execute(&mut self, input: ToolInput) -> WasmRuntimeResult<ToolOutput> {
        let start_time = Utc::now();

        debug!("Executing tool with input: {:?}", input.parameters);

        // Record the execution start
        self.store.data_mut().log_event(
            format!("Tool execution started: {}", input.parameters),
            crate::host::LogLevel::Info,
        );

        // Convert input to WASM types
        let wasm_input = WasmToolInput {
            parameters: input.parameters,
            session_id: input.session_id,
            tenant_id: input.tenant_id,
            trace_id: input.trace_id,
            idempotency_key: input.idempotency_key,
        };

        // Call tool's execute function via WIT bindings
        let result = self
            .bindings
            .allternit_tool_abi_tool()
            .call_execute(&mut self.store, &wasm_input)
            .map_err(|e| {
                error!("Tool execution failed: {:?}", e);
                WasmRuntimeError::ExecutionError(e.to_string())
            })?;

        let wasm_output = result.map_err(|err| {
            let runtime_error = match err {
                WasmToolError::ValidationError(reason) => WasmRuntimeError::InvalidInput(reason),
                WasmToolError::ExecutionError(reason) => WasmRuntimeError::ExecutionError(reason),
                WasmToolError::PolicyDenied(reason) => WasmRuntimeError::CapabilityDenied {
                    capability: "policy".into(),
                    reason,
                },
                WasmToolError::Timeout => WasmRuntimeError::Timeout {
                    timeout_ms: self.sandbox_config.max_execution_time_ms,
                },
            };
            runtime_error
        })?;

        let execution_time_ms = (Utc::now() - start_time).num_milliseconds() as u64;

        let output = ToolOutput {
            result: wasm_output.output,
            execution_time_ms,
            side_effects: wasm_output.side_effects,
        };

        self.store.data().log_event(
            format!("Tool execution completed in {}ms", output.execution_time_ms),
            crate::host::LogLevel::Info,
        );

        Ok(output)
    }

    /// Validate input without executing.
    pub async fn validate(&mut self, parameters: &str) -> WasmRuntimeResult<()> {
        debug!("Validating tool input");

        // Call validate function via WIT bindings
        let result = self
            .bindings
            .allternit_tool_abi_tool()
            .call_validate(&mut self.store, parameters)
            .map_err(|e| {
                error!("Validation call failed: {:?}", e);
                WasmRuntimeError::InvalidInput(e.to_string())
            })?;

        match result {
            ValidationResult::Valid => {
                info!("Input validation passed");
                Ok(())
            }
            ValidationResult::Invalid(reason) => {
                error!("Input validation failed: {}", reason);
                Err(WasmRuntimeError::InvalidInput(reason))
            }
        }
    }

    /// Get tool description/metadata.
    pub async fn describe(&mut self) -> WasmRuntimeResult<String> {
        debug!("Getting tool description");

        // Call describe function via WIT bindings
        let metadata = self
            .bindings
            .allternit_tool_abi_tool()
            .call_describe(&mut self.store)
            .map_err(|e| {
                error!("Describe call failed: {:?}", e);
                WasmRuntimeError::ExecutionError(e.to_string())
            })?;

        info!("Got tool metadata: {}", metadata.name);
        Ok(serde_json::json!({
            "name": metadata.name,
            "description": metadata.description,
            "version": metadata.version,
            "input_schema": metadata.input_schema,
            "output_schema": metadata.output_schema,
            "required_capabilities": metadata.required_capabilities,
            "safety_tier": metadata.safety_tier,
            "idempotent": metadata.idempotent
        })
        .to_string())
    }

    /// Get the host state for inspection.
    pub fn host_state(&self) -> &ToolHostState {
        self.store.data()
    }

    /// Get remaining fuel (if fuel metering is enabled).
    pub fn remaining_fuel(&self) -> Option<u64> {
        self.store.get_fuel().ok()
    }

    /// Get when this instance was created.
    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    /// Check if instance has exceeded max execution time.
    pub fn is_expired(&self) -> bool {
        let elapsed = (Utc::now() - self.created_at).num_milliseconds() as u64;
        elapsed > self.sandbox_config.max_execution_time_ms
    }
}

/// Input for tool execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInput {
    /// JSON-encoded parameters
    pub parameters: String,

    /// Session ID for context
    pub session_id: String,

    /// Tenant ID
    pub tenant_id: String,

    /// Optional trace ID for distributed tracing
    pub trace_id: Option<String>,

    /// Optional idempotency key for safe retries
    pub idempotency_key: Option<String>,
}

impl ToolInput {
    /// Create new tool input.
    pub fn new(
        parameters: impl Into<String>,
        session_id: impl Into<String>,
        tenant_id: impl Into<String>,
    ) -> Self {
        Self {
            parameters: parameters.into(),
            session_id: session_id.into(),
            tenant_id: tenant_id.into(),
            trace_id: None,
            idempotency_key: None,
        }
    }

    /// Builder: set trace ID.
    pub fn with_trace_id(mut self, trace_id: impl Into<String>) -> Self {
        self.trace_id = Some(trace_id.into());
        self
    }

    /// Builder: set idempotency key.
    pub fn with_idempotency_key(mut self, key: impl Into<String>) -> Self {
        self.idempotency_key = Some(key.into());
        self
    }
}

/// Output from tool execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolOutput {
    /// JSON-encoded result
    pub result: String,

    /// Execution time in milliseconds
    pub execution_time_ms: u64,

    /// Side effects that occurred during execution
    pub side_effects: Vec<String>,
}

impl ToolOutput {
    /// Parse the result as a specific type.
    pub fn parse_result<T: serde::de::DeserializeOwned>(&self) -> Result<T, serde_json::Error> {
        serde_json::from_str(&self.result)
    }
}

/// Error variants from tool execution (matches WIT interface).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "message")]
pub enum ToolError {
    ValidationError(String),
    ExecutionError(String),
    PolicyDenied(String),
    Timeout,
}

impl std::fmt::Display for ToolError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ToolError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            ToolError::ExecutionError(msg) => write!(f, "Execution error: {}", msg),
            ToolError::PolicyDenied(msg) => write!(f, "Policy denied: {}", msg),
            ToolError::Timeout => write!(f, "Execution timeout"),
        }
    }
}

impl std::error::Error for ToolError {}
