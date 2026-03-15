//! WASM runtime engine using Wasmtime.

use crate::capabilities::CapabilityGrant;
use crate::error::{WasmRuntimeError, WasmRuntimeResult};
use crate::host::{ExecutionContext, ToolHostState};
use crate::instance::WasmToolInstance;
use crate::manifest::CapsuleManifest;
use crate::sandbox::SandboxConfig;

use a2rchitech_history::HistoryLedger;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};
use tracing::{debug, info, warn};
use wasmtime::{component::Component, Config, Engine, Store};

/// Configuration for the WASM runtime.
#[derive(Debug, Clone)]
pub struct WasmRuntimeConfig {
    /// Sandbox configuration
    pub sandbox: SandboxConfig,

    /// Enable component caching
    pub enable_cache: bool,

    /// Maximum cached components
    pub max_cached_components: usize,

    /// Enable debug info in compiled modules
    pub debug_info: bool,

    /// Enable cranelift optimizations
    pub cranelift_optimizations: bool,

    /// Persistent history log path
    pub history_path: PathBuf,
}

impl Default for WasmRuntimeConfig {
    fn default() -> Self {
        Self {
            sandbox: SandboxConfig::default(),
            enable_cache: true,
            max_cached_components: 100,
            debug_info: false,
            cranelift_optimizations: true,
            history_path: PathBuf::from(".a2r/wasm-runtime-history.jsonl"),
        }
    }
}

/// The main WASM runtime for A2rchitech.
///
/// This runtime manages:
/// - Wasmtime engine and configuration
/// - Component compilation and caching
/// - Tool instantiation with capability grants
pub struct WasmRuntime {
    /// Wasmtime engine
    engine: Engine,

    /// Runtime configuration
    config: WasmRuntimeConfig,

    /// Compiled component cache
    component_cache: Arc<RwLock<HashMap<String, Arc<Component>>>>,

    /// History ledger for auditing host actions
    history_ledger: Arc<Mutex<HistoryLedger>>,
}

impl WasmRuntime {
    /// Create a new WASM runtime with the given configuration.
    pub fn new(config: WasmRuntimeConfig) -> WasmRuntimeResult<Self> {
        let mut wasmtime_config = Config::new();

        // Enable component model
        wasmtime_config.wasm_component_model(config.sandbox.component_model);

        // Enable async support
        wasmtime_config.async_support(config.sandbox.async_support);

        // Configure fuel for execution limiting
        if config.sandbox.max_fuel.is_some() {
            wasmtime_config.consume_fuel(true);
        }

        // Configure memory limits
        // Note: Memory limits are applied per-instance, not globally

        // Enable threading if allowed
        wasmtime_config.wasm_threads(config.sandbox.allow_threads);

        // Debug info
        wasmtime_config.debug_info(config.debug_info);

        // Cranelift optimizations
        if config.cranelift_optimizations {
            wasmtime_config.cranelift_opt_level(wasmtime::OptLevel::Speed);
        }

        let engine = Engine::new(&wasmtime_config)?;

        if let Some(parent) = config.history_path.parent() {
            fs::create_dir_all(parent).map_err(|e| WasmRuntimeError::Internal(e.to_string()))?;
        }
        let history_ledger = Arc::new(Mutex::new(
            HistoryLedger::new(&config.history_path)
                .map_err(|e| WasmRuntimeError::Internal(e.to_string()))?,
        ));

        info!("WASM runtime initialized with component model support");

        Ok(Self {
            engine,
            config,
            component_cache: Arc::new(RwLock::new(HashMap::new())),
            history_ledger,
        })
    }

    /// Get reference to the underlying Wasmtime engine.
    pub fn engine(&self) -> &Engine {
        &self.engine
    }

    /// Compile a WASM component from bytes.
    ///
    /// This handles both core WASM modules and component model components.
    pub fn compile_component(&self, wasm_bytes: &[u8]) -> WasmRuntimeResult<Component> {
        debug!("Compiling WASM component ({} bytes)", wasm_bytes.len());

        let component = Component::from_binary(&self.engine, wasm_bytes).map_err(|e| {
            WasmRuntimeError::CompilationError(format!("Failed to compile component: {}", e))
        })?;

        debug!("WASM component compiled successfully");
        Ok(component)
    }

    /// Compile and cache a component by ID.
    pub fn compile_and_cache(
        &self,
        component_id: &str,
        wasm_bytes: &[u8],
    ) -> WasmRuntimeResult<Arc<Component>> {
        // Check cache first
        if let Some(cached) = self.get_cached_component(component_id) {
            debug!("Using cached component: {}", component_id);
            return Ok(cached);
        }

        // Compile
        let component = self.compile_component(wasm_bytes)?;
        let component = Arc::new(component);

        // Cache if enabled
        if self.config.enable_cache {
            self.cache_component(component_id, component.clone());
        }

        Ok(component)
    }

    /// Get a cached component by ID.
    pub fn get_cached_component(&self, component_id: &str) -> Option<Arc<Component>> {
        self.component_cache
            .read()
            .ok()
            .and_then(|cache| cache.get(component_id).cloned())
    }

    /// Cache a compiled component.
    fn cache_component(&self, component_id: &str, component: Arc<Component>) {
        if let Ok(mut cache) = self.component_cache.write() {
            // Evict if at capacity (simple LRU would be better but this is fine for now)
            if cache.len() >= self.config.max_cached_components {
                // Remove first key (arbitrary eviction)
                if let Some(key) = cache.keys().next().cloned() {
                    cache.remove(&key);
                    warn!("Evicted component from cache: {}", key);
                }
            }

            cache.insert(component_id.to_string(), component);
            debug!("Cached component: {}", component_id);
        }
    }

    /// Clear the component cache.
    pub fn clear_cache(&self) {
        if let Ok(mut cache) = self.component_cache.write() {
            cache.clear();
            info!("Component cache cleared");
        }
    }

    /// Instantiate a tool from a compiled component using a manifest.
    ///
    /// This creates a new isolated instance with capabilities granted according to the manifest.
    pub async fn instantiate_tool_from_manifest(
        &self,
        component: Arc<Component>,
        manifest: &CapsuleManifest,
        capsule_id: String,
        tenant_id: String,
        context: ExecutionContext,
    ) -> WasmRuntimeResult<WasmToolInstance> {
        debug!(
            "Instantiating tool from manifest for capsule: {}",
            capsule_id
        );

        // Validate the manifest
        manifest
            .validate()
            .map_err(|e| WasmRuntimeError::ManifestError(format!("Invalid manifest: {}", e)))?;

        // Create capability grant from manifest
        let grant = manifest.to_capability_grant(capsule_id, tenant_id);

        // Create host state with capabilities
        let host_state = ToolHostState::new(grant, context, self.history_ledger.clone());

        // Create store with fuel limit
        let mut store = Store::new(&self.engine, host_state);

        // Set fuel limit if configured
        if let Some(fuel) = self.config.sandbox.max_fuel {
            store.set_fuel(fuel).map_err(|e| {
                WasmRuntimeError::Internal(format!("Failed to set fuel limit: {}", e))
            })?;
        }

        // Create instance
        let instance = WasmToolInstance::new(store, component, &self.config.sandbox).await?;

        debug!("Tool instance created successfully from manifest");
        Ok(instance)
    }

    /// Instantiate a tool from a compiled component.
    ///
    /// This creates a new isolated instance with the given capability grant.
    pub async fn instantiate_tool(
        &self,
        component: Arc<Component>,
        grant: CapabilityGrant,
        context: ExecutionContext,
    ) -> WasmRuntimeResult<WasmToolInstance> {
        debug!("Instantiating tool for capsule: {}", grant.capsule_id);

        // Create host state with capabilities
        let host_state = ToolHostState::new(grant, context, self.history_ledger.clone());

        // Create store with fuel limit
        let mut store = Store::new(&self.engine, host_state);

        // Set fuel limit if configured
        if let Some(fuel) = self.config.sandbox.max_fuel {
            store.set_fuel(fuel).map_err(|e| {
                WasmRuntimeError::Internal(format!("Failed to set fuel limit: {}", e))
            })?;
        }

        // Create instance
        let instance = WasmToolInstance::new(store, component, &self.config.sandbox).await?;

        debug!("Tool instance created successfully");
        Ok(instance)
    }

    /// Get current cache size.
    pub fn cache_size(&self) -> usize {
        self.component_cache.read().map(|c| c.len()).unwrap_or(0)
    }
}

impl std::fmt::Debug for WasmRuntime {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("WasmRuntime")
            .field("config", &self.config)
            .field("cache_size", &self.cache_size())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_runtime_creation() {
        let runtime = WasmRuntime::new(WasmRuntimeConfig::default());
        assert!(runtime.is_ok());
    }

    #[test]
    fn test_runtime_with_minimal_sandbox() {
        let config = WasmRuntimeConfig {
            sandbox: SandboxConfig::minimal(),
            ..Default::default()
        };
        let runtime = WasmRuntime::new(config);
        assert!(runtime.is_ok());
    }
}
