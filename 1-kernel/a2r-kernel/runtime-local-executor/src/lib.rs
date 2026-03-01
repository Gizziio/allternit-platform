use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use wasmtime::{Engine, Instance, Linker, Module, Store, TypedFunc};

#[derive(Debug, Serialize, Deserialize)]
pub struct FunctionCall {
    pub function_name: String,
    pub arguments: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FunctionResult {
    pub result: serde_json::Value,
    pub success: bool,
    pub error: Option<String>,
}

pub struct LocalRuntime {
    engine: Engine,
    store: RwLock<Store<RuntimeData>>,
    functions: RwLock<HashMap<String, TypedFunc<String, String>>>,
}

#[derive(Clone)]
pub struct RuntimeData {
    pub config: serde_json::Value,
    pub context: serde_json::Value,
}

impl RuntimeData {
    pub fn new(config: serde_json::Value, context: serde_json::Value) -> Self {
        Self { config, context }
    }
}

impl LocalRuntime {
    pub fn new(config: serde_json::Value) -> Result<Self> {
        let engine = Engine::default();
        let data = RuntimeData::new(config, serde_json::Value::Null);
        let store = Store::new(&engine, data);

        Ok(Self {
            engine,
            store: RwLock::new(store),
            functions: RwLock::new(HashMap::new()),
        })
    }

    pub async fn load_wasm(&self, wasm_bytes: &[u8]) -> Result<()> {
        let module = Module::from_binary(&self.engine, wasm_bytes)?;
        let mut store = self.store.write().await;
        let mut linker = Linker::new(&self.engine);

        let instance = linker.instantiate(&mut *store, &module)?;

        // Extract and store functions from the instance
        // This is a simplified approach - in practice you'd need to enumerate exports
        drop(instance); // For now, just instantiate to validate

        Ok(())
    }

    pub async fn call_function(&self, call: FunctionCall) -> Result<FunctionResult> {
        let args_json = serde_json::to_string(&call.arguments)?;

        // In a real implementation, we would look up the function and call it
        // For now, returning a mock result
        Ok(FunctionResult {
            result: serde_json::Value::String(format!(
                "Executed {} with args: {}",
                call.function_name, args_json
            )),
            success: true,
            error: None,
        })
    }

    pub async fn register_function(
        &self,
        name: String,
        func: TypedFunc<String, String>,
    ) -> Result<()> {
        let mut functions = self.functions.write().await;
        functions.insert(name, func);
        Ok(())
    }
}

#[async_trait]
pub trait Runtime {
    async fn execute(&self, call: FunctionCall) -> Result<FunctionResult>;
    async fn load_module(&self, module_data: &[u8]) -> Result<()>;
}

#[async_trait]
impl Runtime for LocalRuntime {
    async fn execute(&self, call: FunctionCall) -> Result<FunctionResult> {
        self.call_function(call).await
    }

    async fn load_module(&self, module_data: &[u8]) -> Result<()> {
        self.load_wasm(module_data).await
    }
}

pub struct LocalRuntimeManager {
    runtimes: RwLock<HashMap<String, Arc<LocalRuntime>>>,
}

impl LocalRuntimeManager {
    pub fn new() -> Self {
        Self {
            runtimes: RwLock::new(HashMap::new()),
        }
    }

    pub async fn create_runtime(&self, id: String, config: serde_json::Value) -> Result<()> {
        let runtime = Arc::new(LocalRuntime::new(config)?);
        let mut runtimes = self.runtimes.write().await;
        runtimes.insert(id, runtime);
        Ok(())
    }

    pub async fn get_runtime(&self, id: &str) -> Option<Arc<LocalRuntime>> {
        let runtimes = self.runtimes.read().await;
        runtimes.get(id).cloned()
    }

    pub async fn execute_function(
        &self,
        runtime_id: &str,
        call: FunctionCall,
    ) -> Result<FunctionResult> {
        if let Some(runtime) = self.get_runtime(runtime_id).await {
            runtime.execute(call).await
        } else {
            Err(anyhow::anyhow!("Runtime {} not found", runtime_id))
        }
    }
}
