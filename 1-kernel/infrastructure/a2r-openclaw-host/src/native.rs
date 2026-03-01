//! Native A2R Implementations for Strangler Components
//!
//! This module provides the native A2R implementations that strangler components
//! delegate to during DualRun and Graduate phases.
//!
//! Phase 2 (Control Plane Native): These implementations replace OpenClaw calls
//! with native A2R kernel services.

use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;

use a2r_parity::strangler::{ComponentInput, ComponentOutput, OutputMetadata};

/// Native skill registry implementation
pub struct NativeSkillRegistry {
    // This would be a reference to the actual a2rchitech-skills crate
    // For now, we'll implement the interface
    storage: Arc<dyn SkillStorage>,
}

impl std::fmt::Debug for NativeSkillRegistry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NativeSkillRegistry")
            .field("storage", &"<dyn SkillStorage>")
            .finish()
    }
}

impl Clone for NativeSkillRegistry {
    fn clone(&self) -> Self {
        Self {
            storage: Arc::clone(&self.storage),
        }
    }
}

/// Storage trait for skills
#[async_trait]
pub trait SkillStorage: Send + Sync {
    async fn list_skills(&self) -> anyhow::Result<Vec<SkillSummary>>;
    async fn get_skill(&self, id: &str) -> anyhow::Result<Option<SkillDetail>>;
    async fn install_skill(&self, manifest: &SkillManifest) -> anyhow::Result<()>;
    async fn uninstall_skill(&self, id: &str) -> anyhow::Result<()>;
    async fn execute_skill(&self, id: &str, input: Value) -> anyhow::Result<Value>;
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SkillSummary {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub installed: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SkillDetail {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub license: String,
    pub permissions: Vec<String>,
    pub config_schema: Value,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SkillManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub source: String,
}

impl NativeSkillRegistry {
    pub fn new(storage: Arc<dyn SkillStorage>) -> Self {
        Self { storage }
    }

    pub async fn list_skills(&self, _input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let skills = self.storage.list_skills().await?;

        Ok(ComponentOutput {
            data: serde_json::json!({
                "skills": skills,
                "count": skills.len(),
            }),
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }

    pub async fn get_skill(&self, input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let id = input
            .data
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing skill id"))?;

        let skill = self.storage.get_skill(id).await?;

        Ok(ComponentOutput {
            data: serde_json::json!({
                "skill": skill,
                "found": skill.is_some(),
            }),
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: skill.is_some(),
                error: if skill.is_none() {
                    Some(format!("Skill not found: {}", id))
                } else {
                    None
                },
            },
        })
    }

    pub async fn execute_skill(&self, input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let id = input
            .data
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing skill id"))?;

        let skill_input = input
            .data
            .get("input")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({}));

        let result = self.storage.execute_skill(id, skill_input).await?;

        Ok(ComponentOutput {
            data: result,
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }
}

/// Native session manager implementation
pub struct NativeSessionManager {
    storage: Arc<dyn SessionStorage>,
}

impl std::fmt::Debug for NativeSessionManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NativeSessionManager")
            .field("storage", &"<dyn SessionStorage>")
            .finish()
    }
}

impl Clone for NativeSessionManager {
    fn clone(&self) -> Self {
        Self {
            storage: Arc::clone(&self.storage),
        }
    }
}

/// Storage trait for sessions
#[async_trait]
pub trait SessionStorage: Send + Sync {
    async fn list_sessions(&self) -> anyhow::Result<Vec<SessionSummary>>;
    async fn get_session(&self, id: &str) -> anyhow::Result<Option<SessionDetail>>;
    async fn create_session(&self, config: &SessionConfig) -> anyhow::Result<String>;
    async fn delete_session(&self, id: &str) -> anyhow::Result<()>;
    async fn export_session(&self, id: &str) -> anyhow::Result<Value>;
    async fn import_session(&self, data: Value) -> anyhow::Result<String>;
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SessionSummary {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub message_count: usize,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SessionDetail {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub messages: Vec<Message>,
    pub metadata: Value,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SessionConfig {
    pub name: String,
    pub metadata: Value,
}

impl NativeSessionManager {
    pub fn new(storage: Arc<dyn SessionStorage>) -> Self {
        Self { storage }
    }

    pub async fn list_sessions(&self, _input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let sessions = self.storage.list_sessions().await?;

        Ok(ComponentOutput {
            data: serde_json::json!({
                "sessions": sessions,
                "count": sessions.len(),
            }),
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }

    pub async fn get_session(&self, input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let id = input
            .data
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing session id"))?;

        let session = self.storage.get_session(id).await?;

        Ok(ComponentOutput {
            data: serde_json::json!({
                "session": session,
                "found": session.is_some(),
            }),
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: session.is_some(),
                error: if session.is_none() {
                    Some(format!("Session not found: {}", id))
                } else {
                    None
                },
            },
        })
    }

    pub async fn create_session(&self, input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let name = input
            .data
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("New Session");

        let metadata = input
            .data
            .get("metadata")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({}));

        let config = SessionConfig {
            name: name.to_string(),
            metadata,
        };

        let id = self.storage.create_session(&config).await?;

        Ok(ComponentOutput {
            data: serde_json::json!({
                "id": id,
                "name": name,
                "created": true,
            }),
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }

    pub async fn export_session(&self, input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let id = input
            .data
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing session id"))?;

        let data = self.storage.export_session(id).await?;

        Ok(ComponentOutput {
            data,
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }

    pub async fn import_session(&self, input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let data = input
            .data
            .get("data")
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Missing session data"))?;

        let id = self.storage.import_session(data).await?;

        Ok(ComponentOutput {
            data: serde_json::json!({
                "id": id,
                "imported": true,
            }),
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }
}

/// Native gateway bridge implementation
pub struct NativeGatewayBridge {
    gateway: Arc<dyn Gateway>,
}

impl std::fmt::Debug for NativeGatewayBridge {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NativeGatewayBridge")
            .field("gateway", &"<dyn Gateway>")
            .finish()
    }
}

impl Clone for NativeGatewayBridge {
    fn clone(&self) -> Self {
        Self {
            gateway: Arc::clone(&self.gateway),
        }
    }
}

/// Gateway trait
#[async_trait]
pub trait Gateway: Send + Sync {
    async fn get_status(&self) -> anyhow::Result<GatewayStatus>;
    async fn connect(&self, config: &ConnectionConfig) -> anyhow::Result<()>;
    async fn disconnect(&self) -> anyhow::Result<()>;
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GatewayStatus {
    pub connected: bool,
    pub connection_type: Option<String>,
    pub uptime_seconds: Option<u64>,
    pub health: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConnectionConfig {
    pub connection_type: String,
    pub params: Value,
}

impl NativeGatewayBridge {
    pub fn new(gateway: Arc<dyn Gateway>) -> Self {
        Self { gateway }
    }

    pub async fn get_status(&self, _input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let status = self.gateway.get_status().await?;

        Ok(ComponentOutput {
            data: serde_json::to_value(&status)?,
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }

    pub async fn connect(&self, input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let connection_type = input
            .data
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("local");

        let params = input
            .data
            .get("params")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({}));

        let config = ConnectionConfig {
            connection_type: connection_type.to_string(),
            params,
        };

        self.gateway.connect(&config).await?;

        Ok(ComponentOutput {
            data: serde_json::json!({
                "connected": true,
                "type": connection_type,
            }),
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }

    pub async fn disconnect(&self, _input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        self.gateway.disconnect().await?;

        Ok(ComponentOutput {
            data: serde_json::json!({
                "connected": false,
            }),
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }
}

/// Native provider router implementation
pub struct NativeProviderRouter {
    router: Arc<dyn ProviderRouter>,
}

impl std::fmt::Debug for NativeProviderRouter {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NativeProviderRouter")
            .field("router", &"<dyn ProviderRouter>")
            .finish()
    }
}

impl Clone for NativeProviderRouter {
    fn clone(&self) -> Self {
        Self {
            router: Arc::clone(&self.router),
        }
    }
}

/// Provider router trait
#[async_trait]
pub trait ProviderRouter: Send + Sync {
    async fn list_providers(&self) -> anyhow::Result<Vec<ProviderInfo>>;
    async fn get_provider(&self, id: &str) -> anyhow::Result<Option<ProviderInfo>>;
    async fn select_provider(&self, request: &RoutingRequest) -> anyhow::Result<String>;
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub models: Vec<String>,
    pub healthy: bool,
    pub latency_ms: Option<u64>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RoutingRequest {
    pub model: Option<String>,
    pub capabilities: Vec<String>,
    pub priority: String, // latency, cost, quality
}

impl NativeProviderRouter {
    pub fn new(router: Arc<dyn ProviderRouter>) -> Self {
        Self { router }
    }

    pub async fn list_providers(&self, _input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let providers = self.router.list_providers().await?;

        Ok(ComponentOutput {
            data: serde_json::json!({
                "providers": providers,
                "count": providers.len(),
            }),
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }

    pub async fn select_provider(&self, input: &ComponentInput) -> anyhow::Result<ComponentOutput> {
        let start = std::time::Instant::now();

        let model = input
            .data
            .get("model")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let capabilities = input
            .data
            .get("capabilities")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        let priority = input
            .data
            .get("priority")
            .and_then(|v| v.as_str())
            .unwrap_or("quality")
            .to_string();

        let request = RoutingRequest {
            model,
            capabilities,
            priority,
        };

        let provider_id = self.router.select_provider(&request).await?;

        Ok(ComponentOutput {
            data: serde_json::json!({
                "provider_id": provider_id,
            }),
            metadata: OutputMetadata {
                duration_ms: start.elapsed().as_millis() as u64,
                success: true,
                error: None,
            },
        })
    }
}

/// Factory for creating native implementations
pub struct NativeImplementationFactory;

impl NativeImplementationFactory {
    /// Create native skill registry with in-memory storage (for testing)
    pub fn create_skill_registry() -> NativeSkillRegistry {
        use std::collections::HashMap;
        use tokio::sync::RwLock;

        struct InMemorySkillStorage {
            skills: RwLock<HashMap<String, SkillDetail>>,
        }

        #[async_trait]
        impl SkillStorage for InMemorySkillStorage {
            async fn list_skills(&self) -> anyhow::Result<Vec<SkillSummary>> {
                let skills = self.skills.read().await;
                Ok(skills
                    .values()
                    .map(|s| SkillSummary {
                        id: s.id.clone(),
                        name: s.name.clone(),
                        version: "1.0.0".to_string(),
                        description: s.description.clone(),
                        installed: true,
                    })
                    .collect())
            }

            async fn get_skill(&self, id: &str) -> anyhow::Result<Option<SkillDetail>> {
                let skills = self.skills.read().await;
                Ok(skills.get(id).cloned())
            }

            async fn install_skill(&self, _manifest: &SkillManifest) -> anyhow::Result<()> {
                Ok(())
            }

            async fn uninstall_skill(&self, _id: &str) -> anyhow::Result<()> {
                Ok(())
            }

            async fn execute_skill(&self, id: &str, input: Value) -> anyhow::Result<Value> {
                Ok(serde_json::json!({
                    "skill_id": id,
                    "input": input,
                    "status": "executed",
                }))
            }
        }

        let storage = Arc::new(InMemorySkillStorage {
            skills: RwLock::new(HashMap::new()),
        });

        NativeSkillRegistry::new(storage)
    }

    /// Create native session manager with in-memory storage (for testing)
    pub fn create_session_manager() -> NativeSessionManager {
        use std::collections::HashMap;
        use tokio::sync::RwLock;

        struct InMemorySessionStorage {
            sessions: RwLock<HashMap<String, SessionDetail>>,
        }

        #[async_trait]
        impl SessionStorage for InMemorySessionStorage {
            async fn list_sessions(&self) -> anyhow::Result<Vec<SessionSummary>> {
                let sessions = self.sessions.read().await;
                Ok(sessions
                    .values()
                    .map(|s| SessionSummary {
                        id: s.id.clone(),
                        name: s.name.clone(),
                        created_at: s.created_at,
                        message_count: s.messages.len(),
                    })
                    .collect())
            }

            async fn get_session(&self, id: &str) -> anyhow::Result<Option<SessionDetail>> {
                let sessions = self.sessions.read().await;
                Ok(sessions.get(id).cloned())
            }

            async fn create_session(&self, config: &SessionConfig) -> anyhow::Result<String> {
                let mut sessions = self.sessions.write().await;
                let id = uuid::Uuid::new_v4().to_string();
                let session = SessionDetail {
                    id: id.clone(),
                    name: config.name.clone(),
                    created_at: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)?
                        .as_secs() as i64,
                    messages: vec![],
                    metadata: config.metadata.clone(),
                };
                sessions.insert(id.clone(), session);
                Ok(id)
            }

            async fn delete_session(&self, id: &str) -> anyhow::Result<()> {
                let mut sessions = self.sessions.write().await;
                sessions.remove(id);
                Ok(())
            }

            async fn export_session(&self, id: &str) -> anyhow::Result<Value> {
                let sessions = self.sessions.read().await;
                let session = sessions
                    .get(id)
                    .ok_or_else(|| anyhow::anyhow!("Session not found"))?;
                Ok(serde_json::to_value(session)?)
            }

            async fn import_session(&self, data: Value) -> anyhow::Result<String> {
                let mut sessions = self.sessions.write().await;
                let id = uuid::Uuid::new_v4().to_string();
                let mut session: SessionDetail = serde_json::from_value(data)?;
                session.id = id.clone();
                sessions.insert(id.clone(), session);
                Ok(id)
            }
        }

        let storage = Arc::new(InMemorySessionStorage {
            sessions: RwLock::new(HashMap::new()),
        });

        NativeSessionManager::new(storage)
    }

    /// Create native gateway bridge
    pub fn create_gateway_bridge() -> NativeGatewayBridge {
        struct InMemoryGateway;

        #[async_trait]
        impl Gateway for InMemoryGateway {
            async fn get_status(&self) -> anyhow::Result<GatewayStatus> {
                Ok(GatewayStatus {
                    connected: true,
                    connection_type: Some("local".to_string()),
                    uptime_seconds: Some(3600),
                    health: "healthy".to_string(),
                })
            }

            async fn connect(&self, _config: &ConnectionConfig) -> anyhow::Result<()> {
                Ok(())
            }

            async fn disconnect(&self) -> anyhow::Result<()> {
                Ok(())
            }
        }

        NativeGatewayBridge::new(Arc::new(InMemoryGateway))
    }

    /// Create native provider router
    pub fn create_provider_router() -> NativeProviderRouter {
        struct InMemoryProviderRouter;

        #[async_trait]
        impl ProviderRouter for InMemoryProviderRouter {
            async fn list_providers(&self) -> anyhow::Result<Vec<ProviderInfo>> {
                Ok(vec![ProviderInfo {
                    id: "local".to_string(),
                    name: "Local Provider".to_string(),
                    models: vec!["local-model".to_string()],
                    healthy: true,
                    latency_ms: Some(10),
                }])
            }

            async fn get_provider(&self, _id: &str) -> anyhow::Result<Option<ProviderInfo>> {
                Ok(Some(ProviderInfo {
                    id: "local".to_string(),
                    name: "Local Provider".to_string(),
                    models: vec!["local-model".to_string()],
                    healthy: true,
                    latency_ms: Some(10),
                }))
            }

            async fn select_provider(&self, _request: &RoutingRequest) -> anyhow::Result<String> {
                Ok("local".to_string())
            }
        }

        NativeProviderRouter::new(Arc::new(InMemoryProviderRouter))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_native_skill_registry() {
        let registry = NativeImplementationFactory::create_skill_registry();

        let input = ComponentInput {
            data: serde_json::json!({}),
            context: serde_json::json!({}),
        };

        let result = registry.list_skills(&input).await;
        assert!(result.is_ok());

        let result = result.unwrap();
        assert!(result.metadata.success);
    }

    #[tokio::test]
    async fn test_native_session_manager() {
        let manager = NativeImplementationFactory::create_session_manager();

        let input = ComponentInput {
            data: serde_json::json!({
                "name": "Test Session",
            }),
            context: serde_json::json!({}),
        };

        let result = manager.create_session(&input).await;
        assert!(result.is_ok());

        let result = result.unwrap();
        assert!(result.metadata.success);
        assert!(result.data.get("id").is_some());
    }

    #[tokio::test]
    async fn test_native_gateway_bridge() {
        let bridge = NativeImplementationFactory::create_gateway_bridge();

        let input = ComponentInput {
            data: serde_json::json!({}),
            context: serde_json::json!({}),
        };

        let result = bridge.get_status(&input).await;
        assert!(result.is_ok());

        let result = result.unwrap();
        assert!(result.metadata.success);
    }

    #[tokio::test]
    async fn test_native_provider_router() {
        let router = NativeImplementationFactory::create_provider_router();

        let input = ComponentInput {
            data: serde_json::json!({}),
            context: serde_json::json!({}),
        };

        let result = router.list_providers(&input).await;
        assert!(result.is_ok());

        let result = result.unwrap();
        assert!(result.metadata.success);
    }
}
