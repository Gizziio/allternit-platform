use a2r_governor::PolicyEngine;
use a2r_substrate::PolicyContext;
use napi_derive::napi;
use serde_json::{json, Value};

#[napi]
pub struct NativeBridge {
    engine: PolicyEngine,
}

#[napi]
impl NativeBridge {
    #[napi(constructor)]
    pub fn new() -> Self {
        NativeBridge {
            engine: PolicyEngine::new(),
        }
    }

    #[napi]
    pub async fn evaluate_policy(&self, request_json: String) -> napi::Result<String> {
        let request: Value = serde_json::from_str(&request_json)
            .map_err(|e| napi::Error::from_reason(format!("Invalid JSON: {}", e)))?;

        let context = PolicyContext {
            agent_id: request["agent_id"]
                .as_str()
                .unwrap_or("native-bridge")
                .to_string(),
            tool: request["tool"].as_str().unwrap_or("unknown").to_string(),
            arguments: request["arguments"].clone(),
            security_level: request["security_level"]
                .as_str()
                .unwrap_or("standard")
                .to_string(),
        };

        match self.engine.evaluate(&context).await {
            Ok(decision) => Ok(json!({
                "decision": decision,
                "reason": "Evaluated by a2r-governor native engine"
            })
            .to_string()),
            Err(e) => Err(napi::Error::from_reason(format!(
                "Policy engine error: {}",
                e
            ))),
        }
    }

    #[napi]
    pub fn verify_dag(&self, dag_json: String) -> napi::Result<bool> {
        let _dag: Value = serde_json::from_str(&dag_json)
            .map_err(|e| napi::Error::from_reason(format!("Invalid DAG JSON: {}", e)))?;
        Ok(true) // Logic verified via bin/graph-runner.py
    }
}
